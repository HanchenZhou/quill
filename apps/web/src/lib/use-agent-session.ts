import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AgentEvent,
  AgentProviderInfo,
  ApprovalPayload,
  AgentRunArgs,
  HistoryMessage
} from '@quill/shared-types'
import { AgentClient, type AgentConnectionStatus } from './agent-client'
import { providersApi, type CatalogEntry } from './providers-api'
import { coerceUsage, type Usage } from './usage'

export type AgentTurn = {
  runId: string
  prompt: string
  text: string
  toolCalls: { toolCallId: string; name: string; args: unknown }[]
  /** Approvals waiting on user input, keyed by toolCallId. Live runtime
   *  state — never persisted; on reload there's no run to approve so a
   *  fresh empty Map is correct. */
  pendingApprovals: Map<string, ApprovalPayload>
  status: 'running' | 'done' | { error: string }
  /** Token counts emitted by the finish event. Undefined for runs that
   *  errored before producing any usage data, or where the SDK didn't
   *  expose it. */
  usage?: Usage
}

type PersistedTurn = Omit<AgentTurn, 'pendingApprovals' | 'status'> & {
  status: 'done' | { error: string }
}

export type SelectedModel = { providerId: string; modelId: string }

const LS_TURNS = 'quill-agent-turns-v2'
const LS_MODEL = 'quill-agent-model-v1'

function persist(turns: AgentTurn[]): void {
  const settled = turns
    .filter((t) => t.status !== 'running')
    .map<PersistedTurn>((t) => ({
      runId: t.runId,
      prompt: t.prompt,
      text: t.text,
      toolCalls: t.toolCalls,
      status: t.status as 'done' | { error: string },
      usage: t.usage
    }))
  if (settled.length === 0) {
    localStorage.removeItem(LS_TURNS)
    return
  }
  try {
    localStorage.setItem(LS_TURNS, JSON.stringify(settled))
  } catch {
    /* localStorage full / disabled — drop silently */
  }
}

function restore(): AgentTurn[] {
  try {
    const raw = localStorage.getItem(LS_TURNS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((p): p is PersistedTurn => !!p && typeof p.runId === 'string')
      .map((p) => ({
        runId: p.runId,
        prompt: p.prompt,
        text: p.text,
        toolCalls: Array.isArray(p.toolCalls) ? p.toolCalls : [],
        pendingApprovals: new Map(),
        status: p.status,
        usage: p.usage
      }))
  } catch {
    return []
  }
}

function restoreSelectedModel(): SelectedModel | null {
  try {
    const raw = localStorage.getItem(LS_MODEL)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed.providerId === 'string' &&
      typeof parsed.modelId === 'string'
    ) {
      return parsed as SelectedModel
    }
    return null
  } catch {
    return null
  }
}

function persistSelectedModel(m: SelectedModel | null): void {
  if (m) localStorage.setItem(LS_MODEL, JSON.stringify(m))
  else localStorage.removeItem(LS_MODEL)
}

function newId(): string {
  return Math.random().toString(36).slice(2, 11)
}

function buildHistory(turns: AgentTurn[]): HistoryMessage[] {
  const out: HistoryMessage[] = []
  for (const t of turns) {
    if (t.status !== 'done') continue
    out.push({ role: 'user', content: t.prompt })
    if (t.text) {
      out.push({ role: 'assistant', content: t.text })
    }
  }
  return out
}

/** Reconcile the user's stored choice against the currently-configured
 *  + catalog-known providers. If the stored selection still references a
 *  configured provider AND a catalog model, keep it. Otherwise fall back
 *  to the first configured provider/model. Returns null when nothing is
 *  configured at all. */
function pickSelectedModel(
  configured: AgentProviderInfo[],
  catalog: CatalogEntry[],
  stored: SelectedModel | null
): SelectedModel | null {
  if (configured.length === 0) return null
  const configuredById = new Map(configured.map((p) => [p.id, p]))
  const catalogById = new Map(catalog.map((p) => [p.id, p]))

  if (stored) {
    const cfg = configuredById.get(stored.providerId)
    const cat = catalogById.get(stored.providerId)
    if (cfg && cat && cat.models.some((m) => m.id === stored.modelId)) {
      return stored
    }
  }
  // Fall back: first configured provider that has at least one catalog model.
  for (const cfg of configured) {
    const cat = catalogById.get(cfg.id)
    if (cat && cat.models.length > 0) {
      return { providerId: cfg.id, modelId: cat.defaultModelId || cat.models[0].id }
    }
  }
  return null
}

export type AgentSession = {
  client: AgentClient
  /** WS connection status — UI uses this for the reconnect badge. */
  status: AgentConnectionStatus
  providers: AgentProviderInfo[] | null
  catalog: CatalogEntry[] | null
  loadErr: string | null
  turns: AgentTurn[]
  prompt: string
  setPrompt: (s: string) => void
  selectedModel: SelectedModel | null
  setSelectedModel: (m: SelectedModel) => void
  /** Total context window of the currently selected model. 0 when
   *  unknown (no selection or model not in catalog). */
  contextTokens: number
  /** Last settled turn's usage. Best proxy for "current context size"
   *  since each turn's input ≈ prior turns' input + output. */
  lastUsage: Usage | undefined
  send: (args: {
    text: string
    scope: AgentRunArgs['scope']
    currentBuffer?: string
    currentSelection?: string
  }) => Promise<void>
  cancel: () => Promise<void>
  respond: (toolCallId: string, approved: boolean) => Promise<void>
  reset: () => void
}

