import { promises as fs } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

/**
 * config.yaml schema. The shape mirrors docs/web-server.md and is validated
 * at startup so a broken config dies loudly with a clear message rather
 * than crashing mid-request.
 *
 * AI providers are optional — when omitted, /api/agent endpoints reject
 * with a "AI is disabled in this deployment" error and the web UI hides
 * the agent panel.
 */
const ProviderConfigSchema = z.object({
  id: z.string(),
  base_url: z.string().url(),
  api_key: z.string(),
  models: z.array(z.string()).default([])
})

const ConfigSchema = z.object({
  server: z.object({
    port: z.number().int().positive().default(3000),
    base_url: z.string().url().optional()
  }),
  auth: z.object({
    /** bcrypt hash of the password; generate with `quill-server hash-password`. */
    password_hash: z.string().regex(/^\$2[aby]\$/, 'must be a bcrypt hash'),
    /** HMAC secret for signing session JWTs. 32+ random bytes recommended. */
    session_secret: z.string().min(32, 'session_secret must be at least 32 chars'),
    session_ttl_days: z.number().int().positive().default(30)
  }),
  vault: z.object({
    path: z.string()
  }),
  ai: z
    .object({
      providers: z.array(ProviderConfigSchema).default([]),
      default: z.string().optional()
    })
    .optional()
})

export type Config = z.infer<typeof ConfigSchema>
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>

/**
 * Expand `${ENV_VAR}` placeholders against process.env before yaml parsing.
 * Used so api_key / password_hash etc. can be supplied via env vars without
 * baking them into a file checked into source. Missing vars expand to ''.
 */
function interpolate(raw: string, env: NodeJS.ProcessEnv): string {
  return raw.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => env[name] ?? '')
}

export async function loadConfig(
  path: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<Config> {
  let raw: string
  try {
    raw = await fs.readFile(path, 'utf8')
  } catch (err) {
    throw new Error(
      `failed to read config at ${path}: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  const interpolated = interpolate(raw, env)
  let parsed: unknown
  try {
    parsed = parseYaml(interpolated)
  } catch (err) {
    throw new Error(
      `failed to parse ${path} as YAML: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  const result = ConfigSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`invalid config: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
  }
  return result.data
}
