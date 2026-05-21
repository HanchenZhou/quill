import { Pencil, Columns2, Eye } from 'lucide-react'
import type { ViewMode } from '../types'

const items: { id: ViewMode; label: string; icon: typeof Pencil }[] = [
  { id: 'edit', label: '编辑', icon: Pencil },
  { id: 'split', label: '分栏', icon: Columns2 },
  { id: 'preview', label: '预览', icon: Eye }
]

type Props = {
  value: ViewMode
  onChange: (m: ViewMode) => void
}

export function ModeSwitcher({ value, onChange }: Props) {
  return (
    <div className="no-drag flex items-center gap-0.5 p-0.5 rounded-md bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
      {items.map(({ id, label, icon: Icon }) => {
        const active = id === value
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            title={label}
            className={`p-1.5 rounded transition ${
              active
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-50 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        )
      })}
    </div>
  )
}
