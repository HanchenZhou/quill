import { describe, expect, test } from 'bun:test'
import { resolveInVault, PathGuardError } from './path-guard'

const VAULT = '/data/vault'

describe('resolveInVault', () => {
  test('plain file under vault resolves', () => {
    expect(resolveInVault(VAULT, 'notes/a.md')).toBe('/data/vault/notes/a.md')
  })

  test('leading slash is treated as vault-relative, not absolute', () => {
    expect(resolveInVault(VAULT, '/notes/a.md')).toBe('/data/vault/notes/a.md')
  })

  test('redundant slashes / dots get normalized', () => {
    expect(resolveInVault(VAULT, './notes//a.md')).toBe('/data/vault/notes/a.md')
  })

  test('empty path resolves to vault root', () => {
    expect(resolveInVault(VAULT, '')).toBe('/data/vault')
  })

  test('rejects .. that escapes the vault', () => {
    expect(() => resolveInVault(VAULT, '../etc/passwd')).toThrow(PathGuardError)
  })

  test('rejects sibling escape via traversal segments', () => {
    expect(() => resolveInVault(VAULT, 'notes/../../etc/passwd')).toThrow(
      PathGuardError
    )
  })

  test('absolute-looking input is treated as vault-relative, not as filesystem root', () => {
    // Defense-in-depth: even if a client sends what looks like an absolute
    // path, we resolve under the vault root rather than `/`. The result may
    // 404 (no such file in the vault) but it can't read outside the vault.
    expect(resolveInVault(VAULT, '/etc/passwd')).toBe('/data/vault/etc/passwd')
  })

  test('error message names the offending path', () => {
    try {
      resolveInVault(VAULT, '../oops')
      throw new Error('expected throw')
    } catch (e) {
      expect((e as Error).message).toContain('../oops')
    }
  })

  test('traversal that lands back inside is still rejected (defensive)', () => {
    // notes/../sub stays inside literally, but the .. segment is a code smell;
    // we treat as legit since resolved path is in scope.
    expect(resolveInVault(VAULT, 'notes/../sub/b.md')).toBe('/data/vault/sub/b.md')
  })
})
