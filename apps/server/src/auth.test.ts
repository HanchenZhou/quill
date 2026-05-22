import { describe, expect, test } from 'bun:test'
import bcrypt from 'bcryptjs'
import { verifyPassword, signSession, verifySession } from './auth'

const SECRET = 'a'.repeat(36)

describe('verifyPassword', () => {
  test('returns true for the correct password', async () => {
    const hash = await bcrypt.hash('hunter2', 4)
    expect(await verifyPassword('hunter2', hash)).toBe(true)
  })

  test('returns false for the wrong password', async () => {
    const hash = await bcrypt.hash('hunter2', 4)
    expect(await verifyPassword('hunter3', hash)).toBe(false)
  })
})

describe('session token roundtrip', () => {
  test('verifySession returns the original subject for a fresh token', async () => {
    const token = await signSession(SECRET, 1)
    const payload = await verifySession(SECRET, token)
    expect(payload).not.toBeNull()
    expect(payload?.sub).toBe('user')
  })

  test('verifySession returns null for a token signed with a different secret', async () => {
    const token = await signSession(SECRET, 1)
    const result = await verifySession('b'.repeat(36), token)
    expect(result).toBeNull()
  })

  test('verifySession returns null for a malformed token', async () => {
    const result = await verifySession(SECRET, 'not-a-jwt')
    expect(result).toBeNull()
  })

  test('verifySession returns null for an expired token', async () => {
    // ttlDays = 0 → expires immediately. jose's exp is in seconds since
    // epoch; clock skew is +/- 0 by default, so an iat==exp token is past.
    const token = await signSession(SECRET, 0)
    // Give the clock a moment so exp is strictly in the past.
    await new Promise((r) => setTimeout(r, 50))
    const result = await verifySession(SECRET, token)
    expect(result).toBeNull()
  })
})
