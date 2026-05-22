import type { ConvItem } from './itemsToMessages'
import type { Usage } from './usage'

/**
 * Decide whether the conversation is close enough to the model's context
 * window that we should run a compression pass before the next turn.
 *
 * Heuristic: the next call's input ≈ last call's (input + output) + new
 * prompt. If `input + output` is already past `threshold * contextTokens`
 * the next turn risks overflowing. 0.9 is the default headroom budget.
 *
 * Returns false when usage is missing, when contextTokens is 0 (unknown
 * model), or when we're still safely below threshold.
 */
export function shouldCompress(
  lastUsage: Usage | undefined,
  contextTokens: number,
  threshold: number
): boolean {
  if (!lastUsage) return false
  if (!contextTokens || contextTokens <= 0) return false
  const headroom = lastUsage.input + lastUsage.output
  return headroom >= threshold * contextTokens
}

/**
 * "Conversation turns" — items that meaningfully carry context: user
 * messages, assistant text, tool calls / results, approvals, plans, and
 * compressed-summary blocks. Everything else (finish marker, plan-usage
 * telemetry, route decision, phase divider, truncated marker, error
 * line) is UI decoration that shouldn't count when picking the "last N"
 * boundary.
 */
function isConversationTurn(item: ConvItem): boolean {
  return (
    item.kind === 'user' ||
    item.kind === 'assistant-text' ||
    item.kind === 'tool-call' ||
    item.kind === 'tool-result' ||
    item.kind === 'approval' ||
    item.kind === 'plan' ||
    item.kind === 'compressed-summary'
  )
}

export type SplitResult = {
  /** Older items the compression agent will summarize. */
  toCompress: ConvItem[]
  /** Recent items kept verbatim. May be the entire input when items
   *  has fewer than keepRecent conversation turns. */
  kept: ConvItem[]
}

/**
 * Walk back from the end of items[] counting "real" turns until we have
 * `keepRecent` of them. Adjust forward if the boundary lands inside an
 * assistant burst so `kept` always starts on a `user` turn — otherwise
 * the model sees history that starts mid-thought.
 *
 * When items has fewer than `keepRecent` real turns, returns
 * `{ toCompress: [], kept: items }` — nothing to compress yet.
 */
export function splitForCompression(items: ConvItem[], keepRecent: number): SplitResult {
  if (items.length === 0 || keepRecent <= 0) {
    return { toCompress: [], kept: items }
  }
  // Walk backwards counting "real" turns until we've collected keepRecent.
  let realCount = 0
  let cutIndex = items.length
  for (let i = items.length - 1; i >= 0; i--) {
    if (isConversationTurn(items[i])) {
      realCount++
      if (realCount === keepRecent) {
        cutIndex = i
        break
      }
    }
  }
  if (realCount < keepRecent) {
    // Not enough real turns to even fill keepRecent — nothing to compress.
    return { toCompress: [], kept: items }
  }
  // Adjust forward so kept starts on a user message. Anything walked past
  // here joins toCompress.
  while (cutIndex < items.length && items[cutIndex].kind !== 'user') {
    cutIndex++
  }
  return {
    toCompress: items.slice(0, cutIndex),
    kept: items.slice(cutIndex)
  }
}
