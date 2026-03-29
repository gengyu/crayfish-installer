import { render, screen, waitFor } from '@testing-library/react'
import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExistingInstall, SystemInfo } from '../types'
import type { RuntimeStatus } from '../lib/installer-state'
import Installer from './Installer'

const systemInfo: SystemInfo = {
  platform: 'darwin',
  arch: 'arm64',
  osRelease: '24.4.0',
  osVersion: '15.4',
  totalMemory: '16 GB',
  freeMemory: '8 GB',
  cpus: 8,
  homedir: '/Users/tester'
}

const emptyInstall: ExistingInstall | null = {
  exists: false,
  path: null,
  version: null
}

function createRuntimeStatus(installed: boolean): RuntimeStatus {
  return {
    commands: {
      node: { exists: true, path: '/usr/local/bin/node', version: 'v22.16.0' },
      npm: { exists: true, path: '/usr/local/bin/npm', version: '10.9.0' },
      pnpm: { exists: true, path: '/usr/local/bin/pnpm', version: '9.1.0' },
      openclaw: installed
        ? { exists: true, path: '/usr/local/bin/openclaw', version: '1.2.3' }
        : { exists: false, path: null, version: null }
    },
    gateway: {
      running: false,
      port: 18789
    },
    registry: {
      npm: 'https://registry.npmjs.org',
      pnpm: 'https://registry.npmjs.org'
    },
    mirrorRecommended: false
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
}

describe('Installer', () => {
  let clipboardWriteText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clipboardWriteText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText
      }
    })

    window.electronAPI = {
      getPlatform: vi.fn(),
      getDefaultInstallPath: vi.fn().mockResolvedValue('/Applications/OpenClaw'),
      checkExistingInstallation: vi.fn(),
      checkDependencies: vi.fn().mockResolvedValue({ node: true, pnpm: false }),
      getRuntimeStatus: vi.fn()
        .mockResolvedValueOnce(createRuntimeStatus(false))
        .mockResolvedValueOnce(createRuntimeStatus(true)),
      checkDiskSpace: vi.fn(),
      selectInstallPath: vi.fn(),
      installOpenClaw: vi.fn().mockResolvedValue({ success: true, attempts: 1 }),
      uninstallOpenClaw: vi.fn(),
      launchOpenClaw: vi.fn().mockResolvedValue({ success: true }),
      openDirectory: vi.fn().mockResolvedValue(undefined),
      getOpenClawSettings: vi.fn(),
      getLocalModelDiscovery: vi.fn(),
      saveOpenClawSettings: vi.fn(),
      getOpenClawPluginPresets: vi.fn(),
      applyOpenClawPluginPreset: vi.fn(),
      installOpenClawPluginPreset: vi.fn(),
      openOpenClawControlUi: vi.fn(),
      exportOpenClawAgentBundle: vi.fn(),
      importOpenClawAgentBundle: vi.fn(),
      onInstallProgress: vi.fn(),
      removeInstallProgressListener: vi.fn()
    }
  })

  it('shows missing dependency details from the derived runtime state', async () => {
    const user = userEvent.setup()

    render(
      <Installer
        systemInfo={systemInfo}
        existingInstall={emptyInstall}
        onInstallationChanged={vi.fn()}
      />
    )

    await screen.findByRole('button', { name: /立即安装/ })
    await user.click(screen.getByRole('button', { name: /查看安装详情/ }))
    expect(screen.getByText('/Applications/OpenClaw')).toBeInTheDocument()
    expect(await screen.findByText('待补齐：pnpm')).toBeInTheDocument()
  })

  it('runs the install flow with the detected default path and refreshes runtime state', async () => {
    const user = userEvent.setup()
    const onInstallationChanged = vi.fn()

    render(
      <Installer
        systemInfo={systemInfo}
        existingInstall={emptyInstall}
        onInstallationChanged={onInstallationChanged}
      />
    )

    await screen.findByRole('button', { name: /立即安装/ })
    await user.click(screen.getByRole('button', { name: /立即安装/ }))

    await waitFor(() => {
      expect(window.electronAPI.installOpenClaw).toHaveBeenCalledWith('/Applications/OpenClaw')
    })

    expect(await screen.findByRole('button', { name: /启动 OpenClaw/ })).toBeInTheDocument()
    expect(onInstallationChanged).toHaveBeenCalledTimes(1)
  })

  it('lets the user choose a path before installing when no default path exists', async () => {
    const user = userEvent.setup()
    vi.mocked(window.electronAPI.getDefaultInstallPath).mockResolvedValue('')
    vi.mocked(window.electronAPI.selectInstallPath).mockResolvedValue('/tmp/OpenClaw')

    render(
      <Installer
        systemInfo={systemInfo}
        existingInstall={emptyInstall}
        onInstallationChanged={vi.fn()}
      />
    )

    await user.click(await screen.findByRole('button', { name: /立即安装/ }))

    expect(window.electronAPI.selectInstallPath).toHaveBeenCalledTimes(1)
    expect(window.electronAPI.installOpenClaw).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /查看安装详情/ }))
    expect(await screen.findByText('/tmp/OpenClaw')).toBeInTheDocument()
  })

  it('shows install progress while submitting and handles install failures with retry and copy', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<{ success: boolean; attempts?: number }>()
    vi.mocked(window.electronAPI.installOpenClaw).mockImplementationOnce(() => deferred.promise as Promise<{ success: boolean }>)
      .mockResolvedValue({ success: false, error: '网络失败', detail: 'ECONNRESET', attempts: 2 })

    render(
      <Installer
        systemInfo={systemInfo}
        existingInstall={emptyInstall}
        onInstallationChanged={vi.fn()}
      />
    )

    await screen.findByRole('button', { name: /立即安装/ })
    await user.click(screen.getByRole('button', { name: /立即安装/ }))

    const progressHandler = vi.mocked(window.electronAPI.onInstallProgress).mock.calls[0][0]
    progressHandler({ stage: 'downloading', progress: 35, detail: '正在下载 OpenClaw' })

    expect(await screen.findByText('35%')).toBeInTheDocument()
    expect(screen.getByText('正在下载 OpenClaw')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '安装中...' })).toBeDisabled()

    deferred.resolve({ success: false, error: '网络失败', detail: 'ECONNRESET', attempts: 2 } as { success: boolean; attempts?: number })

    expect(await screen.findByText('网络失败')).toBeInTheDocument()
    expect(screen.getByText('已自动重试 1 次。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /查看安装详情/ }))
    expect(screen.getByText('ECONNRESET')).toBeInTheDocument()

    const copyButton = screen.getByRole('button', { name: '复制错误信息' })
    expect(copyButton).toBeEnabled()
    await user.click(copyButton)

    await user.click(screen.getByRole('button', { name: /再试一次/ }))
    await waitFor(() => {
      expect(window.electronAPI.installOpenClaw).toHaveBeenCalledTimes(2)
    })
  })

  it('supports launch, open-directory, uninstall success and uninstall failure for installed runtimes', async () => {
    const user = userEvent.setup()
    const onBackToSettings = vi.fn()
    const onInstallationChanged = vi.fn()
    vi.mocked(window.electronAPI.checkDependencies).mockResolvedValue({ node: true, pnpm: true, openclaw: true })
    vi.mocked(window.electronAPI.getRuntimeStatus)
      .mockResolvedValueOnce(createRuntimeStatus(true))
      .mockResolvedValueOnce(createRuntimeStatus(false))

    vi.mocked(window.electronAPI.launchOpenClaw).mockResolvedValue({ success: false, error: '启动失败：端口占用' })
    vi.mocked(window.electronAPI.uninstallOpenClaw)
      .mockResolvedValueOnce({ success: false, error: '卸载失败' })
      .mockResolvedValueOnce({ success: true })

    render(
      <Installer
        systemInfo={systemInfo}
        existingInstall={{ exists: true, path: '/Applications/OpenClaw', version: { version: '1.2.3', installDate: '2026-03-26' } }}
        onInstallationChanged={onInstallationChanged}
        onBackToSettings={onBackToSettings}
      />
    )

    expect(await screen.findByRole('button', { name: /返回配置页面/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /返回配置页面/ }))
    expect(onBackToSettings).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /查看安装详情/ }))
    await user.click(screen.getByRole('button', { name: /^启动$/ }))
    expect(window.electronAPI.launchOpenClaw).toHaveBeenCalledWith('/Applications/OpenClaw')
    expect(await screen.findByText('启动失败：端口占用')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '打开目录' }))
    expect(window.electronAPI.openDirectory).toHaveBeenCalledWith('/Applications/OpenClaw')

    await user.click(screen.getByRole('button', { name: '卸载' }))
    expect(await screen.findByText('确认卸载 OpenClaw')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认卸载' }))
    expect(await screen.findAllByText('卸载失败')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /再试一次/ }))
    await waitFor(() => {
      expect(window.electronAPI.installOpenClaw).toHaveBeenCalled()
    })
  })

  it('completes uninstall and returns to install-ready state', async () => {
    const user = userEvent.setup()
    const onInstallationChanged = vi.fn()
    vi.mocked(window.electronAPI.checkDependencies).mockResolvedValue({ node: true, pnpm: true, openclaw: true })
    vi.mocked(window.electronAPI.getRuntimeStatus)
      .mockResolvedValueOnce(createRuntimeStatus(true))
      .mockResolvedValueOnce(createRuntimeStatus(false))
    vi.mocked(window.electronAPI.uninstallOpenClaw).mockResolvedValue({ success: true })

    const { rerender } = render(
      <Installer
        systemInfo={systemInfo}
        existingInstall={{ exists: true, path: '/Applications/OpenClaw', version: { version: '1.2.3', installDate: '2026-03-26' } }}
        onInstallationChanged={onInstallationChanged}
      />
    )

    await screen.findByRole('button', { name: /查看安装详情/ })
    await user.click(screen.getByRole('button', { name: /查看安装详情/ }))
    await user.click(screen.getByRole('button', { name: '卸载' }))
    expect(await screen.findByText('确认卸载 OpenClaw')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认卸载' }))

    await waitFor(() => {
      expect(window.electronAPI.uninstallOpenClaw).toHaveBeenCalledWith({
        installPath: '/Applications/OpenClaw',
        options: {
          removeConfig: false,
          removeOpenClaw: true,
          removeNode: false,
          removeWorkspace: false
        }
      })
    })
    await waitFor(() => {
      expect(window.electronAPI.getRuntimeStatus).toHaveBeenCalledTimes(2)
      expect(onInstallationChanged).toHaveBeenCalledTimes(1)
    })

    rerender(
      <Installer
        systemInfo={systemInfo}
        existingInstall={emptyInstall}
        onInstallationChanged={onInstallationChanged}
      />
    )

    await waitFor(() => {
      expect(onInstallationChanged).toHaveBeenCalledTimes(1)
    })
  })

  it('lets the user choose extra cleanup targets before uninstalling', async () => {
    const user = userEvent.setup()
    vi.mocked(window.electronAPI.checkDependencies).mockResolvedValue({ node: true, pnpm: true, openclaw: true })
    vi.mocked(window.electronAPI.getRuntimeStatus)
      .mockResolvedValueOnce(createRuntimeStatus(true))
      .mockResolvedValueOnce(createRuntimeStatus(false))
    vi.mocked(window.electronAPI.uninstallOpenClaw).mockResolvedValue({ success: true })

    render(
      <Installer
        systemInfo={systemInfo}
        existingInstall={{ exists: true, path: '/Applications/OpenClaw', version: { version: '1.2.3', installDate: '2026-03-26' } }}
        onInstallationChanged={vi.fn()}
      />
    )

    await screen.findByRole('button', { name: /查看安装详情/ })
    await user.click(screen.getByRole('button', { name: /查看安装详情/ }))
    await user.click(screen.getByRole('button', { name: '卸载' }))

    await user.click(screen.getByRole('checkbox', { name: /删除 OpenClaw 配置文件/ }))
    await user.click(screen.getByRole('checkbox', { name: /删除 OpenClaw workspace/ }))
    await user.click(screen.getByRole('checkbox', { name: /删除 Node.js \/ pnpm 环境/ }))
    await user.click(screen.getByRole('button', { name: '确认卸载' }))

    await waitFor(() => {
      expect(window.electronAPI.uninstallOpenClaw).toHaveBeenCalledWith({
        installPath: '/Applications/OpenClaw',
        options: {
          removeConfig: true,
          removeOpenClaw: true,
          removeNode: true,
          removeWorkspace: true
        }
      })
    })
  })

  it('keeps the uninstall dialog visible with progress feedback while uninstalling', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<{ success: boolean }>()
    vi.mocked(window.electronAPI.checkDependencies).mockResolvedValue({ node: true, pnpm: true, openclaw: true })
    vi.mocked(window.electronAPI.getRuntimeStatus).mockResolvedValue(createRuntimeStatus(true))
    vi.mocked(window.electronAPI.uninstallOpenClaw).mockImplementationOnce(() => deferred.promise)

    render(
      <Installer
        systemInfo={systemInfo}
        existingInstall={{ exists: true, path: '/Applications/OpenClaw', version: { version: '1.2.3', installDate: '2026-03-26' } }}
        onInstallationChanged={vi.fn()}
      />
    )

    await screen.findByRole('button', { name: /查看安装详情/ })
    await user.click(screen.getByRole('button', { name: /查看安装详情/ }))
    await user.click(screen.getByRole('button', { name: '卸载' }))
    await user.click(screen.getByRole('button', { name: '确认卸载' }))

    const dialog = screen.getByText('确认卸载 OpenClaw').closest('div[class*="rounded-[28px]"]') ?? screen.getByText('确认卸载 OpenClaw').parentElement?.parentElement
    expect(dialog).not.toBeNull()
    expect(within(dialog as HTMLElement).getByText('正在卸载')).toBeInTheDocument()
    expect(within(dialog as HTMLElement).getByText('卸载过程中请不要关闭窗口或重复点击按钮。')).toBeInTheDocument()

    const progressHandler = vi.mocked(window.electronAPI.onInstallProgress).mock.calls[0][0]
    progressHandler({ stage: 'uninstalling', progress: 60, detail: '正在删除 OpenClaw 配置' })
    expect(await within(dialog as HTMLElement).findByText('正在删除 OpenClaw 配置')).toBeInTheDocument()

    deferred.resolve({ success: true })
    await waitFor(() => {
      expect(screen.getByText('卸载已完成')).toBeInTheDocument()
      expect(screen.getByText('OpenClaw 主程序与 gateway 服务')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
    })
  })
})
