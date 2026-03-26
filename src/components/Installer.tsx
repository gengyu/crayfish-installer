import { useState, useEffect, useCallback, useRef } from 'react'
import type { SystemInfo } from '../types'
import ProgressBar from './ProgressBar'

interface InstallerProps {
  systemInfo: SystemInfo | null
  existingInstall: { exists: boolean; path: string | null; version: { version: string; installDate: string } | null } | null
  onInstallationChanged: () => void
  onBackToSettings?: () => void
}

type InstallStage =
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

interface InstallState {
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

interface RuntimeStatus {
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

export default function Installer({ systemInfo, existingInstall, onInstallationChanged, onBackToSettings }: InstallerProps) {
  const [state, setState] = useState<InstallState>({
    stage: 'idle',
    progress: 0,
    installPath: '',
    error: null,
    warning: null,
    detail: '准备开始',
    errorDetail: null,
    warningDetail: null,
    attempts: 0
  })
  const [dependencies, setDependencies] = useState<Record<string, boolean> | null>(null)
  const [installDetected, setInstallDetected] = useState(Boolean(existingInstall?.exists))
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null)
  const [showDetails, setShowDetails] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeOperationRef = useRef<'install' | 'uninstall' | null>(null)

  const refreshRuntimeState = useCallback(async () => {
    const [nextDependencies, nextRuntimeStatus] = await Promise.all([
      window.electronAPI.checkDependencies(),
      window.electronAPI.getRuntimeStatus()
    ])

    setDependencies(nextDependencies)
    setRuntimeStatus(nextRuntimeStatus)
    return nextRuntimeStatus
  }, [])

  // 获取默认安装路径和检测环境
  useEffect(() => {
    window.electronAPI.getDefaultInstallPath().then((path: string) => {
      setState(prev => ({ ...prev, installPath: path }))
    })
    refreshRuntimeState()
  }, [refreshRuntimeState])

  // 如果检测到已有安装，使用已有路径
  useEffect(() => {
    if (existingInstall?.exists && existingInstall.path) {
      setState(prev => ({ ...prev, installPath: existingInstall.path! }))
    }
    setInstallDetected(Boolean(existingInstall?.exists))
  }, [existingInstall])

  const handleInstallProgress = useCallback((data: { stage: string; progress: number; detail?: string }) => {
    const isUninstallProgress = data.stage === 'uninstalling'
    if (activeOperationRef.current === null) {
      return
    }

    if (isUninstallProgress && activeOperationRef.current !== 'uninstall') {
      return
    }

    if (!isUninstallProgress && activeOperationRef.current !== 'install') {
      return
    }

    const effectiveStage: InstallStage = isUninstallProgress && data.progress >= 100
      ? 'idle'
      : (data.stage as InstallStage)

    setState(prev => ({
      ...prev,
      stage: effectiveStage,
      progress: data.progress,
      detail: data.detail || prev.detail
    }))

    if (data.stage === 'completed' || (isUninstallProgress && data.progress >= 100)) {
      setIsSubmitting(false)
    }
  }, [])

  useEffect(() => {
    window.electronAPI.onInstallProgress(handleInstallProgress)
    return () => {
      window.electronAPI.removeInstallProgressListener()
    }
  }, [handleInstallProgress])

  const handleSelectPath = async () => {
    const path = await window.electronAPI.selectInstallPath()
    if (path) {
      setState(prev => ({ ...prev, installPath: path }))
    }
  }

  const handleInstall = async () => {
    if (!state.installPath) {
      await handleSelectPath()
      return
    }

    activeOperationRef.current = 'install'
    setIsSubmitting(true)
    setState(prev => ({ ...prev, stage: 'checking', progress: 0, error: null, warning: null, detail: '正在检查安装环境', errorDetail: null, warningDetail: null }))

    try {
      const result = await window.electronAPI.installOpenClaw(state.installPath)

      if (!result.success) {
        setState(prev => ({ 
          ...prev, 
          stage: 'error', 
          error: result.error || '安装失败',
          warning: null,
          detail: '安装没有完成',
          errorDetail: result.detail || null,
          warningDetail: null,
          attempts: result.attempts || 1
        }))
      } else {
        const nextRuntimeStatus = await refreshRuntimeState()
        const installed = nextRuntimeStatus.commands.openclaw.exists
        setState(prev => ({
          ...prev,
          stage: installed ? 'completed' : 'idle',
          progress: installed ? 100 : 0,
          detail: installed ? '已经可以开始使用' : '安装已结束',
          warning: result.warning || null,
          errorDetail: null,
          warningDetail: result.warningDetail || null,
          attempts: result.attempts || 1
        }))
        setInstallDetected(installed)
        onInstallationChanged()
      }
    } finally {
      activeOperationRef.current = null
      setIsSubmitting(false)
    }
  }

