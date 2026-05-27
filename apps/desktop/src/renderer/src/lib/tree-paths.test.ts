import { describe, expect, test } from 'bun:test'
import { joinTreePath, validateNewEntryName } from './tree-paths'

describe('validateNewEntryName', () => {
  test('accepts a plain name', () => {
    expect(validateNewEntryName('notes.md')).toEqual({ ok: true, name: 'notes.md' })
  })

  test('trims surrounding whitespace', () => {
    expect(validateNewEntryName('  draft.md  ')).toEqual({ ok: true, name: 'draft.md' })
  })

  test('rejects empty or whitespace-only', () => {
    expect(validateNewEntryName('')).toEqual({ ok: false, error: '名称不能为空' })
    expect(validateNewEntryName('   ')).toEqual({ ok: false, error: '名称不能为空' })
  })

  test('rejects names containing path separators', () => {
    expect(validateNewEntryName('a/b')).toEqual({
      ok: false,
      error: '名称不能包含 / 或 \\'
    })
    expect(validateNewEntryName('a\\b')).toEqual({
      ok: false,
      error: '名称不能包含 / 或 \\'
    })
  })

  test('rejects . and .. (reserved)', () => {
    expect(validateNewEntryName('.')).toEqual({ ok: false, error: '保留名称不可用' })
    expect(validateNewEntryName('..')).toEqual({ ok: false, error: '保留名称不可用' })
  })
})

describe('joinTreePath', () => {
  test('returns just the name when parent is empty (remote root)', () => {
    expect(joinTreePath('', 'a.md')).toBe('a.md')
  })

  test('joins parent + name with a single slash', () => {
    expect(joinTreePath('notes', 'a.md')).toBe('notes/a.md')
    expect(joinTreePath('/Users/x/vault/sub', 'new.md')).toBe('/Users/x/vault/sub/new.md')
  })

  test('strips a trailing / or \\ from parent before joining', () => {
    expect(joinTreePath('notes/', 'a.md')).toBe('notes/a.md')
    expect(joinTreePath('C:\\Users\\x\\', 'a.md')).toBe('C:\\Users\\x/a.md')
  })
})
