import { useState } from 'react'
import { ChevronRight, FileText, File } from 'lucide-react'
import type { FileNode } from '../types'

type Props = {
  nodes: FileNode[]
  currentPath: string | null
  dirty: boolean
  onSelect: (path: string) => void
}

export function FileTree({ nodes, currentPath, dirty, onSelect }: Props) {
  return (
    <ul className="text-sm">
      {nodes.map((n) => (
        <FileTreeNode
          key={n.path}
          node={n}
          depth={0}
          currentPath={currentPath}
          dirty={dirty}
          onSelect={onSelect}
        />
      ))}
    </ul>
  )
}

type NodeProps = {
  node: FileNode
  depth: number
  currentPath: string | null
  dirty: boolean
  onSelect: (path: string) => void
}

function FileTreeNode({ node, depth, currentPath, dirty, onSelect }: NodeProps) {
  const [open, setOpen] = useState(depth === 0)
  const padLeft = 8 + depth * 12
  const isCurrent = node.path === currentPath

  if (node.isDirectory) {
    return (
      <li>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ paddingLeft: padLeft }}
          className="no-drag w-full flex items-center gap-1 py-1 pr-2 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-200"
        >
          <ChevronRight
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''} text-neutral-400`}
          />
          <span className="truncate text-left flex-1">{node.name}</span>
        </button>
        {open && node.children && node.children.length > 0 && (
          <ul>
            {node.children.map((c) => (
              <FileTreeNode
                key={c.path}
                node={c}
                depth={depth + 1}
                currentPath={currentPath}
                dirty={dirty}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </li>
    )
  }

  if (node.isMarkdown) {
    return (
      <li>
        <button
          onClick={() => onSelect(node.path)}
          style={{ paddingLeft: padLeft + 16 }}
          className={`no-drag w-full flex items-center gap-1.5 py-1 pr-2 text-left ${
            isCurrent
              ? 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50'
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
          <span className="truncate flex-1">{node.name}</span>
          {isCurrent && dirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-300 shrink-0" />
          )}
        </button>
      </li>
    )
  }

  return (
    <li>
      <div
        style={{ paddingLeft: padLeft + 16 }}
        className="flex items-center gap-1.5 py-1 pr-2 text-neutral-400 dark:text-neutral-600 select-none cursor-default"
        title="只支持打开 .md 文件"
      >
        <File className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{node.name}</span>
      </div>
    </li>
  )
}
