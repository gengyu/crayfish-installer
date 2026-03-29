import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  ExistingInstall,
  LocalModelDiscoveryResult,
  OpenClawChannelType,
  OpenClawDmPolicy,
  OpenClawGroupPolicy,
  OpenClawPluginPreset,
  OpenClawProviderApi,
  OpenClawSettings
} from '../types'

type WorkspaceTab = 'setup' | 'plugins' | 'agents'
type PluginActionState = 'idle' | 'pending' | 'success' | 'error'
type ModelProviderTab = 'ollama' | 'tencent' | 'aliyun' | 'other'
type AliyunRegion = 'cn' | 'global' | 'us'

interface PluginUiStatus {
  applyState: PluginActionState
  installState: PluginActionState
  message: string | null
  updatedAt: number | null
}

interface OpenClawSettingsPageProps {
  existingInstall: ExistingInstall | null
  onGoToInstaller: () => void
}

const providerApiOptions: Array<{ value: OpenClawProviderApi; label: string; hint: string }> = [
  { value: 'openai-responses', label: 'OpenAI Responses', hint: '官方更推荐的新 OpenAI 兼容接口' },
  { value: 'openai-completions', label: 'OpenAI Chat Completions', hint: '兼容面最广，适合代理服务' },
  { value: 'anthropic-messages', label: 'Anthropic Messages', hint: '适合 Claude / Anthropic 兼容服务' },
  { value: 'google-generative-ai', label: 'Google Generative AI', hint: '适合 Gemini 官方接口' }
]

const dmPolicies: Array<{ value: OpenClawDmPolicy; label: string }> = [
  { value: 'pairing', label: 'Pairing only' },
  { value: 'allowlist', label: 'Allowlist only' },
  { value: 'open', label: 'Open access' },
  { value: 'disabled', label: 'Disabled' }
]

const groupPolicies: Array<{ value: OpenClawGroupPolicy; label: string }> = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'allowlist', label: 'Allowlist only' },
  { value: 'open', label: 'Open access' }
]

const channelOptions: Array<{ value: OpenClawChannelType; label: string; description: string }> = [
  { value: 'telegram', label: 'Telegram', description: '官方接入成熟，适合个人助手和小团队' },
  { value: 'discord', label: 'Discord', description: '适合社区机器人和公开频道' },
  { value: 'slack', label: 'Slack', description: '适合企业内部工作流和客服场景' },
  { value: 'none', label: '稍后再配', description: '先把模型跑通，再逐步接 IM' }
]

const tabs: Array<{ id: WorkspaceTab; title: string; subtitle: string }> = [
  { id: 'setup', title: 'Quick Setup', subtitle: '模型、渠道、workspace' },
  { id: 'plugins', title: 'Plugin Center', subtitle: '按官方最佳实践一键启用' },
  { id: 'agents', title: 'Agent Studio', subtitle: '导出、导入、分享智能体' }
]

const modelProviderTabs: Array<{
  id: ModelProviderTab
  title: string
  description: string
}> = [
  {
    id: 'ollama',
    title: 'Ollama',
    description: '本机原生模型，自动读取 Model ID'
  },
  {
    id: 'tencent',
    title: '腾讯混元',
    description: '按 OpenAI 兼容接口填写'
  },
  {
    id: 'aliyun',
    title: '阿里云百炼',
    description: '按 OpenClaw 官方百炼配置填写'
  },
  {
    id: 'other',
    title: '自定义',
    description: '完全自定义 Provider / Base URL / Model ID',
  }
]

const tencentRecommendedModels = [
  'hunyuan-turbos-latest',
  'hunyuan-turbo',
  'hunyuan-large',
  'hunyuan-standard'
]

const aliyunRecommendedModels = [
  'qwen3-max',
  'qwen3-plus',
  'qwen3-coder-plus',
  'qwen3-coder-next',
  'deepseek-v3.1',
  'glm-4.5',
  'kimi-k2-0711-preview'
]

const aliyunEndpointMap: Record<AliyunRegion, string> = {
  cn: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  global: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  us: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1'
}

