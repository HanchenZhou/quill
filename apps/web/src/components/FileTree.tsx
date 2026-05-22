import { useEffect, useState } from 'react'
import type { FileNode } from '@quill/shared-types'
import type { VaultProvider } from '@quill/vault-adapter'

type TreeProps = {
  vault: VaultProvider
  selectedPath: string | null
  onSelect: (node: FileNode) => void
}

type Loaded = { status: 'loaded'; entries: FileNode[] }
type Loading = { status: 'loading' }
type Errored = { status: 'error'; message: string }

type NodeState = Loaded | Loading | Errored

function sortEntries(entries: FileNode[]): FileNode[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function FileTree({ vault, selectedPath, onSelect }: TreeProps): JSX.Element {
  const [root, setRoot] = useState<NodeState>({ status: 'loading' })
  const [expanded, setExpanded] = useState<Record<string, NodeState>>({})

  useEffect(() => {
    let cancelled = false
    vault
      .list('')
      .then((entries) => {
        if (cancelled) return
        setRoot({ status: 'loaded', entries: sortEntries(entries) })
      })
      .catch((err) => {
        if (cancelled) return
        setRoot({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [vault])

  async function toggle(node: FileNode): Promise<void> {
    if (expanded[node.path]) {
      // Collapse
      const next = { ...expanded }
      delete next[node.path]
      setExpanded(next)
      return
    }
    setExpanded({ ...expanded, [node.path]: { status: 'loading' } })
    try {
      const entries = await vault.list(node.path)
      setExpanded((prev) => ({
        ...prev,
        [node.path]: { status: 'loaded', entries: sortEntries(entries) }
      }))
    } catch (err) {
      setExpanded((prev) => ({
        ...prev,
        [node.path]: {
          status: 'error',
          message: err instanceof Error ? err.message : String(err)
        }
      }))
    }
  }

  function renderNode(node: FileNode, depth: number): JSX.Element {
    const isSelected = node.path === selectedPath
    const isExpanded = !!expanded[node.path]
    const isMd = node.isMarkdown
    return (
      <div key={node.path}>
        <button
          type="button"
          onClick={() => {
            if (node.isDirectory) void toggle(node)
            else if (isMd) onSelect(node)
          }}
          className={[
            'w-full flex items-center gap-1 text-left text-sm px-2 py-1 rounded transition-colors',
            isSelected
              ? 'bg-[--accent-soft] text-[--ink]'
              : 'hover:bg-[--paper-dim] text-[--ink-soft]',
            !node.isDirectory && !isMd ? 'opacity-50' : ''
          ].join(' ')}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          disabled={!node.isDirectory && !isMd}
        >
          <span className="w-3 text-[--ink-faint] text-xs shrink-0">
            {node.isDirectory ? (isExpanded ? '▾' : '▸') : ''}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
        {node.isDirectory && isExpanded && (
          <ChildList state={expanded[node.path]} depth={depth + 1} render={renderNode} />
        )}
      </div>
    )
  }

  if (root.status === 'loading') {
    return <div className="text-xs text-[--ink-faint] p-3">加载中…</div>
  }
  if (root.status === 'error') {
    return <div className="text-xs text-[--accent] p-3">加载失败：{root.message}</div>
  }
  return (
    <nav className="flex flex-col py-2 scroll-thin overflow-y-auto">
      {root.entries.map((e) => renderNode(e, 0))}
    </nav>
  )
}

function ChildList({
  state,
  depth,
  render
}: {
  state: NodeState
  depth: number
  render: (n: FileNode, d: number) => JSX.Element
}): JSX.Element {
  if (state.status === 'loading') {
    return (
      <div
        className="text-xs text-[--ink-faint] px-2 py-1"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        …
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div
        className="text-xs text-[--accent] px-2 py-1"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {state.message}
      </div>
    )
  }
  return <div>{state.entries.map((e) => render(e, depth))}</div>
}
