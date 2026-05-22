import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Send, X, StopCircle, Loader2, ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import { useApp } from '../state/app'
import { ipc } from '../lib/ipc'
import type { AgentEvent, Scope } from '../types'

type DefaultProvider = { id: string; model: string } | null

type Item =
  | { kind: 'user'; text: string }
  | { kind: 'assistant-text'; text: string }
  | { kind: 'tool-call'; toolCallId: string; name: string; args: unknown }
  | { kind: 'tool-result'; toolCallId: string; name: string; result: unknown }
  | { kind: 'error'; message: string }
  | { kind: 'finish'; usage?: unknown }

type Props = {
  onClose: () => void
}

function genRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function computeScope(
  workspaceRoot: string | undefined,
  currentPath: string | null,
  hasCurrentFile: boolean
): Scope | null {
  if (workspaceRoot) return { kind: 'workspace', root: workspaceRoot }
  if (currentPath) return { kind: 'single-file', path: currentPath }
  if (hasCurrentFile) return { kind: 'untitled' }
  return null
}

function scopeLabel(scope: Scope | null): string {
  if (!scope) return 'no scope'
  if (scope.kind === 'workspace') return `workspace · ${scope.root.split('/').pop()}`
  if (scope.kind === 'single-file') return `file · ${scope.path.split('/').pop()}`
  return 'untitled'
}

