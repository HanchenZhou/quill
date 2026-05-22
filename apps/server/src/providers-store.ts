import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Persisted provider configuration for the server. One entry per provider
 * the user has configured a key for. The catalog (baseURL / supported
 * models) lives in @quill/agent's PROFILES — this store only tracks which
 * providers are enabled and what credentials they use.
 */
export type StoredProvider = {
  id: string
  api_key: string
  /** The model id the user picked from the catalog. */
  model: string
  addedAt: number
  updatedAt: number
}

type FileShape = {
  providers: StoredProvider[]
  defaultId?: string
}

/**
 * File-backed store. JSON at `path`, chmod 0600 (keys live in plaintext;
 * file mode plus filesystem permissions is the protection layer — anyone
 * who can read this can already read your config.yaml's password hash).
 *
 * In-memory cache backs reads so the agent runtime can resolve keys
 * without hitting disk on every LLM call. Writes flush the cache to
 * disk and update the cache atomically.
 */
export class ProvidersStore {
  private cache: FileShape = { providers: [] }
  private loaded = false

  constructor(private readonly path: string) {}

  async load(): Promise<void> {
    if (this.loaded) return
    try {
      const raw = await fs.readFile(this.path, 'utf8')
      const parsed = JSON.parse(raw) as Partial<FileShape>
      this.cache = {
        providers: Array.isArray(parsed.providers) ? parsed.providers : [],
        defaultId: typeof parsed.defaultId === 'string' ? parsed.defaultId : undefined
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        // First boot — empty store, save lazily on first mutation.
        this.cache = { providers: [] }
      } else {
        throw err
      }
    }
    this.loaded = true
  }

  /** Seed from config.yaml's ai.providers if the store is otherwise empty.
   *  Lets existing deployments keep working without a manual migration. */
  async seedFromConfig(
    configProviders: Array<{ id: string; api_key: string; models?: string[] }>
  ): Promise<void> {
    await this.load()
    if (this.cache.providers.length > 0) return
    if (configProviders.length === 0) return
    const now = Date.now()
    this.cache.providers = configProviders.map((p) => ({
      id: p.id,
      api_key: p.api_key,
      model: p.models?.[0] ?? '',
      addedAt: now,
      updatedAt: now
    }))
    await this.flush()
  }

  list(): StoredProvider[] {
    return this.cache.providers.map((p) => ({ ...p }))
  }

  /** Sanitized view — never includes api_key. Safe to return from REST. */
  listPublic(): Array<{ id: string; model: string; addedAt: number; updatedAt: number }> {
    return this.cache.providers.map((p) => ({
      id: p.id,
      model: p.model,
      addedAt: p.addedAt,
      updatedAt: p.updatedAt
    }))
  }

  getKey(id: string): string | null {
    const found = this.cache.providers.find((p) => p.id === id)
    return found?.api_key ?? null
  }

  getModel(id: string): string | null {
    return this.cache.providers.find((p) => p.id === id)?.model ?? null
  }

  async upsert(input: { id: string; api_key?: string; model: string }): Promise<void> {
    const now = Date.now()
    const existing = this.cache.providers.find((p) => p.id === input.id)
    if (existing) {
      // Empty api_key means "keep the stored one" (matches desktop's edit-without-key behavior).
      if (input.api_key !== undefined && input.api_key.length > 0) {
        existing.api_key = input.api_key
      }
      existing.model = input.model
      existing.updatedAt = now
    } else {
      if (!input.api_key) {
        throw new Error('api_key required when adding a new provider')
      }
      this.cache.providers.push({
        id: input.id,
        api_key: input.api_key,
        model: input.model,
        addedAt: now,
        updatedAt: now
      })
    }
    await this.flush()
  }

  async remove(id: string): Promise<void> {
    const before = this.cache.providers.length
    this.cache.providers = this.cache.providers.filter((p) => p.id !== id)
    if (this.cache.defaultId === id) this.cache.defaultId = undefined
    if (this.cache.providers.length !== before) {
      await this.flush()
    }
  }

  getDefault(): string | null {
    return this.cache.defaultId ?? this.cache.providers[0]?.id ?? null
  }

  async setDefault(id: string | null): Promise<void> {
    this.cache.defaultId = id ?? undefined
    await this.flush()
  }

  private async flush(): Promise<void> {
    await fs.mkdir(dirname(this.path), { recursive: true })
    const tmp = this.path + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(this.cache, null, 2) + '\n', {
      mode: 0o600
    })
    await fs.rename(tmp, this.path)
  }
}
