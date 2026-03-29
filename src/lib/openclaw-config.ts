import type { OpenClawChannelType, OpenClawPluginPreset, OpenClawSettings } from '../types'
import { DEFAULT_LOCAL_MODEL_BASE_URL, DEFAULT_LOCAL_MODEL_FALLBACK } from './model-discovery'

export interface OpenClawPaths {
  configPath: string
  configDir: string
  defaultWorkspacePath: string
  homedir: string
}

export interface OpenClawConfigObject {
  [key: string]: unknown
}

const DEFAULT_MEMORY_LANCEDB_CONFIG = {
  embedding: {
    apiKey: '${OPENAI_API_KEY}',
    model: 'text-embedding-3-small'
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function isChannelType(value: string): value is OpenClawChannelType {
  return ['telegram', 'discord', 'slack', 'none'].includes(value)
}

export function getDefaultOpenClawSettings(paths: OpenClawPaths): OpenClawSettings {
  return {
    configPath: paths.configPath,
    configDir: paths.configDir,
    workspacePath: paths.defaultWorkspacePath,
    modelProviderId: 'custom-openai',
    modelBaseUrl: DEFAULT_LOCAL_MODEL_BASE_URL,
    modelApiKey: 'local',
    modelApi: 'openai-responses',
    modelId: DEFAULT_LOCAL_MODEL_FALLBACK,
    fallbackModelIds: [],
    channelType: 'telegram',
    dmPolicy: 'pairing',
    groupPolicy: 'disabled',
    telegramBotToken: '',
    telegramRequireMention: true,
    discordBotToken: '',
    slackBotToken: '',
    slackAppToken: '',
    slackUserToken: '',
    slackUserTokenReadOnly: true
  }
}

export function expandHomePath(targetPath: string, homedir: string) {
  if (targetPath.startsWith('~/')) {
    return `${homedir}/${targetPath.slice(2)}`.replace(/\/+/g, '/')
  }

  return targetPath
}

export function normalizeOpenClawSettings(settings: OpenClawSettings, paths: OpenClawPaths): OpenClawSettings {
  const defaults = getDefaultOpenClawSettings(paths)

  return {
    ...defaults,
    ...settings,
    configPath: paths.configPath,
    configDir: paths.configDir,
    workspacePath: expandHomePath(settings.workspacePath || defaults.workspacePath, paths.homedir),
    modelProviderId: (settings.modelProviderId || defaults.modelProviderId).trim(),
    modelBaseUrl: (settings.modelBaseUrl || defaults.modelBaseUrl).trim(),
    modelApiKey: (settings.modelApiKey || '').trim(),
    modelId: (settings.modelId || defaults.modelId).trim(),
    fallbackModelIds: Array.isArray(settings.fallbackModelIds)
      ? settings.fallbackModelIds.map((modelId) => modelId.trim()).filter(Boolean)
      : defaults.fallbackModelIds,
    telegramBotToken: (settings.telegramBotToken || '').trim(),
    discordBotToken: (settings.discordBotToken || '').trim(),
    slackBotToken: (settings.slackBotToken || '').trim(),
    slackAppToken: (settings.slackAppToken || '').trim(),
    slackUserToken: (settings.slackUserToken || '').trim(),
    channelType: isChannelType(settings.channelType) ? settings.channelType : defaults.channelType
  }
}

export function readOpenClawSettingsFromConfig(config: OpenClawConfigObject, paths: OpenClawPaths): OpenClawSettings {
  const defaults = getDefaultOpenClawSettings(paths)
  const agents = asRecord(config.agents)
  const defaultsSection = asRecord(agents.defaults)
  const modelSection = asRecord(defaultsSection.model)
  const workspacePath = expandHomePath(readString(defaultsSection.workspace, defaults.workspacePath), paths.homedir)
  const primaryModel = readString(modelSection.primary)
  const fallbackModels = readStringArray(modelSection.fallbacks)
  const [providerFromPrimary, modelIdFromPrimary] = primaryModel.includes('/')
    ? primaryModel.split(/\/(.+)/, 2)
    : [defaults.modelProviderId, defaults.modelId]

  const models = asRecord(config.models)
  const providers = asRecord(models.providers)
  const providerConfig = asRecord(providers[providerFromPrimary || defaults.modelProviderId])

  const channels = asRecord(config.channels)
  const telegramConfig = asRecord(channels.telegram)
  const telegramGroups = asRecord(telegramConfig.groups)
  const telegramWildcardGroup = asRecord(telegramGroups['*'])
  const discordConfig = asRecord(channels.discord)
  const slackConfig = asRecord(channels.slack)

  const detectedChannelType: OpenClawChannelType = telegramConfig.enabled === true
    ? 'telegram'
    : discordConfig.enabled === true
      ? 'discord'
      : slackConfig.enabled === true
        ? 'slack'
        : defaults.channelType

  return normalizeOpenClawSettings({
    ...defaults,
    configPath: paths.configPath,
    configDir: paths.configDir,
    workspacePath,
    modelProviderId: providerFromPrimary || defaults.modelProviderId,
    modelBaseUrl: readString(providerConfig.baseUrl, defaults.modelBaseUrl),
    modelApiKey: readString(providerConfig.apiKey, defaults.modelApiKey),
    modelApi: readString(providerConfig.api, defaults.modelApi) as OpenClawSettings['modelApi'],
    modelId: modelIdFromPrimary || defaults.modelId,
    fallbackModelIds: fallbackModels.map((modelRef) => modelRef.split('/').pop() || modelRef),
    channelType: detectedChannelType,
    dmPolicy: readString(
      detectedChannelType === 'telegram'
        ? telegramConfig.dmPolicy
        : detectedChannelType === 'discord'
          ? discordConfig.dmPolicy
          : slackConfig.dmPolicy,
      defaults.dmPolicy
    ) as OpenClawSettings['dmPolicy'],
    groupPolicy: readString(
      detectedChannelType === 'telegram'
        ? telegramConfig.groupPolicy
        : detectedChannelType === 'discord'
          ? discordConfig.groupPolicy
          : slackConfig.groupPolicy,
      defaults.groupPolicy
    ) as OpenClawSettings['groupPolicy'],
    telegramBotToken: readString(telegramConfig.botToken),
    telegramRequireMention: readBoolean(telegramWildcardGroup.requireMention, defaults.telegramRequireMention),
    discordBotToken: readString(discordConfig.token),
    slackBotToken: readString(slackConfig.botToken),
    slackAppToken: readString(slackConfig.appToken),
    slackUserToken: readString(slackConfig.userToken),
    slackUserTokenReadOnly: readBoolean(slackConfig.userTokenReadOnly, defaults.slackUserTokenReadOnly)
  }, paths)
}

export function buildManagedProviderConfig(settings: OpenClawSettings) {
  if (settings.modelProviderId === 'ollama') {
    return null
  }

  return {
    api: settings.modelApi,
    baseUrl: settings.modelBaseUrl,
    apiKey: settings.modelApiKey,
    models: [
      settings.modelProviderId === 'bailian'
        ? { id: settings.modelId, reasoning: false }
        : { id: settings.modelId }
    ]
  }
}

export function buildTelegramChannelConfig(settings: OpenClawSettings) {
  return {
    enabled: settings.channelType === 'telegram',
    botToken: settings.telegramBotToken,
    dmPolicy: settings.dmPolicy,
    groupPolicy: settings.groupPolicy,
    groups: {
      '*': {
        requireMention: settings.telegramRequireMention
      }
    }
  }
}

export function buildDiscordChannelConfig(settings: OpenClawSettings) {
  return {
    enabled: settings.channelType === 'discord',
    token: settings.discordBotToken,
    dmPolicy: settings.dmPolicy,
    groupPolicy: settings.groupPolicy
  }
}

export function buildSlackChannelConfig(settings: OpenClawSettings) {
  return {
    enabled: settings.channelType === 'slack',
    botToken: settings.slackBotToken,
    appToken: settings.slackAppToken,
    userToken: settings.slackUserToken,
    userTokenReadOnly: settings.slackUserTokenReadOnly,
    dmPolicy: settings.dmPolicy,
    groupPolicy: settings.groupPolicy
  }
}

export function applyOpenClawSettingsToConfig(currentConfig: OpenClawConfigObject, settings: OpenClawSettings): OpenClawConfigObject {
  const providerId = settings.modelProviderId
  const primaryModel = `${providerId}/${settings.modelId}`
  const fallbackModels = settings.fallbackModelIds
    .map((modelId) => modelId.trim())
    .filter(Boolean)
    .map((modelId) => `${providerId}/${modelId}`)
  const currentModelsSection = asRecord(currentConfig.models)
  const currentAgentsSection = asRecord(currentConfig.agents)
  const currentDefaultsSection = asRecord(currentAgentsSection.defaults)
  const currentModelConfig = { ...asRecord(currentDefaultsSection.model) }
  const nextDefaultsModel: Record<string, unknown> = {
    ...currentModelConfig,
    primary: primaryModel
  }

  if (fallbackModels.length > 0) {
    nextDefaultsModel.fallbacks = fallbackModels
  } else {
    delete nextDefaultsModel.fallbacks
  }

  const nextProviderConfig = buildManagedProviderConfig(settings)

  return {
    ...currentConfig,
    models: {
      ...currentModelsSection,
      mode: 'merge',
      providers: {
        ...asRecord(currentModelsSection.providers),
        ...(nextProviderConfig
          ? {
            [providerId]: {
              ...asRecord(asRecord(currentModelsSection.providers)[providerId]),
              ...nextProviderConfig
            }
          }
          : {})
      }
    },
    agents: {
      ...currentAgentsSection,
      defaults: {
        ...currentDefaultsSection,
        workspace: settings.workspacePath,
        model: nextDefaultsModel,
        models: {
          ...asRecord(currentDefaultsSection.models),
          [primaryModel]: {
            alias: settings.modelId
          },
          ...Object.fromEntries(
            fallbackModels.map((modelRef, index) => [
              modelRef,
              {
                alias: settings.fallbackModelIds[index]
              }
            ])
          )
        }
      }
    },
    channels: {
      ...asRecord(currentConfig.channels),
      telegram: {
        ...asRecord(asRecord(currentConfig.channels).telegram),
        ...buildTelegramChannelConfig(settings)
      },
      discord: {
        ...asRecord(asRecord(currentConfig.channels).discord),
        ...buildDiscordChannelConfig(settings)
      },
      slack: {
        ...asRecord(asRecord(currentConfig.channels).slack),
        ...buildSlackChannelConfig(settings)
      }
    }
  }
}

export function applyPluginPresetToConfig(currentConfig: OpenClawConfigObject, presetId: OpenClawPluginPreset['id']): OpenClawConfigObject {
  const plugins = asRecord(currentConfig.plugins)
  const entries = asRecord(plugins.entries)
  const nextEntries = { ...entries }

  switch (presetId) {
    case 'memory-lancedb':
      {
        const currentEntry = asRecord(entries['memory-lancedb'])
        const currentEntryConfig = asRecord(currentEntry.config)
        const currentEmbedding = asRecord(currentEntryConfig.embedding)

        const nextEntryConfig = {
          ...currentEntryConfig,
          embedding: {
            ...DEFAULT_MEMORY_LANCEDB_CONFIG.embedding,
            ...currentEmbedding
          }
        }

      nextEntries['memory-lancedb'] = {
        ...currentEntry,
        config: nextEntryConfig,
        enabled: true
      }
      return {
        ...currentConfig,
        plugins: {
          ...plugins,
          slots: {
            ...asRecord(plugins.slots),
            memory: 'memory-lancedb'
          },
          entries: nextEntries
        }
      }
      }
    case 'open-prose':
      nextEntries['open-prose'] = {
        ...asRecord(entries['open-prose']),
        enabled: true
      }
      return {
        ...currentConfig,
        plugins: {
          ...plugins,
          entries: nextEntries
        }
      }
    case 'voice-call':
      nextEntries['voice-call'] = {
        ...asRecord(entries['voice-call']),
        enabled: true
      }
      return {
        ...currentConfig,
        plugins: {
          ...plugins,
          entries: nextEntries
        }
      }
    case 'control-ui':
    default:
      return currentConfig
  }
}

export function slugifyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'openclaw-agent'
}

export function shouldSkipBundlePath(path: string) {
  const blocked = [
    '.git',
    'node_modules',
    '.DS_Store',
    '.openclaw/sessions',
    '.openclaw/cache',
    '.openclaw/logs'
  ]

  return blocked.some((segment) => path === segment || path.startsWith(`${segment}/`))
}

export function isTextBuffer(buffer: Buffer) {
  return !buffer.includes(0)
}