export function AgentPanel({ onClose }: Props) {
  const { state } = useApp()
  const cur = state.currentFile

  const scope = useMemo(
    () => computeScope(state.workspace?.rootPath, cur?.path ?? null, !!cur),
    [state.workspace?.rootPath, cur]
  )

  const [provider, setProvider] = useState<DefaultProvider>(null)
  const [providerError, setProviderError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Resolve the default provider on mount + when panel re-opens.
  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      const defId = await ipc.providers.getDefault()
      if (!alive) return
      if (!defId) {
        setProvider(null)
        setProviderError('未设置默认 provider — 去 ⌘, 设置里配置')
        return
      }
      const list = await ipc.providers.list()
      const meta = list.find((p) => p.id === defId)
      if (!alive) return
      if (!meta) {
        setProvider(null)
        setProviderError(`默认 provider "${defId}" 未配置`)
        return
      }
      setProvider({ id: meta.id, model: meta.model })
      setProviderError(null)
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  // Subscribe once to agent events; filter by current runId in handler.
  useEffect(() => {
    const off = ipc.agent.onEvent(({ runId: incoming, event }) => {
      // Only consume events for our active run; stale events from a previous
      // cancelled run are ignored.
      setRunId((current) => {
        if (current !== incoming) return current
        applyEvent(event)
        return current
      })
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyEvent = (event: AgentEvent): void => {
    setItems((prev) => {
      if (event.type === 'text-delta') {
        const last = prev[prev.length - 1]
        if (last && last.kind === 'assistant-text') {
          return [...prev.slice(0, -1), { kind: 'assistant-text', text: last.text + event.delta }]
        }
        return [...prev, { kind: 'assistant-text', text: event.delta }]
      }
      if (event.type === 'tool-call') {
        return [
          ...prev,
          {
            kind: 'tool-call',
            toolCallId: event.toolCallId,
            name: event.name,
            args: event.args
          }
        ]
      }
      if (event.type === 'tool-result') {
        return [
          ...prev,
          {
            kind: 'tool-result',
            toolCallId: event.toolCallId,
            name: event.name,
            result: event.result
          }
        ]
      }
      if (event.type === 'error') {
        return [...prev, { kind: 'error', message: event.message }]
      }
      if (event.type === 'finish') {
        return [...prev, { kind: 'finish', usage: event.usage }]
      }
      return prev
    })
    if (event.type === 'finish' || event.type === 'error') {
      setBusy(false)
      setRunId(null)
    }
  }

  // Auto-scroll on new items
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [items])

  const canRun = !!scope && !!provider && !busy && input.trim().length > 0
  const canCancel = busy && runId !== null

  const handleSend = useCallback(async () => {
    if (!canRun || !provider || !scope) return
    const prompt = input.trim()
    setInput('')
    setItems((prev) => [...prev, { kind: 'user', text: prompt }])
    const newRunId = genRunId()
    setRunId(newRunId)
    setBusy(true)
    try {
      await ipc.agent.run({
        runId: newRunId,
        providerId: provider.id,
        modelId: provider.model,
        prompt,
        scope,
        currentBuffer: cur?.buffer,
        currentSelection: undefined
      })
    } catch (e) {
      setItems((prev) => [
        ...prev,
        { kind: 'error', message: e instanceof Error ? e.message : String(e) }
      ])
      setBusy(false)
      setRunId(null)
    }
  }, [canRun, provider, scope, input, cur])

  const handleCancel = useCallback(async () => {
    if (!runId) return
    await ipc.agent.cancel(runId)
    // The cancel itself produces an 'error' event with message 'cancelled'
    // which clears busy/runId. We don't clear here to avoid race.
  }, [runId])

  const handleClear = (): void => {
    setItems([])
  }

  return (
    <aside className="w-[360px] shrink-0 border-l border-[var(--rule)] bg-[var(--paper-dim)] flex flex-col">
      <header className="h-11 px-4 flex items-center gap-2 border-b border-[var(--rule)] shrink-0 bg-[var(--paper)]">
        <span className="font-display italic text-[14px] text-[var(--ink)]">
          Agent
        </span>
        <span className="font-serif-zh italic text-[11px] text-[var(--ink-faint)]">
          (preview)
        </span>
        <div className="flex-1" />
        {items.length > 0 && (
          <button
            onClick={handleClear}
            disabled={busy}
            className="no-drag px-2 py-1 rounded-md text-[11px] text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--paper-soft)] transition disabled:opacity-40"
            title="清空对话"
          >
            清空
          </button>
        )}
        <button
          onClick={onClose}
          className="no-drag p-1.5 rounded-md text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--paper-soft)] transition"
          title="关闭 (⌘J)"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* status strip: scope + provider */}
      <div className="px-4 py-2 border-b border-[var(--rule-soft)] flex items-center gap-3 text-[11px]">
        <span className="font-mono text-[var(--ink-faint)] truncate" title={scope ? JSON.stringify(scope) : ''}>
          {scopeLabel(scope)}
        </span>
        <span className="text-[var(--ink-ghost)]">·</span>
        {providerError ? (
          <span className="text-[var(--accent)] font-serif-zh italic">
            {providerError}
          </span>
        ) : provider ? (
          <span className="font-mono text-[var(--ink-faint)] truncate">
            {provider.id}/{provider.model}
          </span>
        ) : (
          <span className="text-[var(--ink-faint)] font-serif-zh italic">加载中…</span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {items.length === 0 && (
          <div className="font-serif-zh italic text-[12px] text-[var(--ink-faint)] text-center pt-8">
            {scope
              ? '问点什么 —— 比如「读 README.md 然后总结」'
              : '没有打开任何文件或文件夹'}
          </div>
        )}
        {items.map((item, i) => (
          <ItemView key={i} item={item} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-[12px] text-[var(--ink-faint)]">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="font-serif-zh italic">agent 思考中…</span>
          </div>
        )}
      </div>

      <footer className="border-t border-[var(--rule)] p-3 bg-[var(--paper)]">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder={
              scope ? '问 agent 一件事… (⌘↵ 发送)' : '请先打开一个文件或文件夹'
            }
            disabled={!scope || !provider || busy}
            rows={3}
            className="flex-1 resize-none px-3 py-2 rounded-md bg-[var(--paper-soft)] text-[13px] text-[var(--ink)] border border-transparent focus:border-[var(--accent)]/50 focus:bg-[var(--paper)] focus:outline-none disabled:opacity-50 placeholder:text-[var(--ink-faint)] placeholder:italic"
          />
          {canCancel ? (
            <button
              onClick={handleCancel}
              className="no-drag p-2 rounded-md bg-[var(--paper-soft)] text-[var(--accent)] hover:bg-[var(--paper)] transition active:scale-[0.96]"
              title="取消"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canRun}
              className="no-drag p-2 rounded-md bg-[var(--accent)] text-[var(--paper)] disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.96]"
              title="发送 (⌘↵)"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>
    </aside>
  )
}

function ItemView({ item }: { item: Item }) {
  if (item.kind === 'user') {
    return (
      <div className="ml-6 px-3 py-2 rounded-md bg-[var(--paper-soft)] text-[13px] text-[var(--ink)] whitespace-pre-wrap">
        {item.text}
      </div>
    )
  }
  if (item.kind === 'assistant-text') {
    return (
      <div className="text-[13px] text-[var(--ink)] whitespace-pre-wrap leading-[1.65]">
        {item.text}
      </div>
    )
  }
  if (item.kind === 'tool-call') {
    return <ToolCallView name={item.name} args={item.args} />
  }
  if (item.kind === 'tool-result') {
    return <ToolResultView name={item.name} result={item.result} />
  }
  if (item.kind === 'error') {
    return (
      <div className="text-[12px] text-[var(--accent)] font-serif-zh italic">
        ⚠ {item.message}
      </div>
    )
  }
  if (item.kind === 'finish') {
    return (
      <div className="text-[11px] text-[var(--ink-faint)] font-serif-zh italic text-right">
        done
      </div>
    )
  }
  return null
}

function ToolCallView({ name, args }: { name: string; args: unknown }) {
  return (
    <div className="text-[12px] border-l-2 border-[var(--rule)] pl-2">
      <div className="flex items-center gap-1 text-[var(--ink-soft)]">
        <Wrench className="w-3 h-3" />
        <span className="font-mono">{name}</span>
      </div>
      <pre className="font-mono text-[11px] text-[var(--ink-faint)] mt-0.5 overflow-x-auto whitespace-pre-wrap break-all">
        {JSON.stringify(args, null, 2)}
      </pre>
    </div>
  )
}

function ToolResultView({ name, result }: { name: string; result: unknown }) {
  const [open, setOpen] = useState(false)
  const preview =
    typeof result === 'string'
      ? result.slice(0, 120)
      : JSON.stringify(result).slice(0, 120)
  const full = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  return (
    <div className="text-[12px] border-l-2 border-[var(--accent)]/40 pl-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="no-drag flex items-center gap-1 text-[var(--ink-soft)] hover:text-[var(--ink)] transition"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="font-mono">{name}</span>
        <span className="font-serif-zh italic text-[var(--ink-faint)] ml-1">→</span>
        {!open && (
          <span className="font-mono text-[11px] text-[var(--ink-faint)] truncate ml-1 max-w-[200px]">
            {preview}
            {full.length > 120 ? '…' : ''}
          </span>
        )}
      </button>
      {open && (
        <pre className="font-mono text-[11px] text-[var(--ink-faint)] mt-1 overflow-x-auto whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
          {full}
        </pre>
      )}
    </div>
  )
}
