export type Schedule = {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void
}

export type Watchdog = {
  /** Arm or re-arm the timer. Safe to call when already running — it just
   *  resets the deadline (same effect as `touch`). */
  start: () => void
  /** Reset the timer because a sign of life arrived (any agent event). */
  touch: () => void
  /** Tear down the timer. Idempotent. After stop, the watchdog can be
   *  re-armed with another start(). */
  stop: () => void
}

const DEFAULT_SCHEDULE: Schedule = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id)
}

/**
 * Generic dead-man switch. AgentPanel uses it as the last-line safety net
 * for #89: if no agent event lands within `timeoutMs` while the run is
 * still believed to be active, the renderer assumes main has gone silent
 * and recovers by clearing `busy/runId` itself. main-side fixes
 * (terminal-event-guard, IPC try/catch) cover almost every path; this
 * watchdog catches the cases they can't — main process crash, IPC
 * delivery failure, listener race that drops an event.
 *
 * `schedule` is injectable so tests can substitute deterministic timers.
 */
export function createWatchdog(
  timeoutMs: number,
  onTimeout: () => void,
  schedule: Schedule = DEFAULT_SCHEDULE
): Watchdog {
  let handle: ReturnType<typeof setTimeout> | null = null
  let fired = false

  const fire = (): void => {
    handle = null
    if (fired) return
    fired = true
    onTimeout()
  }

  const arm = (): void => {
    if (handle !== null) schedule.clearTimeout(handle)
    handle = schedule.setTimeout(fire, timeoutMs)
  }

  return {
    start() {
      fired = false
      arm()
    },
    touch() {
      // Only meaningful while the timer is armed and hasn't fired. Touch
      // after fire is a no-op — caller has to start() again explicitly.
      if (handle === null) return
      arm()
    },
    stop() {
      if (handle !== null) {
        schedule.clearTimeout(handle)
        handle = null
      }
    }
  }
}
