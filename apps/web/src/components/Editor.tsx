import { useEffect, useRef } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
  onSave: () => void
}

/**
 * Plain textarea editor for v0 web. CodeMirror integration belongs in
 * packages/core/components alongside the desktop editor — doing it now
 * would mean two divergent CM setups. textarea covers the read+lightly-
 * edit scenario which is the H5 user's whole job.
 *
 * ⌘S / Ctrl+S triggers onSave without taking the user out of the page
 * (preventDefault on the browser's "save page" handler).
 */
export function Editor({ value, onChange, onSave }: Props): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Keep focus on the textarea after a file switch — opening a file and
  // immediately wanting to type is the common path.
  useEffect(() => {
    ref.current?.focus()
  }, [])

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    const isSaveCombo =
      (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's'
    if (isSaveCombo) {
      e.preventDefault()
      onSave()
    }
  }

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      spellCheck={false}
      // 16px to dodge iOS Safari auto-zoom on focus.
      className="w-full h-full resize-none bg-[var(--paper)] text-[var(--ink)] outline-none px-6 sm:px-10 py-8 font-mono leading-relaxed"
      style={{
        fontFamily: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
        fontSize: '16px',
        lineHeight: 1.7
      }}
    />
  )
}
