import { app } from 'electron'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'
import { createWindow, windows } from './windows'

// Paths queued during cold start before app is ready — Finder sends `open-file`
// before `whenReady` fires. Drained in whenReady().
const pendingOpenAtStartup: string[] = []

// Finder "Open With" / drop-on-dock / double-click .md → always spawn a fresh
// window so the user's existing work isn't disturbed.
app.on('open-file', (event, path) => {
  event.preventDefault()
  if (!app.isReady()) {
    pendingOpenAtStartup.push(path)
    return
  }
  createWindow({ initial: { type: 'open-file', path } })
})

app.whenReady().then(() => {
  registerIpc()
  buildMenu()

  if (pendingOpenAtStartup.length > 0) {
    for (const path of pendingOpenAtStartup) {
      createWindow({ initial: { type: 'open-file', path } })
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
