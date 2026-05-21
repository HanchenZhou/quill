import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileDown, Loader2 } from 'lucide-react'
import { useApp } from '../state/app'
import { useTheme } from '../state/theme'
import { exportToPdf } from '../lib/export'
import { ipc } from '../lib/ipc'

function baseNameFor(path: string | null): string {
  if (!path) return 'untitled'
  const name = path.split(/[/\\]/).pop() ?? 'untitled'
  return name.replace(/\.[^.]+$/, '')
}

export function ExportMenu() {
  const { state } = useApp()
  const { theme } = useTheme()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const cur = state.currentFile

  const doExportPdf = useCallback(async (): Promise<void> => {
    setOpen(false)
    if (!cur || busy) return
    setBusy(true)
    try {
      await exportToPdf({
        markdown: cur.buffer,
        defaultName: `${baseNameFor(cur.path)}.pdf`,
        theme
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('export pdf failed', err)
    } finally {
      setBusy(false)
    }
  }, [cur, busy, theme])

  // Native menu (File → Export → PDF…) triggers the same flow.
  useEffect(() => {
    return ipc.onMenu((cmd) => {
      if (cmd === 'export-pdf') void doExportPdf()
    })
  }, [doExportPdf])

  // Click-outside to close the dropdown.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!cur) return null

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        title="导出"
        className="no-drag flex items-center gap-1 px-1.5 py-1 rounded text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-default"
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
      </button>
      {open && (
        <div className="no-drag absolute top-full right-0 mt-1 min-w-[180px] py-1 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg z-50">
          <button
            onClick={doExportPdf}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
          >
            <FileDown className="w-3.5 h-3.5 text-neutral-400" />
            <span>导出为 PDF…</span>
            <kbd className="ml-auto text-[10px] text-neutral-400">⌘⇧E</kbd>
          </button>
          <div className="mt-1 px-3 py-1 text-[10px] text-neutral-400 dark:text-neutral-500 select-none border-t border-neutral-100 dark:border-neutral-800">
            更多格式即将支持
          </div>
        </div>
      )}
    </div>
  )
}
