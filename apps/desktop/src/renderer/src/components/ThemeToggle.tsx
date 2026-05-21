import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../state/theme'

export function ThemeToggle() {
  const { pref, cyclePref } = useTheme()
  const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : Monitor
  const label = pref === 'light' ? '浅色' : pref === 'dark' ? '深色' : '跟随系统'

  return (
    <button
      onClick={cyclePref}
      title={`主题：${label}（点击切换）`}
      className="no-drag flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
    >
      <Icon className="w-3 h-3" />
      <span className="text-[11px]">{label}</span>
    </button>
  )
}
