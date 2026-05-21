import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode
} from 'react'
import type { FileNode, ViewMode } from '../types'
import { ipc } from '../lib/ipc'
import { addRecent } from '../lib/recent'

type Workspace = {
  rootPath: string
  rootName: string
  tree: FileNode[]
}

type CurrentFile = {
  path: string | null // null = untitled (new file, not yet saved)
  content: string // last-saved content on disk
  buffer: string // editor buffer (may differ from content)
}

type State = {
  workspace: Workspace | null
  currentFile: CurrentFile | null
  viewMode: ViewMode
  sidebarCollapsed: boolean
  outlineVisible: boolean
  saving: boolean
}

const OUTLINE_KEY = 'quill:outlineVisible'

function readInitialOutlineVisible(): boolean {
  try {
    return localStorage.getItem(OUTLINE_KEY) === '1'
  } catch {
    return false
  }
}

type Action =
  | { type: 'OPEN_WORKSPACE'; rootPath: string; rootName: string; tree: FileNode[] }
  | { type: 'CLOSE_WORKSPACE' }
  | { type: 'OPEN_FILE'; path: string; content: string }
  | { type: 'NEW_FILE' }
  | { type: 'CLOSE_FILE' }
  | { type: 'SET_BUFFER'; buffer: string }
  | { type: 'BEGIN_SAVE' }
  | { type: 'END_SAVE'; path: string; content: string }
  | { type: 'SAVE_FAILED' }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_COLLAPSED'; collapsed: boolean }
  | { type: 'TOGGLE_OUTLINE' }
  | { type: 'SET_OUTLINE_VISIBLE'; visible: boolean }

const initialState: State = {
  workspace: null,
  currentFile: null,
  viewMode: 'split',
  sidebarCollapsed: false,
  outlineVisible: readInitialOutlineVisible(),
  saving: false
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'OPEN_WORKSPACE':
      return {
        ...s,
        workspace: { rootPath: a.rootPath, rootName: a.rootName, tree: a.tree },
        sidebarCollapsed: false
      }
    case 'CLOSE_WORKSPACE':
      return { ...initialState }
    case 'OPEN_FILE':
      return {
        ...s,
        currentFile: { path: a.path, content: a.content, buffer: a.content },
        viewMode: 'split'
      }
    case 'NEW_FILE':
      return {
        ...s,
        currentFile: { path: null, content: '', buffer: '' },
        viewMode: 'split'
      }
    case 'CLOSE_FILE':
      return { ...s, currentFile: null }
    case 'SET_BUFFER':
      return s.currentFile
        ? { ...s, currentFile: { ...s.currentFile, buffer: a.buffer } }
        : s
    case 'BEGIN_SAVE':
      return { ...s, saving: true }
    case 'END_SAVE':
      // Preserve the latest buffer (user may have typed more during async write).
      // Only path + content (last-saved snapshot) update.
      return {
        ...s,
        saving: false,
        currentFile: s.currentFile
          ? { ...s.currentFile, path: a.path, content: a.content }
          : null
      }
    case 'SAVE_FAILED':
      return { ...s, saving: false }
    case 'SET_VIEW_MODE':
      return { ...s, viewMode: a.mode }
    case 'TOGGLE_SIDEBAR':
      return { ...s, sidebarCollapsed: !s.sidebarCollapsed }
    case 'SET_SIDEBAR_COLLAPSED':
      return { ...s, sidebarCollapsed: a.collapsed }
    case 'TOGGLE_OUTLINE':
      return { ...s, outlineVisible: !s.outlineVisible }
    case 'SET_OUTLINE_VISIBLE':
      return { ...s, outlineVisible: a.visible }
  }
}

export type AppMode = 'empty' | 'workspace' | 'single'

export function deriveMode(s: State): AppMode {
  if (s.workspace) return 'workspace'
  if (s.currentFile) return 'single'
  return 'empty'
}

export function isDirty(s: State): boolean {
  return !!s.currentFile && s.currentFile.buffer !== s.currentFile.content
}

type Ctx = {
  state: State
  mode: AppMode
  dirty: boolean
  openFolder: () => Promise<void>
  openFile: () => Promise<void>
  openFolderAt: (path: string) => Promise<void>
  openFileAt: (path: string) => Promise<void>
  /** Open or new-file via user gesture — prompts for new-vs-current window
   *  when something is already open. */
  openPathWithPrompt: (target: {
    filePath?: string
    folderPath?: string
    newFile?: boolean
  }) => Promise<void>
  newFile: () => Promise<void>
  closeWorkspace: () => void
  setBuffer: (buffer: string) => void
  save: () => Promise<void>
  setViewMode: (m: ViewMode) => void
  toggleSidebar: () => void
  toggleOutline: () => void
}

