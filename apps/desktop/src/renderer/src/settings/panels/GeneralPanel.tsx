import { useCallback, useState } from 'react'
import { Download, FolderOpen, Loader2, RefreshCw, Upload } from 'lucide-react'
import { useTheme } from '../../state/theme'
import { usePrefs } from '../../state/prefs'
import type { ThemePref, ViewMode } from '../../types'
import { Select } from '../../components/Select'
import { ipc } from '../../lib/ipc'

type RowProps = {
  label: string
  hint?: string
  children: React.ReactNode
}

function Row({ label, hint, children }: RowProps) {
  return (
    <div className="flex items-start py-4 border-b border-[var(--rule-soft)] last:border-b-0">
      <div className="w-[140px] shrink-0 pt-1">
        <div className="text-[13.5px] font-medium text-[var(--ink)]">{label}</div>
        {hint && (
          <div className="font-serif-zh italic text-[12px] text-[var(--ink-faint)] mt-0.5">
            {hint}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

type PillProps<T extends string | number> = {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
}

function PillGroup<T extends string | number>({ options, value, onChange }: PillProps<T>) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-[var(--paper-soft)]">
      {options.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`px-3.5 py-1 rounded-full text-[12.5px] transition ${
              isActive
                ? 'bg-[var(--ink)] text-[var(--paper)] font-medium'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

type ToggleProps = {
  checked: boolean
  onChange: (v: boolean) => void
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center w-10 h-5 rounded-full transition ${
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--paper-soft)] border border-[var(--rule)]'
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[var(--paper)] shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )
}

function PrimaryThemeAction({
  icon,
  label,
  loading,
  onClick,
  disabled
}: {
  icon: React.ReactNode
  label: string
  loading?: boolean
  onClick: () => void | Promise<void>
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="no-drag flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] bg-[var(--paper-edge)] text-[var(--ink)] border border-[var(--rule)] hover:bg-[var(--paper-soft)] disabled:opacity-50 disabled:cursor-not-allowed transition"
    >
      <span className="text-[var(--ink-soft)]">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      </span>
      {label}
    </button>
  )
}

function IconThemeAction({
  icon,
  title,
  loading,
  onClick,
  disabled
}: {
  icon: React.ReactNode
  title: string
  loading?: boolean
  onClick: () => void | Promise<void>
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="no-drag w-8 h-8 rounded-md flex items-center justify-center text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--paper-soft)] disabled:opacity-40 disabled:cursor-not-allowed transition"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
    </button>
  )
}

// Placeholder values for the "export current built-in" path. Built-in
// theme tokens live in CSS, so JS doesn't know them — exporting a
// built-in produces a stub the user fills in by editing the JSON.
const TOKEN_STUB = {
  paper: '#ffffff',
  paperDim: '#f4f4f4',
  paperSoft: '#eaeaea',
  paperEdge: '#dcdcdc',
  ink: '#111111',
  inkSoft: '#333333',
  inkFaint: '#666666',
  inkGhost: '#999999',
  rule: '#cccccc',
  ruleSoft: '#e2e2e2',
  accent: '#cc3333',
  accentSoft: '#f4d8d8'
}

const THEME_OPTIONS: Array<{ value: ThemePref; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' }
]

const FONT_SIZE_OPTIONS = [12, 13, 14, 15, 16].map((n) => ({ value: n, label: String(n) }))

const VIEW_MODE_OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: 'edit', label: '编辑' },
  { value: 'split', label: '分栏' },
  { value: 'preview', label: '预览' }
]

export function GeneralPanel() {
  const {
    pref,
    setPref,
    themeId,
    setThemeId,
    availableThemes,
    activeCustomTheme,
    reloadCustomThemes
  } = useTheme()
  const { prefs, setPref: setEditorPref } = usePrefs()
  const [busy, setBusy] = useState<'import' | 'export' | 'reload' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const themeOptions = availableThemes.map((t) => ({
    value: t.id,
    label: t.name,
    hint: t.builtin ? '内置' : '自定义'
  }))

  const handleImport = useCallback(async () => {
    setBusy('import')
    setNotice(null)
    try {
      const filename = await ipc.themes.importDialog()
      if (filename) {
        await reloadCustomThemes()
        setNotice(`已导入 ${filename}`)
      }
    } catch (e) {
      setNotice('导入失败：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(null)
    }
  }, [reloadCustomThemes])

  const handleExport = useCallback(async () => {
    setBusy('export')
    setNotice(null)
    try {
      // Only custom themes carry the full token payload in JS — for a
      // built-in we emit a minimal stub the user can fill in, so the
      // workflow "pick claude → export → tweak → import" still works.
      const exportable = activeCustomTheme ?? {
        id: themeId + '-copy',
        name: (availableThemes.find((t) => t.id === themeId)?.name ?? 'Custom') + ' (Copy)',
        builtin: false,
        light: TOKEN_STUB,
        dark: TOKEN_STUB
      }
      const content = JSON.stringify(
        {
          id: exportable.id,
          name: exportable.name,
          light: exportable.light,
          dark: exportable.dark
        },
        null,
        2
      )
      const saved = await ipc.themes.exportDialog({
        suggestedFilename: `${exportable.id}.json`,
        content
      })
      if (saved) setNotice(`已导出到 ${saved}`)
    } catch (e) {
      setNotice('导出失败：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(null)
    }
  }, [activeCustomTheme, availableThemes, themeId])

  const handleReveal = useCallback(async () => {
    await ipc.themes.revealFolder()
  }, [])

  const handleReload = useCallback(async () => {
    setBusy('reload')
    try {
      await reloadCustomThemes()
      setNotice('已重新加载主题列表')
    } finally {
      setBusy(null)
    }
  }, [reloadCustomThemes])

  return (
    <div className="max-w-[520px]">
      <h2 className="font-display text-[28px] text-[var(--ink)] mb-1" style={{ fontWeight: 500 }}>
        通用
      </h2>
      <p className="font-serif-zh italic text-[13px] text-[var(--ink-faint)] mb-6">
        外观与编辑器
      </p>

      <Row label="模式" hint="跟随系统会同步 macOS 的浅 / 深色设置">
        <PillGroup options={THEME_OPTIONS} value={pref} onChange={setPref} />
      </Row>

      <Row label="主题" hint="内置 4 套；自定义主题来自 ~/.quill/themes/">
        <Select
          value={themeId}
          onChange={setThemeId}
          options={themeOptions}
          ariaLabel="主题选择"
          className="min-w-[200px]"
        />
      </Row>

      <Row label="自定义主题" hint="JSON 文件存于 ~/.quill/themes/">
        <div className="flex flex-col gap-2">
          {/* Primary action gets its label; the three utility actions are
            * icon-only with tooltips. The vertical divider between primary
            * and utilities marks the boundary visually. */}
          <div className="flex items-center gap-2">
            <PrimaryThemeAction
              icon={<Upload className="w-3.5 h-3.5" />}
              label="导入主题…"
              loading={busy === 'import'}
              onClick={handleImport}
              disabled={busy !== null}
            />
            <div className="w-px h-5 bg-[var(--rule-soft)] mx-1" aria-hidden />
            <IconThemeAction
              icon={<Download className="w-3.5 h-3.5" />}
              title="导出当前主题为 JSON"
              loading={busy === 'export'}
              onClick={handleExport}
              disabled={busy !== null}
            />
            <IconThemeAction
              icon={<FolderOpen className="w-3.5 h-3.5" />}
              title="打开主题文件夹"
              onClick={handleReveal}
              disabled={busy !== null}
            />
            <IconThemeAction
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              title="重新加载主题列表"
              loading={busy === 'reload'}
              onClick={handleReload}
              disabled={busy !== null}
            />
          </div>
          {notice && (
            <p className="font-serif-zh italic text-[12px] text-[var(--ink-faint)]">
              {notice}
            </p>
          )}
        </div>
      </Row>

      <Row label="编辑器字号" hint="影响 markdown 源码编辑器的字号">
        <PillGroup
          options={FONT_SIZE_OPTIONS}
          value={prefs.fontSize}
          onChange={(v) => setEditorPref('fontSize', v)}
        />
      </Row>

      <Row label="默认视图" hint="打开文件 / 新建文件时的初始模式">
        <PillGroup
          options={VIEW_MODE_OPTIONS}
          value={prefs.defaultViewMode}
          onChange={(v) => setEditorPref('defaultViewMode', v)}
        />
      </Row>

      <Row label="显示行号" hint="CodeMirror 的左侧行号 gutter">
        <Toggle
          checked={prefs.showLineNumbers}
          onChange={(v) => setEditorPref('showLineNumbers', v)}
        />
      </Row>
    </div>
  )
}
