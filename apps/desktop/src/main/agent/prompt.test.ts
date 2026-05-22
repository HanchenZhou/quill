import { describe, expect, it } from 'bun:test'
import { buildSystemPrompt } from './prompt'
import type { Scope } from './scope'

describe('buildSystemPrompt', () => {
  it('workspace mode mentions root path and full tool set', () => {
    const scope: Scope = { kind: 'workspace', root: '/work/notes' }
    const p = buildSystemPrompt(scope)
    expect(p).toContain('workspace mode')
    expect(p).toContain('/work/notes')
    expect(p).toContain('read_file')
    expect(p).toContain('list_dir')
    expect(p).toContain('search_in_scope')
    expect(p).toContain('grep')
    expect(p).toContain('rejected by the runtime')
  })

  it('single-file mode pins the exact file path', () => {
    const scope: Scope = { kind: 'single-file', path: '/work/notes/x.md' }
    const p = buildSystemPrompt(scope)
    expect(p).toContain('single-file mode')
    expect(p).toContain('/work/notes/x.md')
    expect(p).toContain('only the file above')
  })

  it('untitled mode declares no file system access', () => {
    const scope: Scope = { kind: 'untitled' }
    const p = buildSystemPrompt(scope)
    expect(p).toContain('untitled')
    expect(p).toContain('No file system access')
    expect(p).toContain('text only')
  })

  it('injects current buffer when provided', () => {
    const scope: Scope = { kind: 'single-file', path: '/x.md' }
    const buffer = '# Hello\nworld'
    const p = buildSystemPrompt(scope, buffer)
    expect(p).toContain('Currently open file content')
    expect(p).toContain('# Hello')
  })

  it('truncates buffers over 4000 chars and marks them truncated', () => {
    const scope: Scope = { kind: 'workspace', root: '/r' }
    const huge = 'a'.repeat(5000)
    const p = buildSystemPrompt(scope, huge)
    expect(p).toContain('(truncated)')
    expect(p).toContain('[truncated]')
    expect(p.length).toBeLessThan(huge.length + 1000)
  })

  it('injects selection when provided', () => {
    const scope: Scope = { kind: 'workspace', root: '/r' }
    const p = buildSystemPrompt(scope, undefined, 'this paragraph')
    expect(p).toContain("User's selection")
    expect(p).toContain('this paragraph')
  })

  it('omits buffer and selection sections when neither is given', () => {
    const scope: Scope = { kind: 'workspace', root: '/r' }
    const p = buildSystemPrompt(scope)
    expect(p).not.toContain('Currently open file content')
    expect(p).not.toContain("User's selection")
  })

  it('always reminds the agent to respond in the user language', () => {
    const scope: Scope = { kind: 'workspace', root: '/r' }
    const p = buildSystemPrompt(scope)
    expect(p).toContain('same language')
  })
})