  const handleUninstall = async () => {
    const targetPath = state.installPath || existingInstall?.path
    if (!targetPath) {
      return
    }

    activeOperationRef.current = 'uninstall'
    setIsSubmitting(true)
    setState(prev => ({
      ...prev,
      stage: 'uninstalling',
        progress: 0,
        error: null,
        warning: null,
        detail: '正在移除已安装文件',
        errorDetail: null
      }))

    try {
      const result = await window.electronAPI.uninstallOpenClaw(targetPath)
      if (!result.success) {
        setState(prev => ({
          ...prev,
          stage: 'error',
          error: result.error || '卸载失败',
          warning: null,
          detail: '卸载没有完成'
        }))
        return
      }

      setState(prev => ({
        ...prev,
        stage: 'idle',
        progress: 0,
        error: null,
        warning: null,
        detail: '已卸载，可以重新安装',
        installPath: targetPath,
        errorDetail: null,
        warningDetail: null,
        attempts: 0
      }))

      activeOperationRef.current = null
      setIsSubmitting(false)

      const nextRuntimeStatus = await refreshRuntimeState()
      setInstallDetected(nextRuntimeStatus.commands.openclaw.exists)
      onInstallationChanged()
    } finally {
      activeOperationRef.current = null
      setIsSubmitting(false)
    }
  }

  const handleLaunch = async () => {
    const launchPath = state.installPath || existingInstall?.path
    if (launchPath) {
      const result = await window.electronAPI.launchOpenClaw(launchPath)
      if (!result.success) {
        setState(prev => ({ ...prev, error: result.error || '启动失败' }))
      }
    }
  }

  const handleOpenDirectory = () => {
    const dirPath = state.installPath || existingInstall?.path
    if (dirPath) {
      window.electronAPI.openDirectory(dirPath)
    }
  }

