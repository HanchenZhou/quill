export type ViewMode = 'edit' | 'preview'

type Props = {
  value: ViewMode
  onChange: (m: ViewMode) => void
}

const modes: { id: ViewMode; label: string }[] = [
  { id: 'edit', label: '✎' },
  { id: 'preview', label: '👁' }
]

export function ModeSwitcher({ value, onChange }: Props): JSX.Element {
  return (
    <div className="flex items-center gap-0.5 bg-[var(--paper-soft)] rounded p-0.5">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          aria-pressed={value === m.id}
          title={m.id === 'edit' ? '编辑' : '预览'}
          className={[
            'px-2 py-0.5 rounded text-sm leading-none transition-colors',
            value === m.id
              ? 'bg-[var(--paper)] text-[var(--ink)] shadow-sm'
              : 'text-[var(--ink-faint)] hover:text-[var(--ink-soft)]'
          ].join(' ')}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
