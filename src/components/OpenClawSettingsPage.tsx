import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { ExistingInstall, OpenClawChannelType, OpenClawDmPolicy, OpenClawGroupPolicy, OpenClawProviderApi, OpenClawSettings } from '../types'

interface OpenClawSettingsPageProps {
  existingInstall: ExistingInstall | null
}

const providerApiOptions: Array<{ value: OpenClawProviderApi; label: string; hint: string }> = [
  { value: 'openai-responses', label: 'OpenAI Responses', hint: '优先适配新的 OpenAI 兼容接口' },
  { value: 'openai-completions', label: 'OpenAI Chat Completions', hint: '兼容大多数现有代理服务' },
  { value: 'anthropic-messages', label: 'Anthropic Messages', hint: '适配 Claude / Anthropic 兼容接口' },
  { value: 'google-generative-ai', label: 'Google Generative AI', hint: '适配 Gemini 官方接口' }
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
  { value: 'telegram', label: 'Telegram', description: '用 bot token 直接接入，适合个人和小团队' },
  { value: 'discord', label: 'Discord', description: '适合社区和频道式协作' },
  { value: 'slack', label: 'Slack', description: '适合企业内部工作区' },
  { value: 'none', label: 'Later', description: '先只完成模型配置，稍后再接入 IM' }
]

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
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
  return 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100'
}

