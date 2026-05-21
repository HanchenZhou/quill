import { FolderOpen, FileText, FilePlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '../state/app'
import { getRecent } from '../lib/recent'
import type { RecentEntry } from '../types'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 60) return '刚刚'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  return new Date(ts).toLocaleDateString()
}

export function EmptyState() {
  const { newFile, openFolder, openFile, openFolderAt, openFileAt } = useApp()
  const [recent, setRecent] = useState<RecentEntry[]>([])

  useEffect(() => {
    setRecent(getRecent())
  }, [])

  return (
    <div className="h-full w-full flex flex-col items-center justify-center select-none px-8">
      <h1 className="text-3xl font-light text-neutral-700 dark:text-neutral-200 tracking-wide mb-12">
        Quill
      </h1>

      <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">
        <button
          onClick={newFile}
          className="no-drag group flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition"
        >
          <FilePlus className="w-7 h-7 text-neutral-500 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200" />
          <span className="text-sm text-neutral-700 dark:text-neutral-200">新建文件</span>
          <kbd className="text-[10px] text-neutral-400">⌘N</kbd>
        </button>

        <button
          onClick={openFolder}
          className="no-drag group flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition"
        >
          <FolderOpen className="w-7 h-7 text-neutral-500 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200" />
          <span className="text-sm text-neutral-700 dark:text-neutral-200">打开文件夹</span>
          <kbd className="text-[10px] text-neutral-400">⌘⇧O</kbd>
        </button>

        <button
          onClick={openFile}
          className="no-drag group flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition"
        >
          <FileText className="w-7 h-7 text-neutral-500 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200" />
          <span className="text-sm text-neutral-700 dark:text-neutral-200">打开文件</span>
          <kbd className="text-[10px] text-neutral-400">⌘O</kbd>
        </button>
      </div>

      <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
        或者把一个 .md 文件 / 文件夹拖到窗口里
      </p>

      {recent.length > 0 && (
        <div className="mt-12 w-full max-w-2xl">
          <h2 className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3">
            最近
          </h2>
          <ul className="space-y-1">
            {recent.map((r) => (
              <li key={r.path}>
                <button
                  onClick={() => {
                    if (r.type === 'folder') void openFolderAt(r.path)
                    else void openFileAt(r.path)
                  }}
                  className="no-drag w-full flex items-center gap-3 px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 text-left group"
                >
                  {r.type === 'folder' ? (
                    <FolderOpen className="w-4 h-4 text-neutral-400 shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                  )}
                  <span className="text-sm text-neutral-700 dark:text-neutral-200 truncate flex-1">
                    {r.name}
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500 truncate max-w-xs">
                    {r.path}
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500 shrink-0">
                    {timeAgo(r.openedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
