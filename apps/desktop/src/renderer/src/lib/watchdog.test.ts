/// <reference types="bun" />
import { describe, it, expect, mock } from 'bun:test'
import { createWatchdog, type Schedule } from './watchdog'

function makeFakeSchedule(): Schedule & {
  flush: (ms?: number) => void
  pending: number
} {
  let now = 0
  const queue: Array<{ id: number; fireAt: number; fn: () => void }> = []
  let nextId = 1
  return {
    setTimeout(fn, ms) {
      const id = nextId++
      queue.push({ id, fireAt: now + ms, fn })
      return id as unknown as ReturnType<typeof setTimeout>
    },
    clearTimeout(id) {
      const i = queue.findIndex((t) => t.id === (id as unknown as number))
      if (i >= 0) queue.splice(i, 1)
    },
    flush(ms = Infinity) {
      now += ms
      // Fire in scheduled order (each callback may schedule more).
      while (true) {
        const next = queue[0]
        if (!next) break
        if (next.fireAt > now) break
        queue.shift()
        next.fn()
      }
    },
    get pending() {
      return queue.length
    }
  }
}

describe('createWatchdog', () => {
  it('fires onTimeout after the given delay when started and never touched', () => {
    const onTimeout = mock(() => {})
    const sched = makeFakeSchedule()
    const w = createWatchdog(5000, onTimeout, sched)
    w.start()
    expect(sched.pending).toBe(1)
    sched.flush(5000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('does not fire when touched before the deadline', () => {
    const onTimeout = mock(() => {})
    const sched = makeFakeSchedule()
    const w = createWatchdog(5000, onTimeout, sched)
    w.start()
    sched.flush(3000)
    w.touch()
    sched.flush(3000) // total 6000, but timer was reset at 3000
    expect(onTimeout).not.toHaveBeenCalled()
    sched.flush(3000) // total 9000 — 6000 after touch, past deadline
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('stops cleanly without firing when stop() is called', () => {
    const onTimeout = mock(() => {})
    const sched = makeFakeSchedule()
    const w = createWatchdog(5000, onTimeout, sched)
    w.start()
    w.stop()
    expect(sched.pending).toBe(0)
    sched.flush(10_000)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('only fires once even when touch is called repeatedly across the deadline', () => {
    const onTimeout = mock(() => {})
    const sched = makeFakeSchedule()
    const w = createWatchdog(5000, onTimeout, sched)
    w.start()
    sched.flush(5000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
    // After firing, additional touches without a fresh start() do nothing.
    w.touch()
    w.touch()
    sched.flush(10_000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('restarting after stop schedules a fresh deadline', () => {
    const onTimeout = mock(() => {})
    const sched = makeFakeSchedule()
    const w = createWatchdog(5000, onTimeout, sched)
    w.start()
    w.stop()
    w.start()
    sched.flush(5000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it('start() while already running just resets the deadline', () => {
    const onTimeout = mock(() => {})
    const sched = makeFakeSchedule()
    const w = createWatchdog(5000, onTimeout, sched)
    w.start()
    sched.flush(4000)
    w.start() // reset
    sched.flush(4000) // total 8000, but reset at 4000 → 4000 since reset
    expect(onTimeout).not.toHaveBeenCalled()
    sched.flush(1000) // total 9000, 5000 since reset
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })
})
