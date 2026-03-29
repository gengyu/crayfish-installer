import { describe, expect, it } from 'vitest'
import { buildRuntimeSummary, deriveInstallerUiState, getEnvironmentNote, getPlatformName, getStageText, type InstallState, type RuntimeStatus } from './installer-state'

const baseState: InstallState = {
  stage: 'idle',
  progress: 0,
  installPath: '/Applications/OpenClaw',
  error: null,
  warning: null,
  detail: '准备开始',
  errorDetail: null,
  warningDetail: null,
  attempts: 0
}

const baseRuntimeStatus: RuntimeStatus = {
  commands: {
    node: { exists: true, path: '/usr/local/bin/node', version: 'v22.16.0' },
    npm: { exists: true, path: '/usr/local/bin/npm', version: '10.9.0' },
    pnpm: { exists: true, path: '/usr/local/bin/pnpm', version: '9.0.0' },
    openclaw: { exists: true, path: '/usr/local/bin/openclaw', version: '1.2.3' }
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

describe('installer-state helpers', () => {
  it('derives the installer ui state for an installed runtime', () => {
    const result = deriveInstallerUiState({
      state: { ...baseState, stage: 'completed', progress: 100 },
      dependencies: { node: true, pnpm: true, openclaw: true },
      installDetected: true,
      runtimeStatus: baseRuntimeStatus,
      existingInstall: {
        exists: true,
        path: '/Applications/OpenClaw',
        version: { version: '1.2.3', installDate: '2026-03-26' }
      },
      systemInfo: {
        platform: 'darwin',
        arch: 'arm64',
        osRelease: '24.4.0',
        osVersion: '15.4',
        totalMemory: '16 GB',
        freeMemory: '8 GB',
        cpus: 8,
        homedir: '/Users/tester'
      },
      isSubmitting: false
    })

    expect(result.stageText).toBe('安装完成！')
    expect(result.isBusy).toBe(false)
    expect(result.isInstalled).toBe(true)
    expect(result.canLaunch).toBe(true)
    expect(result.canUninstall).toBe(true)
    expect(result.statusTitle).toBe('安装完成')
    expect(result.environmentNote).toBe('环境检查已完成')
  })

  it('marks unsupported desktop platforms and busy uninstall states correctly', () => {
    const result = deriveInstallerUiState({
      state: { ...baseState, stage: 'uninstalling', progress: 40 },
      dependencies: null,
      installDetected: false,
      runtimeStatus: {
        ...baseRuntimeStatus,
        commands: {
          ...baseRuntimeStatus.commands,
          openclaw: { exists: false, path: null, version: null }
        },
        gateway: {
          running: true,
          port: 18789
        }
      },
      existingInstall: null,
      systemInfo: {
        platform: 'linux',
        arch: 'x64',
        osRelease: '6.0.0',
        osVersion: 'Ubuntu',
        totalMemory: '32 GB',
        freeMemory: '24 GB',
        cpus: 16,
        homedir: '/home/tester'
      },
      isSubmitting: true
    })

    expect(result.isBusy).toBe(true)
    expect(result.isGatewayRunning).toBe(true)
    expect(result.isSupportedDesktopPlatform).toBe(false)
    expect(result.statusTitle).toBe('正在卸载 OpenClaw...')
    expect(result.environmentNote).toBe('正在检测本机环境')
  })

  it('builds human readable runtime summaries and helper text', () => {
    expect(buildRuntimeSummary(baseRuntimeStatus)).toEqual([
      { label: 'Node.js 环境', value: 'v22.16.0', done: true },
      { label: '核心依赖', value: '9.0.0', done: true },
      { label: 'OpenClaw', value: '1.2.3', done: true }
    ])

    expect(getStageText('preparing')).toBe('正在准备 pnpm 和镜像')
    expect(getPlatformName('win32')).toBe('Windows')
    expect(getEnvironmentNote({ node: true, pnpm: false, openclaw: false })).toBe('待补齐：pnpm / openclaw')
  })
})
