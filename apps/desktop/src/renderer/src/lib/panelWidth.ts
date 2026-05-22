/**
 * Agent panel width bookkeeping. Kept pure so the clamp + storage roundtrip
 * stays testable; the React drag handler in AgentPanel just calls into
 * `clampPanelWidth` on every pointer move.
 */

export const PANEL_WIDTH_MIN = 280
export const PANEL_WIDTH_MAX = 800
export const PANEL_WIDTH_DEFAULT = 360

export function clampPanelWidth(n: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return PANEL_WIDTH_DEFAULT
  if (n < PANEL_WIDTH_MIN) return PANEL_WIDTH_MIN
  if (n > PANEL_WIDTH_MAX) return PANEL_WIDTH_MAX
  return n
}
