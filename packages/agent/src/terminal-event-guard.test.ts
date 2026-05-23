/// <reference types="bun" />
import { describe, it, expect } from 'bun:test'
import { createTerminalEventGuard } from './terminal-event-guard'
import type { AgentEvent } from '@quill/shared-types'

describe('createTerminalEventGuard', () => {
  it('forwards every event to the inner sink', () => {
    const seen: AgentEvent[] = []
    const guard = createTerminalEventGuard((e) => seen.push(e))
    guard.onEvent({ type: 'text-delta', delta: 'hi' })
    guard.onEvent({ type: 'tool-call', toolCallId: 't1', name: 'read', args: {} })
    expect(seen.map((e) => e.type)).toEqual(['text-delta', 'tool-call'])
  })

  it('ensureEmitted is a no-op when finish was already forwarded', () => {
    const seen: AgentEvent[] = []
    const guard = createTerminalEventGuard((e) => seen.push(e))
    guard.onEvent({ type: 'finish' })
    guard.ensureEmitted('should not appear')
    expect(seen.map((e) => e.type)).toEqual(['finish'])
  })

  it('ensureEmitted is a no-op when error was already forwarded', () => {
    const seen: AgentEvent[] = []
    const guard = createTerminalEventGuard((e) => seen.push(e))
    guard.onEvent({ type: 'error', message: 'real error' })
    guard.ensureEmitted('should not appear')
    expect(seen.map((e) => e.type)).toEqual(['error'])
    expect((seen[0] as { message: string }).message).toBe('real error')
  })

  it('ensureEmitted emits a synthetic error when neither finish nor error was forwarded', () => {
    const seen: AgentEvent[] = []
    const guard = createTerminalEventGuard((e) => seen.push(e))
    guard.onEvent({ type: 'text-delta', delta: 'started but never finished' })
    guard.ensureEmitted('run ended without a terminal event')
    expect(seen.map((e) => e.type)).toEqual(['text-delta', 'error'])
    expect((seen[1] as { message: string }).message).toBe('run ended without a terminal event')
  })

  it('ensureEmitted is idempotent across multiple calls', () => {
    // runAgent's `finally` always runs ensureEmitted; if for any reason
    // it's called twice (defensive layering elsewhere), it must not emit
    // a second synthetic error.
    const seen: AgentEvent[] = []
    const guard = createTerminalEventGuard((e) => seen.push(e))
    guard.ensureEmitted('first')
    guard.ensureEmitted('second')
    expect(seen).toHaveLength(1)
    expect((seen[0] as { message: string }).message).toBe('first')
  })

  it('treats non-finish/error events as non-terminal even if they look final', () => {
    // `plan-complete` and `finish` look similar in intent but only `finish`
    // (and `error`) clear the renderer's busy state — so only those count.
    const seen: AgentEvent[] = []
    const guard = createTerminalEventGuard((e) => seen.push(e))
    guard.onEvent({ type: 'plan-complete', plan: { steps: [] } })
    guard.ensureEmitted('still wedged')
    expect(seen.map((e) => e.type)).toEqual(['plan-complete', 'error'])
  })
})
