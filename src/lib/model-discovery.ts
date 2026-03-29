export const DEFAULT_LOCAL_MODEL_BASE_URL = 'http://127.0.0.1:1234/v1'
export const DEFAULT_LOCAL_MODEL_FALLBACK = 'qwen2.5:7b'

interface ModelListEntry {
  id?: unknown
}

interface OpenAICompatibleModelList {
  data?: ModelListEntry[]
}

export function normalizeModelBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '')
}

export function buildModelsEndpoint(baseUrl: string) {
  const normalizedBaseUrl = normalizeModelBaseUrl(baseUrl)
  if (!normalizedBaseUrl) {
    return ''
  }

  return normalizedBaseUrl.endsWith('/models')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/models`
}

export function extractModelIds(payload: unknown) {
  const data = (payload as OpenAICompatibleModelList | null)?.data
  if (!Array.isArray(data)) {
    return []
  }

  return data
    .map((item) => item?.id)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
}

export function isLikelyUsableDefaultModel(modelId: string) {
  return !/(embedding|embed|rerank|moderation|whisper|transcri|tts|speech)/i.test(modelId)
}

export function isPreferredQwenModel(modelId: string) {
  return /(qwen|qwq)/i.test(modelId)
}

export function selectDefaultModelId(modelIds: string[], fallback = DEFAULT_LOCAL_MODEL_FALLBACK) {
  const preferredQwenModel = modelIds.find((modelId) => isPreferredQwenModel(modelId) && isLikelyUsableDefaultModel(modelId))
  if (preferredQwenModel) {
    return preferredQwenModel
  }

  const preferred = modelIds.find(isLikelyUsableDefaultModel)
  return preferred || modelIds[0] || fallback
}

export function isDefaultLocalModelBaseUrl(baseUrl: string) {
  return normalizeModelBaseUrl(baseUrl) === DEFAULT_LOCAL_MODEL_BASE_URL
}
