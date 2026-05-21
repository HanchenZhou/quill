import type { FileNode, MenuCommand } from '../types'

export const ipc = {
  openFolderDialog: (): Promise<string | null> => window.quill.dialog.openFolder(),
  openFileDialog: (): Promise<string | null> => window.quill.dialog.openFile(),
  saveFileDialog: (defaultName?: string): Promise<string | null> =>
    window.quill.dialog.saveFile(defaultName),
  readFile: (path: string): Promise<string> => window.quill.fs.readFile(path),
  writeFile: (path: string, content: string): Promise<void> =>
    window.quill.fs.writeFile(path, content),
  listDir: (path: string): Promise<FileNode[]> => window.quill.fs.listDir(path),
  onOpenFile: (cb: (path: string) => void): (() => void) =>
    window.quill.events.onOpenFile(cb),
  onMenu: (cb: (cmd: MenuCommand) => void): (() => void) =>
    window.quill.events.onMenuCommand(cb),
  exportPdf: (args: { html: string; defaultName: string }): Promise<string | null> =>
    window.quill.exportPdf(args)
}
