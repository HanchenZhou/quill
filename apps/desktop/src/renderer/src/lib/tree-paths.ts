/**
 * Path / name helpers for the file-tree CRUD UI. Validation lives here
 * (not in the components) so it has the same shape across local + remote
 * vaults — they both surface tree paths joined with `/`.
 */

export type NameValidation =
  | { ok: true; name: string }
  | { ok: false; error: string }

/** Validate a user-supplied file or folder name from the inline tree input. */
export function validateNewEntryName(raw: string): NameValidation {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: '名称不能为空' }
  if (/[/\\]/.test(trimmed)) return { ok: false, error: '名称不能包含 / 或 \\' }
  if (trimmed === '.' || trimmed === '..') return { ok: false, error: '保留名称不可用' }
  return { ok: true, name: trimmed }
}

/**
 * Join a parent tree-path with a child name.
 * Empty parent → just the name (remote vault root).
 * Trailing `/` or `\` on the parent is stripped before joining.
 */
export function joinTreePath(parent: string, name: string): string {
  if (!parent) return name
  return `${parent.replace(/[/\\]+$/, '')}/${name}`
}