const AppContext = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const stateRef = useRef(state)
  stateRef.current = state

  const openFolderAt = useCallback(async (rootPath: string) => {
    const tree = await ipc.listDir(rootPath)
    const rootName = rootPath.split(/[/\\]/).filter(Boolean).pop() ?? rootPath
    dispatch({ type: 'OPEN_WORKSPACE', rootPath, rootName, tree })
    addRecent({ type: 'folder', path: rootPath, name: rootName })
  }, [])

  const openFileAt = useCallback(async (path: string) => {
    const content = await ipc.readFile(path)
    dispatch({ type: 'OPEN_FILE', path, content })
    const name = path.split(/[/\\]/).pop() ?? path
    addRecent({ type: 'file', path, name })
  }, [])

  // Direct mutation of the current window's state — used by sidebar tree
  // clicks and by main-process-initiated initial actions (no prompt).
  const newFileInCurrent = useCallback(() => {
    dispatch({ type: 'NEW_FILE' })
  }, [])

  const openPathWithPrompt = useCallback(
    async (target: { filePath?: string; folderPath?: string; newFile?: boolean }) => {
      const cur = stateRef.current.currentFile
      // Empty state: just apply, no prompt.
      if (!cur) {
        if (target.filePath) return openFileAt(target.filePath)
        if (target.folderPath) return openFolderAt(target.folderPath)
        if (target.newFile) return newFileInCurrent()
        return
      }
      const candidateName = target.filePath
        ? (target.filePath.split(/[/\\]/).pop() ?? '文件')
        : target.folderPath
          ? (target.folderPath.split(/[/\\]/).pop() ?? '文件夹')
          : '未命名'
      const currentName = cur.path
        ? (cur.path.split(/[/\\]/).pop() ?? '未命名')
        : 'Untitled'
      const choice = await ipc.confirmOpenChoice({
        candidateName,
        currentName,
        dirty: isDirty(stateRef.current)
      })
      if (choice === 'cancel') return
      if (choice === 'new') {
        await ipc.openInNewWindow(target)
        return
      }
      // current
      if (target.filePath) await openFileAt(target.filePath)
      else if (target.folderPath) await openFolderAt(target.folderPath)
      else if (target.newFile) newFileInCurrent()
    },
    [openFileAt, openFolderAt, newFileInCurrent]
  )

  const openFolder = useCallback(async () => {
    const p = await ipc.openFolderDialog()
    if (p) await openPathWithPrompt({ folderPath: p })
  }, [openPathWithPrompt])

  const openFile = useCallback(async () => {
    const p = await ipc.openFileDialog()
    if (p) await openPathWithPrompt({ filePath: p })
  }, [openPathWithPrompt])

  const newFile = useCallback(async () => {
    await openPathWithPrompt({ newFile: true })
  }, [openPathWithPrompt])

  const closeWorkspace = useCallback(() => dispatch({ type: 'CLOSE_WORKSPACE' }), [])

  const setBuffer = useCallback((buffer: string) => {
    dispatch({ type: 'SET_BUFFER', buffer })
  }, [])

  const save = useCallback(async () => {
    const cur = stateRef.current.currentFile
    if (!cur) return
    // Nothing to save: already on disk and buffer matches.
    if (cur.path !== null && cur.buffer === cur.content) return

    let path = cur.path
    const isFirstSave = path === null
    if (isFirstSave) {
      path = await ipc.saveFileDialog('untitled.md')
      if (!path) return // user cancelled
    }

    // Snapshot the buffer at save time so we know what we wrote.
    const snapshot = cur.buffer
    dispatch({ type: 'BEGIN_SAVE' })
    try {
      await ipc.writeFile(path!, snapshot)
      dispatch({ type: 'END_SAVE', path: path!, content: snapshot })
      if (isFirstSave) {
        const name = path!.split(/[/\\]/).pop() ?? path!
        addRecent({ type: 'file', path: path!, name })
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('save failed', err)
      dispatch({ type: 'SAVE_FAILED' })
    }
  }, [])

  const setViewMode = useCallback((m: ViewMode) => dispatch({ type: 'SET_VIEW_MODE', mode: m }), [])
  const toggleSidebar = useCallback(() => dispatch({ type: 'TOGGLE_SIDEBAR' }), [])
  const toggleOutline = useCallback(() => dispatch({ type: 'TOGGLE_OUTLINE' }), [])

  // Persist outline visibility across sessions.
  useEffect(() => {
    try {
      localStorage.setItem(OUTLINE_KEY, state.outlineVisible ? '1' : '0')
    } catch {
      /* localStorage unavailable; silently skip */
    }
  }, [state.outlineVisible])

  // Wire native menu commands
  useEffect(() => {
    return ipc.onMenu((cmd) => {
      if (cmd === 'open-folder') void openFolder()
      else if (cmd === 'open-file') void openFile()
      else if (cmd === 'save') void save()
      else if (cmd === 'new-file') void newFile()
      else if (cmd === 'close-folder') closeWorkspace()
    })
  }, [openFolder, openFile, save, newFile, closeWorkspace])

  // Wire main → renderer open-file event (Finder "Open With" + new windows
  // bootstrapped by main with an `initial: open-file` action). The window
  // that receives this event was created for the file, so always apply
  // directly without prompting.
  useEffect(() => {
    return ipc.onOpenFile((path) => {
      void openFileAt(path)
    })
  }, [openFileAt])

  // Same for folder — fires when main creates a new window with an
  // `initial: open-folder` action.
  useEffect(() => {
    return ipc.onOpenFolder((path) => {
      void openFolderAt(path)
    })
  }, [openFolderAt])

  const value = useMemo<Ctx>(
    () => ({
      state,
      mode: deriveMode(state),
      dirty: isDirty(state),
      openFolder,
      openFile,
      openFolderAt,
      openFileAt,
      openPathWithPrompt,
      newFile,
      closeWorkspace,
      setBuffer,
      save,
      setViewMode,
      toggleSidebar,
      toggleOutline
    }),
    [
      state,
      openFolder,
      openFile,
      openFolderAt,
      openFileAt,
      openPathWithPrompt,
      newFile,
      closeWorkspace,
      setBuffer,
      save,
      setViewMode,
      toggleSidebar,
      toggleOutline
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