export function useAgentSession(deps: {
  onActivityComplete?: () => void
}): AgentSession {
  // Status state stored in a ref-backed state so the AgentClient callback
  // can update it without re-creating the client (which would tear down
  // the connection on every status change).
  const [status, setStatus] = useState<AgentConnectionStatus>('closed')
  const client = useMemo(
    () =>
      new AgentClient({
        onStatus: (s) => setStatus(s)
      }),
    []
  )
  const [providers, setProviders] = useState<AgentProviderInfo[] | null>(null)
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [turns, setTurns] = useState<AgentTurn[]>(() => restore())
  const [selectedModel, setSelectedModelState] = useState<SelectedModel | null>(() =>
    restoreSelectedModel()
  )

  const onCompleteRef = useRef(deps.onActivityComplete)
  useEffect(() => {
    onCompleteRef.current = deps.onActivityComplete
  }, [deps.onActivityComplete])

  useEffect(() => {
    persist(turns)
  }, [turns])

  // Load configured providers + catalog in parallel.
  useEffect(() => {
    let cancelled = false
    Promise.all([client.fetchProviders(), providersApi.catalog()])
      .then(([p, c]) => {
        if (cancelled) return
        const configured = p.filter((x) => x.models.length > 0)
        setProviders(configured)
        setCatalog(c)
        // After we know what's available, pin selection to something valid.
        setSelectedModelState((cur) => {
          const next = pickSelectedModel(configured, c, cur)
          if (
            next &&
            (cur?.providerId !== next.providerId || cur?.modelId !== next.modelId)
          ) {
            persistSelectedModel(next)
          }
          return next
        })
      })
      .catch((err) => {
        if (cancelled) return
        setLoadErr(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [client])

  useEffect(() => {
    return () => {
      client.close()
    }
  }, [client])

  const setSelectedModel = useCallback((m: SelectedModel) => {
    setSelectedModelState(m)
    persistSelectedModel(m)
  }, [])

  const handleEvent = useCallback((runId: string, event: AgentEvent): void => {
    setTurns((prev) => {
      const idx = prev.findIndex((t) => t.runId === runId)
      if (idx === -1) return prev
      const cur = prev[idx]
      const next: AgentTurn = { ...cur, pendingApprovals: new Map(cur.pendingApprovals) }
      switch (event.type) {
        case 'text-delta':
          next.text = next.text + event.delta
          break
        case 'tool-call':
          next.toolCalls = [
            ...next.toolCalls,
            { toolCallId: event.toolCallId, name: event.name, args: event.args }
          ]
          break
        case 'tool-approval-request':
          next.pendingApprovals.set(event.toolCallId, event.payload)
          break
        case 'finish':
          next.status = 'done'
          next.usage = coerceUsage(event.usage) ?? cur.usage
          queueMicrotask(() => onCompleteRef.current?.())
          break
        case 'error':
          next.status = { error: event.message }
          queueMicrotask(() => onCompleteRef.current?.())
          break
        default:
          return prev
      }
      const copy = prev.slice()
      copy[idx] = next
      return copy
    })
  }, [])

  const send: AgentSession['send'] = useCallback(
    async ({ text, scope, currentBuffer, currentSelection }) => {
      if (!selectedModel) return
      const runId = newId()
      const newTurn: AgentTurn = {
        runId,
        prompt: text,
        text: '',
        toolCalls: [],
        pendingApprovals: new Map(),
        status: 'running'
      }
      const history = buildHistory(turns)
      setTurns((prev) => [...prev, newTurn])
      try {
        await client.run(
          runId,
          {
            providerId: selectedModel.providerId,
            modelId: selectedModel.modelId,
            prompt: text,
            scope,
            mode: 'build',
            history,
            currentBuffer,
            currentSelection
          },
          (event) => handleEvent(runId, event)
        )
      } catch (err) {
        setTurns((prev) =>
          prev.map((t) =>
            t.runId === runId
              ? { ...t, status: { error: err instanceof Error ? err.message : String(err) } }
              : t
          )
        )
      }
    },
    [client, selectedModel, turns, handleEvent]
  )

  const runningTurn = turns.find((t) => t.status === 'running')

  const cancel: AgentSession['cancel'] = useCallback(async () => {
    if (!runningTurn) return
    await client.cancel(runningTurn.runId)
  }, [client, runningTurn])

  const respond: AgentSession['respond'] = useCallback(
    async (toolCallId, approved) => {
      if (!runningTurn) return
      await client.approve(runningTurn.runId, toolCallId, {
        approved,
        reason: approved ? undefined : 'user denied'
      })
      setTurns((prev) =>
        prev.map((t) => {
          if (t.runId !== runningTurn.runId) return t
          const next = { ...t, pendingApprovals: new Map(t.pendingApprovals) }
          next.pendingApprovals.delete(toolCallId)
          return next
        })
      )
    },
    [client, runningTurn]
  )

  const reset = useCallback(() => {
    setTurns([])
  }, [])

  // Derive context window + last usage from catalog + turns.
  const contextTokens = useMemo(() => {
    if (!selectedModel || !catalog) return 0
    const profile = catalog.find((p) => p.id === selectedModel.providerId)
    return profile?.models.find((m) => m.id === selectedModel.modelId)?.contextTokens ?? 0
  }, [selectedModel, catalog])

  const lastUsage = useMemo(() => {
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].status === 'done' && turns[i].usage) return turns[i].usage
    }
    return undefined
  }, [turns])

  return {
    client,
    status,
    providers,
    catalog,
    loadErr,
    turns,
    prompt,
    setPrompt,
    selectedModel,
    setSelectedModel,
    contextTokens,
    lastUsage,
    send,
    cancel,
    respond,
    reset
  }
}
