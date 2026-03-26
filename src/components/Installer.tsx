import { useState, useEffect, useCallback, useRef } from 'react'
import type { SystemInfo } from '../types'
import ProgressBar from './ProgressBar'

interface InstallerProps {
  systemInfo: SystemInfo | null
  existingInstall: { exists: boolean; path: string | null; version: { version: string; installDate: string } | null } | null
  onInstallationChanged: () => void
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
  node: { exists: boolean; path: string | null; version: string | null }
  npm: { exists: boolean; path: string | null; version: string | null }
  pnpm: { exists: boolean; path: string | null; version: string | null }
  openclaw: { exists: boolean; path: string | null; version: string | null }
  gatewayRunning: boolean
  registry: { npm: string | null; pnpm: string | null }
  mirrorRecommended: boolean
}

export default function Installer({ systemInfo, existingInstall, onInstallationChanged }: InstallerProps) {
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
        const installed = nextRuntimeStatus.openclaw.exists
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
      setInstallDetected(nextRuntimeStatus.openclaw.exists)
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
  const isInstalled = installDetected || Boolean(existingInstall?.exists) || Boolean(runtimeStatus?.openclaw.exists)
  const isGatewayRunning = Boolean(runtimeStatus?.gatewayRunning)
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
      value: runtimeStatus.node.exists ? (runtimeStatus.node.version || '已安装') : '待安装',
      done: runtimeStatus.node.exists
    },
    {
      label: '核心依赖',
      value: runtimeStatus.pnpm.exists ? (runtimeStatus.pnpm.version || '已配置') : '待配置',
      done: runtimeStatus.pnpm.exists
    },
    {
      label: 'OpenClaw',
      value: isGatewayRunning
        ? '运行中'
        : runtimeStatus.openclaw.exists
          ? (runtimeStatus.openclaw.version || '已准备')
          : '准备中',
      done: runtimeStatus.openclaw.exists
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

  return (
    <div className="installer">
      <div className="installer-shell">
        <div className="installer-card installer-hero">
          <div className="hero-icon-wrap">
            <div className="hero-icon">🦞</div>
          </div>

          <div className="hero-copy">
            <h1>OpenClaw</h1>
            <p>{isInstalled ? '智能环境已就绪' : '智能环境配置向导'}</p>
          </div>

          {!isBusy && !state.error && !isInstalled ? (
            <div className="hero-points">
              <div className="hero-point"><span className="hero-point-icon">⚡</span><span>无需命令行</span></div>
              <div className="hero-point"><span className="hero-point-icon">🪄</span><span>自动配置环境</span></div>
              <div className="hero-point"><span className="hero-point-icon">🕒</span><span>约 1-3 分钟</span></div>
            </div>
          ) : (
            <div className="state-area">
              <h2 className="state-title">{statusTitle}</h2>

              {isBusy ? (
                <div className="state-progress">
                  <ProgressBar
                    progress={state.progress}
                    stage={getStageText()}
                    detail={state.detail}
                  />
                </div>
              ) : null}

              {state.error ? (
                <div className="state-error-box">
                  <p className="state-error-title">{state.error}</p>
                  <p className="state-error-text">
                    {state.attempts > 1 ? `已自动重试 ${state.attempts - 1} 次。` : '安装器没有成功完成当前步骤。'}
                  </p>
                  <p className="state-error-hint">请检查网络或系统权限后，再点击安装按钮重试。</p>
                </div>
              ) : null}

              {state.warning && !state.error ? (
                <div className="state-error-box">
                  <p className="state-error-title">{state.warning}</p>
                  <p className="state-error-text">OpenClaw 主程序已经安装完成。</p>
                  {!isGatewayRunning ? (
                    <p className="state-error-hint">你可以先执行 `openclaw` 启动，或执行 `openclaw gateway run` 前台运行网关。</p>
                  ) : null}
                </div>
              ) : null}

              {(state.stage === 'completed' || (isInstalled && !isBusy && !state.error)) ? (
                <div className="state-success-box">
                  <p>{isGatewayRunning ? 'OpenClaw 已在运行，可以直接开始使用。' : 'OpenClaw 已安装完成，可以直接开始使用。'}</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="details-section">
          <button className="detail-toggle" onClick={() => setShowDetails(prev => !prev)}>
            <span>查看安装详情</span>
            <span className={`detail-arrow ${showDetails ? 'open' : ''}`}>⌄</span>
          </button>

          {showDetails ? (
            <div className="details-content">
              {runtimeSummary.length > 0 ? (
                <div className="details-normal">
                  {runtimeSummary.map(item => (
                    <div className="detail-line" key={item.label}>
                      <span className={`detail-line-icon ${item.done ? 'done' : 'pending'}`}>{item.done ? '✓' : '◌'}</span>
                      <span>{item.done ? `${item.label}就绪` : `${item.label}准备中`}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="details-normal">
                  <div className="detail-line">
                    <span className="detail-line-icon pending">◌</span>
                    <span>正在检测本机环境</span>
                  </div>
                </div>
              )}

              {state.errorDetail ? (
                <div className="details-error">
                  <div className="detail-error-title">安装错误</div>
                  <div className="detail-error-message">{state.errorDetail}</div>
                </div>
              ) : null}

              {state.warningDetail && !state.error ? (
                <div className="details-error">
                  <div className="detail-error-title">安装提示</div>
                  <div className="detail-error-message">{state.warningDetail}</div>
                </div>
              ) : null}

              {showDetails && systemInfo ? (
                <div className="details-meta">
                  <div>{getPlatformName(systemInfo.platform)} / {systemInfo.arch}</div>
                  <div>{systemInfo.totalMemory} 内存</div>
                  <div>{environmentNote}</div>
                  {state.installPath ? <div>{state.installPath}</div> : null}
                </div>
              ) : null}

              {(canLaunch || canOpenDirectory || canUninstall) ? (
                <div className="details-actions">
                  {canLaunch ? (
                    <button className="detail-action-btn" onClick={handleLaunch}>
                      启动
                    </button>
                  ) : null}
                  {canOpenDirectory ? (
                    <button className="detail-action-btn" onClick={handleOpenDirectory}>
                      打开目录
                    </button>
                  ) : null}
                  {canUninstall ? (
                    <button className="detail-action-btn danger" onClick={handleUninstall}>
                      卸载
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="actions actions-secondary">
          {state.error ? (
            <>
              <button 
                className="btn btn-primary btn-large btn-block"
                onClick={handleInstall}
                disabled={isBusy || !isSupportedDesktopPlatform}
              >
                <span className="btn-icon">↻</span>
                再试一次
              </button>
              <button
                className="btn btn-secondary btn-block"
                onClick={() => {
                  if (state.errorDetail) {
                    navigator.clipboard?.writeText(state.errorDetail)
                  }
                }}
                disabled={!state.errorDetail}
              >
                复制错误信息
              </button>
            </>
          ) : (state.stage === 'completed' || isInstalled) ? (
            <>
              {!isGatewayRunning ? (
                <button 
                  className="btn btn-primary btn-large btn-block"
                  onClick={handleLaunch}
                  disabled={isBusy}
                >
                  <span className="btn-icon">🚀</span>
                  启动 OpenClaw
                </button>
              ) : null}
              <button
                className="btn btn-secondary"
                onClick={handleInstall}
                disabled={isBusy}
              >
                重新安装
              </button>
            </>
          ) : isBusy ? (
            <button 
              className="btn btn-secondary btn-large btn-block"
              disabled
            >
              <span className="spinner"></span>
              {state.stage === 'uninstalling' ? '卸载中...' : '安装中...'}
            </button>
          ) : (
            <button 
              className="btn btn-primary btn-large btn-block"
              onClick={handleInstall}
              disabled={!isSupportedDesktopPlatform}
            >
              <span className="btn-icon">🚀</span>
              立即安装
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