function parseFallbackModelIds(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function inferModelProviderTab(settings: OpenClawSettings): ModelProviderTab {
  const providerId = settings.modelProviderId.toLowerCase()
  const baseUrl = settings.modelBaseUrl.toLowerCase()

  if (providerId === 'ollama' || baseUrl.includes('127.0.0.1:11434') || baseUrl.includes('localhost:11434')) {
    return 'ollama'
  }

  if (providerId.includes('tencent') || providerId.includes('hunyuan') || baseUrl.includes('tencent') || baseUrl.includes('hunyuan')) {
    return 'tencent'
  }

  if (providerId.includes('aliyun') || providerId.includes('dashscope') || providerId.includes('qwen') || providerId.includes('bailian') || baseUrl.includes('aliyun') || baseUrl.includes('dashscope')) {
    return 'aliyun'
  }

  return 'other'
}

function inferAliyunRegion(baseUrl: string): AliyunRegion {
  const normalizedBaseUrl = baseUrl.toLowerCase()
  if (normalizedBaseUrl.includes('dashscope-us')) {
    return 'us'
  }

  if (normalizedBaseUrl.includes('dashscope-intl')) {
    return 'global'
  }

  return 'cn'
}

function getAliyunBaseUrl(region: AliyunRegion) {
  return aliyunEndpointMap[region]
}

function getPresetSettingsForModelTab(
  tab: ModelProviderTab,
  settings: OpenClawSettings,
  localModelDiscovery: LocalModelDiscoveryResult | null
) {
  switch (tab) {
    case 'ollama':
      return {
        ...settings,
        modelProviderId: 'ollama',
        modelBaseUrl: 'http://127.0.0.1:11434',
        modelApiKey: 'local',
        modelId: localModelDiscovery?.defaultModelId || settings.modelId
      }
    case 'tencent':
      return {
        ...settings,
        modelProviderId: 'hunyuan',
        modelBaseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
        modelApi: 'openai-completions' as OpenClawProviderApi
      }
    case 'aliyun':
      return {
        ...settings,
        modelProviderId: 'bailian',
        modelBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        modelApi: 'openai-completions' as OpenClawProviderApi
      }
    case 'other':
    default:
      return settings
  }
}

function getPluginStatusStorageKey(configPath: string) {
  return `openclaw-plugin-statuses:${configPath}`
}

function readStoredPluginStatuses(configPath: string): Record<string, PluginUiStatus> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(getPluginStatusStorageKey(configPath))
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, PluginUiStatus>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStoredPluginStatuses(configPath: string, statuses: Record<string, PluginUiStatus>) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(getPluginStatusStorageKey(configPath), JSON.stringify(statuses))
}

function getDefaultPluginStatus(): PluginUiStatus {
  return {
    applyState: 'idle',
    installState: 'idle',
    message: null,
    updatedAt: null
  }
}

function getPluginStatusLabel(status: PluginUiStatus) {
  if (status.installState === 'pending') {
    return { text: '安装中', className: 'border-amber-200 bg-amber-50 text-amber-700' }
  }

  if (status.installState === 'success') {
    return { text: '安装成功', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
  }

  if (status.installState === 'error') {
    return { text: '安装失败', className: 'border-red-200 bg-red-50 text-red-700' }
  }

  if (status.applyState === 'success') {
    return { text: '已应用配置', className: 'border-brand-200 bg-brand-50 text-brand-700' }
  }

  if (status.applyState === 'error') {
    return { text: '配置失败', className: 'border-red-200 bg-red-50 text-red-700' }
  }

  return null
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </label>
  )
}

function inputClassName() {
  return 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100'
}

function statusCardClass(active: boolean) {
  return active
    ? 'border-brand-500 bg-brand-50 shadow-[0_10px_40px_rgba(20,184,166,0.14)]'
    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
}

