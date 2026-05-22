import { Hono } from 'hono'
import { loadConfig } from './config'
import { createAuthRoutes } from './auth-routes'
import { createVaultRoutes } from './vault'
import { requireSession } from './auth'

const CONFIG_PATH = process.env.QUILL_CONFIG ?? './config.yaml'

const config = await loadConfig(CONFIG_PATH)

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true }))

app.route(
  '/api/auth',
  createAuthRoutes({
    passwordHash: config.auth.password_hash,
    sessionSecret: config.auth.session_secret,
    sessionTtlDays: config.auth.session_ttl_days
  })
)

// All /api/vault/* endpoints require an authenticated session.
const vaultApp = new Hono()
vaultApp.use('*', requireSession(config.auth.session_secret))
vaultApp.route('/', createVaultRoutes(config.vault.path))
app.route('/api/vault', vaultApp)

// eslint-disable-next-line no-console
console.log(
  JSON.stringify({
    event: 'server-start',
    port: config.server.port,
    vault: config.vault.path,
    aiProviders: config.ai?.providers.length ?? 0
  })
)

export default {
  port: config.server.port,
  fetch: app.fetch
}
