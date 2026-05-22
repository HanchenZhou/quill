import { describe, expect, it } from 'bun:test'
import { buildCompressionSystemPrompt } from './compress'

describe('buildCompressionSystemPrompt', () => {
  const p = buildCompressionSystemPrompt()

  it('declares the summarizer role and output is a summary, not analysis', () => {
    expect(p).toMatch(/compress|summari[sz]e/i)
  })

  it('tells the model what to PRESERVE — files, decisions, errors, tasks', () => {
    expect(p).toMatch(/file/i)
    expect(p).toMatch(/decision/i)
    expect(p).toMatch(/error/i)
    expect(p).toMatch(/task|todo|outstanding/i)
  })

  it('warns the model not to fabricate facts', () => {
    expect(p).toMatch(/do not invent|don't invent|stay faithful|no fabricat/i)
  })

  it('caps output length so the summary itself does not push us back over the limit', () => {
    expect(p).toMatch(/word|sentence|brief|concise/i)
  })

  it('says to write markdown (so the panel renders cleanly)', () => {
    expect(p).toMatch(/markdown/i)
  })
})
