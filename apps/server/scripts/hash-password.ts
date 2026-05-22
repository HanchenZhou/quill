#!/usr/bin/env bun
// Helper to generate a bcrypt password hash for config.yaml.
// Usage:  bun run apps/server/scripts/hash-password.ts <password>

import bcrypt from 'bcryptjs'

const password = process.argv[2]
if (!password) {
  console.error('usage: hash-password.ts <password>')
  process.exit(1)
}

const hash = await bcrypt.hash(password, 12)
console.log(hash)
