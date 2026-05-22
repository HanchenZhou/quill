import { describe, expect, it } from 'bun:test'
import { reducer } from './app'

const baseFile = { path: '/r/a.md', content: 'old', buffer: 'old' }

describe('RELOAD_CURRENT_FILE', () => {
  it('replaces content and buffer when the path matches and buffer is clean', () => {
    const next = reducer(
      {
        workspace: null,
        currentFile: baseFile,
        viewMode: 'split',
        sidebarCollapsed: false,
        saving: false
      },
      { type: 'RELOAD_CURRENT_FILE', path: '/r/a.md', content: 'new' }
    )
    expect(next.currentFile?.content).toBe('new')
    expect(next.currentFile?.buffer).toBe('new')
  })

  it('updates content but preserves buffer when user has unsaved edits', () => {
    // The user typed some local changes before the agent wrote. We update
    // content (disk truth changed) but leave buffer intact so their work
    // isn't silently overwritten.
    const next = reducer(
      {
        workspace: null,
        currentFile: { path: '/r/a.md', content: 'old', buffer: 'old + user typing' },
        viewMode: 'split',
        sidebarCollapsed: false,
        saving: false
      },
      { type: 'RELOAD_CURRENT_FILE', path: '/r/a.md', content: 'new from agent' }
    )
    expect(next.currentFile?.content).toBe('new from agent')
    expect(next.currentFile?.buffer).toBe('old + user typing')
  })

  it('is a no-op when path does not match current file', () => {
    const before = {
      workspace: null,
      currentFile: baseFile,
      viewMode: 'split' as const,
      sidebarCollapsed: false,
      saving: false
    }
    const next = reducer(before, {
      type: 'RELOAD_CURRENT_FILE',
      path: '/r/other.md',
      content: 'whatever'
    })
    expect(next).toEqual(before)
  })

  it('is a no-op when no file is open', () => {
    const before = {
      workspace: null,
      currentFile: null,
      viewMode: 'split' as const,
      sidebarCollapsed: false,
      saving: false
    }
    const next = reducer(before, {
      type: 'RELOAD_CURRENT_FILE',
      path: '/r/a.md',
      content: 'whatever'
    })
    expect(next).toEqual(before)
  })
})
