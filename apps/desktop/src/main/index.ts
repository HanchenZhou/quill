import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'

const isDev = !!process.env.ELECTRON_RENDERER_URL

let mainWindow: BrowserWindow | null = null
const pendingOpenFiles: string[] = []

function flushPendingOpenFiles(): void {
  if (!mainWindow) return
  while (pendingOpenFiles.length) {
    const p = pendingOpenFiles.shift()!
    mainWindow.webContents.send('quill:open-file', p)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('did-finish-load', () => {
    flushPendingOpenFiles()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.on('open-file', (event, path) => {
  event.preventDefault()
  pendingOpenFiles.push(path)

  // Cold start: app.whenReady() will call createWindow() and the queue flushes
  // on did-finish-load.
  if (!app.isReady()) return

  // Window was closed but app is still running (macOS dock behaviour). Spin a
  // new window; its did-finish-load will drain the queue.
  if (!mainWindow) {
    createWindow()
    return
  }

  // Window exists but renderer hasn't loaded yet — same flush path covers it.
  if (mainWindow.webContents.isLoading()) return

  flushPendingOpenFiles()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.whenReady().then(() => {
  registerIpc()
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
