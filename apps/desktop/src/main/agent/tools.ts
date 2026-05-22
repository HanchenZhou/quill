import { tool } from 'ai'
import { z } from 'zod'
import { promises as fs } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import type { Dirent } from 'node:fs'
import { inScope, type Scope } from './scope'

const MD_EXT = /\.(md|markdown|mdown|mkd)$/i
const MAX_RESULTS = 50
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '__pycache__',
  'dist',
  'build',
  'target',
  '.next',
  '.cache',
  'out',
  'release'
])

/**
 * Resolve a user-supplied path against the scope and verify it stays inside.
 * Throws a string error meant to be returned to the model as a tool error so
 * it can self-correct.
 */
function resolveInScope(scope: Scope, userPath: string): string {
  if (scope.kind === 'untitled') {
    throw new Error('untitled scope has no file system access')
  }
  const base = scope.kind === 'workspace' ? scope.root : dirname(scope.path)
  const abs = resolve(base, userPath)
  if (!inScope(scope, abs)) {
    throw new Error(`path "${userPath}" is outside the agent scope`)
  }
  return abs
}

/**
 * Walk all files in scope, depth-first. Hidden dirs and common ignore dirs
 * (node_modules, .git, etc.) are skipped. Stops early when cb signals stop
 * by returning true.
 */
async function walkScope(
  scope: Scope,
  cb: (filePath: string) => Promise<boolean | void>,
  rootOverride?: string
): Promise<void> {
  if (scope.kind === 'untitled') return
  if (scope.kind === 'single-file') {
    await cb(scope.path)
    return
  }
  const root = rootOverride ?? scope.root
  let stopped = false
  async function walk(dir: string): Promise<void> {
    if (stopped) return
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (stopped) return
      if (e.name.startsWith('.')) continue
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue
        await walk(join(dir, e.name))
      } else if (e.isFile()) {
        const stop = await cb(join(dir, e.name))
        if (stop) stopped = true
      }
    }
  }
  await walk(root)
}

export function makeTools(scope: Scope) {
  return {
    read_file: tool({
      description:
        'Read the full text content of a file inside the agent scope. Provide an absolute path (recommended) or one relative to the scope root.',
      inputSchema: z.object({
        path: z.string().describe('Absolute or scope-relative path to the file')
      }),
      execute: async ({ path }) => {
        try {
          const abs = resolveInScope(scope, path)
          const content = await fs.readFile(abs, 'utf-8')
          return { ok: true, path: abs, content }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) }
        }
      }
    }),

    list_dir: tool({
      description:
        'List entries (files and folders) in a directory inside scope. Omit `path` to list the scope root.',
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe('Directory to list. Defaults to scope root.')
      }),
      execute: async ({ path }) => {
        if (scope.kind === 'untitled') {
          return { ok: false, error: 'untitled scope has no file system access' }
        }
        try {
          const target = path
            ? resolveInScope(scope, path)
            : scope.kind === 'workspace'
              ? scope.root
              : dirname(scope.path)
          const entries = await fs.readdir(target, { withFileTypes: true })
          return {
            ok: true,
            path: target,
            entries: entries
              .filter((e) => !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
              .map((e) => ({
                name: e.name,
                type: e.isDirectory() ? ('dir' as const) : ('file' as const)
              }))
          }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) }
        }
      }
    }),

    search_in_scope: tool({
      description:
        'Case-insensitive substring search across all .md files in the scope. Returns matching file paths and line numbers. Capped at 50 results.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Substring to search for')
      }),
      execute: async ({ query }) => {
        if (scope.kind === 'untitled') {
          return { ok: false, error: 'untitled scope has no file system access' }
        }
        const needle = query.toLowerCase()
        const matches: Array<{ path: string; line: number; text: string }> = []
        await walkScope(scope, async (filePath) => {
          if (!MD_EXT.test(filePath)) return
          try {
            const content = await fs.readFile(filePath, 'utf-8')
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (matches.length >= MAX_RESULTS) return true
              if (lines[i].toLowerCase().includes(needle)) {
                matches.push({
                  path: filePath,
                  line: i + 1,
                  text: lines[i].trim().slice(0, 200)
                })
              }
            }
          } catch {
            /* skip unreadable file */
          }
          return false
        })
        return {
          ok: true,
          matches,
          truncated: matches.length >= MAX_RESULTS
        }
      }
    }),

    grep: tool({
      description:
        'Regex grep across files in scope (or a subset). Pattern is JS regex source without delimiters; case-insensitive. Optional `path` limits to a single file or subdirectory. Capped at 50 results.',
      inputSchema: z.object({
        pattern: z.string().min(1).describe('JS regex source, e.g. "TODO|FIXME"'),
        path: z
          .string()
          .optional()
          .describe('Optional file or subdirectory to limit search to')
      }),
      execute: async ({ pattern, path: userPath }) => {
        if (scope.kind === 'untitled') {
          return { ok: false, error: 'untitled scope has no file system access' }
        }
        let re: RegExp
        try {
          re = new RegExp(pattern, 'i')
        } catch (err) {
          return {
            ok: false,
            error: `invalid regex: ${err instanceof Error ? err.message : String(err)}`
          }
        }
        const matches: Array<{ path: string; line: number; text: string }> = []
        const processFile = async (filePath: string): Promise<boolean | void> => {
          try {
            const content = await fs.readFile(filePath, 'utf-8')
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (matches.length >= MAX_RESULTS) return true
              if (re.test(lines[i])) {
                matches.push({
                  path: filePath,
                  line: i + 1,
                  text: lines[i].trim().slice(0, 200)
                })
              }
            }
          } catch {
            /* skip */
          }
          return false
        }

        if (userPath) {
          let targetPath: string
          try {
            targetPath = resolveInScope(scope, userPath)
          } catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : String(err) }
          }
          const stat = await fs.stat(targetPath).catch(() => null)
          if (!stat) return { ok: false, error: 'path not found' }
          if (stat.isFile()) {
            await processFile(targetPath)
          } else {
            await walkScope(scope, processFile, targetPath)
          }
        } else {
          await walkScope(scope, processFile)
        }
        return {
          ok: true,
          matches,
          truncated: matches.length >= MAX_RESULTS
        }
      }
    })
  }
}

export type AgentTools = ReturnType<typeof makeTools>
