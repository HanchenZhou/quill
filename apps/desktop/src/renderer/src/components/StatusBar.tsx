import { useMemo } from 'react'
import { useApp } from '../state/app'
import { countWords } from '../lib/markdown'
import { ThemeToggle } from './ThemeToggle'

export function StatusBar() {
  const { state, mode, dirty } = useApp()
  const cur = state.currentFile

  const words = useMemo(() => (cur ? countWords(cur.buffer) : 0), [cur])

  const saveLabel = state.saving
    ? 'saving…'
    : dirty
      ? 'unsaved'
      : cur
        ? 'saved'
        : null

  return (
    <footer className="h-6 px-3 flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 select-none shrink-0">
      {cur ? (
        <>
          <span>{words.toLocaleString()} words</span>
          <span className="text-neutral-300 dark:text-neutral-700">·</span>
          <span>{saveLabel}</span>
        </>
      ) : (
        <span>{mode === 'empty' ? '未打开任何内容' : ''}</span>
      )}
      <div className="flex-1" />
      <ThemeToggle />
    </footer>
  )
}
