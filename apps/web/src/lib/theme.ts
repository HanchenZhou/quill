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