export default function OpenClawSettingsPage({ existingInstall, onGoToInstaller }: OpenClawSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('setup')
  const [activeModelProviderTab, setActiveModelProviderTab] = useState<ModelProviderTab>('ollama')
  const [aliyunRegion, setAliyunRegion] = useState<AliyunRegion>('cn')
  const [settings, setSettings] = useState<OpenClawSettings | null>(null)
  const [pluginPresets, setPluginPresets] = useState<OpenClawPluginPreset[]>([])
  const [localModelDiscovery, setLocalModelDiscovery] = useState<LocalModelDiscoveryResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTestingModelConnection, setIsTestingModelConnection] = useState(false)
  const [pluginBusyId, setPluginBusyId] = useState<string | null>(null)
  const [pluginStatuses, setPluginStatuses] = useState<Record<string, PluginUiStatus>>({})
  const [bundleBusy, setBundleBusy] = useState<'export' | 'import' | null>(null)
  const [modelTestFeedback, setModelTestFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [agentBundleName, setAgentBundleName] = useState('my-openclaw-agent')
  const [agentBundleDescription, setAgentBundleDescription] = useState('包含记忆、技能和人格设定的可复用智能体')

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [nextSettings, nextPluginPresets, nextLocalModelDiscovery] = await Promise.all([
        window.electronAPI.getOpenClawSettings(),
        window.electronAPI.getOpenClawPluginPresets(),
        window.electronAPI.getLocalModelDiscovery()
      ])
      setSettings(nextSettings)
      setActiveModelProviderTab(inferModelProviderTab(nextSettings))
      setAliyunRegion(inferAliyunRegion(nextSettings.modelBaseUrl))
      setPluginPresets(nextPluginPresets)
      setLocalModelDiscovery(nextLocalModelDiscovery)
    } catch (loadError) {
      setSettings(null)
      setPluginPresets([])
      setLocalModelDiscovery(null)
      setError(loadError instanceof Error ? loadError.message : '读取 OpenClaw 配置失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (!settings?.configPath) {
      return
    }

    setPluginStatuses(readStoredPluginStatuses(settings.configPath))
  }, [settings?.configPath])

  const updateSettings = <K extends keyof OpenClawSettings>(key: K, value: OpenClawSettings[K]) => {
    setSettings((current) => current ? { ...current, [key]: value } : current)
  }

  const handleModelProviderTabChange = (tab: ModelProviderTab) => {
    setActiveModelProviderTab(tab)
    setModelTestFeedback(null)
    setSettings((current) => current ? getPresetSettingsForModelTab(tab, current, localModelDiscovery) : current)
    if (tab === 'aliyun') {
      setAliyunRegion('cn')
    }
  }

  const updatePluginStatus = (presetId: string, updater: (current: PluginUiStatus) => PluginUiStatus) => {
    if (!settings?.configPath) {
      return
    }

    setPluginStatuses((current) => {
      const next = {
        ...current,
        [presetId]: updater(current[presetId] || getDefaultPluginStatus())
      }
      writeStoredPluginStatuses(settings.configPath, next)
      return next
    })
  }

  const localModelIds = localModelDiscovery?.modelIds || []
  const isOllamaProvider = activeModelProviderTab === 'ollama'
  const isTencentProvider = activeModelProviderTab === 'tencent'
  const isAliyunProvider = activeModelProviderTab === 'aliyun'
  const isCustomProvider = activeModelProviderTab === 'other'
  const shouldSuggestLocalModels = Boolean(isOllamaProvider && settings && localModelIds.length > 0)
  const modelSelectOptions = settings && shouldSuggestLocalModels
    ? Array.from(new Set([settings.modelId, ...localModelIds].filter(Boolean)))
    : localModelIds
  const tencentModelOptions = Array.from(new Set([settings?.modelId, ...tencentRecommendedModels].filter(Boolean)))
  const aliyunModelOptions = Array.from(new Set([settings?.modelId, ...aliyunRecommendedModels].filter(Boolean)))

  const refreshSettings = async () => {
    const nextSettings = await window.electronAPI.getOpenClawSettings()
    setSettings(nextSettings)
    setActiveModelProviderTab(inferModelProviderTab(nextSettings))
    setAliyunRegion(inferAliyunRegion(nextSettings.modelBaseUrl))
  }

  const handleTestModelConnection = async () => {
    if (!settings) {
      return
    }

    setIsTestingModelConnection(true)
    setError(null)
    setNotice(null)
    setModelTestFeedback(null)

    try {
      const result = await window.electronAPI.testOpenClawModelConnection(settings)
      setModelTestFeedback({
        tone: 'success',
        message: result.message
      })
    } catch (testError) {
      setModelTestFeedback({
        tone: 'error',
        message: testError instanceof Error ? testError.message : '模型接口测试失败'
      })
    } finally {
      setIsTestingModelConnection(false)
    }
  }

  const handleAliyunRegionChange = (region: AliyunRegion) => {
    setAliyunRegion(region)
    setModelTestFeedback(null)
    setSettings((current) => current
      ? {
        ...current,
        modelProviderId: 'bailian',
        modelApi: 'openai-completions',
        modelBaseUrl: getAliyunBaseUrl(region)
      }
      : current)
  }

  const handleSave = async () => {
    if (!settings) {
      return
    }

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      const result = await window.electronAPI.saveOpenClawSettings(settings)
      setNotice(`已写入 OpenClaw 配置：${result.configPath}`)
      await refreshSettings()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存 OpenClaw 配置失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleApplyPluginPreset = async (presetId: string) => {
    setPluginBusyId(presetId)
    setError(null)
    setNotice(null)
    updatePluginStatus(presetId, (current) => ({
      ...current,
      applyState: 'pending',
      message: '正在应用插件配置...',
      updatedAt: Date.now()
    }))

    try {
      const result = await window.electronAPI.applyOpenClawPluginPreset(presetId)
      setNotice(`已写入插件预设到 ${result.configPath}`)
      updatePluginStatus(presetId, (current) => ({
        ...current,
        applyState: 'success',
        message: `配置已写入 ${result.configPath}`,
        updatedAt: Date.now()
      }))
      await refreshSettings()
    } catch (pluginError) {
      const message = pluginError instanceof Error ? pluginError.message : '应用插件预设失败'
      updatePluginStatus(presetId, (current) => ({
        ...current,
        applyState: 'error',
        message,
        updatedAt: Date.now()
      }))
      setError(pluginError instanceof Error ? pluginError.message : '应用插件预设失败')
    } finally {
      setPluginBusyId(null)
    }
  }

  const handleInstallPluginPreset = async (presetId: string) => {
    setPluginBusyId(presetId)
    setError(null)
    setNotice(null)
    updatePluginStatus(presetId, (current) => ({
      ...current,
      installState: 'pending',
      message: '插件正在安装，请稍候...',
      updatedAt: Date.now()
    }))

    try {
      const result = await window.electronAPI.installOpenClawPluginPreset(presetId)
      setNotice(result.message)
      updatePluginStatus(presetId, (current) => ({
        ...current,
        installState: 'success',
        message: result.message,
        updatedAt: Date.now()
      }))
    } catch (pluginError) {
      const message = pluginError instanceof Error ? pluginError.message : '执行插件安装失败'
      updatePluginStatus(presetId, (current) => ({
        ...current,
        installState: 'error',
        message,
        updatedAt: Date.now()
      }))
      setError(pluginError instanceof Error ? pluginError.message : '执行插件安装失败')
    } finally {
      setPluginBusyId(null)
    }
  }

  const handleOpenControlUi = async () => {
    try {
      const result = await window.electronAPI.openOpenClawControlUi()
      setNotice(`已打开 OpenClaw Control UI：${result.url}`)
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : '打开 Control UI 失败')
    }
  }

  const handleExportBundle = async () => {
    setBundleBusy('export')
    setError(null)
    setNotice(null)

    try {
      const result = await window.electronAPI.exportOpenClawAgentBundle({
        name: agentBundleName,
        description: agentBundleDescription
      })
      setNotice(`已导出 ${result.fileCount} 个文件到 ${result.path}`)
    } catch (bundleError) {
      setError(bundleError instanceof Error ? bundleError.message : '导出智能体失败')
    } finally {
      setBundleBusy(null)
    }
  }

  const handleImportBundle = async () => {
    setBundleBusy('import')
    setError(null)
    setNotice(null)

    try {
      const result = await window.electronAPI.importOpenClawAgentBundle()
      setNotice(`已向 ${result.workspacePath} 导入 ${result.fileCount} 个文件`)
      await refreshSettings()
    } catch (bundleError) {
      setError(bundleError instanceof Error ? bundleError.message : '导入智能体失败')
    } finally {
      setBundleBusy(null)
    }
  }

  if (isLoading) {
    return (
      <div className="relative flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,#e6fffb,transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-6 pt-20">
        <div className="window-drag fixed inset-x-0 top-0 z-20 h-14 pl-20" />
        <div className="flex flex-1 items-center justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-sm text-slate-500 shadow-xl">
            正在读取 OpenClaw 工作台配置...
          </div>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="relative flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,#e6fffb,transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-6 pt-20">
        <div className="window-drag fixed inset-x-0 top-0 z-20 h-14 pl-20" />
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
            <div className="text-lg font-semibold text-slate-900">读取 OpenClaw 工作台配置失败</div>
            <div className="mt-3 text-sm leading-6 text-slate-500">{error || '请稍后重试。'}</div>
            <button
              className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={loadSettings}
              type="button"
            >
              重新读取配置
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top,#dffcf7,transparent_32%),radial-gradient(circle_at_right,#e8efff,transparent_28%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-4 pt-[72px] sm:p-6 sm:pt-20">
      <div className="window-drag fixed inset-x-0 top-0 z-20 h-14 pl-20" />
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl">
          <div className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[1.45fr_0.88fr]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                OpenClaw Configuration Workspace
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-2xl font-bold tracking-[-0.03em] text-slate-950 sm:text-[2.2rem]">
                  安装完成后，直接可视化配置 OpenClaw、插件和可分享智能体
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  这里按 OpenClaw 官方最佳实践，把高频配置拆成 Quick Setup、Plugin Center 和 Agent Studio 三块。
                  模型接口、IM 渠道、记忆插件、工作流插件以及 agent bundle 导入导出都统一在一个面板里完成。
                </p>
              </div>
            </div>

            <div className="relative grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
              <button
                className="window-no-drag absolute right-0 top-0 rounded-bl-2xl rounded-tr-[28px] border-b border-l border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 hover:text-red-700"
                onClick={onGoToInstaller}
                type="button"
              >
                卸载入口
              </button>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">安装状态</div>
                <div className="mt-2 text-sm font-medium text-slate-900">
                  {existingInstall?.exists ? `已检测到 OpenClaw: ${existingInstall.path || '命令可用'}` : '当前未检测到安装'}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">配置文件</div>
                <div className="mt-2 break-all text-sm text-slate-600">{settings.configPath}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Workspace</div>
                <div className="mt-2 break-all text-sm text-slate-600">{settings.workspacePath}</div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  className="window-no-drag rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  onClick={() => window.electronAPI.openDirectory(settings.configDir)}
                  type="button"
                >
                  打开配置目录
                </button>
                <button
                  className="window-no-drag rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  onClick={() => window.electronAPI.openDirectory(settings.workspacePath)}
                  type="button"
                >
                  打开 workspace
                </button>
                <button
                  className="window-no-drag rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  onClick={handleOpenControlUi}
                  type="button"
                >
                  打开 Control UI
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {tabs.map((tab) => (
            <button
              className={`rounded-[22px] border p-4 text-left transition ${statusCardClass(activeTab === tab.id)}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <div className="text-base font-semibold text-slate-900">{tab.title}</div>
              <div className="mt-1 text-sm text-slate-500">{tab.subtitle}</div>
            </button>
          ))}
        </section>

        {activeTab === 'setup' ? (
          <main className="grid gap-5 lg:grid-cols-[1.16fr_0.84fr]">
            <section className="space-y-5">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <SectionTitle
                    title="模型接口"
                    description="只保留主模型配置。按接入方切换后，下面字段会自动收敛。"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      className="text-sm font-medium text-brand-700 underline decoration-brand-300 underline-offset-4 transition hover:text-brand-800 disabled:cursor-not-allowed disabled:text-slate-400"
                      disabled={isTestingModelConnection}
                      onClick={handleTestModelConnection}
                      type="button"
                    >
                      {isTestingModelConnection ? '测试中...' : '测试连接'}
                    </button>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
                  {modelProviderTabs.map((tab) => (
                    <button
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${statusCardClass(activeModelProviderTab === tab.id)}`}
                      key={tab.id}
                      onClick={() => handleModelProviderTabChange(tab.id)}
                      type="button"
                    >
                      <div className="text-sm font-semibold text-slate-900">{tab.title}</div>
                    </button>
                  ))}
                </div>

                {modelTestFeedback ? (
                  <div className={`mb-4 rounded-2xl px-4 py-3 text-sm leading-6 ${
                    modelTestFeedback.tone === 'success'
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-red-200 bg-red-50 text-red-700'
                  }`}>
                    {modelTestFeedback.message}
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  {isOllamaProvider ? (
                    <>
                      <Field label="Model ID">
                        {shouldSuggestLocalModels ? (
                          <select className={inputClassName()} onChange={(event) => updateSettings('modelId', event.target.value)} value={settings.modelId}>
                            {modelSelectOptions.map((modelId) => (
                              <option key={modelId} value={modelId}>
                                {modelId}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input className={inputClassName()} onChange={(event) => updateSettings('modelId', event.target.value)} value={settings.modelId} />
                        )}
                      </Field>
                    </>
                  ) : null}

                  {isTencentProvider ? (
                    <>
                      <Field label="API Endpoint">
                        <input className={inputClassName()} onChange={(event) => updateSettings('modelBaseUrl', event.target.value)} value={settings.modelBaseUrl} />
                      </Field>
                      <Field label="API Key">
                        <input className={inputClassName()} onChange={(event) => updateSettings('modelApiKey', event.target.value)} type="password" value={settings.modelApiKey} />
                      </Field>
                      <Field label="Model ID">
                        <input className={inputClassName()} list="tencent-model-options" onChange={(event) => updateSettings('modelId', event.target.value)} value={settings.modelId} />
                        <datalist id="tencent-model-options">
                          {tencentModelOptions.map((modelId) => (
                            <option key={modelId} value={modelId} />
                          ))}
                        </datalist>
                      </Field>
                    </>
                  ) : null}

                  {isAliyunProvider ? (
                    <>
                      <Field label="服务区域">
                        <div className="grid grid-cols-3 gap-3">
                          {([
                            { id: 'cn', label: '中国站' },
                            { id: 'global', label: '国际站' },
                            { id: 'us', label: '美国站' }
                          ] as Array<{ id: AliyunRegion; label: string }>).map((option) => (
                            <button
                              className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${statusCardClass(aliyunRegion === option.id)}`}
                              key={option.id}
                              onClick={() => handleAliyunRegionChange(option.id)}
                              type="button"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </Field>
                      <Field label="API Endpoint">
                        <input className={inputClassName()} onChange={(event) => updateSettings('modelBaseUrl', event.target.value)} value={settings.modelBaseUrl} />
                      </Field>
                      <Field label="API Key">
                        <input className={inputClassName()} onChange={(event) => updateSettings('modelApiKey', event.target.value)} type="password" value={settings.modelApiKey} />
                      </Field>
                      <Field label="Model ID">
                        <input className={inputClassName()} list="aliyun-model-options" onChange={(event) => updateSettings('modelId', event.target.value)} value={settings.modelId} />
                        <datalist id="aliyun-model-options">
                          {aliyunModelOptions.map((modelId) => (
                            <option key={modelId} value={modelId} />
                          ))}
                        </datalist>
                      </Field>
                    </>
                  ) : null}

                  {isCustomProvider ? (
                    <>
                      <Field label="Provider ID" hint="例如 custom-openai">
                        <input className={inputClassName()} onChange={(event) => updateSettings('modelProviderId', event.target.value)} value={settings.modelProviderId} />
                      </Field>
                      <Field label="Model ID" hint="例如 gpt-4.1 / qwen2.5:7b">
                        <input className={inputClassName()} onChange={(event) => updateSettings('modelId', event.target.value)} value={settings.modelId} />
                      </Field>
                      <Field label="Base URL" hint="OpenAI-compatible / Anthropic / Gemini">
                        <input className={inputClassName()} onChange={(event) => updateSettings('modelBaseUrl', event.target.value)} value={settings.modelBaseUrl} />
                      </Field>
                      <Field label="API Key" hint="会写入 OpenClaw 配置">
                        <input className={inputClassName()} onChange={(event) => updateSettings('modelApiKey', event.target.value)} type="password" value={settings.modelApiKey} />
                      </Field>
                      <Field label="Provider API" hint="上游协议">
                        <select className={inputClassName()} onChange={(event) => updateSettings('modelApi', event.target.value as OpenClawProviderApi)} value={settings.modelApi}>
                          {providerApiOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </>
                  ) : null}

                  <Field label="Fallback Models" hint="按行或逗号分隔">
                    <textarea
                      className={`${inputClassName()} min-h-[84px] resize-y`}
                      onChange={(event) => updateSettings('fallbackModelIds', parseFallbackModelIds(event.target.value))}
                      value={settings.fallbackModelIds.join('\n')}
                    />
                  </Field>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <SectionTitle
                    title="即时通讯接入"
                    description="OpenClaw 原生配置里先支持 Telegram、Discord、Slack；微信 ClawBot 属于插件式接入，下面会给出单独安装指引。"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {channelOptions.map((option) => (
                    <button
                      className={`rounded-2xl border px-4 py-4 text-left transition ${statusCardClass(settings.channelType === option.value)}`}
                      key={option.value}
                      onClick={() => updateSettings('channelType', option.value)}
                      type="button"
                    >
                      <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{option.description}</div>
                    </button>
                  ))}
                </div>

                {settings.channelType !== 'none' ? (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <Field label="DM Policy">
                      <select className={inputClassName()} onChange={(event) => updateSettings('dmPolicy', event.target.value as OpenClawDmPolicy)} value={settings.dmPolicy}>
                        {dmPolicies.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Group Policy">
                      <select className={inputClassName()} onChange={(event) => updateSettings('groupPolicy', event.target.value as OpenClawGroupPolicy)} value={settings.groupPolicy}>
                        {groupPolicies.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    {settings.channelType === 'telegram' ? (
                      <>
                        <Field label="Telegram Bot Token" hint="channels.telegram.botToken">
                          <input className={inputClassName()} onChange={(event) => updateSettings('telegramBotToken', event.target.value)} type="password" value={settings.telegramBotToken} />
                        </Field>
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input checked={settings.telegramRequireMention} className="h-4 w-4 rounded accent-brand-600" onChange={(event) => updateSettings('telegramRequireMention', event.target.checked)} type="checkbox" />
                          <div>
                            <div className="text-sm font-medium text-slate-800">群聊中必须 @ 机器人</div>
                            <div className="text-xs text-slate-500">降低群消息噪音，符合大多数助手场景</div>
                          </div>
                        </label>
                      </>
                    ) : null}

                    {settings.channelType === 'discord' ? (
                      <Field label="Discord Bot Token" hint="channels.discord.token">
                        <input className={inputClassName()} onChange={(event) => updateSettings('discordBotToken', event.target.value)} type="password" value={settings.discordBotToken} />
                      </Field>
                    ) : null}

                    {settings.channelType === 'slack' ? (
                      <>
                        <Field label="Slack Bot Token" hint="xoxb-...">
                          <input className={inputClassName()} onChange={(event) => updateSettings('slackBotToken', event.target.value)} type="password" value={settings.slackBotToken} />
                        </Field>
                        <Field label="Slack App Token" hint="xapp-...">
                          <input className={inputClassName()} onChange={(event) => updateSettings('slackAppToken', event.target.value)} type="password" value={settings.slackAppToken} />
                        </Field>
                        <Field label="Slack User Token" hint="可选">
                          <input className={inputClassName()} onChange={(event) => updateSettings('slackUserToken', event.target.value)} type="password" value={settings.slackUserToken} />
                        </Field>
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <input checked={settings.slackUserTokenReadOnly} className="h-4 w-4 rounded accent-brand-600" onChange={(event) => updateSettings('slackUserTokenReadOnly', event.target.checked)} type="checkbox" />
                          <div>
                            <div className="text-sm font-medium text-slate-800">User token 只读</div>
                            <div className="text-xs text-slate-500">先用保守权限跑通工作区，再逐步放开</div>
                          </div>
                        </label>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    先只保存模型配置。等模型可以稳定响应后，再接入 IM 渠道。
                  </div>
                )}

                <div className="mt-5 rounded-[24px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.96))] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-slate-900">微信 ClawBot</h3>
                      <p className="max-w-2xl text-sm leading-6 text-slate-600">
                        微信接入走插件安装和扫码绑定，不写到原生 `channels.*`。
                      </p>
                    </div>
                    <button
                      className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                      onClick={() => setActiveTab('plugins')}
                      type="button"
                    >
                      去 Plugin Center 安装
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-emerald-100 bg-white/90 p-3 font-mono text-xs leading-6 text-slate-700">
                    pnpm dlx @tencent-weixin/openclaw-weixin-cli@latest install
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <SectionTitle
                  title="Workspace 与持久化"
                  description="这里只保留 workspace 路径。其他解释放到 Agent Studio。"
                />
                <div className="mt-4 space-y-3">
                  <Field label="Workspace Path" hint="agents.defaults.workspace">
                    <input className={inputClassName()} onChange={(event) => updateSettings('workspacePath', event.target.value)} value={settings.workspacePath} />
                  </Field>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <SectionTitle
                  title="配置摘要"
                  description="这里只更新当前面板托管的核心配置。"
                />
                <div className="mt-4 space-y-2 rounded-3xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-200">
                  <div>provider: {settings.modelProviderId}</div>
                  <div>primary: {settings.modelProviderId}/{settings.modelId}</div>
                  <div>fallbacks: {settings.fallbackModelIds.length > 0 ? settings.fallbackModelIds.map((modelId) => `${settings.modelProviderId}/${modelId}`).join(', ') : '(none)'}</div>
                  <div>api: {settings.modelApi}</div>
                  <div>channel: {settings.channelType}</div>
                  <div>workspace: {settings.workspacePath}</div>
                </div>

                {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

                <div className="mt-5 flex flex-col gap-3">
                  <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300" disabled={isSaving} onClick={handleSave} type="button">
                    {isSaving ? '正在写入 OpenClaw 配置...' : '保存 Quick Setup'}
                  </button>
                  <button className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50" onClick={() => window.electronAPI.openDirectory(settings.workspacePath)} type="button">
                    查看当前 workspace
                  </button>
                </div>
              </div>
            </aside>
          </main>
        ) : null}

        {activeTab === 'plugins' ? (
          <main className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="grid gap-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <SectionTitle
                  title="Plugin Center"
                  description="结合 OpenClaw 官方最佳实践，先推荐 1) Control UI 2) Memory LanceDB 3) Open Prose。微信 ClawBot 这类外部渠道插件也可以在这里直接启动安装流程。"
                />
                <div className="mt-6 grid gap-4">
                  {pluginPresets.map((preset) => (
                    <article className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-5" key={preset.id}>
                      {(() => {
                        const status = pluginStatuses[preset.id] || getDefaultPluginStatus()
                        const statusLabel = getPluginStatusLabel(status)

                        return (
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">{preset.title}</h3>
                            {preset.recommended ? (
                              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">
                                Recommended
                              </span>
                            ) : null}
                            {statusLabel ? (
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusLabel.className}`}>
                                {statusLabel.text}
                              </span>
                            ) : null}
                          </div>
                          <p className="max-w-2xl text-sm leading-6 text-slate-600">{preset.description}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{preset.category}</span>
                            {preset.installSource ? <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{preset.installSource}</span> : null}
                            {preset.enableCommand ? <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">enable {preset.enableCommand}</span> : null}
                          </div>
                          {preset.id === 'wechat-clawbot' ? (
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-800">
                              安装后会在终端中展示微信二维码。请使用微信扫码启用 `微信ClawBot` 插件，完成后即可在微信中与 OpenClaw 收发消息。
                            </div>
                          ) : null}
                          {status.message ? (
                            <div className={`rounded-2xl px-4 py-3 text-xs leading-6 ${
                              status.installState === 'error' || status.applyState === 'error'
                                ? 'border border-red-200 bg-red-50 text-red-700'
                                : status.installState === 'success' || status.applyState === 'success'
                                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border border-amber-200 bg-amber-50 text-amber-700'
                            }`}>
                              {status.message}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={pluginBusyId === preset.id}
                            onClick={() => handleApplyPluginPreset(preset.id)}
                            type="button"
                          >
                            {pluginBusyId === preset.id && status.applyState === 'pending' ? '应用中...' : '应用配置'}
                          </button>
                          <button
                            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={pluginBusyId === preset.id}
                            onClick={() => handleInstallPluginPreset(preset.id)}
                            type="button"
                          >
                            {pluginBusyId === preset.id && status.installState === 'pending'
                              ? '安装中...'
                              : preset.id === 'control-ui'
                                ? '打开 UI'
                                : preset.id === 'wechat-clawbot'
                                  ? '安装并显示二维码'
                                  : '安装/启用'}
                          </button>
                        </div>
                      </div>
                        )
                      })()}
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <SectionTitle
                  title="推荐顺序"
                  description="先把最影响使用门槛的能力接上。"
                />
                <ol className="mt-5 space-y-3 text-sm text-slate-600">
                  <li className="rounded-2xl bg-slate-50 p-4">1. 打开 Control UI，验证 gateway 和配置面板可访问。</li>
                  <li className="rounded-2xl bg-slate-50 p-4">2. 启用 Memory LanceDB，让助手具备更稳定的长期记忆。</li>
                  <li className="rounded-2xl bg-slate-50 p-4">3. 启用 Open Prose，在复杂任务里编排多智能体流程。</li>
                  <li className="rounded-2xl bg-slate-50 p-4">4. 最后再接语音、微信 ClawBot 或其它外部渠道插件，降低排障成本。</li>
                </ol>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <SectionTitle
                  title="当前说明"
                  description="这个页面同时支持两种操作。"
                />
                <div className="mt-5 space-y-3 text-sm text-slate-600">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    `应用配置`：写入 `openclaw.json` 里的 `plugins` 区块，适合先完成结构化配置。
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    `安装/启用`：直接调用 `openclaw plugins install/enable`，适合把配置和插件状态一次到位。
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    `微信 ClawBot`：会执行教程里的安装命令，并在终端中显示二维码；这一步完成的是微信绑定，不会写入 Telegram/Discord/Slack 那类原生渠道配置。
                  </div>
                </div>

                {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
              </div>
            </aside>
          </main>
        ) : null}

        {activeTab === 'agents' ? (
          <main className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <SectionTitle
                  title="Agent Studio"
                  description="把调教好的智能体当成资产来管理。这里导出的 bundle 会携带 workspace 里的记忆、技能、人格文本和其它文本资源，便于你分享给另一个人直接导入使用。"
                />
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Field label="Bundle Name" hint="导出文件名和元数据">
                    <input className={inputClassName()} onChange={(event) => setAgentBundleName(event.target.value)} value={agentBundleName} />
                  </Field>
                  <Field label="Description" hint="描述这个智能体适合做什么">
                    <input className={inputClassName()} onChange={(event) => setAgentBundleDescription(event.target.value)} value={agentBundleDescription} />
                  </Field>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={bundleBusy !== null}
                    onClick={handleExportBundle}
                    type="button"
                  >
                    {bundleBusy === 'export' ? '正在导出 bundle...' : '导出当前智能体'}
                  </button>
                  <button
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={bundleBusy !== null}
                    onClick={handleImportBundle}
                    type="button"
                  >
                    {bundleBusy === 'import' ? '正在导入 bundle...' : '导入别人分享的智能体'}
                  </button>
                  <button
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    onClick={() => window.electronAPI.openDirectory(settings.workspacePath)}
                    type="button"
                  >
                    查看 workspace 资产
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <SectionTitle
                  title="Bundle 内容策略"
                  description="为了让分享出去的智能体可直接复用，导出时会优先携带可迁移的文本资产，而不是本地凭据和临时状态。"
                />
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    会导出：
                    <div className="mt-2 text-xs leading-6 text-slate-500">
                      `AGENTS.md`、`SOUL.md`、`USER.md`、`MEMORY.md`、`skills/`、`memory/` 以及 workspace 下的其他文本资源。
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    不会导出：
                    <div className="mt-2 text-xs leading-6 text-slate-500">
                      `.git`、`node_modules`、缓存、session、日志等本地运行状态目录。
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <SectionTitle
                  title="分享最佳实践"
                  description="把 agent 当成可版本化资产，而不是一次性对话结果。"
                />
                <ol className="mt-5 space-y-3 text-sm text-slate-600">
                  <li className="rounded-2xl bg-slate-50 p-4">1. 把人格、边界、输出风格写进 `SOUL.md` / `AGENTS.md`，不要只靠临时对话记忆。</li>
                  <li className="rounded-2xl bg-slate-50 p-4">2. 把关键技能沉淀到 `skills/`，这样导入后另一个人能直接复用同样能力。</li>
                  <li className="rounded-2xl bg-slate-50 p-4">3. 共享前清理私有 API Key 和敏感 session，只分享可迁移文本资产。</li>
                  <li className="rounded-2xl bg-slate-50 p-4">4. 如果需要团队协作，bundle 之外再配合 git 管理 workspace 源文件。</li>
                </ol>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <SectionTitle
                  title="当前目标 workspace"
                  description="导入时会把 bundle 中的文件解包到这里。"
                />
                <div className="mt-5 rounded-3xl bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-200">
                  {settings.workspacePath}
                </div>

                {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                {notice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
              </div>
            </aside>
          </main>
        ) : null}
      </div>
    </div>
  )
}
