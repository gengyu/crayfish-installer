import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalModelDiscoveryResult, OpenClawPluginPreset, OpenClawSettings } from '../types'
import OpenClawSettingsPage from './OpenClawSettingsPage'

const baseSettings: OpenClawSettings = {
  configPath: '/Users/tester/.openclaw/openclaw.json',
  configDir: '/Users/tester/.openclaw',
  workspacePath: '/Users/tester/.openclaw/workspace',
  modelProviderId: 'ollama',
  modelBaseUrl: 'http://127.0.0.1:11434',
  modelApiKey: 'local',
  modelApi: 'openai-responses',
  modelId: 'qwen3-vl:4b',
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

const presets: OpenClawPluginPreset[] = [
  {
    id: 'control-ui',
    title: 'Control UI',
    description: '控制台',
    installSource: null,
    enableCommand: null,
    category: 'ui',
    recommended: true
  },
  {
    id: 'memory-lancedb',
    title: 'Memory LanceDB',
    description: '长期记忆',
    installSource: null,
    enableCommand: 'memory-lancedb',
    category: 'memory',
    recommended: true
  },
  {
    id: 'wechat-clawbot',
    title: '微信 ClawBot',
    description: '微信接入',
    installSource: '@tencent-weixin/openclaw-weixin-cli@latest',
    enableCommand: null,
    category: 'channel',
    recommended: true
  }
]

const localModelDiscovery: LocalModelDiscoveryResult = {
  source: 'ollama',
  modelIds: ['qwen3-vl:4b', 'gemma3:4b'],
  defaultModelId: 'qwen3-vl:4b'
}

function createElectronApi() {
  return {
    getPlatform: vi.fn(),
    getDefaultInstallPath: vi.fn(),
    checkExistingInstallation: vi.fn(),
    checkDependencies: vi.fn(),
    getRuntimeStatus: vi.fn(),
    checkDiskSpace: vi.fn(),
    selectInstallPath: vi.fn(),
    installOpenClaw: vi.fn(),
    uninstallOpenClaw: vi.fn(),
    launchOpenClaw: vi.fn(),
    openDirectory: vi.fn().mockResolvedValue(undefined),
    getOpenClawSettings: vi.fn().mockResolvedValue(baseSettings),
    getLocalModelDiscovery: vi.fn().mockResolvedValue(localModelDiscovery),
    testOpenClawModelConnection: vi.fn().mockResolvedValue({
      success: true,
      message: '连接成功，已发现 2 个 Ollama 模型。',
      modelIds: localModelDiscovery.modelIds
    }),
    saveOpenClawSettings: vi.fn().mockResolvedValue({ success: true, configPath: baseSettings.configPath }),
    getOpenClawPluginPresets: vi.fn().mockResolvedValue(presets),
    applyOpenClawPluginPreset: vi.fn().mockResolvedValue({ success: true, configPath: baseSettings.configPath }),
    installOpenClawPluginPreset: vi.fn().mockResolvedValue({ success: true, message: '插件已启用' }),
    openOpenClawControlUi: vi.fn().mockResolvedValue({ success: true, url: 'http://127.0.0.1:18789' }),
    exportOpenClawAgentBundle: vi.fn().mockResolvedValue({
      success: true,
      path: '/tmp/demo.ocb.json',
      fileCount: 4,
      workspacePath: baseSettings.workspacePath
    }),
    importOpenClawAgentBundle: vi.fn().mockResolvedValue({
      success: true,
      path: '/tmp/demo.ocb.json',
      fileCount: 3,
      workspacePath: baseSettings.workspacePath
    }),
    onInstallProgress: vi.fn(),
    removeInstallProgressListener: vi.fn()
  }
}

describe('OpenClawSettingsPage', () => {
  beforeEach(() => {
    window.electronAPI = createElectronApi()
  })

  it('loads settings, toggles channel forms, saves quick setup and opens utility actions', async () => {
    const user = userEvent.setup()

    render(
      <OpenClawSettingsPage
        existingInstall={{ exists: true, path: '/Applications/OpenClaw', version: { version: '1.2.3', installDate: '2026-03-26' } }}
        onGoToInstaller={vi.fn()}
      />
    )

    expect(await screen.findByLabelText(/Model ID/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Model ID/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '测试连接' }))
    expect(window.electronAPI.testOpenClawModelConnection).toHaveBeenCalledWith(expect.objectContaining({
      modelProviderId: 'ollama'
    }))
    expect(await screen.findByText('连接成功，已发现 2 个 Ollama 模型。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /腾讯混元/ }))
    expect(screen.getByDisplayValue('https://api.hunyuan.cloud.tencent.com/v1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('qwen3-vl:4b')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /自定义/ }))
    expect(screen.getByDisplayValue('hunyuan')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ollama/ }))
    await user.clear(screen.getByLabelText(/Workspace Path/))
    await user.type(screen.getByLabelText(/Workspace Path/), '/Users/tester/agents/demo')
    const fallbackField = screen.getByLabelText(/Fallback Models/i)
    fireEvent.change(fallbackField, { target: { value: 'gpt-4.1-mini\ngpt-4.1-nano' } })

    await user.click(screen.getByRole('button', { name: /Slack/ }))
    expect(screen.getByLabelText(/Slack Bot Token/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Slack App Token/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /稍后再配/ }))
    expect(screen.getByText('先只保存模型配置。等模型可以稳定响应后，再接入 IM 渠道。')).toBeInTheDocument()
    expect(screen.getByText('微信 ClawBot')).toBeInTheDocument()
    expect(screen.getByText('pnpm dlx @tencent-weixin/openclaw-weixin-cli@latest install')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Telegram/ }))
    await user.click(screen.getByRole('button', { name: '保存 Quick Setup' }))

    await waitFor(() => {
      expect(window.electronAPI.saveOpenClawSettings).toHaveBeenCalledWith(expect.objectContaining({
        workspacePath: '/Users/tester/agents/demo',
        fallbackModelIds: ['gpt-4.1-mini', 'gpt-4.1-nano'],
        channelType: 'telegram'
      }))
    })

    expect(await screen.findByText(`已写入 OpenClaw 配置：${baseSettings.configPath}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '打开 Control UI' }))
    expect(await screen.findByText('已打开 OpenClaw Control UI：http://127.0.0.1:18789')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '查看当前 workspace' }))
    expect(window.electronAPI.openDirectory).toHaveBeenCalledWith('/Users/tester/.openclaw/workspace')
  })

  it('applies and installs plugin presets from Plugin Center', async () => {
    const user = userEvent.setup()

    render(
      <OpenClawSettingsPage
        existingInstall={{ exists: true, path: '/Applications/OpenClaw', version: { version: '1.2.3', installDate: '2026-03-26' } }}
        onGoToInstaller={vi.fn()}
      />
    )

    await screen.findByText('Quick Setup')
    await user.click(screen.getByRole('button', { name: /Plugin Center .*一键启用/ }))

    const card = screen.getByText('Memory LanceDB').closest('article')
    expect(card).not.toBeNull()

    const scoped = within(card!)
    await user.click(scoped.getByRole('button', { name: '应用配置' }))
    expect(window.electronAPI.applyOpenClawPluginPreset).toHaveBeenCalledWith('memory-lancedb')
    expect(await screen.findByText(`已写入插件预设到 ${baseSettings.configPath}`)).toBeInTheDocument()

    await user.click(scoped.getByRole('button', { name: '安装/启用' }))
    expect(window.electronAPI.installOpenClawPluginPreset).toHaveBeenCalledWith('memory-lancedb')
    expect(await within(card!).findByText('插件已启用')).toBeInTheDocument()
    expect(within(card!).getByText('安装成功')).toBeInTheDocument()

    const wechatCard = screen.getByText('微信 ClawBot').closest('article')
    expect(wechatCard).not.toBeNull()

    const wechatScoped = within(wechatCard!)
    await user.click(wechatScoped.getByRole('button', { name: '安装并显示二维码' }))
    expect(window.electronAPI.installOpenClawPluginPreset).toHaveBeenCalledWith('wechat-clawbot')
  })

  it('keeps plugin status when revisiting the plugin tab and shows failure feedback', async () => {
    const user = userEvent.setup()
    const api = createElectronApi()
    api.installOpenClawPluginPreset = vi.fn()
      .mockResolvedValueOnce({ success: true, message: 'Memory 插件安装完成' })
      .mockRejectedValueOnce(new Error('二维码拉起失败'))
    window.electronAPI = api

    render(
      <OpenClawSettingsPage
        existingInstall={{ exists: true, path: '/Applications/OpenClaw', version: { version: '1.2.3', installDate: '2026-03-26' } }}
        onGoToInstaller={vi.fn()}
      />
    )

    await screen.findByText('Quick Setup')
    await user.click(screen.getByRole('button', { name: /Plugin Center .*一键启用/ }))

    const memoryCard = screen.getByText('Memory LanceDB').closest('article')
    expect(memoryCard).not.toBeNull()
    await user.click(within(memoryCard!).getByRole('button', { name: '安装/启用' }))
    expect(await within(memoryCard!).findByText('Memory 插件安装完成')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Quick Setup/ }))
    await user.click(screen.getByRole('button', { name: /Plugin Center .*一键启用/ }))
    const revisitedMemoryCard = screen.getByText('Memory LanceDB').closest('article')
    expect(revisitedMemoryCard).not.toBeNull()
    expect(within(revisitedMemoryCard!).getByText('安装成功')).toBeInTheDocument()
    expect(within(revisitedMemoryCard!).getByText('Memory 插件安装完成')).toBeInTheDocument()

    const wechatCard = screen.getByText('微信 ClawBot').closest('article')
    expect(wechatCard).not.toBeNull()
    await user.click(within(wechatCard!).getByRole('button', { name: '安装并显示二维码' }))
    expect(await within(wechatCard!).findByText('二维码拉起失败')).toBeInTheDocument()
    expect(within(wechatCard!).getByText('安装失败')).toBeInTheDocument()
  })

  it('exports and imports agent bundles from Agent Studio', async () => {
    const user = userEvent.setup()

    render(
      <OpenClawSettingsPage
        existingInstall={{ exists: true, path: '/Applications/OpenClaw', version: { version: '1.2.3', installDate: '2026-03-26' } }}
        onGoToInstaller={vi.fn()}
      />
    )

    await screen.findByText('Quick Setup')
    await user.click(screen.getByRole('button', { name: /Agent Studio/ }))

    await user.clear(screen.getByLabelText(/Bundle Name/))
    await user.type(screen.getByLabelText(/Bundle Name/), 'team-agent')
    await user.click(screen.getByRole('button', { name: '导出当前智能体' }))

    expect(window.electronAPI.exportOpenClawAgentBundle).toHaveBeenCalledWith(expect.objectContaining({
      name: 'team-agent'
    }))
    expect(await screen.findByText('已导出 4 个文件到 /tmp/demo.ocb.json')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '导入别人分享的智能体' }))
    expect(window.electronAPI.importOpenClawAgentBundle).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(`已向 ${baseSettings.workspacePath} 导入 3 个文件`)).toBeInTheDocument()
  })

  it('shows a retryable error state when initial load fails', async () => {
    const user = userEvent.setup()
    const api = createElectronApi()
    api.getOpenClawSettings
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(baseSettings)
    window.electronAPI = api

    render(
      <OpenClawSettingsPage
        existingInstall={null}
        onGoToInstaller={vi.fn()}
      />
    )

    expect(await screen.findByText('读取 OpenClaw 工作台配置失败')).toBeInTheDocument()
    expect(screen.getByText('network down')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重新读取配置' }))
    expect(await screen.findByLabelText(/Model ID/i)).toBeInTheDocument()
  })
})
