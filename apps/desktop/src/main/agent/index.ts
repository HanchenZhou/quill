import { streamText, stepCountIs } from 'ai'
import { makeModel } from './providers'
import { makeTools } from './tools'
import { buildSystemPrompt } from './prompt'
import type { Scope } from './scope'

export type { Scope } from './scope'
export { buildSystemPrompt } from './prompt'

export type AgentRunArgs = {
  providerId: string
  modelId: string
  prompt: string
  scope: Scope
  /** Snapshot of the user's currently open file at run start. Injected into
   *  the system prompt so the agent has the editing context without burning
   *  a read_file tool call. */
  currentBuffer?: string
  /** Currently selected text in the editor. */
  currentSelection?: string
}

export type AgentEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'tool-call'; toolCallId: string; name: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; name: string; result: unknown }
  | { type: 'step-finish'; usage?: unknown }
  | { type: 'finish'; usage?: unknown; finishReason?: string }
  | { type: 'error'; message: string }

const runs = new Map<string, AbortController>()

export function cancelRun(runId: string): boolean {
  const c = runs.get(runId)
  if (!c) return false
  c.abort()
  return true
}

export async function runAgent(
  runId: string,
  args: AgentRunArgs,
  onEvent: (event: AgentEvent) => void
): Promise<void> {
  const controller = new AbortController()
  runs.set(runId, controller)

  try {
    const model = await makeModel(args.providerId, args.modelId)
    const tools =
      args.scope.kind === 'untitled' ? undefined : makeTools(args.scope)

    const result = streamText({
      model,
      system: buildSystemPrompt(args.scope, args.currentBuffer, args.currentSelection),
      messages: [{ role: 'user', content: args.prompt }],
      tools,
      stopWhen: stepCountIs(15),
      abortSignal: controller.signal
    })

    for await (const chunk of result.fullStream) {
      // ai-sdk v6 stream parts are a discriminated union. We narrow with
      // `chunk.type` and pull the fields we care about. Use `unknown` casts
      // sparingly because the typed shape changes between minor versions.
      switch (chunk.type) {
        case 'text-delta':
          onEvent({
            type: 'text-delta',
            delta:
              (chunk as unknown as { text?: string; delta?: string }).text ??
              (chunk as unknown as { delta?: string }).delta ??
              ''
          })
          break
        case 'tool-call':
          onEvent({
            type: 'tool-call',
            toolCallId: chunk.toolCallId,
            name: chunk.toolName,
            args:
              (chunk as unknown as { input?: unknown }).input ??
              (chunk as unknown as { args?: unknown }).args
          })
          break
        case 'tool-result':
          onEvent({
            type: 'tool-result',
            toolCallId: chunk.toolCallId,
            name: chunk.toolName,
            result:
              (chunk as unknown as { output?: unknown }).output ??
              (chunk as unknown as { result?: unknown }).result
          })
          break
        case 'finish-step':
          onEvent({
            type: 'step-finish',
            usage: (chunk as unknown as { usage?: unknown }).usage
          })
          break
        case 'finish':
          onEvent({
            type: 'finish',
            usage:
              (chunk as unknown as { totalUsage?: unknown }).totalUsage ??
              (chunk as unknown as { usage?: unknown }).usage,
            finishReason: (chunk as unknown as { finishReason?: string }).finishReason
          })
          break
        case 'error':
          onEvent({
            type: 'error',
            message: String((chunk as unknown as { error?: unknown }).error)
          })
          break
        default:
          // Unhandled chunk type (reasoning, redacted, etc.) — skip silently
          break
      }
    }
  } catch (err) {
    if (controller.signal.aborted) {
      onEvent({ type: 'error', message: 'cancelled' })
    } else {
      onEvent({
        type: 'error',
        message: err instanceof Error ? err.message : String(err)
      })
    }
  } finally {
    runs.delete(runId)
  }
}
