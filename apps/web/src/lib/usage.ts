/**
 * Token usage normalization. AI SDK + various provider shapes drift:
 *   v6 finish chunks: { inputTokens, outputTokens, totalTokens }
 *   v3/v4 (older clients): { promptTokens, completionTokens, totalTokens }
 *   some providers omit fields or return nulls.
 *
 * Normalize to a fixed `{ input, output, total }` shape so the renderer's
 * accumulator can just add numbers without sniffing.
 *
 * Mirror of apps/desktop/src/renderer/src/lib/usage.ts — kept in sync by
 * eyeball until packages/core absorbs it.
 */

export type Usage = { input: number; output: number; total: number }

function asPositiveNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined
}

/** Returns undefined for "nothing recognizable here" — distinct from
 *  zero, which is a real outcome we want callers to surface. */
export function coerceUsage(raw: unknown): Usage | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const input = asPositiveNumber(r.inputTokens) ?? asPositiveNumber(r.promptTokens)
  const output = asPositiveNumber(r.outputTokens) ?? asPositiveNumber(r.completionTokens)
  const total = asPositiveNumber(r.totalTokens)
  if (input === undefined && output === undefined && total === undefined) {
    return undefined
  }
  const i = input ?? 0
  const o = output ?? 0
  return { input: i, output: o, total: total ?? i + o }
}

export function sumUsage(parts: Array<Usage | undefined>): Usage {
  let input = 0
  let output = 0
  let total = 0
  for (const p of parts) {
    if (!p) continue
    input += p.input
    output += p.output
    total += p.total
  }
  return { input, output, total }
}

export function formatTokens(n: number): string {
  // Use Intl for thousand separators — matches desktop's formatTokens.
  return n.toLocaleString('en-US')
}

/** Compact context-window formatter: 262144 → "262K", 1_000_000 → "1.0M". */
export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return (tokens / 1_000_000).toFixed(1) + 'M'
  return Math.round(tokens / 1000) + 'K'
}
