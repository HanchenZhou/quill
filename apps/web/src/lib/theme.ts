import { useEffect, useState } from 'react'

/**
 * Set `data-theme="light|dark"` on <html> from prefers-color-scheme, and
 * keep it in sync when the OS theme changes. Manual override (a toggle
 * UI) is a follow-up; today the page just tracks the system.
 */
export function applySystemTheme(): void {
  const root = document.documentElement
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = (): void => {
    root.dataset.theme = mq.matches ? 'dark' : 'light'
  }
  apply()
  mq.addEventListener('change', apply)
}

/** Read the current `data-theme` from <html> and re-render when it
 *  flips. Used by the editor to swap its CodeMirror theme. Observes the
 *  attribute directly (rather than matchMedia) so a future manual toggle
 *  also propagates. */
export function useTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  )
  useEffect(() => {
    const root = document.documentElement
    const ob = new MutationObserver(() => {
      setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light')
    })
    ob.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => ob.disconnect()
  }, [])
  return theme
}
