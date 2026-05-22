import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FileNode } from '@quill/shared-types'
import { FileTree } from '../components/FileTree'
import { Preview } from '../components/Preview'
import { RemoteVault, UnauthorizedError } from '../lib/remote-vault'
import { logout } from '../lib/auth'

export function Vault(): JSX.Element {
  const navigate = useNavigate()
  const vault = useMemo(() => new RemoteVault(), [])
  const [selected, setSelected] = useState<FileNode | null>(null)
  const [content, setContent] = useState<string>('')
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    vault
      .read(selected.path)
      .then((text) => {
        if (cancelled) return
        setContent(text)
        setLoadErr(null)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof UnauthorizedError) {
          navigate('/login', { replace: true })
          return
        }
        setLoadErr(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [selected, vault, navigate])

  async function onLogout(): Promise<void> {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="h-[100dvh] flex">
      {/* Sidebar — fixed drawer on H5, in-flow on md+. */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-20 w-72 bg-[--paper-dim] border-r border-[--rule] flex flex-col',
          'transition-transform duration-200 md:translate-x-0 md:static md:flex',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        ].join(' ')}
      >
        <div className="h-12 flex items-center justify-between px-3 border-b border-[--rule-soft]">
          <span className="font-display text-lg text-[--ink]">Quill</span>
          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-[--ink-faint] hover:text-[--accent] px-2 py-1"
          >
            登出
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <FileTree
            vault={vault}
            selectedPath={selected?.path ?? null}
            onSelect={(node) => {
              setSelected(node)
              setSidebarOpen(false)
            }}
          />
        </div>
      </aside>

      {/* Overlay for H5 drawer */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="关闭侧栏"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-10 bg-[--ink] opacity-30 md:hidden"
        />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center gap-2 px-3 border-b border-[--rule-soft]">
          <button
            type="button"
            onClick={() => setSidebarOpen((s) => !s)}
            className="md:hidden text-[--ink-soft] p-2"
            aria-label="切换侧栏"
          >
            ☰
          </button>
          <span className="text-sm text-[--ink-soft] truncate">
            {selected?.path ?? '选择一个文件'}
          </span>
        </header>
        <div className="flex-1 overflow-y-auto scroll-thin">
          {loadErr && (
            <div className="px-6 py-4 text-sm text-[--accent]">{loadErr}</div>
          )}
          {!selected && !loadErr && (
            <div className="flex items-center justify-center h-full text-sm text-[--ink-faint]">
              在左侧选择一个 markdown 文件预览
            </div>
          )}
          {selected && !loadErr && <Preview source={content} />}
        </div>
      </main>
    </div>
  )
}
