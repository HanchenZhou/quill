import { describe, expect, test } from 'bun:test'
import { FileWindowRouter, type FocusableWindow } from './file-window-router'

class FakeWindow implements FocusableWindow {
  destroyed = false
  minimized = true
  restored = false
  focused = false

  isDestroyed(): boolean {
    return this.destroyed
  }

  isMinimized(): boolean {
    return this.minimized
  }

  restore(): void {
    this.restored = true
    this.minimized = false
  }

  focus(): void {
    this.focused = true
  }
}

describe('FileWindowRouter', () => {
  test('reuses the window already showing the requested file', () => {
    const router = new FileWindowRouter<FakeWindow>()
    const existing = new FakeWindow()
    const duplicate = new FakeWindow()
    router.setFile(existing, '/notes/a.md')

    const result = router.open('/notes/a.md', () => duplicate)

    expect(result).toBe(existing)
    expect(existing.restored).toBe(true)
    expect(existing.focused).toBe(true)
  })

  test('creates a window when the requested file is not already open', () => {
    const router = new FileWindowRouter<FakeWindow>()
    const existing = new FakeWindow()
    const created = new FakeWindow()
    router.setFile(existing, '/notes/a.md')

    const result = router.open('/notes/b.md', () => created)

    expect(result).toBe(created)
    expect(existing.focused).toBe(false)
  })

  test('stops matching the previous file after a window switches files', () => {
    const router = new FileWindowRouter<FakeWindow>()
    const existing = new FakeWindow()
    const created = new FakeWindow()
    router.setFile(existing, '/notes/a.md')
    router.setFile(existing, '/notes/b.md')

    const result = router.open('/notes/a.md', () => created)

    expect(result).toBe(created)
    expect(existing.focused).toBe(false)
  })
})
