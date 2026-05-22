import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import { getProviderKey } from '../providers'

type ProviderKind = 'anthropic' | 'openai-compatible'

/**
 * Minimal mirror of `renderer/src/lib/providers.ts` PROVIDERS — just enough
 * for the model factory. Keep in sync with the renderer registry; renderer is
 * the source of truth for display name / docs URL / default model.
 */
const PROFILES: Record<string, { kind: ProviderKind; baseURL: string }> = {
  anthropic: { kind: 'anthropic', baseURL: 'https://api.anthropic.com' },
  openai: { kind: 'openai-compatible', baseURL: 'https://api.openai.com/v1' },
  kimi: { kind: 'openai-compatible', baseURL: 'https://api.kimi.com/coding/v1' },
  deepseek: { kind: 'openai-compatible', baseURL: 'https://api.deepseek.com/v1' },
  glm: {
    kind: 'openai-compatible',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/'
  },
  qwen: {
    kind: 'openai-compatible',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  }
}

/**
 * Build an ai-sdk LanguageModel for the given providerId + modelId. Decrypts
 * the stored API key on demand — main process only.
 */
export async function makeModel(
  providerId: string,
  modelId: string
): Promise<LanguageModel> {
  const profile = PROFILES[providerId]
  if (!profile) {
    throw new Error(`unknown provider: ${providerId}`)
  }
  const key = await getProviderKey(providerId)
  if (!key) {
    throw new Error(`provider "${providerId}" not configured — set API key in Settings`)
  }
  if (profile.kind === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: key })
    return anthropic(modelId)
  }
  const provider = createOpenAICompatible({
    name: providerId,
    baseURL: profile.baseURL,
    apiKey: key
  })
  return provider(modelId)
}
