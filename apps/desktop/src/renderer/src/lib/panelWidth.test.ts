import { describe, expect, it } from 'bun:test'
import { clampPanelWidth, PANEL_WIDTH_MIN, PANEL_WIDTH_MAX, PANEL_WIDTH_DEFAULT } from './panelWidth'

describe('clampPanelWidth', () => {
  it('passes through values inside the range', () => {
    expect(clampPanelWidth(400)).toBe(400)
    expect(clampPanelWidth(PANEL_WIDTH_MIN)).toBe(PANEL_WIDTH_MIN)
    expect(clampPanelWidth(PANEL_WIDTH_MAX)).toBe(PANEL_WIDTH_MAX)
  })

  it('snaps under-range values to the min', () => {
    expect(clampPanelWidth(100)).toBe(PANEL_WIDTH_MIN)
    expect(clampPanelWidth(0)).toBe(PANEL_WIDTH_MIN)
    expect(clampPanelWidth(-50)).toBe(PANEL_WIDTH_MIN)
  })

  it('snaps over-range values to the max', () => {
    expect(clampPanelWidth(2000)).toBe(PANEL_WIDTH_MAX)
    expect(clampPanelWidth(PANEL_WIDTH_MAX + 1)).toBe(PANEL_WIDTH_MAX)
  })

  it('falls back to default for non-finite / non-number input', () => {
    expect(clampPanelWidth(NaN)).toBe(PANEL_WIDTH_DEFAULT)
    expect(clampPanelWidth(Infinity)).toBe(PANEL_WIDTH_MAX)
    expect(clampPanelWidth(-Infinity)).toBe(PANEL_WIDTH_MIN)
  })
})
