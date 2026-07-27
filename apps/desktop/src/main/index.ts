import { app } from 'electron'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'
import { createWindow, openFileWindow, windows } from './windows'

// Override the app name so dev builds don't show "@quill/desktop" in
// the macOS app menu / Dock / about dialog. `app.getName()` defaults to
// `package.json#name`, which is the workspace identifier — fine for npm
// resolution, ugly for UI. Production builds already get the right name
// via electron-builder.yml `productName: Quill`, but calling
// `setName` early here covers dev mode too (must run before whenReady
// so the menu builder picks it up).
app.setName('Quill')

// Paths queued during cold start before app is ready — Finder sends `open-file`
// before `whenReady` fires. Drained in whenReady().
const pendingOpenAtStartup: string[] = []

// Finder "Open With" / drop-on-dock / double-click .md → focus the window
// already showing that file, or create a new one for a different file.
app.on('open-file', (event, path) => {
  event.preventDefault()
  if (!app.isReady()) {
    pendingOpenAtStartup.push(path)
    return
  }
  openFileWindow(path)
})

app.whenReady().then(() => {
  registerIpc()
  buildMenu()

  if (pendingOpenAtStartup.length > 0) {
    for (const path of pendingOpenAtStartup) {
      openFileWindow(path)
    }
    pendingOpenAtStartup.length = 0
  } else {
    createWindow()
  }

  app.on('activate', () => {
    if (windows.size === 0) createWindow()
  })
})

// Quit on all platforms when the last window closes. Per project UX: a
// markdown editor that lingers in the dock with no windows is heavier than
// useful.
app.on('window-all-closed', () => {
  app.quit()
})
