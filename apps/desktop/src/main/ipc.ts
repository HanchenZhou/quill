import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export type FileNode = {
  name: string
  path: string
  isDirectory: boolean
  isMarkdown: boolean
  children?: FileNode[]
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '__pycache__',
  'dist',
  'build',
  'target',
  '.next',
  '.cache',
  'out',
  'release'
])

const MD_EXT = new Set(['.md', '.markdown', '.mdown', '.mkd'])

async function scanDir(path: string): Promise<FileNode[]> {
  const entries = await fs.readdir(path, { withFileTypes: true })
  const nodes: FileNode[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue
    const childPath = join(path, entry.name)
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: childPath,
        isDirectory: true,
        isMarkdown: false,
        children: await scanDir(childPath)
      })
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase()
      nodes.push({
        name: entry.name,
        path: childPath,
        isDirectory: false,
        isMarkdown: MD_EXT.has(ext)
      })
    }
  }
  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return nodes
}

export function registerIpc(): void {
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:saveFile', async (_evt, defaultName?: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName ?? 'untitled.md',
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }
      ]
    })
    return result.canceled || !result.filePath ? null : result.filePath
  })

  ipcMain.handle('fs:readFile', async (_evt, path: string) => {
    return await fs.readFile(path, 'utf-8')
  })

  ipcMain.handle('fs:writeFile', async (_evt, path: string, content: string) => {
    await fs.writeFile(path, content, 'utf-8')
  })

  ipcMain.handle('fs:listDir', async (_evt, rootPath: string) => {
    return await scanDir(rootPath)
  })

  ipcMain.handle('fs:stat', async (_evt, path: string) => {
    const s = await fs.stat(path)
    return {
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      size: s.size,
      mtime: s.mtimeMs
    }
  })

  ipcMain.handle(
    'export:pdf',
    async (_evt, args: { html: string; defaultName: string }) => {
      const { html, defaultName } = args

      const saveResult = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (saveResult.canceled || !saveResult.filePath) return null

      const targetPath = saveResult.filePath
      const tmpHtml = join(tmpdir(), `quill-export-${randomUUID()}.html`)
      await fs.writeFile(tmpHtml, html, 'utf-8')

      const win = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          javascript: false
        }
      })

      try {
        await win.loadFile(tmpHtml)
        // Give the layout engine a tick for fonts / late paints.
        await new Promise<void>((r) => setTimeout(r, 150))
        const pdf = await win.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
          margins: { marginType: 'default' }
        })
        await fs.writeFile(targetPath, pdf)
        return targetPath
      } finally {
        win.destroy()
        fs.unlink(tmpHtml).catch(() => {})
      }
    }
  )
}
