import { describe, expect, it } from 'bun:test'
import { shouldCompress, splitForCompression } from './compressionTrigger'
import type { ConvItem } from './itemsToMessages'

describe('shouldCompress', () => {
  it('returns false when usage is missing', () => {
    expect(shouldCompress(undefined, 1000, 0.9)).toBe(false)
  })

  it('returns false when contextTokens is 0 (unknown)', () => {
    expect(shouldCompress({ input: 5000, output: 1000, total: 6000 }, 0, 0.9)).toBe(false)
  })

  it('returns false below threshold', () => {
    // input + output = 5000, threshold = 0.9 * 10000 = 9000
    expect(
      shouldCompress({ input: 4000, output: 1000, total: 5000 }, 10000, 0.9)
    ).toBe(false)
  })

  it('returns true at or above threshold', () => {
    // input + output = 9000 == 0.9 * 10000
    expect(
      shouldCompress({ input: 7000, output: 2000, total: 9000 }, 10000, 0.9)
    ).toBe(true)
    // well over
    expect(
      shouldCompress({ input: 9500, output: 0, total: 9500 }, 10000, 0.9)
    ).toBe(true)
  })

  it('handles custom threshold', () => {
    expect(
      shouldCompress({ input: 800, output: 0, total: 800 }, 1000, 0.5)
    ).toBe(true)
    expect(
      shouldCompress({ input: 400, output: 0, total: 400 }, 1000, 0.5)
    ).toBe(false)
  })
})

describe('splitForCompression', () => {
  const u = (text: string): ConvItem => ({ kind: 'user', text })
  const a = (text: string): ConvItem => ({ kind: 'assistant-text', text })

  it('returns [items, []] when keepRecent >= items.length', () => {
    const items = [u('q1'), a('a1')]
    const { toCompress, kept } = splitForCompression(items, 10)
    expect(toCompress).toEqual([])
    expect(kept).toEqual(items)
  })

  it('returns [items, []] when items is empty', () => {
    const { toCompress, kept } = splitForCompression([], 5)
    expect(toCompress).toEqual([])
    expect(kept).toEqual([])
  })

  it('splits at the boundary so the last N items are kept', () => {
    const items = [u('q1'), a('a1'), u('q2'), a('a2'), u('q3'), a('a3')]
    const { toCompress, kept } = splitForCompression(items, 2)
    expect(toCompress).toEqual([u('q1'), a('a1'), u('q2'), a('a2')])
    expect(kept).toEqual([u('q3'), a('a3')])
  })

  it('respects user-message boundary when the split would land on an assistant turn', () => {
    // Boundary safety: never start `kept` with an assistant message
    // — the model gets confused if its history starts mid-conversation.
    // Walk back until kept starts with `user`.
    const items = [u('q1'), a('a1-1'), a('a1-2'), u('q2'), a('a2')]
    // raw split with keepRecent=3 would give kept = [a('a1-2'), u('q2'), a('a2')]
    // we want it adjusted to start at u('q2') → kept = [u('q2'), a('a2')]
    const { toCompress, kept } = splitForCompression(items, 3)
    expect(kept[0]?.kind).toBe('user')
    expect(toCompress.length + kept.length).toBe(items.length)
  })

  it('does not include UI-only items (finish, plan-usage, route, phase-divider, truncated) in the count', () => {
    // Tool-result / approval items are model-relevant; finish events etc.
    // are decoration that don't count toward "conversation turns".
    const items: ConvItem[] = [
      u('q1'),
      a('a1'),
      { kind: 'finish' },
      u('q2'),
      a('a2'),
      { kind: 'finish' }
    ]
    const { kept } = splitForCompression(items, 2)
    // Last 2 "real" turns are u('q2') + a('a2')
    expect(kept).toContainEqual(u('q2'))
    expect(kept).toContainEqual(a('a2'))
  })
})
