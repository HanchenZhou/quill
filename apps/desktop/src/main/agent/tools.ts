import { tool } from 'ai'
import { z } from 'zod'
import { promises as fs } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import type { Dirent } from 'node:fs'
import { inScope, type Scope } from './scope'
import type { ApprovalPayload, ApprovalResponse } from './approvals'

export type ApprovalRequester = (
  toolCallId: string,
  payload: ApprovalPayload
) => Promise<ApprovalResponse>

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

export function makeTools(scope: Scope, requestApproval: ApprovalRequester) {
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
    }),

    write_file: tool({
      description:
        'Replace the entire contents of a file inside scope. Use this for big rewrites; prefer apply_edit for small substring changes to save tokens. The user must approve each call before disk is touched.',
      inputSchema: z.object({
        path: z.string().describe('Absolute or scope-relative path'),
        content: z.string().describe('New full file content')
      }),
      execute: async ({ path, content }, { toolCallId }) => {
        let abs: string
        try {
          abs = resolveInScope(scope, path)
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) }
        }
        const decision = await requestApproval(toolCallId, {
          kind: 'write_file',
          path: abs,
          content
        })
        if (!decision.approved) {
          return { ok: false, error: decision.reason ?? 'user denied' }
        }
        try {
          await fs.mkdir(dirname(abs), { recursive: true })
          await fs.writeFile(abs, content, 'utf-8')
          return { ok: true, path: abs }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) }
        }
      }
    }),

    apply_edit: tool({
      description:
        'Replace one occurrence of an exact substring inside a file. `old_text` must match a unique span (verbatim, including whitespace). Errors if old_text is missing or appears more than once — in that case widen old_text with surrounding context until unique. The user must approve before disk is touched.',
      inputSchema: z.object({
        path: z.string().describe('Absolute or scope-relative path'),
        old_text: z.string().min(1).describe('Exact substring to find (must be unique)'),
        new_text: z.string().describe('Replacement text')
      }),
      execute: async ({ path, old_text, new_text }, { toolCallId }) => {
        let abs: string
        try {
          abs = resolveInScope(scope, path)
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) }
        }
        let current: string
        try {
          current = await fs.readFile(abs, 'utf-8')
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) }
        }
        const first = current.indexOf(old_text)
        if (first === -1) {
          return { ok: false, error: 'old_text not found in file' }
        }
        const second = current.indexOf(old_text, first + 1)
        if (second !== -1) {
          return {
            ok: false,
            error: 'old_text matches multiple locations; widen it with surrounding context to be unique'
          }
        }
        const next = current.slice(0, first) + new_text + current.slice(first + old_text.length)
        const decision = await requestApproval(toolCallId, {
          kind: 'apply_edit',
          path: abs,
          old_text,
          new_text
        })
        if (!decision.approved) {
          return { ok: false, error: decision.reason ?? 'user denied' }
        }
        try {
          await fs.writeFile(abs, next, 'utf-8')
          return { ok: true, path: abs }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) }
        }
      }
    }),

    create_file: tool({
      description:
        'Create a new file inside scope. Errors if the file already exists — use write_file or apply_edit instead. Intermediate directories are created as needed. The user must approve before disk is touched.',
      inputSchema: z.object({
        path: z.string().describe('Absolute or scope-relative path to the new file'),
        content: z.string().describe('Initial file content')
      }),
      execute: async ({ path, content }, { toolCallId }) => {
        let abs: string
        try {
          abs = resolveInScope(scope, path)
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) }
        }
        // Pre-check existence so we never ask the user to approve a doomed call.
        const exists = await fs
          .stat(abs)
          .then(() => true)
          .catch(() => false)
        if (exists) {
          return { ok: false, error: `file already exists: ${abs}` }
        }
        const decision = await requestApproval(toolCallId, {
          kind: 'create_file',
          path: abs,
          content
        })
        if (!decision.approved) {
          return { ok: false, error: decision.reason ?? 'user denied' }
        }
        try {
          await fs.mkdir(dirname(abs), { recursive: true })
          // 'wx' = fail if exists. Belt-and-suspenders against a race.
          await fs.writeFile(abs, content, { encoding: 'utf-8', flag: 'wx' })
          return { ok: true, path: abs }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) }
        }
      }
    })
  }
}

export type AgentTools = ReturnType<typeof makeTools>
