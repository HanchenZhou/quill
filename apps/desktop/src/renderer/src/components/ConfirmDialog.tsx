import { useEffect } from 'react'
import type { ConfirmRequest } from '../state/app'

/**
 * Paper-styled confirm modal. Used for destructive actions (delete file /
 * folder from the tree). Same promise-parking shape as OpenChoiceDialog:
 * AppContext parks a resolver in `confirmRequest`, this dialog calls it on
 * button click.
 */
type Props = {
  request: ConfirmRequest
}

export function ConfirmDialog({ request }: Props): React.JSX.Element {
  const {
    title,
    message,
    danger = false,
    confirmLabel = '确认',
    cancelLabel = '取消',
    resolve
  } = request

  // Esc cancels, Enter confirms. Captured at the document level so the
  // dialog wins over any underlying editor shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        resolve(false)
      } else if (e.key === 'Enter') {
        e.stopPropagation()
        resolve(true)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [resolve])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[var(--ink)]/30 backdrop-blur-[2px]"
      onClick={() => resolve(false)}
    >
      <div
        className="w-full max-w-[420px] rounded-[12px] bg-[var(--paper)] border border-[var(--rule)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4">
          <h3
            className="font-display text-[16px] text-[var(--ink)] mb-2"
            style={{ fontWeight: 500 }}
          >
            {title}
          </h3>
          <p className="font-serif-zh italic text-[12px] text-[var(--ink-soft)] leading-[1.6] whitespace-pre-wrap">
            {message}
          </p>
        </div>

        <div className="flex border-t border-[var(--rule-soft)]">
          <button
            onClick={() => resolve(false)}
            className="no-drag flex-1 px-3 py-3 text-[12px] text-[var(--ink-soft)] hover:bg-[var(--paper-soft)] transition border-r border-[var(--rule-soft)]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => resolve(true)}
            autoFocus
            className={[
              'no-drag flex-1 px-3 py-3 text-[12px] font-medium text-[var(--paper)] transition hover:opacity-90',
              danger ? 'bg-[var(--accent)]' : 'bg-[var(--ink)]'
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
