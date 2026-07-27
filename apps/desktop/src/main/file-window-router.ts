import { resolve } from 'node:path'

export interface FocusableWindow {
  isDestroyed(): boolean
  isMinimized(): boolean
  restore(): void
  focus(): void
}

export class FileWindowRouter<T extends FocusableWindow> {
  private readonly files = new Map<T, string>()

  setFile(win: T, path: string | null): void {
    if (path === null) {
      this.files.delete(win)
      return
    }
    this.files.set(win, resolve(path))
  }

  remove(win: T): void {
    this.files.delete(win)
  }

  open(path: string, create: () => T): T {
    const target = resolve(path)
    for (const [win, openPath] of this.files) {
      if (win.isDestroyed()) {
        this.files.delete(win)
        continue
      }
      if (openPath !== target) continue
      if (win.isMinimized()) win.restore()
      win.focus()
      return win
    }

    const win = create()
    this.setFile(win, path)
    return win
  }
}
