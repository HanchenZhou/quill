import { resolve, sep } from 'node:path'

/**
 * Where the agent is allowed to operate. Computed in renderer from the
 * current app state (workspace folder vs single open file vs untitled new
 * file) and passed to main on each agent run.
 */
export type Scope =
  | { kind: 'workspace'; root: string }
  | { kind: 'single-file'; path: string }
  | { kind: 'untitled' }

/**
 * Returns true if the given absolute path is allowed by the scope.
 *
 * - untitled: never allows any path (no file tools usable)
 * - single-file: only the exact file is allowed
 * - workspace: the root itself and any descendant; trailing slash on root
 *   is normalized; sibling paths whose name prefix-matches the root are
 *   NOT considered inside (uses platform separator to disambiguate)
 *
 * Path traversal via `..` is handled by node's `path.resolve`, which
 * collapses segments before comparison.
 */
export function inScope(scope: Scope, abs: string): boolean {
  if (scope.kind === 'untitled') return false
  const target = resolve(abs)
  if (scope.kind === 'single-file') {
    return target === resolve(scope.path)
  }
  const root = resolve(scope.root)
  return target === root || target.startsWith(root + sep)
}
