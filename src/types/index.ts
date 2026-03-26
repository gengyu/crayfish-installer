export interface SystemInfo {
  platform: string
  arch: string
  osRelease: string
  osVersion: string
  totalMemory: string
  freeMemory: string
  cpus: number
  homedir: string
}

export interface ExistingInstall {
  exists: boolean
  path: string | null
  version: { version: string; installDate: string } | null
}

export type OpenClawChannelType = 'telegram' | 'discord' | 'slack' | 'none'
export type OpenClawDmPolicy = 'pairing' | 'allowlist' | 'open' | 'disabled'
export type OpenClawGroupPolicy = 'allowlist' | 'open' | 'disabled'
export type OpenClawProviderApi =
  | 'openai-completions'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'google-generative-ai'

export interface OpenClawSettings {
  configPath: string
  configDir: string
  workspacePath: string
  modelProviderId: string
  modelBaseUrl: string
  modelApiKey: string
  modelApi: OpenClawProviderApi
  modelId: string
  fallbackModelId: string
  channelType: OpenClawChannelType
  dmPolicy: OpenClawDmPolicy
  groupPolicy: OpenClawGroupPolicy
  telegramBotToken: string
  telegramRequireMention: boolean
  discordBotToken: string
  slackBotToken: string
  slackAppToken: string
  slackUserToken: string
  slackUserTokenReadOnly: boolean
}

export interface OpenClawPluginPreset {
  id: string
  title: string
  description: string
  installSource: string | null
  enableCommand: string | null
  category: 'ui' | 'memory' | 'workflow' | 'channel'
  recommended: boolean
}

export interface OpenClawAgentBundleFile {
  path: string
  content: string
}

export interface OpenClawAgentBundle {
  format: 'openclaw-agent-bundle'
  version: 1
  exportedAt: string
  metadata: {
    name: string
    description: string
    sourceWorkspace: string
  }
  files: OpenClawAgentBundleFile[]
}

export interface OpenClawAgentBundleResult {
  success: boolean
  path: string
  fileCount: number
  workspacePath: string
}
