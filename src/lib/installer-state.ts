import type { ExistingInstall, SystemInfo } from '../types'

export type InstallStage =
  | 'idle'
  | 'selecting'
  | 'checking'
  | 'preparing'
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'finalizing'
  | 'uninstalling'
  | 'completed'
  | 'error'

export interface InstallState {
  stage: InstallStage
  progress: number
  installPath: string
  error: string | null
  warning: string | null
  detail: string
  errorDetail: string | null
  warningDetail: string | null
  attempts: number
}

export interface RuntimeStatus {
  commands: {
    node: { exists: boolean; path: string | null; version: string | null }
    npm: { exists: boolean; path: string | null; version: string | null }
    pnpm: { exists: boolean; path: string | null; version: string | null }
    openclaw: { exists: boolean; path: string | null; version: string | null }
  }
  gateway: {
    running: boolean
    port: number
  }
  registry: { npm: string | null; pnpm: string | null }
  mirrorRecommended: boolean
}

export interface RuntimeSummaryItem {
  label: string
  value: string
  done: boolean
}

interface DeriveInstallerUiStateParams {
  state: InstallState
  dependencies: Record<string, boolean> | null
  installDetected: boolean
  runtimeStatus: RuntimeStatus | null
  existingInstall: ExistingInstall | null
  systemInfo: SystemInfo | null
  isSubmitting: boolean
}

export function getStageText(stage: InstallStage) {
  switch (stage) {
    case 'downloading':
      return '正在安装 openclaw'
    case 'preparing':
      return '正在准备 pnpm 和镜像'
    case 'finalizing':
      return '正在执行 onboard'
    case 'uninstalling':
      return '正在卸载'
    case 'completed':
      return '安装完成！'
    case 'checking':
      return '正在检查环境'
    default:
      return ''
  }
}

export function getPlatformName(platform: string) {
  const names: Record<string, string> = {
    win32: 'Windows',
    darwin: 'macOS',
    linux: 'Linux'
  }

  return names[platform] || platform
}

export function getEnvironmentNote(dependencies: Record<string, boolean> | null) {
  if (!dependencies) {
    return '正在检测本机环境'
  }

  const missing = Object.entries(dependencies)
    .filter(([, exists]) => !exists)
    .map(([name]) => name)

  if (missing.length === 0) {
    return '环境检查已完成'
  }

  return `待补齐：${missing.join(' / ')}`
}

export function buildRuntimeSummary(runtimeStatus: RuntimeStatus | null): RuntimeSummaryItem[] {
  if (!runtimeStatus) {
    return []
  }

  const isGatewayRunning = runtimeStatus.gateway.running

  return [
    {
      label: 'Node.js 环境',
      value: runtimeStatus.commands.node.exists ? (runtimeStatus.commands.node.version || '已安装') : '待安装',
      done: runtimeStatus.commands.node.exists
    },
    {
      label: '核心依赖',
      value: runtimeStatus.commands.pnpm.exists ? (runtimeStatus.commands.pnpm.version || '已配置') : '待配置',
      done: runtimeStatus.commands.pnpm.exists
    },
    {
      label: 'OpenClaw',
      value: isGatewayRunning
        ? '运行中'
        : runtimeStatus.commands.openclaw.exists
          ? (runtimeStatus.commands.openclaw.version || '已准备')
          : '准备中',
      done: runtimeStatus.commands.openclaw.exists
    }
  ]
}

export function deriveInstallerUiState({
  state,
  dependencies,
  installDetected,
  runtimeStatus,
  existingInstall,
  systemInfo,
  isSubmitting
}: DeriveInstallerUiStateParams) {
  const isInstalling = ['checking', 'preparing', 'downloading', 'verifying', 'extracting', 'finalizing'].includes(state.stage)
  const isUninstalling = state.stage === 'uninstalling' && state.progress < 100
  const isBusy = isSubmitting || isInstalling || isUninstalling
  const isInstalled = installDetected || Boolean(existingInstall?.exists) || Boolean(runtimeStatus?.commands.openclaw.exists)
  const isGatewayRunning = Boolean(runtimeStatus?.gateway.running)
  const isSupportedDesktopPlatform = systemInfo
    ? systemInfo.platform === 'win32' || systemInfo.platform === 'darwin'
    : true
  const runtimeSummary = buildRuntimeSummary(runtimeStatus)
  const canLaunch = isInstalled && !isGatewayRunning
  const canUninstall = isInstalled && !isBusy
  const canOpenDirectory = Boolean(state.installPath || existingInstall?.path)
  const environmentNote = getEnvironmentNote(dependencies)
  const statusTitle = (() => {
    if (state.stage === 'completed') {
      return '安装完成'
    }
    if (state.stage === 'error') {
      return '安装遇到问题'
    }
    if (isInstalled && !isBusy) {
      return '已安装'
    }
    if (isBusy) {
      return state.stage === 'uninstalling' ? '正在卸载 OpenClaw...' : '正在为你准备 OpenClaw...'
    }
    return ''
  })()

  return {
    stageText: getStageText(state.stage),
    isInstalling,
    isUninstalling,
    isBusy,
    isInstalled,
    isGatewayRunning,
    isSupportedDesktopPlatform,
    runtimeSummary,
    canLaunch,
    canUninstall,
    canOpenDirectory,
    environmentNote,
    statusTitle
  }
}