  const getStageText = () => {
    switch (state.stage) {
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

  const isInstalling = ['checking', 'preparing', 'downloading', 'verifying', 'extracting', 'finalizing'].includes(state.stage)
  const isUninstalling = state.stage === 'uninstalling' && state.progress < 100
  const isBusy = isSubmitting || isInstalling || isUninstalling
  const isInstalled = installDetected || Boolean(existingInstall?.exists) || Boolean(runtimeStatus?.commands.openclaw.exists)
  const isGatewayRunning = Boolean(runtimeStatus?.gateway.running)
  const isSupportedDesktopPlatform = systemInfo
    ? systemInfo.platform === 'win32' || systemInfo.platform === 'darwin'
    : true

  // 获取平台显示名称
  const getPlatformName = (platform: string) => {
    const names: Record<string, string> = {
      win32: 'Windows',
      darwin: 'macOS',
      linux: 'Linux'
    }
    return names[platform] || platform
  }

  const runtimeSummary = runtimeStatus ? [
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
  ] : []

  const canLaunch = isInstalled && !isGatewayRunning
  const canUninstall = isInstalled && !isBusy
  const canOpenDirectory = Boolean(state.installPath || existingInstall?.path)
  const environmentNote = (() => {
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
  })()

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

  const primaryButtonClass = 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none'
  const secondaryButtonClass = 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400'
  const detailActionClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800'

  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        {isInstalled && onBackToSettings ? (
          <div className="border-b border-slate-100 bg-slate-50 px-8 py-3">
            <button
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
              onClick={onBackToSettings}
              type="button"
            >
              ← 返回配置页面
            </button>
          </div>
        ) : null}

        <div className="px-8 pb-5 pt-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-3xl text-brand-600 shadow-sm">
              🦞
            </div>
          </div>

          <div>
            <h1 className="mb-2 text-4xl font-extrabold tracking-[-0.04em] text-slate-900">OpenClaw</h1>
            <p className="text-base font-semibold text-slate-500">{isInstalled ? '智能环境已就绪' : '智能环境配置向导'}</p>
          </div>

          {!isBusy && !state.error && !isInstalled ? (
            <div className="mx-auto mt-7 flex w-fit flex-col gap-3.5 text-left">
              <div className="flex items-center gap-3 text-base font-semibold text-slate-600"><span>⚡</span><span>无需命令行</span></div>
              <div className="flex items-center gap-3 text-base font-semibold text-slate-600"><span>🪄</span><span>自动配置环境</span></div>
              <div className="flex items-center gap-3 text-base font-semibold text-slate-600"><span>🕒</span><span>约 1-3 分钟</span></div>
            </div>
          ) : (
            <div className="pt-2">
              <h2 className="mb-4 text-base font-bold text-slate-800">{statusTitle}</h2>

              {isBusy ? (
                <div>
                  <ProgressBar
                    progress={state.progress}
                    stage={getStageText()}
                    detail={state.detail}
                  />
                </div>
              ) : null}

              {state.error ? (
                <div className="rounded-xl border border-red-100 bg-red-50/70 p-4 text-left">
                  <p className="mb-1.5 text-sm font-bold text-red-800">{state.error}</p>
                  <p className="text-xs leading-5 text-slate-600">
                    {state.attempts > 1 ? `已自动重试 ${state.attempts - 1} 次。` : '安装器没有成功完成当前步骤。'}
                  </p>
                  <p className="text-xs leading-5 text-slate-600">请检查网络或系统权限后，再点击安装按钮重试。</p>
                </div>
              ) : null}

              {state.warning && !state.error ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4 text-left">
                  <p className="mb-1.5 text-sm font-bold text-amber-800">{state.warning}</p>
                  <p className="text-xs leading-5 text-slate-600">OpenClaw 主程序已经安装完成。</p>
                  {!isGatewayRunning ? (
                    <p className="text-xs leading-5 text-slate-600">你可以先执行 `openclaw` 启动，或执行 `openclaw gateway run` 前台运行网关。</p>
                  ) : null}
                </div>
              ) : null}

              {(state.stage === 'completed' || (isInstalled && !isBusy && !state.error)) ? (
                <div className="text-center">
                  <p className="text-xs leading-5 text-slate-600">{isGatewayRunning ? 'OpenClaw 已在运行，可以直接开始使用。' : 'OpenClaw 已安装完成，可以直接开始使用。'}</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50/80 px-8 pb-3 pt-2">
          <button
            className="flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-slate-500 transition hover:text-slate-700"
            onClick={() => setShowDetails(prev => !prev)}
            type="button"
          >
            <span>查看安装详情</span>
            <span className={`transition ${showDetails ? 'rotate-180' : ''}`}>⌄</span>
          </button>

          {showDetails ? (
            <div className="space-y-4 pt-2">
              {runtimeSummary.length > 0 ? (
                <div className="space-y-2.5">
                  {runtimeSummary.map(item => (
                    <div className="flex items-center gap-2 text-xs text-slate-600" key={item.label}>
                      <span className={`inline-block w-4 text-center font-bold ${item.done ? 'text-green-500' : 'text-brand-500'}`}>{item.done ? '✓' : '◌'}</span>
                      <span>{item.done ? `${item.label}就绪` : `${item.label}准备中`}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="inline-block w-4 text-center font-bold text-brand-500">◌</span>
                    <span>正在检测本机环境</span>
                  </div>
                </div>
              )}

              {state.errorDetail ? (
                <div className="rounded-xl border border-red-100 bg-white p-3">
                  <div className="mb-1 text-xs font-semibold text-red-700">安装错误</div>
                  <div className="text-xs leading-5 break-all text-slate-600">{state.errorDetail}</div>
                </div>
              ) : null}

              {state.warningDetail && !state.error ? (
                <div className="rounded-xl border border-amber-100 bg-white p-3">
                  <div className="mb-1 text-xs font-semibold text-amber-700">安装提示</div>
                  <div className="text-xs leading-5 break-all text-slate-600">{state.warningDetail}</div>
                </div>
              ) : null}

              {showDetails && systemInfo ? (
                <div className="space-y-1 border-t border-slate-200 pt-3 text-xs text-slate-500">
                  <div>{getPlatformName(systemInfo.platform)} / {systemInfo.arch}</div>
                  <div>{systemInfo.totalMemory} 内存</div>
                  <div>{environmentNote}</div>
                  {state.installPath ? <div className="break-all">{state.installPath}</div> : null}
                </div>
              ) : null}

              {(canLaunch || canOpenDirectory || canUninstall) ? (
                <div className="flex flex-wrap gap-2">
                  {canLaunch ? (
                    <button className={detailActionClass} onClick={handleLaunch} type="button">
                      启动
                    </button>
                  ) : null}
                  {canOpenDirectory ? (
                    <button className={detailActionClass} onClick={handleOpenDirectory} type="button">
                      打开目录
                    </button>
                  ) : null}
                  {canUninstall ? (
                    <button className={`${detailActionClass} border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700`} onClick={handleUninstall} type="button">
                      卸载
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 px-8 py-5">
          {state.error ? (
            <>
              <button 
                className={primaryButtonClass}
                onClick={handleInstall}
                disabled={isBusy || !isSupportedDesktopPlatform}
                type="button"
              >
                <span>↻</span>
                再试一次
              </button>
              <button
                className={secondaryButtonClass}
                onClick={() => {
                  if (state.errorDetail) {
                    navigator.clipboard?.writeText(state.errorDetail)
                  }
                }}
                disabled={!state.errorDetail}
                type="button"
              >
                复制错误信息
              </button>
            </>
          ) : (state.stage === 'completed' || isInstalled) ? (
            <>
              {!isGatewayRunning ? (
                <button 
                  className={primaryButtonClass}
                  onClick={handleLaunch}
                  disabled={isBusy}
                  type="button"
                >
                  <span>🚀</span>
                  启动 OpenClaw
                </button>
              ) : null}
              <button
                className={secondaryButtonClass}
                onClick={handleInstall}
                disabled={isBusy}
                type="button"
              >
                重新安装
              </button>
            </>
          ) : isBusy ? (
            <button 
              className={secondaryButtonClass}
              disabled
              type="button"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
              {state.stage === 'uninstalling' ? '卸载中...' : '安装中...'}
            </button>
          ) : (
            <button 
              className={primaryButtonClass}
              onClick={handleInstall}
              disabled={!isSupportedDesktopPlatform}
              type="button"
            >
              <span>🚀</span>
              立即安装
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
