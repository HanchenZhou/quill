import { describe, expect, test } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadConfig } from './config'

async function withTempConfig(yaml: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'quill-config-'))
  const path = join(dir, 'config.yaml')
  await writeFile(path, yaml, 'utf8')
  return path
}

const VALID = `
server:
  port: 3000
auth:
  password_hash: "$2b$12$abcdefghijklmnopqrstuv"
  session_secret: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
vault:
  path: /data/vault
`

describe('loadConfig', () => {
  test('parses a minimal valid file', async () => {
    const path = await withTempConfig(VALID)
    const cfg = await loadConfig(path)
    expect(cfg.server.port).toBe(3000)
    expect(cfg.vault.path).toBe('/data/vault')
    expect(cfg.auth.session_ttl_days).toBe(30) // default
  })

  test('rejects non-bcrypt password_hash', async () => {
    const path = await withTempConfig(
      VALID.replace('$2b$12$abcdefghijklmnopqrstuv', 'plaintext')
    )
    await expect(loadConfig(path)).rejects.toThrow(/password_hash/)
  })

  test('rejects short session_secret', async () => {
    const path = await withTempConfig(
      VALID.replace('a'.repeat(36), 'too-short')
    )
    await expect(loadConfig(path)).rejects.toThrow(/session_secret/)
  })

  test('interpolates ${ENV_VAR} from injected env', async () => {
    const path = await withTempConfig(`
server:
  port: 3000
auth:
  password_hash: "\${PASSWD_HASH}"
  session_secret: "\${SESSION_SECRET}"
vault:
  path: /data/vault
`)
    const cfg = await loadConfig(path, {
      PASSWD_HASH: '$2b$12$abcdefghijklmnopqrstuv',
      SESSION_SECRET: 'a'.repeat(36)
    } as NodeJS.ProcessEnv)
    expect(cfg.auth.password_hash).toBe('$2b$12$abcdefghijklmnopqrstuv')
  })
})
