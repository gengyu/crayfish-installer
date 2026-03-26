import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  ExistingInstall,
  OpenClawChannelType,
  OpenClawDmPolicy,
  OpenClawGroupPolicy,
  OpenClawPluginPreset,
  OpenClawProviderApi,
  OpenClawSettings
} from '../types'

type WorkspaceTab = 'setup' | 'plugins' | 'agents'

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
  const [settings, setSettings] = useState<OpenClawSettings | null>(null)
  const [pluginPresets, setPluginPresets] = useState<OpenClawPluginPreset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [pluginBusyId, setPluginBusyId] = useState<string | null>(null)
  const [bundleBusy, setBundleBusy] = useState<'export' | 'import' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [agentBundleName, setAgentBundleName] = useState('my-openclaw-agent')
  const [agentBundleDescription, setAgentBundleDescription] = useState('包含记忆、技能和人格设定的可复用智能体')

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [nextSettings, nextPluginPresets] = await Promise.all([
          window.electronAPI.getOpenClawSettings(),
          window.electronAPI.getOpenClawPluginPresets()
        ])
        setSettings(nextSettings)
        setPluginPresets(nextPluginPresets)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '读取 OpenClaw 配置失败')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  const updateSettings = <K extends keyof OpenClawSettings>(key: K, value: OpenClawSettings[K]) => {
    setSettings((current) => current ? { ...current, [key]: value } : current)
  }

  const refreshSettings = async () => {
    const nextSettings = await window.electronAPI.getOpenClawSettings()
    setSettings(nextSettings)
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

    try {
      const result = await window.electronAPI.applyOpenClawPluginPreset(presetId)
      setNotice(`已写入插件预设到 ${result.configPath}`)
      await refreshSettings()
    } catch (pluginError) {
      setError(pluginError instanceof Error ? pluginError.message : '应用插件预设失败')
    } finally {
      setPluginBusyId(null)
    }
  }

  const handleInstallPluginPreset = async (presetId: string) => {
    setPluginBusyId(presetId)
    setError(null)
    setNotice(null)

    try {
      const result = await window.electronAPI.installOpenClawPluginPreset(presetId)
      setNotice(result.message)
    } catch (pluginError) {
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

  if (isLoading || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e6fffb,transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-6">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-sm text-slate-500 shadow-xl">
          正在读取 OpenClaw 工作台配置...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dffcf7,transparent_32%),radial-gradient(circle_at_right,#e8efff,transparent_28%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-4 sm:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl">
          <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1.5fr_0.9fr]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                OpenClaw Configuration Workspace
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                  安装完成后，直接可视化配置 OpenClaw、插件和可分享智能体
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                  这里按 OpenClaw 官方最佳实践，把高频配置拆成 Quick Setup、Plugin Center 和 Agent Studio 三块。
                  模型接口、IM 渠道、记忆插件、工作流插件以及 agent bundle 导入导出都统一在一个面板里完成。
                </p>
              </div>
            </div>

            <div className="relative grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <button
                className="absolute right-0 top-0 rounded-bl-2xl rounded-tr-[28px] border-b border-l border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 hover:text-red-700"
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
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  onClick={() => window.electronAPI.openDirectory(settings.configDir)}
                  type="button"
                >
                  打开配置目录
                </button>
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  onClick={() => window.electronAPI.openDirectory(settings.workspacePath)}
                  type="button"
                >
                  打开 workspace
                </button>
                <button
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
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
              className={`rounded-[24px] border p-5 text-left transition ${statusCardClass(activeTab === tab.id)}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <div className="text-lg font-semibold text-slate-900">{tab.title}</div>
              <div className="mt-1 text-sm text-slate-500">{tab.subtitle}</div>
            </button>
          ))}
        </section>

        {activeTab === 'setup' ? (
          <main className="grid gap-6 lg:grid-cols-[1.2fr_0.85fr]">
            <section className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <SectionTitle
                    title="模型接口"
                    description="对应 OpenClaw 的 models.providers.* 和 agents.defaults.model.primary。遵循官方建议，优先只暴露最关键的 provider / baseUrl / apiKey / model。"
                  />
                  <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
                    推荐先跑通 Responses / Completions
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Provider ID" hint="例如 custom-openai">
                    <input className={inputClassName()} onChange={(event) => updateSettings('modelProviderId', event.target.value)} value={settings.modelProviderId} />
                  </Field>
                  <Field label="Model ID" hint="例如 gpt-4.1 / claude-sonnet-4">
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
                  <Field label="Fallback Model" hint="可选">
                    <input className={inputClassName()} onChange={(event) => updateSettings('fallbackModelId', event.target.value)} value={settings.fallbackModelId} />
                  </Field>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <SectionTitle
                    title="即时通讯接入"
                    description="官方渠道里 Telegram、Discord、Slack 是最稳定的三种路径。这里按渠道做分组，只展示当前场景必要字段。"
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
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <SectionTitle
                  title="Workspace 与持久化"
                  description="OpenClaw 的长期资产不只是配置文件，还包括 workspace 里的 AGENTS.md、SOUL.md、MEMORY.md、skills 等文本资产。"
                />
                <div className="mt-5 space-y-4">
                  <Field label="Workspace Path" hint="agents.defaults.workspace">
                    <input className={inputClassName()} onChange={(event) => updateSettings('workspacePath', event.target.value)} value={settings.workspacePath} />
                  </Field>
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    最佳实践是把一个调教好的智能体工作区当作“可交付资产”管理，而不是只保存模型 token。
                    这也是下方 Agent Studio 支持导出/导入 bundle 的原因。
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <SectionTitle
                  title="配置摘要"
                  description="保存时会保留其他未知配置键，只更新你在这个界面托管的核心区块。"
                />
                <div className="mt-5 space-y-3 rounded-3xl bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-200">
                  <div>provider: {settings.modelProviderId}</div>
                  <div>primary: {settings.modelProviderId}/{settings.modelId}</div>
                  <div>fallback: {settings.fallbackModelId ? `${settings.modelProviderId}/${settings.fallbackModelId}` : '(none)'}</div>
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
                  description="结合 OpenClaw 官方最佳实践，先推荐 1) Control UI 2) Memory LanceDB 3) Open Prose。先让可视化控制台、长期记忆和工作流能力就绪，再扩展其它插件。"
                />
                <div className="mt-6 grid gap-4">
                  {pluginPresets.map((preset) => (
                    <article className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-5" key={preset.id}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">{preset.title}</h3>
                            {preset.recommended ? (
                              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">
                                Recommended
                              </span>
                            ) : null}
                          </div>
                          <p className="max-w-2xl text-sm leading-6 text-slate-600">{preset.description}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{preset.category}</span>
                            {preset.installSource ? <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{preset.installSource}</span> : null}
                            {preset.enableCommand ? <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">enable {preset.enableCommand}</span> : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={pluginBusyId === preset.id}
                            onClick={() => handleApplyPluginPreset(preset.id)}
                            type="button"
                          >
                            应用配置
                          </button>
                          <button
                            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={pluginBusyId === preset.id}
                            onClick={() => handleInstallPluginPreset(preset.id)}
                            type="button"
                          >
                            {preset.id === 'control-ui' ? '打开 UI' : '安装/启用'}
                          </button>
                        </div>
                      </div>
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
                  <li className="rounded-2xl bg-slate-50 p-4">4. 最后再接语音或外部渠道插件，降低排障成本。</li>
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
