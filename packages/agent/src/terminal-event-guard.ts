import type { AgentEvent } from '@quill/shared-types'

export type TerminalEventGuard = {
  /** Wrap inside `runAgent` in place of the bare `onEvent`. */
  onEvent: (event: AgentEvent) => void
  /**
   * Called from `runAgent`'s `finally`. If no `finish` or `error` event
   * has been forwarded yet, emits a synthetic `error` with `reason` so
   * the renderer can clear `busy/runId`. Otherwise no-op. Idempotent on
   * repeat calls.
   */
  ensureEmitted: (reason: string) => void
}

/**
 * Belt-and-braces guarantee that every agent run terminates with a
 * `finish` or `error` event on the wire. The renderer's spinner state
 * only flips off when one of those two lands (AgentPanel.tsx:482) —
 * any silent exit (unexpected stream close, swallowed throw, future
 * refactor that forgets to emit) wedges the UI indefinitely. See #89.
 *
 * Returned as a plain object instead of a class so the caller can keep
 * destructuring `.onEvent` without losing `this`.
 */
export function createTerminalEventGuard(
  innerOnEvent: (event: AgentEvent) => void
): TerminalEventGuard {
  let emitted = false
  return {
    onEvent(event) {
      if (event.type === 'finish' || event.type === 'error') {
        emitted = true
      }
      innerOnEvent(event)
    },
    ensureEmitted(reason) {
      if (emitted) return
      emitted = true
      innerOnEvent({ type: 'error', message: reason })
    }
  }
}
