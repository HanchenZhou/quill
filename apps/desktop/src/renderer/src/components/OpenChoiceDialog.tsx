import { useEffect } from 'react'

/**
 * Paper-styled replacement for the native macOS sheet that used to ask
 * "in 新窗口 / 当前窗口 / 取消?" when the user opens a file or folder
 * while something is already open. Dispatched by `openPathWithPrompt`
 * in state/app.tsx, resolved by a button click here.
 */

export type OpenChoice = 'new' | 'current' | 'cancel'

export type OpenChoiceRequest = {
  candidateName: string
  currentName: string
  dirty: boolean
}

type Props = {
  request: OpenChoiceRequest
  onResolve: (choice: OpenChoice) => void
}

export function OpenChoiceDialog({ request, onResolve }: Props): React.JSX.Element {
  const { candidateName, currentName, dirty } = request

  // Escape = cancel. Enter = primary (新窗口) for parity with native sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onResolve('cancel')
      } else if (e.key === 'Enter') {
        e.stopPropagation()
        onResolve('new')
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onResolve])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[var(--ink)]/30 backdrop-blur-[2px]"
      onClick={() => onResolve('cancel')}
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
            在哪里打开{' '}
            <span className="font-mono not-italic text-[var(--accent)]">
              {candidateName}
            </span>
            ？
          </h3>
          <p className="font-serif-zh italic text-[12px] text-[var(--ink-soft)] leading-[1.6]">
            {dirty ? (
              <>
                当前打开「
                <span className="font-mono not-italic text-[var(--ink)]">
                  {currentName}
                </span>
                」有未保存的改动。选择「替换」会直接丢弃这些改动。
              </>
            ) : (
              <>
                当前打开：
                <span className="font-mono not-italic text-[var(--ink)]">
                  {currentName}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex border-t border-[var(--rule-soft)]">
          <button
            onClick={() => onResolve('cancel')}
            className="no-drag flex-1 px-3 py-3 text-[12px] text-[var(--ink-soft)] hover:bg-[var(--paper-soft)] transition border-r border-[var(--rule-soft)]"
          >
            取消
          </button>
          <button
            onClick={() => onResolve('current')}
            className={[
              'no-drag flex-1 px-3 py-3 text-[12px] transition border-r border-[var(--rule-soft)]',
              dirty
                ? 'text-[var(--accent)] hover:bg-[var(--accent-soft)]'
                : 'text-[var(--ink-soft)] hover:bg-[var(--paper-soft)]'
            ].join(' ')}
          >
            {dirty ? '替换（丢失改动）' : '在当前窗口打开'}
          </button>
          <button
            onClick={() => onResolve('new')}
            autoFocus
            className="no-drag flex-1 px-3 py-3 text-[12px] font-medium text-[var(--paper)] bg-[var(--accent)] hover:opacity-90 transition"
          >
            新窗口
          </button>
        </div>
      </div>
    </div>
  )
}
