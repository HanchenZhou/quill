import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AgentEvent,
  AgentProviderInfo,
  ApprovalPayload,
  AgentRunArgs,
  HistoryMessage
} from '@quill/shared-types'
import { AgentClient } from './agent-client'

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
}

type PersistedTurn = Omit<AgentTurn, 'pendingApprovals' | 'status'> & {
  status: 'done' | { error: string }
}

// Bumped to v2 when turn-storage went from a single object to an array.
// Old v1 entries are intentionally not migrated — they were single-turn
// snapshots only the dev environment ever saw.
const LS_KEY = 'quill-agent-turns-v2'

function persist(turns: AgentTurn[]): void {
  // Strip the live runtime fields (pendingApprovals, 'running' status) and
  // drop any turn still in flight — saving a 'running' status across a
  // reload would lie about server state.
  const settled = turns
    .filter((t) => t.status !== 'running')
    .map<PersistedTurn>((t) => ({
      runId: t.runId,
      prompt: t.prompt,
      text: t.text,
      toolCalls: t.toolCalls,
      status: t.status as 'done' | { error: string }
    }))
  if (settled.length === 0) {
    localStorage.removeItem(LS_KEY)
    return
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settled))
  } catch {
    /* localStorage full / disabled — drop silently */
  }
}

function restore(): AgentTurn[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
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
        status: p.status
      }))
  } catch {
    return []
  }
}

function newId(): string {
  return Math.random().toString(36).slice(2, 11)
}

/** Build conversation history to send back to the agent so it has context
 *  across turns. Only fully-completed turns are included (errored runs
 *  are skipped — the user's intent was understood but the call failed,
 *  so reusing them as context would confuse the next prompt). Tool calls
 *  are NOT replayed in history; the assistant's text response is the
 *  load-bearing signal for follow-up. */
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

export type AgentSession = {
  client: AgentClient
  providers: AgentProviderInfo[] | null
  loadErr: string | null
  turns: AgentTurn[]
  prompt: string
  setPrompt: (s: string) => void
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

/**
 * Owns the AgentClient + multi-turn conversation + prompt draft. Lives
 * at the Vault layer so toggling the AgentPanel doesn't blow state away.
 * Persists settled turns to localStorage so a hard reload also keeps them.
 *
 * `onActivityComplete` fires whenever a run reaches a terminal state
 * (finish / error). Vault uses this to refresh the file tree — the
 * agent may have written/deleted/moved files server-side.
 */
export function useAgentSession(deps: {
  onActivityComplete?: () => void
}): AgentSession {
  const client = useMemo(() => new AgentClient(), [])
  const [providers, setProviders] = useState<AgentProviderInfo[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [turns, setTurns] = useState<AgentTurn[]>(() => restore())

  // The completion callback can change without us needing to re-create
  // event handlers — stash in a ref.
  const onCompleteRef = useRef(deps.onActivityComplete)
  useEffect(() => {
    onCompleteRef.current = deps.onActivityComplete
  }, [deps.onActivityComplete])

  useEffect(() => {
    persist(turns)
  }, [turns])

  // Load provider catalog once.
  useEffect(() => {
    let cancelled = false
    client
      .fetchProviders()
      .then((p) => {
        if (cancelled) return
        setProviders(p.filter((x) => x.models.length > 0))
      })
      .catch((err) => {
        if (cancelled) return
        setLoadErr(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [client])

  // Close WS only when the hook itself unmounts (= page navigation), NOT
  // when the panel toggles closed.
  useEffect(() => {
    return () => {
      client.close()
    }
  }, [client])

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
      if (!providers || providers.length === 0) return
      const provider = providers[0]
      const modelId = provider.models[0]
      const runId = newId()
      const newTurn: AgentTurn = {
        runId,
        prompt: text,
        text: '',
        toolCalls: [],
        pendingApprovals: new Map(),
        status: 'running'
      }
      // Snapshot history BEFORE we append — the new turn must not see itself.
      const history = buildHistory(turns)
      setTurns((prev) => [...prev, newTurn])
      try {
        await client.run(
          runId,
          {
            providerId: provider.id,
            modelId,
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
    [client, providers, turns, handleEvent]
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

  return {
    client,
    providers,
    loadErr,
    turns,
    prompt,
    setPrompt,
    send,
    cancel,
    respond,
    reset
  }
}
