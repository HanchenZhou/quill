import { describe, expect, test } from 'bun:test'
import { coerceUsage, formatContextWindow, formatTokens, sumUsage } from './usage'

describe('coerceUsage', () => {
  test('v6 shape (inputTokens / outputTokens / totalTokens)', () => {
    expect(coerceUsage({ inputTokens: 10, outputTokens: 5, totalTokens: 15 })).toEqual({
      input: 10,
      output: 5,
      total: 15
    })
  })

  test('legacy shape (promptTokens / completionTokens)', () => {
    expect(coerceUsage({ promptTokens: 7, completionTokens: 3 })).toEqual({
      input: 7,
      output: 3,
      total: 10
    })
  })

  test('partial fields default to zero', () => {
    expect(coerceUsage({ inputTokens: 12 })).toEqual({ input: 12, output: 0, total: 12 })
  })

  test('non-numeric / negative ignored', () => {
    expect(coerceUsage({ inputTokens: -3, outputTokens: 'abc', totalTokens: 9 })).toEqual({
      input: 0,
      output: 0,
      total: 9
    })
  })

  test('returns undefined when nothing recognizable', () => {
    expect(coerceUsage(null)).toBeUndefined()
    expect(coerceUsage({})).toBeUndefined()
    expect(coerceUsage('hi')).toBeUndefined()
  })
})

describe('sumUsage', () => {
  test('sums all fields and skips undefined', () => {
    expect(
      sumUsage([
        { input: 10, output: 5, total: 15 },
        undefined,
        { input: 4, output: 2, total: 6 }
      ])
    ).toEqual({ input: 14, output: 7, total: 21 })
  })

  test('all undefined → zeros', () => {
    expect(sumUsage([undefined, undefined])).toEqual({ input: 0, output: 0, total: 0 })
  })
})

describe('formatTokens', () => {
  test('thousand separators', () => {
    expect(formatTokens(1234)).toBe('1,234')
    expect(formatTokens(1_234_567)).toBe('1,234,567')
  })
})

describe('formatContextWindow', () => {
  test('K under 1M', () => {
    expect(formatContextWindow(262_144)).toBe('262K')
    expect(formatContextWindow(8192)).toBe('8K')
  })
  test('M at 1M and above', () => {
    expect(formatContextWindow(1_000_000)).toBe('1.0M')
    expect(formatContextWindow(2_500_000)).toBe('2.5M')
  })
})
