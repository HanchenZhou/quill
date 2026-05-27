import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type ContextMenuItem = {
  label: string
  onClick: () => void
  /** Style the row red — used for destructive entries (删除). */
  danger?: boolean
  /** Render a visual separator above this item. */
  divider?: boolean
}

type Props = {
  /** Cursor position the menu was opened at (clientX/clientY). */
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

/**
 * Lightweight floating menu that follows the user's cursor on right-click.
 * Closes on outside click, Esc, scroll, or window blur. After mount, the
 * effect clamps the menu inside the viewport so it never overflows the
 * window edge.
 */
export function ContextMenu({ x, y, items, onClose }: Props): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ x, y })

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margin = 8
    const maxX = window.innerWidth - r.width - margin
    const maxY = window.innerHeight - r.height - margin
    setPos({
      x: Math.max(margin, Math.min(x, maxX)),
      y: Math.max(margin, Math.min(y, maxY))
    })
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = (): void => onClose()
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      // Aligned with the project's other dropdowns (ExportMenu, Select,
      // OutlineRail): shadow-lg + a rule-coloured border. shadow-2xl is
      // for full modals (RemoteLogin / OpenChoice / Confirm) — applying it
      // to a small floating menu reads as a heavy black halo, especially
      // jarring on dark themes where the rest of the surface is matte.
      className="fixed z-[60] min-w-[160px] py-1 rounded-md bg-[var(--paper)] border border-[var(--rule)] shadow-lg text-[13px] text-[var(--ink)]"
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.divider && i > 0 && (
            <div className="my-1 border-t border-[var(--rule-soft)]" />
          )}
          <button
            role="menuitem"
            onClick={() => {
              item.onClick()
              onClose()
            }}
            className={[
              'no-drag w-full text-left px-3 py-1.5 transition',
              item.danger
                ? 'text-[var(--accent)] hover:bg-[var(--accent-soft)]'
                : 'text-[var(--ink)] hover:bg-[var(--paper-soft)]'
            ].join(' ')}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  )
}