export default function OpenClawSettingsPage({ existingInstall }: OpenClawSettingsPageProps) {
  const [settings, setSettings] = useState<OpenClawSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const nextSettings = await window.electronAPI.getOpenClawSettings()
        setSettings(nextSettings)
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
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存 OpenClaw 配置失败')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e6fffb,transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-6">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-sm text-slate-500 shadow-xl">
          正在读取 OpenClaw 配置...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dffcf7,transparent_32%),radial-gradient(circle_at_right,#e8efff,transparent_28%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-4 sm:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl">
          <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                OpenClaw Post-Install Setup
              </div>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                  安装完成后直接进入配置，不再让用户碰命令行
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  这里会直接生成 OpenClaw 的真实配置文件，覆盖我们托管的模型和 IM 接入区块，同时保留其他已有配置。
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
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
              <div className="flex gap-3 pt-2">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  onClick={() => window.electronAPI.openDirectory(settings.configDir)}
                  type="button"
                >
                  打开配置目录
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="grid gap-6 lg:grid-cols-[1.25fr_0.85fr]">
          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="mb-6 flex items-start justify-between gap-4">
                <SectionTitle
                  title="模型接口"
                  description="对应 OpenClaw 的 models.providers.* 和 agents.defaults.model.primary。先填最少必要项，高级参数保持隐藏。"
                />
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
                  必填 4 项
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Provider ID" hint="例如 custom-openai">
                  <input
                    className={inputClassName()}
                    onChange={(event) => updateSettings('modelProviderId', event.target.value)}
                    placeholder="custom-openai"
                    value={settings.modelProviderId}
                  />
                </Field>

                <Field label="Model ID" hint="例如 gpt-4.1 / claude-sonnet-4">
                  <input
                    className={inputClassName()}
                    onChange={(event) => updateSettings('modelId', event.target.value)}
                    placeholder="gpt-4.1"
                    value={settings.modelId}
                  />
                </Field>

                <Field label="Base URL" hint="OpenAI-compatible / Anthropic / Gemini">
                  <input
                    className={inputClassName()}
                    onChange={(event) => updateSettings('modelBaseUrl', event.target.value)}
                    placeholder="https://api.openai.com/v1"
                    value={settings.modelBaseUrl}
                  />
                </Field>

                <Field label="API Key" hint="保存到 OpenClaw 配置">
                  <input
                    className={inputClassName()}
                    onChange={(event) => updateSettings('modelApiKey', event.target.value)}
                    placeholder="sk-..."
                    type="password"
                    value={settings.modelApiKey}
                  />
                </Field>

                <Field label="Provider API" hint="对接上游协议">
                  <select
                    className={inputClassName()}
                    onChange={(event) => updateSettings('modelApi', event.target.value as OpenClawProviderApi)}
                    value={settings.modelApi}
                  >
                    {providerApiOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Fallback Model" hint="可选">
                  <input
                    className={inputClassName()}
                    onChange={(event) => updateSettings('fallbackModelId', event.target.value)}
                    placeholder="gpt-4.1-mini"
                    value={settings.fallbackModelId}
                  />
                </Field>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-500">
                当前会生成一个 provider 节点，并把默认模型写入 `agents.defaults.model.primary`。如果你后续在 CLI 里加了更多 provider，这里不会清掉其他节点。
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="mb-6 flex items-start justify-between gap-4">
                <SectionTitle
                  title="即时通讯接入"
                  description="对应 OpenClaw 的 channels.telegram / discord / slack。先只展示当前渠道需要的字段，避免一页塞满。"
                />
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
                  简化输入
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {channelOptions.map((option) => (
                  <button
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      settings.channelType === option.value
                        ? 'border-brand-500 bg-brand-50 shadow-[0_8px_30px_rgba(20,184,166,0.12)]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
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
                    <select
                      className={inputClassName()}
                      onChange={(event) => updateSettings('dmPolicy', event.target.value as OpenClawDmPolicy)}
                      value={settings.dmPolicy}
                    >
                      {dmPolicies.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Group Policy">
                    <select
                      className={inputClassName()}
                      onChange={(event) => updateSettings('groupPolicy', event.target.value as OpenClawGroupPolicy)}
                      value={settings.groupPolicy}
                    >
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
                        <input
                          className={inputClassName()}
                          onChange={(event) => updateSettings('telegramBotToken', event.target.value)}
                          placeholder="123456:AA..."
                          type="password"
                          value={settings.telegramBotToken}
                        />
                      </Field>

                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <input
                          checked={settings.telegramRequireMention}
                          className="h-4 w-4 rounded accent-brand-600"
                          onChange={(event) => updateSettings('telegramRequireMention', event.target.checked)}
                          type="checkbox"
                        />
                        <div>
                          <div className="text-sm font-medium text-slate-800">群聊中必须 @ 机器人</div>
                          <div className="text-xs text-slate-500">写入 `channels.telegram.groups[&quot;*&quot;].requireMention`</div>
                        </div>
                      </label>
                    </>
                  ) : null}

                  {settings.channelType === 'discord' ? (
                    <Field label="Discord Bot Token" hint="channels.discord.token">
                      <input
                        className={inputClassName()}
                        onChange={(event) => updateSettings('discordBotToken', event.target.value)}
                        placeholder="Bot token"
                        type="password"
                        value={settings.discordBotToken}
                      />
                    </Field>
                  ) : null}

                  {settings.channelType === 'slack' ? (
                    <>
                      <Field label="Slack Bot Token" hint="xoxb-...">
                        <input
                          className={inputClassName()}
                          onChange={(event) => updateSettings('slackBotToken', event.target.value)}
                          placeholder="xoxb-..."
                          type="password"
                          value={settings.slackBotToken}
                        />
                      </Field>

                      <Field label="Slack App Token" hint="xapp-...">
                        <input
                          className={inputClassName()}
                          onChange={(event) => updateSettings('slackAppToken', event.target.value)}
                          placeholder="xapp-..."
                          type="password"
                          value={settings.slackAppToken}
                        />
                      </Field>

                      <Field label="Slack User Token" hint="可选">
                        <input
                          className={inputClassName()}
                          onChange={(event) => updateSettings('slackUserToken', event.target.value)}
                          placeholder="xoxp-..."
                          type="password"
                          value={settings.slackUserToken}
                        />
                      </Field>

                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <input
                          checked={settings.slackUserTokenReadOnly}
                          className="h-4 w-4 rounded accent-brand-600"
                          onChange={(event) => updateSettings('slackUserTokenReadOnly', event.target.checked)}
                          type="checkbox"
                        />
                        <div>
                          <div className="text-sm font-medium text-slate-800">User token 只读</div>
                          <div className="text-xs text-slate-500">保守模式，先减少误操作范围</div>
                        </div>
                      </label>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  先只保存模型配置。等 OpenClaw 能稳定对话后，再接 Telegram / Discord / Slack。
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <SectionTitle
                title="保存策略"
                description="设置页只托管上游稳定的几个区块，减少和 OpenClaw CLI 的互相覆盖。"
              />
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-slate-50 p-4">
                  保留其他配置键：不会清理你已有的 tools、profiles、hooks 等其他 OpenClaw 配置。
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  重点写入：
                  <code className="ml-1 text-xs text-brand-700">models.providers</code>、
                  <code className="ml-1 text-xs text-brand-700">agents.defaults.model</code>、
                  <code className="ml-1 text-xs text-brand-700">channels.*</code>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  保存后如果 gateway 已在运行，建议你重启 OpenClaw 相关进程，让新配置立即生效。
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <SectionTitle
                title="配置摘要"
                description="这里展示最终会写入的最核心配置点。"
              />
              <div className="mt-5 space-y-3 rounded-3xl bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-200">
                <div>provider: {settings.modelProviderId}</div>
                <div>primary: {settings.modelProviderId}/{settings.modelId}</div>
                <div>fallback: {settings.fallbackModelId ? `${settings.modelProviderId}/${settings.fallbackModelId}` : '(none)'}</div>
                <div>api: {settings.modelApi}</div>
                <div>baseUrl: {settings.modelBaseUrl}</div>
                <div>channel: {settings.channelType}</div>
                {settings.channelType === 'telegram' ? <div>telegram.requireMention: {String(settings.telegramRequireMention)}</div> : null}
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {notice ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {notice}
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-3">
                <button
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={isSaving}
                  onClick={handleSave}
                  type="button"
                >
                  {isSaving ? '正在写入 OpenClaw 配置...' : '保存到 OpenClaw 配置'}
                </button>
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => window.electronAPI.openDirectory(settings.configDir)}
                  type="button"
                >
                  打开配置目录检查结果
                </button>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  )
}
