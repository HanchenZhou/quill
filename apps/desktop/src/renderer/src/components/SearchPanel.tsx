import { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, X, CaseSensitive, Regex } from 'lucide-react'
import type { EditorView } from '@codemirror/view'
import {
  SearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll
} from '@codemirror/search'

export type SearchMode = 'find' | 'replace'

type Props = {
  view: EditorView
  mode: SearchMode
  initialQuery: string
  onClose: () => void
  onSwitchMode: (m: SearchMode) => void
}

type MatchInfo = { current: number; total: number }

function buildQuery(args: {
  search: string
  caseSensitive: boolean
  regexp: boolean
  replace: string
}): SearchQuery {
  return new SearchQuery({
    search: args.search,
    caseSensitive: args.caseSensitive,
    regexp: args.regexp,
    replace: args.replace
  })
}

function countMatches(view: EditorView, query: SearchQuery): MatchInfo {
  if (!query.search || !query.valid) return { current: 0, total: 0 }
  let total = 0
  let current = 0
  const selFrom = view.state.selection.main.from
  const selTo = view.state.selection.main.to
  try {
    const cursor = query.getCursor(view.state.doc) as Iterator<{ from: number; to: number }>
    let m = cursor.next()
    while (!m.done) {
      total += 1
      if (m.value.from === selFrom && m.value.to === selTo) {
        current = total
      }
      m = cursor.next()
    }
  } catch {
    return { current: 0, total: 0 }
  }
  return { current, total }
}

export function SearchPanel({ view, mode, initialQuery, onClose, onSwitchMode }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [regex, setRegex] = useState(false)
  const [matchInfo, setMatchInfo] = useState<MatchInfo>({ current: 0, total: 0 })
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Push the current query into the editor whenever something changes.
  useEffect(() => {
    if (!view) return
    const q = buildQuery({ search: query, caseSensitive, regexp: regex, replace: replacement })
    view.dispatch({ effects: setSearchQuery.of(q) })
  }, [view, query, replacement, caseSensitive, regex])

  // Recompute match counts. Poll view.state by identity — every transaction
  // creates a fresh state object, so the check is O(1) and only the actual
  // recount (which iterates the doc) runs when something really changed.
  useEffect(() => {
    if (!view) return
    let lastState = view.state
    let raf = 0
    const compute = (): void => {
      const q = buildQuery({ search: query, caseSensitive, regexp: regex, replace: replacement })
      setMatchInfo(countMatches(view, q))
    }
    compute()
    const tick = (): void => {
      if (view.state !== lastState) {
        lastState = view.state
        compute()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [view, query, replacement, caseSensitive, regex])

  useEffect(() => {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }, [mode])

  const close = (): void => {
    view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) })
    view.focus()
    onClose()
  }

  const onFindKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) findPrevious(view)
      else findNext(view)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  const onReplaceKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.metaKey || e.ctrlKey || e.shiftKey) replaceAll(view)
      else replaceNext(view)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  const hasQuery = query.length > 0
  const countLabel = !hasQuery
    ? null
    : matchInfo.total === 0
      ? '无匹配'
      : matchInfo.current === 0
        ? `${matchInfo.total} 处`
        : `${matchInfo.current} / ${matchInfo.total}`

  const fieldCls =
    'flex-1 min-w-0 px-2 py-1 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-none focus:border-neutral-500 dark:focus:border-neutral-500 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400'
  const iconBtnCls =
    'no-drag p-1 rounded text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-default'
  const toggleCls = (on: boolean): string =>
    `${iconBtnCls} ${on ? '!bg-neutral-200 !text-neutral-900 dark:!bg-neutral-700 dark:!text-neutral-50' : ''}`
  const labelBtnCls =
    'no-drag px-2 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-default'

  const noMatches = hasQuery && matchInfo.total === 0

  return (
    <div className="shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/80 px-2 py-1.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          ref={searchInputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onFindKey}
          placeholder="查找"
          className={fieldCls}
        />
        {countLabel !== null && (
          <span
            className={`text-[11px] tabular-nums px-1.5 select-none shrink-0 ${noMatches ? 'text-red-500 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'}`}
            title={
              matchInfo.total > 0 && matchInfo.current === 0
                ? '回车跳到第一个'
                : undefined
            }
          >
            {countLabel}
          </span>
        )}
        <button
          onClick={() => setCaseSensitive((v) => !v)}
          className={toggleCls(caseSensitive)}
          title="区分大小写"
        >
          <CaseSensitive className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setRegex((v) => !v)}
          className={toggleCls(regex)}
          title="正则表达式"
        >
          <Regex className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => findPrevious(view)}
          disabled={!hasQuery || matchInfo.total === 0}
          title="上一个 (⇧↵)"
          className={iconBtnCls}
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => findNext(view)}
          disabled={!hasQuery || matchInfo.total === 0}
          title="下一个 (↵)"
          className={iconBtnCls}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {mode === 'find' ? (
          <button
            onClick={() => onSwitchMode('replace')}
            className={labelBtnCls}
            title="切换到替换 (⌘R)"
          >
            替换…
          </button>
        ) : (
          <button
            onClick={() => onSwitchMode('find')}
            className={labelBtnCls}
            title="仅查找 (⌘F)"
          >
            仅查找
          </button>
        )}
        <button onClick={close} title="关闭 (Esc)" className={iconBtnCls}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {mode === 'replace' && (
        <div className="flex items-center gap-1.5">
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={onReplaceKey}
            placeholder="替换为"
            className={fieldCls}
          />
          <button
            onClick={() => replaceNext(view)}
            disabled={!hasQuery || matchInfo.total === 0}
            className={labelBtnCls}
            title="替换并跳到下一个 (↵)"
          >
            替换
          </button>
          <button
            onClick={() => replaceAll(view)}
            disabled={!hasQuery || matchInfo.total === 0}
            className={labelBtnCls}
            title="全部替换 (⌘↵)"
          >
            全部替换
          </button>
        </div>
      )}
    </div>
  )
}
