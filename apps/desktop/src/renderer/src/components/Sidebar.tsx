import { PanelLeftClose, FolderOpen, X } from 'lucide-react'
import { useApp } from '../state/app'
import { FileTree } from './FileTree'

export function Sidebar() {
  const { state, dirty, toggleSidebar, openFileAt, openFolder, closeWorkspace } = useApp()
  if (!state.workspace) return null

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 flex flex-col">
      <div className="h-9 px-3 flex items-center gap-0.5 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
        <span
          className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate flex-1 mr-1"
          title={state.workspace.rootPath}
        >
          {state.workspace.rootName}
        </span>
        <button
          onClick={openFolder}
          className="no-drag p-1 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          title="打开其他文件夹"
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={closeWorkspace}
          className="no-drag p-1 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          title="关闭文件夹"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={toggleSidebar}
          className="no-drag p-1 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          title="折叠侧栏"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto py-1">
        <FileTree
          nodes={state.workspace.tree}
          currentPath={state.currentFile?.path ?? null}
          dirty={dirty}
          onSelect={(p) => void openFileAt(p)}
        />
      </div>
    </aside>
  )
}
