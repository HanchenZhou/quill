import type { AgentEvent } from '@quill/shared-types'

function abortError(): Error {
  // DOMException is the shape Node, browsers, and the AI SDK all
  // recognise as a cancellation marker (`err.name === 'AbortError'`).
  // Falling back to a plain Error keeps the helper usable in stripped
  // runtimes that don't ship DOMException.
  if (typeof DOMException === 'function') {
    return new DOMException('Aborted', 'AbortError')
  }
  const e = new Error('Aborted')
  e.name = 'AbortError'
  return e
}

/**
 * Consume the AI SDK `streamText().fullStream` and translate each chunk
 * into an `AgentEvent` for the caller.
 *
 * Extracted from `runBuildPhase` so the abort-safety guarantee can be
 * exercised directly in unit tests — wedged LLM providers (half-open TCP,
 * idle keep-alive) can leave `fullStream` waiting on `.next()` forever
 * even after `abortSignal` is tripped on the underlying request, so the
 * loop checks `signal.aborted` between chunks and *throws* AbortError
 * instead of relying on the SDK to throw. The throw is critical: it
 * lets `runAgent`'s outer `try/catch` see the cancellation and emit a
 * terminal `error: cancelled` event, which is what clears `busy/runId`
 * on the renderer (see #89). Silently returning here lets the call
 * stack unwind cleanly but leaves the UI spinning forever.
 *
 * The chunk shape uses `Record<string, unknown>` because the AI SDK
 * surfaces fields under different names across versions (`text` vs
 * `delta`, `totalUsage` vs `usage`, …); the casts here paper over that
 * variance the same way the original inline loop did.
 */
export async function consumeBuildStream(
  stream: AsyncIterable<Record<string, unknown> & { type: string }>,
  signal: AbortSignal,
  onEvent: (event: AgentEvent) => void
): Promise<void> {
  if (signal.aborted) throw abortError()

  for await (const chunk of stream) {
    if (signal.aborted) throw abortError()

    switch (chunk.type) {
      case 'text-delta': {
        const delta =
          (chunk as { text?: string }).text ??
          (chunk as { delta?: string }).delta ??
          ''
        onEvent({ type: 'text-delta', delta })
        break
      }
      case 'tool-call': {
        const c = chunk as unknown as {
          toolCallId: string
          toolName: string
          input?: unknown
          args?: unknown
        }
        onEvent({
          type: 'tool-call',
          toolCallId: c.toolCallId,
          name: c.toolName,
          args: c.input ?? c.args
        })
        break
      }
      case 'tool-result': {
        const c = chunk as unknown as {
          toolCallId: string
          toolName: string
          output?: unknown
          result?: unknown
        }
        onEvent({
          type: 'tool-result',
          toolCallId: c.toolCallId,
          name: c.toolName,
          result: c.output ?? c.result
        })
        break
      }
      case 'finish-step':
        onEvent({
          type: 'step-finish',
          usage: (chunk as { usage?: unknown }).usage
        })
        break
      case 'finish':
        onEvent({
          type: 'finish',
          usage:
            (chunk as { totalUsage?: unknown }).totalUsage ??
            (chunk as { usage?: unknown }).usage,
          finishReason: (chunk as { finishReason?: string }).finishReason
        })
        break
      case 'error':
        onEvent({
          type: 'error',
          message: String((chunk as { error?: unknown }).error)
        })
        break
      default:
        // Unhandled chunk type (reasoning, redacted, ...) — skip silently.
        break
    }
  }

  // Stream closed on its own. If abort fired in the gap between the last
  // chunk and the iterator finalising, the in-loop check missed it — surface
  // the cancellation as a throw so the outer catch still emits `error:
  // cancelled`. Without this, an SDK that unwinds cleanly on abort would
  // look indistinguishable from a real `finish` to the caller.
  if (signal.aborted) throw abortError()
}
