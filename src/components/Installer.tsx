import { useState, useEffect, useCallback, useRef } from 'react'
import type { ExistingInstall, OpenClawUninstallOptions, SystemInfo } from '../types'
import { deriveInstallerUiState, getPlatformName, type InstallStage, type InstallState, type RuntimeStatus } from '../lib/installer-state'
import ProgressBar from './ProgressBar'

interface InstallerProps {
  systemInfo: SystemInfo | null
  existingInstall: ExistingInstall | null
  onInstallationChanged: () => void
  onBackToSettings?: () => void
}

export default function Installer({ systemInfo, existingInstall, onInstallationChanged, onBackToSettings }: InstallerProps) {
  const defaultUninstallOptions: OpenClawUninstallOptions = {
    removeConfig: false,
    removeOpenClaw: true,
    removeNode: false,
    removeWorkspace: false
  }
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
  const [showDetails, setShowDetails] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showUninstallDialog, setShowUninstallDialog] = useState(false)
  const [isUninstalling, setIsUninstalling] = useState(false)
  const [uninstallCompleted, setUninstallCompleted] = useState(false)
  const [uninstallDialogError, setUninstallDialogError] = useState<string | null>(null)
  const [removedItems, setRemovedItems] = useState<string[]>([])
  const [uninstallOptions, setUninstallOptions] = useState<OpenClawUninstallOptions>(defaultUninstallOptions)
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

  const handleRequestUninstall = () => {
    setUninstallOptions(defaultUninstallOptions)
    setUninstallDialogError(null)
    setIsUninstalling(false)
    setUninstallCompleted(false)
    setRemovedItems([])
    setShowUninstallDialog(true)
  }

  const handleUninstall = async () => {
    const targetPath = state.installPath || existingInstall?.path
    if (!targetPath) {
      return
    }

    activeOperationRef.current = 'uninstall'
    setIsUninstalling(true)
    setUninstallDialogError(null)
    setUninstallCompleted(false)
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
      const result = await window.electronAPI.uninstallOpenClaw({
        installPath: targetPath,
        options: uninstallOptions
      })
      if (!result.success) {
        setUninstallDialogError(result.error || '卸载失败')
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
      setRemovedItems(result.removedItems || uninstallTargets)
      setUninstallCompleted(true)

      activeOperationRef.current = null
      setIsSubmitting(false)

      const nextRuntimeStatus = await refreshRuntimeState()
      setInstallDetected(nextRuntimeStatus.commands.openclaw.exists)
      onInstallationChanged()
      setUninstallDialogError(null)
    } finally {
      activeOperationRef.current = null
      setIsSubmitting(false)
      setIsUninstalling(false)
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

  const {
    stageText,
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
  } = deriveInstallerUiState({
    state,
    dependencies,
    installDetected,
    runtimeStatus,
    existingInstall,
    systemInfo,
    isSubmitting
  })

  const primaryButtonClass = 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none'
  const secondaryButtonClass = 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400'
  const detailActionClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800'
  const uninstallTargets = [
    uninstallOptions.removeOpenClaw ? 'OpenClaw 主程序与 gateway 服务' : null,
    uninstallOptions.removeConfig ? 'OpenClaw 配置文件' : null,
    uninstallOptions.removeWorkspace ? 'OpenClaw workspace' : null,
    uninstallOptions.removeNode ? 'Node.js / pnpm 环境' : null
  ].filter((item): item is string => Boolean(item))

  return (
    <div className="w-full max-w-md">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        {isInstalled && onBackToSettings ? (
          <div className="border-b border-slate-100 bg-slate-50 px-8 py-3">
            <button
              className="window-no-drag text-sm font-medium text-slate-600 transition hover:text-slate-900"
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
                    stage={stageText}
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
                    <button className={`${detailActionClass} border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700`} onClick={handleRequestUninstall} type="button">
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

      {showUninstallDialog ? (
        <div className="window-no-drag fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-950">确认卸载 OpenClaw</h2>
              {isUninstalling ? (
                <p className="text-sm leading-6 text-slate-500">
                  正在执行卸载，请保持窗口打开。完成后这里会自动关闭。
                </p>
              ) : (
                <p className="text-sm leading-6 text-slate-500">
                  默认会执行最小卸载，只移除 OpenClaw 主程序和 gateway 服务。你也可以按当前安装器实际写入的内容，额外清理配置、workspace，以及自动补齐的 Node.js / pnpm 环境。
                </p>
              )}
            </div>

            {isUninstalling ? (
              <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-red-500" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">正在卸载</div>
                    <div className="text-xs leading-5 text-slate-500">{state.detail || '正在处理卸载步骤...'}</div>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">本次将删除</div>
                  <div className="flex flex-wrap gap-2">
                    {uninstallTargets.map((target) => (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700" key={target}>
                        {target}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  卸载过程中请不要关闭窗口或重复点击按钮。
                </div>
              </div>
            ) : uninstallCompleted ? (
              <>
                <div className="mt-5 space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div>
                    <div className="text-sm font-semibold text-emerald-800">卸载已完成</div>
                    <div className="mt-1 text-xs leading-5 text-emerald-700">
                      OpenClaw 已完成本次清理。你可以确认下面的结果后，再关闭这个窗口。
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700/70">本次已卸载</div>
                    <div className="flex flex-wrap gap-2">
                      {removedItems.map((item) => (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700" key={item}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    className="window-no-drag rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                    onClick={() => setShowUninstallDialog(false)}
                    type="button"
                  >
                    关闭
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      checked={uninstallOptions.removeOpenClaw}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
                      onChange={(event) => setUninstallOptions((current) => ({ ...current, removeOpenClaw: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">删除 OpenClaw 主程序与 gateway 服务</span>
                      <span className="block text-xs leading-5 text-slate-500">当前安装器会全局安装 `openclaw`，并在初始化时注册 gateway 服务。默认勾选。</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3">
                    <input
                      checked={uninstallOptions.removeConfig}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
                      onChange={(event) => setUninstallOptions((current) => ({ ...current, removeConfig: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">删除 OpenClaw 配置文件</span>
                      <span className="block text-xs leading-5 text-slate-500">会删除 `~/.openclaw/openclaw.json` 这类配置文件，但不会顺带删除 workspace。</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3">
                    <input
                      checked={uninstallOptions.removeWorkspace}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
                      onChange={(event) => setUninstallOptions((current) => ({ ...current, removeWorkspace: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">删除 OpenClaw workspace</span>
                      <span className="block text-xs leading-5 text-slate-500">会删除当前 workspace 目录中的 agents、plugins、导入导出的 bundle 等内容。</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3">
                    <input
                      checked={uninstallOptions.removeNode}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
                      onChange={(event) => setUninstallOptions((current) => ({ ...current, removeNode: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">删除 Node.js / pnpm 环境</span>
                      <span className="block text-xs leading-5 text-slate-500">仅在这些运行时是安装器为当前机器自动补齐时再勾选，默认不删，避免影响你本机其他项目。</span>
                    </span>
                  </label>
                </div>

                {uninstallDialogError ? (
                  <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                    {uninstallDialogError}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    className="window-no-drag rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    onClick={() => setShowUninstallDialog(false)}
                    type="button"
                  >
                    返回
                  </button>
                  <button
                    className="window-no-drag rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={!uninstallOptions.removeOpenClaw && !uninstallOptions.removeConfig && !uninstallOptions.removeWorkspace && !uninstallOptions.removeNode}
                    onClick={handleUninstall}
                    type="button"
                  >
                    {uninstallDialogError ? '再次卸载' : '确认卸载'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
