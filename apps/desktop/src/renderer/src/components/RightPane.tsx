import { useCallback, useEffect, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { useApp } from '../state/app'
import { useTheme } from '../state/theme'
import { PaneHeader } from './PaneHeader'
import { Editor } from './Editor'
import { Preview } from './Preview'
import { SearchPanel, type SearchMode } from './SearchPanel'

type SearchState = {
  open: boolean
  mode: SearchMode
  initial: string
  openedAt: number
}

const closedSearch: SearchState = { open: false, mode: 'find', initial: '', openedAt: 0 }

export function RightPane() {
  const { state, setBuffer, setViewMode } = useApp()
  const { theme } = useTheme()
  const cur = state.currentFile

  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [search, setSearch] = useState<SearchState>(closedSearch)

  const openSearch = useCallback(
    (mode: SearchMode) => {
      let initial = ''
      if (editorView && !editorView.state.selection.main.empty) {
        const { from, to } = editorView.state.selection.main
        const text = editorView.state.doc.sliceString(from, to)
        if (text.length > 0 && text.length < 200 && !text.includes('\n')) {
          initial = text
        }
      }
      setSearch({ open: true, mode, initial, openedAt: Date.now() })
    },
    [editorView]
  )

  const closeSearch = useCallback(() => {
    setSearch((s) => ({ ...s, open: false }))
  }, [])

  // Window-level Cmd+F / Cmd+R. Works regardless of which child has focus.
  // (If currently in pure-preview mode, switch to split so the editor mounts.)
  useEffect(() => {
    if (!cur) return
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.altKey) return
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        if (state.viewMode === 'preview') setViewMode('split')
        openSearch('find')
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        if (state.viewMode === 'preview') setViewMode('split')
        openSearch('replace')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cur, state.viewMode, setViewMode, openSearch])

  // If the file is closed, drop any open search panel so it doesn't lag.
  useEffect(() => {
    if (!cur) setSearch(closedSearch)
  }, [cur])

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <PaneHeader />

      {!cur && (
        <div className="flex-1 flex items-center justify-center text-neutral-400 dark:text-neutral-600 text-sm select-none">
          从左侧选一个 .md 文件
        </div>
      )}

      {cur && (
        <div className="flex-1 flex min-h-0">
          {state.viewMode !== 'preview' && (
            <div
              className={`flex flex-col min-w-0 ${state.viewMode === 'split' ? 'w-1/2 border-r border-neutral-200 dark:border-neutral-800' : 'flex-1'}`}
            >
              {search.open && editorView && (
                <SearchPanel
                  key={search.openedAt}
                  view={editorView}
                  mode={search.mode}
                  initialQuery={search.initial}
                  onClose={closeSearch}
                  onSwitchMode={(m) => setSearch((s) => ({ ...s, mode: m }))}
                />
              )}
              <div className="flex-1 min-h-0">
                <Editor
                  value={cur.buffer}
                  onChange={setBuffer}
                  theme={theme}
                  onViewChange={setEditorView}
                />
              </div>
            </div>
          )}
          {state.viewMode !== 'edit' && (
            <div className={`min-w-0 ${state.viewMode === 'split' ? 'w-1/2' : 'flex-1'}`}>
              <Preview value={cur.buffer} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
