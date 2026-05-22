import { describe, test, expect } from 'bun:test'
import { createApprovalsManager } from './approvals'

describe('approvals manager', () => {
  test('request returns a pending promise that resolves on matching respond', async () => {
    const m = createApprovalsManager()
    const p = m.request('run-1', 'tc-1', { foo: 'bar' })
    queueMicrotask(() => m.respond('run-1', 'tc-1', { approved: true }))
    const r = await p
    expect(r.approved).toBe(true)
  })

  test('respond with approved:false propagates reason', async () => {
    const m = createApprovalsManager()
    const p = m.request('run-1', 'tc-2', {})
    queueMicrotask(() => m.respond('run-1', 'tc-2', { approved: false, reason: 'nope' }))
    const r = await p
    expect(r.approved).toBe(false)
    expect(r.reason).toBe('nope')
  })

  test('respond returns true if found, false if not', () => {
    const m = createApprovalsManager()
    m.request('run-1', 'tc-3', {})
    expect(m.respond('run-1', 'tc-3', { approved: true })).toBe(true)
    expect(m.respond('run-1', 'tc-missing', { approved: true })).toBe(false)
  })

  test('respond for an already-resolved approval returns false', async () => {
    const m = createApprovalsManager()
    const p = m.request('run-1', 'tc-4', {})
    m.respond('run-1', 'tc-4', { approved: true })
    await p
    expect(m.respond('run-1', 'tc-4', { approved: true })).toBe(false)
  })

  test('cancelRun rejects all pending for that run with approved:false reason cancelled', async () => {
    const m = createApprovalsManager()
    const p1 = m.request('run-A', 'tc-1', {})
    const p2 = m.request('run-A', 'tc-2', {})
    const p3 = m.request('run-B', 'tc-1', {})
    const n = m.cancelRun('run-A')
    expect(n).toBe(2)
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.approved).toBe(false)
    expect(r1.reason).toBe('cancelled')
    expect(r2.approved).toBe(false)
    // run-B still pending
    queueMicrotask(() => m.respond('run-B', 'tc-1', { approved: true }))
    const r3 = await p3
    expect(r3.approved).toBe(true)
  })

  test('cancelRun on unknown runId returns 0', () => {
    const m = createApprovalsManager()
    expect(m.cancelRun('nope')).toBe(0)
  })

  test('pending() lists currently pending approval requests', () => {
    const m = createApprovalsManager()
    m.request('run-1', 'tc-1', { kind: 'write_file', path: '/a' })
    m.request('run-1', 'tc-2', { kind: 'apply_edit', path: '/b' })
    const pending = m.pending('run-1')
    expect(pending.length).toBe(2)
    expect(pending.map((p) => p.toolCallId).sort()).toEqual(['tc-1', 'tc-2'])
  })
})
