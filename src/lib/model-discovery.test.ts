import { describe, expect, it } from 'vitest'
import {
  buildModelsEndpoint,
  DEFAULT_LOCAL_MODEL_FALLBACK,
  extractModelIds,
  isDefaultLocalModelBaseUrl,
  isLikelyUsableDefaultModel,
  isPreferredQwenModel,
  selectDefaultModelId
} from './model-discovery'

describe('model-discovery helpers', () => {
  it('builds a models endpoint from an OpenAI-compatible base url', () => {
    expect(buildModelsEndpoint('http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234/v1/models')
    expect(buildModelsEndpoint('http://127.0.0.1:1234/v1/')).toBe('http://127.0.0.1:1234/v1/models')
    expect(buildModelsEndpoint('http://127.0.0.1:1234/v1/models')).toBe('http://127.0.0.1:1234/v1/models')
  })

  it('extracts model ids and prefers a usable default model', () => {
    const modelIds = extractModelIds({
      data: [
        { id: 'text-embedding-nomic-embed' },
        { id: 'qwen2.5-7b-instruct' },
        { id: '' },
        {}
      ]
    })

    expect(modelIds).toEqual(['text-embedding-nomic-embed', 'qwen2.5-7b-instruct'])
    expect(selectDefaultModelId(modelIds, DEFAULT_LOCAL_MODEL_FALLBACK)).toBe('qwen2.5-7b-instruct')
  })

  it('falls back safely when only embedding-style models exist or base url differs', () => {
    expect(isLikelyUsableDefaultModel('text-embedding-3-large')).toBe(false)
    expect(isPreferredQwenModel('qwen2.5:7b')).toBe(true)
    expect(selectDefaultModelId(['text-embedding-3-large'], DEFAULT_LOCAL_MODEL_FALLBACK)).toBe('text-embedding-3-large')
    expect(selectDefaultModelId([], DEFAULT_LOCAL_MODEL_FALLBACK)).toBe(DEFAULT_LOCAL_MODEL_FALLBACK)
    expect(isDefaultLocalModelBaseUrl('http://127.0.0.1:1234/v1/')).toBe(true)
    expect(isDefaultLocalModelBaseUrl('http://127.0.0.1:11434/v1')).toBe(false)
  })

  it('prefers installed qwen-family models when available', () => {
    expect(selectDefaultModelId(['gemma3:4b', 'qwen3-vl:4b'], DEFAULT_LOCAL_MODEL_FALLBACK)).toBe('qwen3-vl:4b')
  })
})
