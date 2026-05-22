import { describe, expect, it } from 'bun:test'
import { inScope, type Scope } from './scope'

describe('inScope', () => {
  describe('untitled', () => {
    const scope: Scope = { kind: 'untitled' }

    it('always returns false (no file scope)', () => {
      expect(inScope(scope, '/anything')).toBe(false)
      expect(inScope(scope, '/')).toBe(false)
    })
  })

  describe('single-file', () => {
    const scope: Scope = { kind: 'single-file', path: '/work/notes/x.md' }

    it('allows exact match', () => {
      expect(inScope(scope, '/work/notes/x.md')).toBe(true)
    })

    it('rejects sibling files', () => {
      expect(inScope(scope, '/work/notes/y.md')).toBe(false)
    })

    it('rejects the parent directory', () => {
      expect(inScope(scope, '/work/notes')).toBe(false)
    })

    it('rejects path traversal via ..', () => {
      expect(inScope(scope, '/work/notes/x.md/../../etc/passwd')).toBe(false)
    })
  })

  describe('workspace', () => {
    const scope: Scope = { kind: 'workspace', root: '/work/notes' }

    it('allows the root itself', () => {
      expect(inScope(scope, '/work/notes')).toBe(true)
    })

    it('allows direct children', () => {
      expect(inScope(scope, '/work/notes/x.md')).toBe(true)
    })

    it('allows nested files', () => {
      expect(inScope(scope, '/work/notes/daily/2026-05-22.md')).toBe(true)
    })

    it('rejects the parent', () => {
      expect(inScope(scope, '/work')).toBe(false)
    })

    it('rejects siblings', () => {
      expect(inScope(scope, '/work/other/file.md')).toBe(false)
    })

    it('rejects unrelated absolute paths', () => {
      expect(inScope(scope, '/etc/passwd')).toBe(false)
    })

    it('rejects path traversal escaping root', () => {
      expect(inScope(scope, '/work/notes/../etc/passwd')).toBe(false)
    })

    it('normalizes trailing slash on root', () => {
      const s: Scope = { kind: 'workspace', root: '/work/notes/' }
      expect(inScope(s, '/work/notes/x.md')).toBe(true)
    })

    it('rejects a sibling whose name prefix-matches root', () => {
      // /work/notes-other must NOT count as inside /work/notes
      expect(inScope(scope, '/work/notes-other/x.md')).toBe(false)
    })
  })
})
