// Mirror of types exported from src/preload/index.ts. Keep in sync.

export type FileNode = {
  name: string
  path: string
  isDirectory: boolean
  isMarkdown: boolean
  children?: FileNode[]
}

export type MenuCommand =
  | 'new-file'
  | 'open-file'
  | 'open-folder'
  | 'save'
  | 'close-folder'
  | 'export-pdf'

export type ViewMode = 'edit' | 'split' | 'preview'

export type ThemePref = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

export type RecentEntry = {
  type: 'folder' | 'file'
  path: string
  name: string
  openedAt: number
}
