/**
 * Pending-approval registry. The agent's write tools `await request(...)` and
 * the renderer answers via IPC, which calls `respond(...)`. Cancelling a run
 * resolves any outstanding approvals as `{ approved: false, reason: 'cancelled' }`
 * so the tool's `execute` can return a tool-error and the agent keeps moving.
 *
 * Keyed by `${runId}\0${toolCallId}` internally — runId scoping is what lets
 * cancel-run wipe a single run's queue without touching others.
 */
export type ApprovalResponse = { approved: boolean; reason?: string }

export type ApprovalPayload = Record<string, unknown>

export type PendingApproval = {
  runId: string
  toolCallId: string
  payload: ApprovalPayload
}

type Entry = {
  runId: string
  toolCallId: string
  payload: ApprovalPayload
  resolve: (r: ApprovalResponse) => void
}

const key = (runId: string, toolCallId: string): string => `${runId}\0${toolCallId}`

export function createApprovalsManager() {
  const entries = new Map<string, Entry>()

  function request(
    runId: string,
    toolCallId: string,
    payload: ApprovalPayload
  ): Promise<ApprovalResponse> {
    return new Promise<ApprovalResponse>((resolve) => {
      entries.set(key(runId, toolCallId), { runId, toolCallId, payload, resolve })
    })
  }

  function respond(runId: string, toolCallId: string, response: ApprovalResponse): boolean {
    const k = key(runId, toolCallId)
    const entry = entries.get(k)
    if (!entry) return false
    entries.delete(k)
    entry.resolve(response)
    return true
  }

  function cancelRun(runId: string): number {
    let n = 0
    for (const [k, entry] of entries) {
      if (entry.runId !== runId) continue
      entries.delete(k)
      entry.resolve({ approved: false, reason: 'cancelled' })
      n++
    }
    return n
  }

  function pending(runId: string): PendingApproval[] {
    const out: PendingApproval[] = []
    for (const entry of entries.values()) {
      if (entry.runId === runId) {
        out.push({ runId: entry.runId, toolCallId: entry.toolCallId, payload: entry.payload })
      }
    }
    return out
  }

  return { request, respond, cancelRun, pending }
}

export type ApprovalsManager = ReturnType<typeof createApprovalsManager>
