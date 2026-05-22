/**
 * Strategy for resolving an API key for a given provider id at LLM-call time.
 *
 * Implementations:
 * - Desktop: wraps `getProviderKey` (electron safeStorage / keychain).
 * - Server:  reads from `config.yaml` providers list (decrypted at startup).
 *
 * Returning `null` indicates the provider isn't configured — `makeModel`
 * surfaces that as a user-actionable error ("set API key in Settings").
 */
export interface CredentialProvider {
  getKey(providerId: string): Promise<string | null>
}
