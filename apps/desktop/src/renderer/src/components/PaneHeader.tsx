import { PanelLeftOpen } from 'lucide-react'
import { useApp } from '../state/app'
import { ModeSwitcher } from './ModeSwitcher'
import { ExportMenu } from './ExportMenu'

export function PaneHeader() {
  const { state, mode, dirty, setViewMode, toggleSidebar } = useApp()
  const cur = state.currentFile
  const showExpand = mode === 'workspace' && state.sidebarCollapsed

  return (
    <div className="h-9 px-3 flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
      {showExpand && (
        <button
          onClick={toggleSidebar}
          className="no-drag p-1 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          title="展开侧栏"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        {cur && (
          <>
            <span
              className={`text-sm truncate ${cur.path ? 'text-neutral-700 dark:text-neutral-200' : 'text-neutral-400 dark:text-neutral-500 italic'}`}
              title={cur.path ?? '未保存的新文件'}
            >
              {cur.path ? cur.path.split(/[/\\]/).pop() : 'Untitled'}
            </span>
            {dirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-300 shrink-0" />
            )}
          </>
        )}
      </div>

      {cur && (
        <>
          <ExportMenu />
          <ModeSwitcher value={state.viewMode} onChange={setViewMode} />
        </>
      )}
    </div>
  )
}
