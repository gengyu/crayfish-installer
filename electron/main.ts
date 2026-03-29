import { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } from 'electron'
import { fileURLToPath } from 'url'
import { basename, dirname, extname, join, relative } from 'path'
import { exec, execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import https from 'https'
import net from 'net'
import JSON5 from 'json5'
import log from 'electron-log'
import { execa, execaCommand } from 'execa'
import { shellEnv } from 'shell-env'
import { coerce, compare, gte } from 'semver'
import sudoPrompt from 'sudo-prompt'
import type { LocalModelDiscoveryResult, OpenClawModelConnectionResult, OpenClawSettings, OpenClawUninstallOptions, OpenClawUninstallResult } from '../src/types'
import type {
  OpenClawAgentBundle,
  OpenClawAgentBundleFile,
  OpenClawAgentBundleResult,
  OpenClawPluginPreset
} from '../src/types'
import {
  applyOpenClawSettingsToConfig as applyOpenClawSettingsToConfigHelper,
  applyPluginPresetToConfig as applyPluginPresetToConfigHelper,
  buildDiscordChannelConfig as buildDiscordChannelConfigHelper,
  buildManagedProviderConfig as buildManagedProviderConfigHelper,
  buildSlackChannelConfig as buildSlackChannelConfigHelper,
  buildTelegramChannelConfig as buildTelegramChannelConfigHelper,
  expandHomePath as expandHomePathHelper,
  getDefaultOpenClawSettings as getDefaultOpenClawSettingsHelper,
  isTextBuffer as isTextBufferHelper,
  normalizeOpenClawSettings as normalizeOpenClawSettingsHelper,
  readOpenClawSettingsFromConfig,
  shouldSkipBundlePath as shouldSkipBundlePathHelper,
  slugifyName as slugifyNameHelper
} from '../src/lib/openclaw-config'
import {
  buildModelsEndpoint,
  DEFAULT_LOCAL_MODEL_BASE_URL,
  DEFAULT_LOCAL_MODEL_FALLBACK,
  extractModelIds,
  isDefaultLocalModelBaseUrl,
  selectDefaultModelId
} from '../src/lib/model-discovery'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

log.initialize()

let mainWindow: BrowserWindow | null = null
let resolvedRuntimeEnv: NodeJS.ProcessEnv = { ...process.env }
let runtimeStatusInFlight: Promise<RuntimeStatus> | null = null
const registryCache = new Map<'npm' | 'pnpm', { value: string | null; checkedAt: number }>()

type InstallProgressStage =
  | 'idle'
  | 'checking'
  | 'preparing'
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'finalizing'
  | 'uninstalling'
  | 'completed'
  | 'error'

interface CommandCheckResult {
  exists: boolean
  path: string | null
  version: string | null
}

interface RuntimeStatus {
  commands: {
    node: CommandCheckResult
    npm: CommandCheckResult
    pnpm: CommandCheckResult
    openclaw: CommandCheckResult
  }
  gateway: {
    running: boolean
    port: number
  }
  registry: {
    npm: string | null
    pnpm: string | null
  }
  mirrorRecommended: boolean
}

interface RuntimeCommandProbe {
  node: CommandCheckResult
  npm: CommandCheckResult
  pnpm: CommandCheckResult
  openclaw: CommandCheckResult
}

interface RuntimeProbeResult {
  commands: RuntimeCommandProbe
  gatewayRunning: boolean
  registry: RuntimeStatus['registry']
  mirrorRecommended: boolean
}

interface InstallResult {
  success: boolean
  error?: string
  detail?: string
  warning?: string
  warningDetail?: string
  attempts?: number
  version?: {
    version: string
    installDate: string
    platform: string
    arch: string
  }
}

const DEFAULT_UNINSTALL_OPTIONS: OpenClawUninstallOptions = {
  removeConfig: false,
  removeOpenClaw: true,
  removeNode: false,
  removeWorkspace: false
}

type OpenClawChannelType = OpenClawSettings['channelType']

interface OpenClawConfigObject {
  [key: string]: unknown
}

const NODE_LTS_BASE_URL = 'https://nodejs.org/dist/latest-v22.x/'
const OPENCLAW_REQUIRED_NODE_VERSION = '22.16.0'
const CN_NODE_MIRROR = 'https://npmmirror.com/mirrors/node'
const NPM_REGISTRY = 'https://registry.npmmirror.com'
const OPENCLAW_GATEWAY_PORT = 18789
const OPENCLAW_CONFIG_DIR = join(os.homedir(), '.openclaw')
const OPENCLAW_CONFIG_PATH = join(OPENCLAW_CONFIG_DIR, 'openclaw.json')
const DEFAULT_OPENCLAW_WORKSPACE = join(OPENCLAW_CONFIG_DIR, 'workspace')
const OPENCLAW_CONTROL_UI_URL = `http://127.0.0.1:${OPENCLAW_GATEWAY_PORT}`
const OPENCLAW_EXTENSIONS_DIR = join(OPENCLAW_CONFIG_DIR, 'extensions')
const OPENCLAW_WEIXIN_PLUGIN_ID = 'openclaw-weixin'
const OPENCLAW_WEIXIN_PLUGIN_DIR = join(OPENCLAW_EXTENSIONS_DIR, OPENCLAW_WEIXIN_PLUGIN_ID)
const OPENCLAW_WEIXIN_PACKAGE_SPEC = '@tencent-weixin/openclaw-weixin@latest'

const OPENCLAW_PLUGIN_PRESETS: OpenClawPluginPreset[] = [
  {
    id: 'control-ui',
    title: 'Control UI',
    description: '官方建议先启用本地 Control UI，用浏览器完成日常配置和调试。',
    installSource: null,
    enableCommand: null,
    category: 'ui',
    recommended: true
  },
  {
    id: 'memory-lancedb',
    title: 'Memory LanceDB',
    description: '把记忆能力落到向量库，适合长期助手和需要跨会话召回的智能体。',
    installSource: null,
    enableCommand: 'memory-lancedb',
    category: 'memory',
    recommended: true
  },
  {
    id: 'open-prose',
    title: 'Open Prose',
    description: '官方多智能体/工作流插件，适合复杂任务编排和长链路执行。',
    installSource: null,
    enableCommand: 'open-prose',
    category: 'workflow',
    recommended: true
  },
  {
    id: 'voice-call',
    title: 'Voice Call',
    description: '语音通话插件，适合语音交互场景。',
    installSource: '@openclaw/voice-call',
    enableCommand: 'voice-call',
    category: 'channel',
    recommended: false
  },
  {
    id: 'wechat-clawbot',
    title: '微信 ClawBot',
    description: '按微信接入教程，在当前设备安装微信 ClawBot，并通过扫码把 OpenClaw 连接到微信。',
    installSource: '@tencent-weixin/openclaw-weixin-cli@latest',
    enableCommand: null,
    category: 'channel',
    recommended: true
  }
]

function getOpenClawPaths() {
  return {
    configPath: OPENCLAW_CONFIG_PATH,
    configDir: OPENCLAW_CONFIG_DIR,
    defaultWorkspacePath: DEFAULT_OPENCLAW_WORKSPACE,
    homedir: os.homedir()
  }
}

function logStepStart(step: string, detail?: unknown) {
  if (detail === undefined) {
    log.info(`[STEP START] ${step}`)
    return
  }
  log.info(`[STEP START] ${step}`, detail)
}

function logStepDone(step: string, detail?: unknown) {
  if (detail === undefined) {
    log.info(`[STEP DONE] ${step}`)
    return
  }
  log.info(`[STEP DONE] ${step}`, detail)
}

function logStepFail(step: string, error: unknown) {
  log.error(`[STEP FAIL] ${step}`, error)
}

function summarizeOutput(output: string, max = 240) {
  const compact = output.replace(/\s+/g, ' ').trim()
  return compact.length > max ? `${compact.slice(0, max)}...` : compact
}

function getEnvValue(env: NodeJS.ProcessEnv, key: string) {
  const direct = env[key]
  if (typeof direct === 'string' && direct.length > 0) {
    return direct
  }

  const matchedKey = Object.keys(env).find(envKey => envKey.toLowerCase() === key.toLowerCase())
  if (!matchedKey) {
    return undefined
  }

  const matchedValue = env[matchedKey]
  return typeof matchedValue === 'string' && matchedValue.length > 0 ? matchedValue : undefined
}

function getPathEnv(env: NodeJS.ProcessEnv = process.env) {
  return getEnvValue(env, 'PATH')
}

function getWindowsRuntimePathCandidates() {
  const appData = getEnvValue(resolvedRuntimeEnv, 'APPDATA')
    || getEnvValue(process.env, 'APPDATA')
    || join(os.homedir(), 'AppData', 'Roaming')
  const localAppData = getEnvValue(resolvedRuntimeEnv, 'LOCALAPPDATA')
    || getEnvValue(process.env, 'LOCALAPPDATA')
    || join(os.homedir(), 'AppData', 'Local')
  const userProfile = getEnvValue(resolvedRuntimeEnv, 'USERPROFILE')
    || getEnvValue(process.env, 'USERPROFILE')
    || os.homedir()
  const programFiles = getEnvValue(resolvedRuntimeEnv, 'ProgramFiles')
    || getEnvValue(process.env, 'ProgramFiles')
    || 'C:\\Program Files'
  const pnpmHome = getEnvValue(resolvedRuntimeEnv, 'PNPM_HOME')
    || getEnvValue(process.env, 'PNPM_HOME')
    || getPnpmHomeDir()

  return [
    join(appData, 'npm'),
    join(localAppData, 'pnpm'),
    join(userProfile, 'AppData', 'Local', 'pnpm'),
    pnpmHome,
    join(programFiles, 'nodejs')
  ]
}

function expandWindowsCommandCandidates(...commandPaths: string[]) {
  const expanded = commandPaths.flatMap((commandPath) => {
    const hasExtension = /\.[^\\/]+$/.test(commandPath)
    if (hasExtension) {
      return [commandPath]
    }

    return [
      commandPath,
      `${commandPath}.cmd`,
      `${commandPath}.exe`,
      `${commandPath}.bat`
    ]
  })

  const seen = new Set<string>()
  return expanded.filter((candidate) => {
    const key = candidate.toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function withNormalizedPathEnv(env: NodeJS.ProcessEnv, pathValue: string) {
  const normalizedEnv: NodeJS.ProcessEnv = {}

  for (const [key, value] of Object.entries(env)) {
    if (key.toLowerCase() === 'path') {
      continue
    }
    normalizedEnv[key] = value
  }

  normalizedEnv[process.platform === 'win32' ? 'Path' : 'PATH'] = pathValue
  return normalizedEnv
}

async function initializeRuntimeEnv() {
  const runtimePath = buildRuntimePath()

  if (process.platform === 'win32') {
    resolvedRuntimeEnv = withNormalizedPathEnv(process.env, runtimePath)
    log.info('[RUNTIME ENV READY]', { path: getPathEnv(resolvedRuntimeEnv) })
    return
  }

  const shellEnvironment = await shellEnv()
  resolvedRuntimeEnv = withNormalizedPathEnv({
    ...process.env,
    ...shellEnvironment
  }, buildRuntimePath(getPathEnv(shellEnvironment)))
  log.info('[RUNTIME ENV READY]', { path: getPathEnv(resolvedRuntimeEnv) })
}

function createWindow() {
  const isMac = process.platform === 'darwin'
  const windowIcon = process.platform === 'win32'
    ? join(__dirname, '../build/icon.ico')
    : process.platform === 'linux'
      ? join(__dirname, '../build/icon.png')
      : undefined

  mainWindow = new BrowserWindow({
    width: 1040,
    height: 860,
    minWidth: 960,
    minHeight: 760,
    backgroundColor: '#fff6ea',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f8fafc',
      symbolColor: '#475569',
      height: isMac ? 56 : 32
    },
    ...(windowIcon ? { icon: windowIcon } : {}),
    ...(isMac ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
    autoHideMenuBar: true,
    show: false
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function setAppDockIcon() {
  if (process.platform !== 'darwin') {
    return
  }

  const dockIconPath = join(__dirname, '../build/icon.png')
  if (!fs.existsSync(dockIconPath)) {
    return
  }

  const dockIcon = nativeImage.createFromPath(dockIconPath)
  if (dockIcon.isEmpty()) {
    return
  }

  app.dock.setIcon(dockIcon)
}

app.whenReady().then(() => {
  setAppDockIcon()
  initializeRuntimeEnv()
    .catch((error) => {
      log.warn('Failed to initialize runtime env:', error)
    })
    .finally(() => {
      createWindow()

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow()
        }
      })
    })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('get-platform', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    osVersion: os.version?.() || os.release(),
    totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
    freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB',
    cpus: os.cpus().length,
    homedir: os.homedir()
  }
})

ipcMain.handle('get-default-install-path', () => {
  return join(os.homedir(), '.openclaw')
})

ipcMain.handle('select-install-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: '选择 OpenClaw 数据目录'
  })

  if (result.canceled) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle('check-existing-installation', async () => {
  const runtime = await getRuntimeStatus()
  return {
    exists: hasOpenClawCommand(runtime),
    path: runtime.commands.openclaw.path,
    version: runtime.commands.openclaw.version ? {
      version: runtime.commands.openclaw.version,
      installDate: new Date().toISOString()
    } : null
  }
})

ipcMain.handle('check-dependencies', async () => {
  const runtime = await getRuntimeStatus()
  return {
    node: runtime.commands.node.exists,
    npm: runtime.commands.npm.exists,
    pnpm: runtime.commands.pnpm.exists,
    openclaw: hasOpenClawCommand(runtime),
    npmRegistryConfigured: runtime.registry.npm === 'https://registry.npmmirror.com',
    pnpmRegistryConfigured: runtime.registry.pnpm === 'https://registry.npmmirror.com'
  }
})

ipcMain.handle('check-disk-space', async () => {
  return { available: true, path: os.homedir() }
})

ipcMain.handle('get-runtime-status', async () => {
  return getRuntimeStatus()
})

ipcMain.handle('install-openclaw', async (event): Promise<InstallResult> => {
  let attempts = 0
  const retry = 1;
  while (attempts < retry) {
    attempts += 1
    log.info(`[INSTALL ATTEMPT] ${attempts}`)

    try {
      if (attempts > 1) {
        sendProgress(event, 'preparing', 10, `正在自动修复并重试，第 ${attempts} 次尝试`)
      }

      const result = await installOpenClawFlow(event)
      log.info(`[INSTALL SUCCESS] attempt=${attempts}`)
      return { ...result, attempts }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '未知错误'
      const translated = translateInstallError(rawMessage)
      log.error(`Install failed on attempt ${attempts}:`, error)

      if (attempts >= retry || !isRecoverableInstallError(rawMessage)) {
        return {
          success: false,
          error: translated.userMessage,
          detail: translated.detail,
          attempts
        }
      }

      try {
        await applyAutoRepair(rawMessage)
      } catch (repairError) {
        log.error('Auto repair failed:', repairError)
      }
    }
  }

  return {
    success: false,
    error: '安装没有完成，请重试',
    detail: '自动修复已执行，但没有成功完成安装。',
    attempts
  }
})

async function installOpenClawFlow(event: Electron.IpcMainInvokeEvent): Promise<InstallResult> {
  try {
    logStepStart('runtime-check')
    sendProgress(event, 'checking', 6, '正在检查 Node.js、npm、pnpm 环境')
    let runtime = await getRuntimeStatus()
    logStepDone('runtime-check', runtime)

    if (!runtime.commands.node.exists) {
      logStepStart('install-node-missing')
      sendProgress(event, 'preparing', 14, '未检测到 Node.js，正在下载安装官方 Node.js')
      await installNodeJs(event)
      runtime = await getRuntimeStatus()
      logStepDone('install-node-missing', runtime.commands.node)
    }

    if (!runtime.commands.node.exists) {
      throw new Error('Node.js 自动安装未完成，请检查系统安装权限后重试。')
    }

    if (!isNodeVersionSupported(runtime.commands.node.version)) {
      logStepStart('upgrade-node-version', runtime.commands.node)
      sendProgress(event, 'preparing', 18, `检测到 Node.js 版本过低，正在升级到 ${OPENCLAW_REQUIRED_NODE_VERSION} 或更高版本`)
      await upgradeNodeJs(event, runtime)
      runtime = await getRuntimeStatus()
      logStepDone('upgrade-node-version', runtime.commands.node)
    }

    if (!isNodeVersionSupported(runtime.commands.node.version)) {
      throw new Error(`需要 Node.js >=${OPENCLAW_REQUIRED_NODE_VERSION}，自动升级没有完成。`)
    }

    if (!runtime.commands.npm.exists) {
      throw new Error('未检测到 npm，当前 Node.js 环境不完整。请重新安装 Node.js。')
    }

    if (!runtime.commands.pnpm.exists) {
      logStepStart('install-pnpm', { npm: runtime.commands.npm.path })
      sendProgress(event, 'preparing', 18, '正在安装 pnpm')
      await runGlobalCommand(getCommandPath(runtime.commands.npm, 'npm'), ['install', '-g', 'pnpm'], getPackageManagerEnv())
      logStepDone('install-pnpm')
    }

    logStepStart('verify-pnpm')
    const runtimeAfterPnpm = await getRuntimeStatus()
    if (!runtimeAfterPnpm.commands.pnpm.exists) {
      throw new Error('pnpm 安装失败，请检查网络或全局安装权限。')
    }
    logStepDone('verify-pnpm', runtimeAfterPnpm.commands.pnpm)

    logStepStart('configure-mirror')
    sendProgress(event, 'preparing', 32, '正在配置国内镜像，提高下载速度')
    await ensureMirrorConfigured()
    logStepDone('configure-mirror')

    logStepStart('install-openclaw-package', { pnpm: runtimeAfterPnpm.commands.pnpm.path })
    sendProgress(event, 'downloading', 52, '正在通过 pnpm 全局安装 openclaw')
    await ensurePnpmHomeConfigured(runtimeAfterPnpm.commands.pnpm.path)
    await runGlobalCommand(getCommandPath(runtimeAfterPnpm.commands.pnpm, 'pnpm'), ['add', '-g', 'openclaw@latest'], getPackageManagerEnv())
    logStepDone('install-openclaw-package')

    let onboardWarning: { warning: string; warningDetail: string } | null = null
    logStepStart('run-openclaw-onboard')
    sendProgress(event, 'finalizing', 78, '正在执行 OpenClaw 初始化')
    const runtimeAfterInstallCommand = await getRuntimeStatus()

    try {
      await runCommand(
        getCommandPath(runtimeAfterInstallCommand.commands.openclaw, 'openclaw'),
        await getDefaultOnboardArgs(),
        getPackageManagerEnv()
      )
      logStepDone('run-openclaw-onboard')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (process.platform === 'win32' && isWindowsGatewayInstallFailure(message)) {
        onboardWarning = {
          warning: 'OpenClaw 已安装，但后台服务未启用。',
          warningDetail: 'Windows 原生环境下后台服务注册失败。你仍然可以继续使用 OpenClaw。请先在终端执行 `openclaw` 启动，或执行 `openclaw gateway run` 前台运行网关；如需后台服务，请以管理员身份重试，或改用 WSL2。'
        }
        log.warn('[STEP WARN] run-openclaw-onboard', { message })
        sendProgress(event, 'finalizing', 92, 'OpenClaw 已安装，后台服务未启用')
      } else {
        throw error
      }
    }

    logStepStart('verify-openclaw')
    const runtimeAfterInstall = await getRuntimeStatus()
    if (!hasOpenClawCommand(runtimeAfterInstall)) {
      throw new Error('openclaw 命令未成功安装。')
    }
    logStepDone('verify-openclaw', runtimeAfterInstall.commands.openclaw)

    sendProgress(event, 'completed', 100, '安装完成，openclaw 和 daemon 已准备就绪')
    return {
      success: true,
      warning: onboardWarning?.warning,
      warningDetail: onboardWarning?.warningDetail,
      version: {
        version: runtimeAfterInstall.commands.openclaw.version || 'latest',
        installDate: new Date().toISOString(),
        platform: process.platform,
        arch: process.arch
      }
    }
  }
  catch (error) {
    logStepFail('install-openclaw-flow', error)
    throw error
  }
}

ipcMain.handle('uninstall-openclaw', async (event, payload?: { installPath?: string; options?: Partial<OpenClawUninstallOptions> }): Promise<OpenClawUninstallResult> => {
  try {
    logStepStart('uninstall-openclaw')
    const options = normalizeUninstallOptions(payload?.options)
    const settingsBeforeUninstall = readOpenClawSettings()
    const removedItems: string[] = []
    const runtime = await getRuntimeStatus()
    if (options.removeOpenClaw && !runtime.commands.pnpm.exists && !runtime.commands.npm.exists) {
      throw new Error('未检测到 pnpm 或 npm，无法执行一键卸载。')
    }

    if (options.removeOpenClaw) {
      sendProgress(event, 'uninstalling', 25, '正在移除 OpenClaw 主程序与 gateway 服务')
      await uninstallOpenClawPackage(runtime)
      await ensureGatewayStoppedAfterUninstall()
      removedItems.push('OpenClaw 主程序与 gateway 服务')

      sendProgress(event, 'uninstalling', 60, '正在校验 OpenClaw 是否已移除')
      const runtimeAfterUninstall = await getRuntimeStatus()
      const commandStillExists = hasOpenClawCommand(runtimeAfterUninstall)

      if (commandStillExists) {
        throw new Error('openclaw 卸载命令已执行，但系统里仍然检测到 openclaw 命令。')
      }

      if (runtimeAfterUninstall.gateway.running) {
        throw new Error(`openclaw 命令已移除，但 ${OPENCLAW_GATEWAY_PORT} 端口上的 gateway 进程仍在运行。`)
      }
    }

    if (options.removeConfig) {
      sendProgress(event, 'uninstalling', 72, '正在删除 OpenClaw 配置')
      removeOpenClawConfig(settingsBeforeUninstall.configPath)
      removedItems.push('OpenClaw 配置文件')
    }

    if (options.removeWorkspace) {
      sendProgress(event, 'uninstalling', 84, '正在删除 OpenClaw workspace')
      removeDirectoryIfExists(settingsBeforeUninstall.workspacePath)
      removedItems.push('OpenClaw workspace')
    }

    if (options.removeNode) {
      sendProgress(event, 'uninstalling', 92, '正在删除 Node.js / pnpm 环境')
      await removeManagedNodeEnvironment(runtime)
      removedItems.push('Node.js / pnpm 环境')
    }

    sendProgress(event, 'uninstalling', 100, '卸载完成')
    logStepDone('uninstall-openclaw')
    return { success: true, removedItems }
  } catch (error) {
    logStepFail('uninstall-openclaw', error)
    log.error('Uninstall failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
})

async function stopAndUninstallGatewayService(runtime: RuntimeStatus) {
  if (!runtime.commands.openclaw.path) {
    return
  }

  const openclawCommand = getCommandPath(runtime.commands.openclaw, 'openclaw')
  const lifecycleCommands: string[][] = [
    ['gateway', 'stop', '--json'],
    ['gateway', 'uninstall', '--json']
  ]

  for (const args of lifecycleCommands) {
    try {
      await runCommand(openclawCommand, args, getPackageManagerEnv())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.warn('[GATEWAY LIFECYCLE WARN]', { args, message })
    }
  }
}

async function ensureGatewayStoppedAfterUninstall() {
  const runningBeforeForceStop = await isOpenClawGatewayRunning()
  if (!runningBeforeForceStop) {
    return
  }

  await forceStopGatewayProcessByPort()

  const stopped = await waitForGatewayStopped()
  if (!stopped) {
    throw new Error(`未能停止 ${OPENCLAW_GATEWAY_PORT} 端口上的 OpenClaw gateway 进程。`)
  }
}

async function waitForGatewayStopped(retries = 10, delayMs = 300) {
  for (let index = 0; index < retries; index += 1) {
    const running = await isOpenClawGatewayRunning()
    if (!running) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  return false
}

async function forceStopGatewayProcessByPort() {
  const commands = process.platform === 'win32'
    ? [
      `powershell -NoProfile -Command "$connections = Get-NetTCPConnection -LocalPort ${OPENCLAW_GATEWAY_PORT} -ErrorAction SilentlyContinue; if ($connections) { $connections | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { taskkill /PID $_ /F } }"`
    ]
    : process.platform === 'darwin'
      ? [
        `lsof -ti tcp:${OPENCLAW_GATEWAY_PORT} | xargs kill -TERM`,
        `sleep 1 && lsof -ti tcp:${OPENCLAW_GATEWAY_PORT} | xargs kill -KILL`
      ]
      : [
        `lsof -ti tcp:${OPENCLAW_GATEWAY_PORT} | xargs kill -TERM`,
        `sleep 1 && lsof -ti tcp:${OPENCLAW_GATEWAY_PORT} | xargs kill -KILL`,
        `fuser -k ${OPENCLAW_GATEWAY_PORT}/tcp`
      ]

  for (const command of commands) {
    try {
      await runShellCommand(command)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.warn('[FORCE STOP GATEWAY WARN]', { command, message })
    }

    const stopped = await waitForGatewayStopped(3, 200)
    if (stopped) {
      return
    }
  }
}

async function uninstallOpenClawPackage(runtime: RuntimeStatus) {
  const packageManagerEnv = getPackageManagerEnv()
  const uninstallErrors: string[] = []

  if (runtime.commands.openclaw.path) {
    await stopAndUninstallGatewayService(runtime)
  }

  if (runtime.commands.pnpm.exists) {
    await ensurePnpmHomeConfigured(runtime.commands.pnpm.path)

    const pnpmCommand = getCommandPath(runtime.commands.pnpm, 'pnpm')
    const pnpmAttempts: string[][] = [
      ['remove', '--global', 'openclaw'],
      ['uninstall', '--global', 'openclaw']
    ]

    for (const args of pnpmAttempts) {
      try {
        await runGlobalCommand(pnpmCommand, args, packageManagerEnv)
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        uninstallErrors.push(`pnpm ${args.join(' ')}: ${message}`)
      }
    }
  }

  if (runtime.commands.npm.exists) {
    try {
      await runGlobalCommand(getCommandPath(runtime.commands.npm, 'npm'), ['uninstall', '-g', 'openclaw'], packageManagerEnv)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      uninstallErrors.push(`npm uninstall -g openclaw: ${message}`)
    }
  }

  throw new Error(uninstallErrors.join('\n\n'))
}

function normalizeUninstallOptions(options?: Partial<OpenClawUninstallOptions>): OpenClawUninstallOptions {
  return {
    removeConfig: Boolean(options?.removeConfig),
    removeOpenClaw: options?.removeOpenClaw ?? DEFAULT_UNINSTALL_OPTIONS.removeOpenClaw,
    removeNode: Boolean(options?.removeNode),
    removeWorkspace: Boolean(options?.removeWorkspace)
  }
}

function removeOpenClawConfig(configPath: string) {
  if (fs.existsSync(configPath)) {
    fs.rmSync(configPath, { force: true })
  }

  const configDir = dirname(configPath)
  if (fs.existsSync(configDir) && fs.readdirSync(configDir).length === 0) {
    fs.rmSync(configDir, { recursive: true, force: true })
  }
}

function removeDirectoryIfExists(targetPath: string) {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return
  }

  fs.rmSync(targetPath, { recursive: true, force: true })
}

async function removeManagedNodeEnvironment(runtime: RuntimeStatus) {
  const candidatePaths = new Set<string>()
  const addCandidate = (targetPath: string | null | undefined) => {
    if (!targetPath) {
      return
    }

    candidatePaths.add(targetPath)

    const normalized = targetPath.replace(/\\/g, '/')
    const binDir = dirname(targetPath)

    if (process.platform === 'win32' && normalized.includes('/nodejs/')) {
      candidatePaths.add(binDir)
    }

    if (process.platform === 'win32' && normalized.includes('/pnpm/')) {
      candidatePaths.add(binDir)
    }

    if (process.platform !== 'win32') {
      if (normalized.endsWith('/bin/node')) {
        candidatePaths.add(join(dirname(binDir), 'lib', 'node_modules'))
        candidatePaths.add(join(dirname(binDir), 'include', 'node'))
        candidatePaths.add(join(dirname(binDir), 'share', 'man', 'man1', 'node.1'))
      }

      if (normalized.endsWith('/bin/pnpm') || normalized.endsWith('/bin/npm')) {
        candidatePaths.add(targetPath)
      }
    }
  }

  addCandidate(runtime.commands.node.path)
  addCandidate(runtime.commands.npm.path)
  addCandidate(runtime.commands.pnpm.path)

  const removablePaths = Array.from(candidatePaths).filter(targetPath => {
    if (!fs.existsSync(targetPath)) {
      return false
    }

    const normalized = targetPath.replace(/\\/g, '/')
    if (process.platform === 'win32') {
      return normalized.includes('/nodejs/') || normalized.includes('/pnpm/') || normalized.endsWith('/pnpm')
    }

    return normalized.startsWith('/usr/local/')
      || normalized.startsWith('/opt/homebrew/')
  })

  for (const targetPath of removablePaths) {
    fs.rmSync(targetPath, { recursive: true, force: true })
  }
}

ipcMain.handle('launch-openclaw', async () => {
  try {
    logStepStart('launch-check')
    const runtime = await getRuntimeStatus()
    await runCommand(getCommandPath(runtime.commands.openclaw, 'openclaw'), ['--help'])
    logStepDone('launch-check')
    return { success: true }
  } catch (error) {
    logStepFail('launch-check', error)
    log.error('Launch check failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'openclaw 命令不可用'
    }
  }
})

ipcMain.handle('open-directory', async (_event, dirPath: string) => {
  shell.openPath(dirPath)
})

ipcMain.handle('get-openclaw-settings', async () => {
  const currentConfig = readOpenClawConfigFile()
  const settings = readOpenClawSettingsFromConfig(currentConfig, getOpenClawPaths())
  return resolveSettingsModelId(currentConfig, settings)
})

ipcMain.handle('get-local-model-discovery', async (): Promise<LocalModelDiscoveryResult> => {
  return discoverLocalModelIds(DEFAULT_LOCAL_MODEL_BASE_URL, DEFAULT_LOCAL_MODEL_FALLBACK)
})

ipcMain.handle('test-openclaw-model-connection', async (_event, settings: OpenClawSettings): Promise<OpenClawModelConnectionResult> => {
  return testOpenClawModelConnection(normalizeOpenClawSettings(settings))
})

ipcMain.handle('save-openclaw-settings', async (_event, settings: OpenClawSettings) => {
  const currentConfig = readOpenClawConfigFile()
  const validatedSettings = await resolveSettingsModelId(
    currentConfig,
    normalizeOpenClawSettings(settings)
  )
  const nextConfig = applyOpenClawSettingsToConfig(currentConfig, validatedSettings)

  fs.mkdirSync(OPENCLAW_CONFIG_DIR, { recursive: true })
  fs.writeFileSync(OPENCLAW_CONFIG_PATH, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8')

  return {
    success: true,
    configPath: OPENCLAW_CONFIG_PATH
  }
})

ipcMain.handle('get-openclaw-plugin-presets', async () => {
  return OPENCLAW_PLUGIN_PRESETS
})

ipcMain.handle('apply-openclaw-plugin-preset', async (_event, presetId: string) => {
  const currentConfig = readOpenClawConfigFile()
  const nextConfig = applyPluginPresetToConfig(currentConfig, presetId)

  fs.mkdirSync(OPENCLAW_CONFIG_DIR, { recursive: true })
  fs.writeFileSync(OPENCLAW_CONFIG_PATH, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8')

  return {
    success: true,
    configPath: OPENCLAW_CONFIG_PATH
  }
})

ipcMain.handle('install-openclaw-plugin-preset', async (_event, presetId: string) => {
  const preset = OPENCLAW_PLUGIN_PRESETS.find((item) => item.id === presetId)
  if (!preset) {
    throw new Error(`Unknown OpenClaw plugin preset: ${presetId}`)
  }

  if (preset.id === 'control-ui') {
    const controlUiUrl = buildOpenClawControlUiUrl()
    await shell.openExternal(controlUiUrl)
    return { success: true, message: `已打开 ${controlUiUrl}` }
  }

  const runtime = await getRuntimeStatus()
  if (!hasOpenClawCommand(runtime)) {
    throw new Error('当前未检测到 openclaw 命令，无法安装插件。')
  }

  if (preset.id === 'wechat-clawbot') {
    const currentConfig = readOpenClawConfigFile()
    const preparedConfig = prepareWeixinInstallConfig(currentConfig)
    if (JSON.stringify(preparedConfig) !== JSON.stringify(currentConfig)) {
      fs.mkdirSync(OPENCLAW_CONFIG_DIR, { recursive: true })
      fs.writeFileSync(OPENCLAW_CONFIG_PATH, `${JSON.stringify(preparedConfig, null, 2)}\n`, 'utf8')
    }

    if (fs.existsSync(join(OPENCLAW_WEIXIN_PLUGIN_DIR, 'package.json'))) {
      await openWeixinLoginInTerminal(runtime)
      return {
        success: true,
        message: '已检测到本机微信 ClawBot 插件，已直接打开终端进行扫码登录。'
      }
    }

    try {
      await openWeixinTutorialInstallInTerminal(runtime)
      return {
        success: true,
        message: '已按官方教程打开微信 ClawBot 安装终端。请在终端里扫码完成连接。'
      }
    } catch (tutorialError) {
      log.warn('Failed to launch tutorial install flow, falling back to manual weixin install:', tutorialError)
      await ensureWeixinPluginInstalled(runtime)
      await openWeixinLoginInTerminal(runtime)
    }

    return {
      success: true,
      message: '官方教程安装未能直接启动，已切换到独立微信安装流程并打开终端扫码登录。'
    }
  }

  const openclawCommand = getCommandPath(runtime.commands.openclaw, 'openclaw')
  if (preset.installSource) {
    await runCommand(openclawCommand, ['plugins', 'install', preset.installSource])
  }
  if (preset.enableCommand) {
    await runCommand(openclawCommand, ['plugins', 'enable', preset.enableCommand])
  }

  return { success: true, message: `已完成插件处理：${preset.title}` }
})

ipcMain.handle('open-openclaw-control-ui', async () => {
  const controlUiUrl = buildOpenClawControlUiUrl()
  await shell.openExternal(controlUiUrl)
  return {
    success: true,
    url: controlUiUrl
  }
})

ipcMain.handle('export-openclaw-agent-bundle', async (_event, payload: { name: string; description: string }): Promise<OpenClawAgentBundleResult> => {
  const settings = readOpenClawSettings()
  const workspacePath = settings.workspacePath
  const files = collectWorkspaceBundleFiles(workspacePath)

  const saveResult = await dialog.showSaveDialog(mainWindow!, {
    title: '导出 OpenClaw 智能体 Bundle',
    defaultPath: join(os.homedir(), `${slugifyName(payload.name || 'openclaw-agent')}.openclaw-agent.json`),
    filters: [
      { name: 'OpenClaw Agent Bundle', extensions: ['json'] }
    ]
  })

  if (saveResult.canceled || !saveResult.filePath) {
    throw new Error('已取消导出')
  }

  const bundle: OpenClawAgentBundle = {
    format: 'openclaw-agent-bundle',
    version: 1,
    exportedAt: new Date().toISOString(),
    metadata: {
      name: (payload.name || basename(workspacePath)).trim() || basename(workspacePath),
      description: (payload.description || '').trim(),
      sourceWorkspace: workspacePath
    },
    files
  }

  fs.writeFileSync(saveResult.filePath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')

  return {
    success: true,
    path: saveResult.filePath,
    fileCount: files.length,
    workspacePath
  }
})

ipcMain.handle('import-openclaw-agent-bundle', async (): Promise<OpenClawAgentBundleResult> => {
  const settings = readOpenClawSettings()
  const workspacePath = settings.workspacePath

  const openResult = await dialog.showOpenDialog(mainWindow!, {
    title: '导入 OpenClaw 智能体 Bundle',
    properties: ['openFile'],
    filters: [
      { name: 'OpenClaw Agent Bundle', extensions: ['json'] }
    ]
  })

  if (openResult.canceled || openResult.filePaths.length === 0) {
    throw new Error('已取消导入')
  }

  const filePath = openResult.filePaths[0]
  const parsed = JSON5.parse(fs.readFileSync(filePath, 'utf8')) as OpenClawAgentBundle
  validateOpenClawAgentBundle(parsed)

  fs.mkdirSync(workspacePath, { recursive: true })
  for (const file of parsed.files) {
    const targetPath = join(workspacePath, file.path)
    fs.mkdirSync(dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, file.content, 'utf8')
  }

  return {
    success: true,
    path: filePath,
    fileCount: parsed.files.length,
    workspacePath
  }
})

function getDefaultOpenClawSettings(): OpenClawSettings {
  return getDefaultOpenClawSettingsHelper(getOpenClawPaths())
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function isChannelType(value: string): value is OpenClawChannelType {
  return ['telegram', 'discord', 'slack', 'none'].includes(value)
}

function readOpenClawConfigFile(): OpenClawConfigObject {
  if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) {
    return {}
  }

  const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8').trim()
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON5.parse(raw)
    return asRecord(parsed)
  } catch (error) {
    log.warn('Failed to parse openclaw config, falling back to defaults:', error)
    return {}
  }
}

function normalizeOpenClawSettings(settings: OpenClawSettings): OpenClawSettings {
  return normalizeOpenClawSettingsHelper(settings, getOpenClawPaths())
}

function readOpenClawSettings(): OpenClawSettings {
  return readOpenClawSettingsFromConfig(readOpenClawConfigFile(), getOpenClawPaths())
}

function buildOpenClawControlUiUrl() {
  const config = readOpenClawConfigFile()
  const gatewayConfig = asRecord(config.gateway)
  const authConfig = asRecord(gatewayConfig.auth)
  const configuredPort = typeof gatewayConfig.port === 'number'
    ? gatewayConfig.port
    : Number(readString(gatewayConfig.port, String(OPENCLAW_GATEWAY_PORT))) || OPENCLAW_GATEWAY_PORT
  const token = readString(authConfig.token).trim()

  const url = new URL(`http://127.0.0.1:${configuredPort}`)
  if (token) {
    url.hash = `token=${token}`
  }

  return url.toString()
}

function buildManagedProviderConfig(settings: OpenClawSettings) {
  return buildManagedProviderConfigHelper(settings)
}

function buildTelegramChannelConfig(settings: OpenClawSettings) {
  return buildTelegramChannelConfigHelper(settings)
}

function buildDiscordChannelConfig(settings: OpenClawSettings) {
  return buildDiscordChannelConfigHelper(settings)
}

function buildSlackChannelConfig(settings: OpenClawSettings) {
  return buildSlackChannelConfigHelper(settings)
}

function applyOpenClawSettingsToConfig(currentConfig: OpenClawConfigObject, settings: OpenClawSettings): OpenClawConfigObject {
  return applyOpenClawSettingsToConfigHelper(currentConfig, settings)
}

function expandHomePath(targetPath: string) {
  return expandHomePathHelper(targetPath, os.homedir())
}

function applyPluginPresetToConfig(currentConfig: OpenClawConfigObject, presetId: string): OpenClawConfigObject {
  return applyPluginPresetToConfigHelper(currentConfig, presetId as OpenClawPluginPreset['id'])
}

function prepareWeixinInstallConfig(currentConfig: OpenClawConfigObject): OpenClawConfigObject {
  const nextConfig = { ...currentConfig }
  const plugins = asRecord(nextConfig.plugins)
  const entries = { ...asRecord(plugins.entries) }
  const allow = readStringArray(plugins.allow)
  const channels = asRecord(nextConfig.channels)
  const weixinChannel = asRecord(channels[OPENCLAW_WEIXIN_PLUGIN_ID])

  entries[OPENCLAW_WEIXIN_PLUGIN_ID] = {
    ...asRecord(entries[OPENCLAW_WEIXIN_PLUGIN_ID]),
    enabled: true
  }

  return {
    ...nextConfig,
    plugins: {
      ...plugins,
      allow: Array.from(new Set([...allow, OPENCLAW_WEIXIN_PLUGIN_ID])),
      entries
    },
    channels: {
      ...channels,
      [OPENCLAW_WEIXIN_PLUGIN_ID]: {
        ...weixinChannel,
        enabled: true
      }
    }
  }
}

function slugifyName(name: string) {
  return slugifyNameHelper(name)
}

function shouldSkipBundlePath(path: string) {
  return shouldSkipBundlePathHelper(path)
}

function isTextBuffer(buffer: Buffer) {
  return isTextBufferHelper(buffer)
}

function collectWorkspaceBundleFiles(workspacePath: string): OpenClawAgentBundleFile[] {
  if (!fs.existsSync(workspacePath)) {
    return []
  }

  const files: OpenClawAgentBundleFile[] = []

  const walk = (currentPath: string) => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name)
      const relativePath = relative(workspacePath, fullPath).replace(/\\/g, '/')

      if (shouldSkipBundlePath(relativePath)) {
        continue
      }

      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      const buffer = fs.readFileSync(fullPath)
      if (!isTextBuffer(buffer)) {
        continue
      }

      files.push({
        path: relativePath,
        content: buffer.toString('utf8')
      })
    }
  }

  walk(workspacePath)
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

function validateOpenClawAgentBundle(bundle: OpenClawAgentBundle) {
  if (!bundle || bundle.format !== 'openclaw-agent-bundle' || bundle.version !== 1 || !Array.isArray(bundle.files)) {
    throw new Error('无效的 OpenClaw Agent Bundle 文件。')
  }

  for (const file of bundle.files) {
    if (!file.path || file.path.includes('..') || file.path.startsWith('/')) {
      throw new Error(`Bundle 中包含非法路径: ${file.path}`)
    }
    if (typeof file.content !== 'string') {
      throw new Error(`Bundle 文件内容非法: ${file.path}`)
    }
  }
}

function sendProgress(
  event: Electron.IpcMainInvokeEvent,
  stage: InstallProgressStage,
  progress: number,
  detail: string
) {
  event.sender.send('install-progress', { stage, progress, detail })
}

async function getRuntimeStatus(): Promise<RuntimeStatus> {
  logStepStart('get-runtime-status')
  if (runtimeStatusInFlight) {
    return runtimeStatusInFlight
  }

  runtimeStatusInFlight = collectRuntimeStatus()
    .finally(() => {
      runtimeStatusInFlight = null
    })

  return runtimeStatusInFlight
}

async function collectRuntimeStatus(): Promise<RuntimeStatus> {
  const probeResult = await probeRuntime()
  const runtime = buildRuntimeStatus(probeResult)
  logStepDone('get-runtime-status', runtime)
  return runtime
}

async function probeRuntime(): Promise<RuntimeProbeResult> {
  const [commands, gatewayRunning] = await Promise.all([
    probeRuntimeCommands(),
    probeGatewayRuntime()
  ])

  const registry = await probeRegistryRuntime(commands)

  return {
    commands,
    gatewayRunning,
    registry,
    mirrorRecommended: isMirrorRecommended()
  }
}

async function probeRuntimeCommands(): Promise<RuntimeCommandProbe> {
  const [node, npm, pnpm, openclaw] = await Promise.all([
    probeCommandStatus('node', ['--version']),
    probeCommandStatus('npm', ['--version']),
    probeCommandStatus('pnpm', ['--version']),
    probeCommandStatus('openclaw', ['--version'])
  ])

  return {
    node,
    npm,
    pnpm,
    openclaw
  }
}

async function probeCommandStatus(command: string, versionArgs: string[]): Promise<CommandCheckResult> {
  const commandPath = await whichCommand(command)
  return buildCommandStatus(commandPath, versionArgs)
}

async function probeGatewayRuntime(): Promise<boolean> {
  return isOpenClawGatewayRunning()
}

async function probeRegistryRuntime(commands: RuntimeCommandProbe): Promise<RuntimeStatus['registry']> {
  const [npmRegistry, pnpmRegistry] = await Promise.all([
    commands.npm.exists ? readRegistry('npm', commands.npm.path) : Promise.resolve(null),
    commands.pnpm.exists ? readRegistry('pnpm', commands.pnpm.path) : Promise.resolve(null)
  ])

  return {
    npm: npmRegistry,
    pnpm: pnpmRegistry
  }
}

function buildRuntimeStatus(probeResult: RuntimeProbeResult): RuntimeStatus {
  const { commands, gatewayRunning, registry, mirrorRecommended } = probeResult

  return {
    commands: {
      node: commands.node,
      npm: commands.npm,
      pnpm: commands.pnpm,
      openclaw: commands.openclaw
    },
    gateway: {
      running: gatewayRunning,
      port: OPENCLAW_GATEWAY_PORT
    },
    registry,
    mirrorRecommended
  }
}

function hasOpenClawCommand(runtime: RuntimeStatus) {
  return runtime.commands.openclaw.exists
}

function isOpenClawGatewayRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: '127.0.0.1',
      port: OPENCLAW_GATEWAY_PORT
    })

    let settled = false
    const finalize = (running: boolean) => {
      if (settled) {
        return
      }
      settled = true
      socket.destroy()
      resolve(running)
    }

    socket.setTimeout(350)
    socket.once('connect', () => finalize(true))
    socket.once('timeout', () => finalize(false))
    socket.once('error', () => finalize(false))
  })
}

async function installNodeJs(event: Electron.IpcMainInvokeEvent) {
  logStepStart('install-nodejs')
  const installer = await resolveNodeInstaller()
  const tempDir = fs.mkdtempSync(join(os.tmpdir(), 'openclaw-node-installer-'))
  const installerFileName = basename(installer.name)
  const installerPath = join(tempDir, installerFileName)

  sendProgress(event, 'downloading', 24, `正在下载 ${installerFileName}`)
  await downloadFile(installer.url, installerPath, (progress) => {
    sendProgress(event, 'downloading', 24 + Math.round(progress * 24), `正在下载 ${installerFileName}`)
  })

  sendProgress(event, 'finalizing', 50, '正在安装 Node.js，可能会触发系统权限确认')
  await runNodeInstaller(installerPath)

  sendProgress(event, 'finalizing', 62, '正在等待 Node.js 安装完成')
  const installed = await waitForCommand('node', ['--version'], 18, 2000)
  if (!installed) {
    throw new Error('Node.js 安装完成后仍未检测到 node 命令。')
  }
  logStepDone('install-nodejs', { installerPath })
}

async function upgradeNodeJs(event: Electron.IpcMainInvokeEvent, runtime: RuntimeStatus) {
  logStepStart('upgrade-nodejs', runtime.commands.node)
  const upgradedWithManager = await tryUpgradeNodeWithManager(event)

  if (upgradedWithManager) {
    logStepDone('upgrade-nodejs', 'manager')
    return
  }

  sendProgress(event, 'finalizing', 40, '未检测到可用的 Node 版本管理工具，正在切换到官方安装器')
  await installNodeJs(event)

  const refreshedRuntime = await getRuntimeStatus()
  if (!isNodeVersionSupported(refreshedRuntime.commands.node.version)) {
    throw new Error(buildNodeVersionError(refreshedRuntime.commands.node.version, refreshedRuntime.commands.node.path))
  }

  if (!runtime.commands.node.path || refreshedRuntime.commands.node.path !== runtime.commands.node.path) {
    log.info('Node.js 已通过官方安装器升级:', refreshedRuntime.commands.node.path, refreshedRuntime.commands.node.version)
  }
  logStepDone('upgrade-nodejs', refreshedRuntime.commands.node)
}

async function getCommandStatus(command: string, versionArgs: string[]): Promise<CommandCheckResult> {
  const path = await whichCommand(command)
  return buildCommandStatus(path, versionArgs)
}

async function buildCommandStatus(path: string | null, versionArgs: string[]): Promise<CommandCheckResult> {
  if (!path) {
    return { exists: false, path: null, version: null }
  }

  try {
    const version = (await runCommand(path, versionArgs)).trim()
    return {
      exists: true,
      path,
      version: version || null
    }
  } catch {
    return {
      exists: true,
      path,
      version: null
    }
  }
}

async function whichCommand(command: string): Promise<string | null> {
  const env = withNormalizedPathEnv(resolvedRuntimeEnv, buildRuntimePath())
  const shellCommand = getShellCommand(command)
  const knownPath = getKnownCommandPath(command)

  if (knownPath) {
    return knownPath
  }

  try {
    execSync(`${shellCommand} --version`, {
      encoding: 'utf8',
      env,
      windowsHide: true,
      stdio: 'pipe'
    })

    return shellCommand
  } catch {
    return null
  }
}

function runCommand(command: string, args: string[], extraEnv: Record<string, string> = {}): Promise<string> {
  const env = withNormalizedPathEnv({
    ...resolvedRuntimeEnv,
    ...extraEnv
  }, buildRuntimePath(getPathEnv(extraEnv)))
  const displayCommand = [command, ...args].join(' ')

  log.info('[COMMAND START]', {
    command,
    args,
    displayCommand,
    path: getPathEnv(env)
  })

  const run = async () => {
    try {
      const result = await execa(command, args, {
        env,
        windowsHide: true,
        shell: false
      })

      log.info('[COMMAND DONE]', {
        command: displayCommand,
        code: result.exitCode,
        stdout: summarizeOutput(result.stdout),
        stderr: summarizeOutput(result.stderr)
      })

      return result.stdout || result.stderr
    } catch (error) {
      const execaError = error as {
        shortMessage?: string
        stderr?: string
        stdout?: string
        exitCode?: number
        message?: string
      }

      log.error('[COMMAND FAIL]', {
        command: displayCommand,
        code: execaError.exitCode ?? 'unknown',
        stdout: summarizeOutput(execaError.stdout || ''),
        stderr: summarizeOutput(execaError.stderr || ''),
        message: execaError.shortMessage || execaError.message || 'command failed'
      })

      throw new Error((execaError.stderr || execaError.stdout || execaError.shortMessage || execaError.message || `${command} 执行失败`).trim())
    }
  }

  return run()
}

function runCommandInDir(command: string, args: string[], cwd: string, extraEnv: Record<string, string> = {}): Promise<string> {
  const env = withNormalizedPathEnv({
    ...resolvedRuntimeEnv,
    ...extraEnv
  }, buildRuntimePath(getPathEnv(extraEnv)))
  const displayCommand = [command, ...args].join(' ')

  log.info('[COMMAND START]', {
    command,
    args,
    cwd,
    displayCommand,
    path: getPathEnv(env)
  })

  const run = async () => {
    try {
      const result = await execa(command, args, {
        cwd,
        env,
        windowsHide: true,
        shell: false
      })

      log.info('[COMMAND DONE]', {
        command: displayCommand,
        cwd,
        code: result.exitCode,
        stdout: summarizeOutput(result.stdout),
        stderr: summarizeOutput(result.stderr)
      })

      return result.stdout || result.stderr
    } catch (error) {
      const execaError = error as {
        shortMessage?: string
        stderr?: string
        stdout?: string
        exitCode?: number
        message?: string
      }

      log.error('[COMMAND FAIL]', {
        command: displayCommand,
        cwd,
        code: execaError.exitCode ?? 'unknown',
        stdout: summarizeOutput(execaError.stdout || ''),
        stderr: summarizeOutput(execaError.stderr || ''),
        message: execaError.shortMessage || execaError.message || 'command failed'
      })

      throw new Error((execaError.stderr || execaError.stdout || execaError.shortMessage || execaError.message || `${command} 执行失败`).trim())
    }
  }

  return run()
}

function runShellCommand(command: string, extraEnv: Record<string, string> = {}): Promise<string> {
  const shellPath = process.platform === 'win32'
    ? (resolvedRuntimeEnv.ComSpec || process.env.ComSpec || 'cmd.exe')
    : (resolvedRuntimeEnv.SHELL || process.env.SHELL || '/bin/zsh')
  const env = withNormalizedPathEnv({
    ...resolvedRuntimeEnv,
    ...extraEnv
  }, buildRuntimePath(getPathEnv(extraEnv)))

  log.info('[SHELL START]', {
    shellPath,
    command,
    path: getPathEnv(env)
  })

  const run = async () => {
    try {
      const result = await execaCommand(command, {
        env,
        windowsHide: true,
        shell: shellPath
      })

      log.info('[SHELL DONE]', {
        command,
        code: result.exitCode,
        stdout: summarizeOutput(result.stdout),
        stderr: summarizeOutput(result.stderr)
      })

      return result.stdout || result.stderr
    } catch (error) {
      const execaError = error as {
        shortMessage?: string
        stderr?: string
        stdout?: string
        exitCode?: number
        message?: string
      }

      log.error('[SHELL FAIL]', {
        command,
        code: execaError.exitCode ?? 'unknown',
        stdout: summarizeOutput(execaError.stdout || ''),
        stderr: summarizeOutput(execaError.stderr || ''),
        message: execaError.shortMessage || execaError.message || 'shell command failed'
      })

      throw new Error((execaError.stderr || execaError.stdout || execaError.shortMessage || execaError.message || `${command} 执行失败`).trim())
    }
  }

  return run()
}

function downloadFile(url: string, destination: string, onProgress?: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(dirname(destination), { recursive: true })
    const file = fs.createWriteStream(destination)
    let settled = false

    const fail = (error: Error) => {
      if (settled) {
        return
      }
      settled = true
      try {
        file.destroy()
      } catch {
      }
      fs.rmSync(destination, { force: true })
      reject(error)
    }

    file.on('error', (error) => {
      fail(error)
    })

    https.get(url, {
      headers: {
        'User-Agent': 'Crayfish-Installer'
      }
    }, (response) => {
      response.on('error', (error) => {
        fail(error)
      })

      if (response.statusCode && [301, 302, 307, 308].includes(response.statusCode)) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          response.resume()
          settled = true
          file.close(() => {
            downloadFile(redirectUrl, destination, onProgress).then(resolve).catch(reject)
          })
          return
        }
      }

      if (response.statusCode !== 200) {
        fail(new Error(`下载安装文件失败: HTTP ${response.statusCode}`))
        return
      }

      const total = Number(response.headers['content-length'] || '0')
      let downloaded = 0

      response.on('data', (chunk) => {
        downloaded += chunk.length
        if (total > 0 && onProgress) {
          onProgress(downloaded / total)
        }
      })

      response.pipe(file)
      file.on('finish', () => {
        if (settled) {
          return
        }
        settled = true
        file.close((closeError) => {
          if (closeError) {
            reject(closeError)
            return
          }
          resolve()
        })
      })
    }).on('error', (error) => {
      fail(error)
    })
  })
}

async function ensureWeixinPluginInstalled(runtime: RuntimeStatus) {
  const packageJsonPath = join(OPENCLAW_WEIXIN_PLUGIN_DIR, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    return OPENCLAW_WEIXIN_PLUGIN_DIR
  }

  fs.rmSync(OPENCLAW_WEIXIN_PLUGIN_DIR, { recursive: true, force: true })
  fs.mkdirSync(OPENCLAW_WEIXIN_PLUGIN_DIR, { recursive: true })

  const defaultPluginDir = join(OPENCLAW_CONFIG_DIR, 'extensions', OPENCLAW_WEIXIN_PLUGIN_ID)
  if (defaultPluginDir !== OPENCLAW_WEIXIN_PLUGIN_DIR && fs.existsSync(join(defaultPluginDir, 'package.json'))) {
    fs.cpSync(defaultPluginDir, OPENCLAW_WEIXIN_PLUGIN_DIR, { recursive: true })
    return OPENCLAW_WEIXIN_PLUGIN_DIR
  }

  const tarballUrl = await resolveWeixinTarballUrl(runtime)
  const archivePath = join(os.tmpdir(), `openclaw-weixin-${Date.now()}.tgz`)
  await downloadFile(tarballUrl, archivePath)
  await runCommand('tar', ['-xzf', archivePath, '-C', OPENCLAW_WEIXIN_PLUGIN_DIR, '--strip-components=1'])

  const packageManagerEnv = getPackageManagerEnv()
  if (runtime.commands.pnpm.exists) {
    await ensurePnpmHomeConfigured(runtime.commands.pnpm.path)
    await runCommandInDir(getCommandPath(runtime.commands.pnpm, 'pnpm'), ['install', '--prod', '--ignore-scripts'], OPENCLAW_WEIXIN_PLUGIN_DIR, packageManagerEnv)
  } else if (runtime.commands.npm.exists) {
    await runCommandInDir(getCommandPath(runtime.commands.npm, 'npm'), ['install', '--omit=dev', '--ignore-scripts'], OPENCLAW_WEIXIN_PLUGIN_DIR, packageManagerEnv)
  } else {
    throw new Error('未检测到 pnpm 或 npm，无法安装微信 ClawBot 依赖。')
  }

  fs.rmSync(archivePath, { force: true })
  return OPENCLAW_WEIXIN_PLUGIN_DIR
}

async function resolveWeixinTarballUrl(runtime: RuntimeStatus) {
  if (runtime.commands.pnpm.exists) {
    const output = await runCommand(getCommandPath(runtime.commands.pnpm, 'pnpm'), ['view', OPENCLAW_WEIXIN_PACKAGE_SPEC, 'dist.tarball'], getPackageManagerEnv())
    const url = output.trim().split('\n').pop()?.trim()
    if (url) {
      return url
    }
  }

  if (runtime.commands.npm.exists) {
    const output = await runCommand(getCommandPath(runtime.commands.npm, 'npm'), ['view', OPENCLAW_WEIXIN_PACKAGE_SPEC, 'dist.tarball'], getPackageManagerEnv())
    const url = output.trim().split('\n').pop()?.trim()
    if (url) {
      return url
    }
  }

  throw new Error('无法解析微信 ClawBot 插件下载地址。')
}

async function openWeixinLoginInTerminal(runtime: RuntimeStatus) {
  const currentSettings = readOpenClawSettings()
  const loginEnv = {
    ...getPackageManagerEnv(),
    OPENAI_API_KEY: getEnvValue(resolvedRuntimeEnv, 'OPENAI_API_KEY') || currentSettings.modelApiKey || 'local'
  }
  const loginCommand = `OPENAI_API_KEY=${shellEscape(loginEnv.OPENAI_API_KEY)} openclaw channels login --channel ${OPENCLAW_WEIXIN_PLUGIN_ID} --verbose`

  if (process.platform === 'darwin') {
    const script = `tell application "Terminal" to do script ${toAppleScriptString(loginCommand)}`
    await runCommand('osascript', ['-e', script, '-e', 'tell application "Terminal" to activate'])
    return
  }

  if (process.platform === 'win32') {
    await runShellCommand(`start "" cmd /k ${loginCommand}`, loginEnv)
    return
  }

  await runShellCommand(`x-terminal-emulator -e ${loginCommand}`, loginEnv)
}

async function openWeixinTutorialInstallInTerminal(runtime: RuntimeStatus) {
  const packageManagerEnv = getPackageManagerEnv()
  const installCommand = runtime.commands.pnpm.exists
    ? `pnpm dlx @tencent-weixin/openclaw-weixin-cli@latest install`
    : `npx -y @tencent-weixin/openclaw-weixin-cli@latest install`

  if (process.platform === 'darwin') {
    const script = `tell application "Terminal" to do script ${toAppleScriptString(installCommand)}`
    await runCommand('osascript', ['-e', script, '-e', 'tell application "Terminal" to activate'], packageManagerEnv)
    return
  }

  if (process.platform === 'win32') {
    await runShellCommand(`start "" cmd /k ${installCommand}`, packageManagerEnv)
    return
  }

  await runShellCommand(`x-terminal-emulator -e ${installCommand}`, packageManagerEnv)
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function toAppleScriptString(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

async function ensureMirrorConfigured() {
  logStepStart('ensure-mirror-configured')
  if (!isMirrorRecommended()) {
    logStepDone('ensure-mirror-configured', 'skipped')
    return
  }

  const registry = NPM_REGISTRY
  const npmPath = await getCommandExecutionPath('npm')
  const pnpmPath = await getCommandExecutionPath('pnpm')

  if (npmPath) {
    await runCommand(npmPath, ['config', 'set', 'registry', registry], getPackageManagerEnv())
  }

  if (pnpmPath) {
    await ensurePnpmHomeConfigured(pnpmPath)
    await runCommand(pnpmPath, ['config', 'set', 'registry', registry], getPackageManagerEnv())
  }
  logStepDone('ensure-mirror-configured', { npmPath, pnpmPath, registry })
}

async function runGlobalCommand(command: string, args: string[], extraEnv: Record<string, string> = {}) {
  logStepStart('run-global-command', { command, args })
  try {
    const result = await runCommand(command, args, extraEnv)
    logStepDone('run-global-command', { command, args })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!isPermissionError(message)) {
      logStepFail('run-global-command', error)
      throw error
    }

    log.warn('Permission denied, requesting elevation:', command, args.join(' '))
    const elevatedResult = await runCommandAsAdministrator(command, args, extraEnv)
    logStepDone('run-global-command', { command, args, elevated: true })
    return elevatedResult
  }
}

function readRegistry(tool: 'npm' | 'pnpm', commandPath?: string | null): Promise<string | null> {
  const cached = registryCache.get(tool)
  if (cached && Date.now() - cached.checkedAt < 15_000) {
    return Promise.resolve(cached.value)
  }

  return new Promise((resolve) => {
    const resolvedCommand = commandPath || getKnownCommandPath(tool) || getShellCommand(tool)
    exec(`"${resolvedCommand}" config get registry`, {
      env: withNormalizedPathEnv(resolvedRuntimeEnv, buildRuntimePath()),
      windowsHide: true
    }, (error, stdout) => {
      if (error) {
        registryCache.set(tool, { value: null, checkedAt: Date.now() })
        resolve(null)
        return
      }

      const value = stdout.trim()
      const normalized = value && value !== 'undefined' ? value : null
      registryCache.set(tool, { value: normalized, checkedAt: Date.now() })
      resolve(normalized)
    })
  })
}

function isMirrorRecommended() {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase()
  return locale.includes('zh')
}

function getShellCommand(command: string) {
  if (process.platform !== 'win32') {
    return command
  }

  const mapped = {
    node: 'node.exe',
    npm: 'npm.cmd',
    pnpm: 'pnpm.cmd',
    openclaw: 'openclaw.cmd'
  } as Record<string, string>

  return mapped[command] || command
}

async function getCommandExecutionPath(command: string) {
  return normalizeCommandPath((await whichCommand(command)) || getShellCommand(command), command)
}

function getCommandPath(status: CommandCheckResult, command: string) {
  return normalizeCommandPath(status.path || getShellCommand(command), command)
}

async function resolveNodeInstaller(): Promise<{ name: string; url: string }> {
  const listing = await fetchText(NODE_LTS_BASE_URL)
  const hrefs = Array.from(listing.matchAll(/href="([^"]+)"/g)).map(match => match[1])
  const target = pickNodeInstaller(hrefs)

  if (!target) {
    throw new Error('没有找到适合当前系统的官方 Node.js 安装包。')
  }

  return {
    name: target,
    url: new URL(target, NODE_LTS_BASE_URL).toString()
  }
}

function pickNodeInstaller(files: string[]): string | null {
  if (process.platform === 'darwin') {
    return files.find(file => file.endsWith('.pkg')) || null
  }

  if (process.platform === 'win32') {
    const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'ia32' ? 'x86' : 'x64'
    return files.find(file => file.endsWith(`-${arch}.msi`))
      || files.find(file => file.endsWith('-x64.msi'))
      || null
  }

  return null
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Crayfish-Installer'
      }
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`获取资源失败: HTTP ${response.statusCode}`))
        return
      }

      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        body += chunk
      })
      response.on('end', () => resolve(body))
    }).on('error', reject)
  })
}

async function runNodeInstaller(installerPath: string) {
  if (process.platform === 'darwin') {
    const escapedPath = installerPath.replace(/"/g, '\\"')
    await runCommand('osascript', [
      '-e',
      `do shell script "installer -pkg \\"${escapedPath}\\" -target /" with administrator privileges`
    ])
    return
  }

  if (process.platform === 'win32') {
    const escapedPath = installerPath.replace(/'/g, "''")
    await runCommand('powershell.exe', [
      '-Command',
      `Start-Process msiexec.exe -Verb RunAs -Wait -ArgumentList '/i "${escapedPath}" /passive /norestart'`
    ])
    return
  }

  throw new Error('当前仅支持在 Windows 和 macOS 上自动安装 Node.js')
}

async function waitForCommand(command: string, args: string[], retries: number, delayMs: number) {
  for (let i = 0; i < retries; i += 1) {
    const status = await getCommandStatus(command, args)
    if (status.exists) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  return false
}

function getKnownCommandPath(command: string): string | null {
  if (process.platform === 'darwin') {
    const macCandidates: Record<string, string[]> = {
      node: ['/usr/local/bin/node', '/opt/homebrew/bin/node'],
      npm: ['/usr/local/bin/npm', '/opt/homebrew/bin/npm'],
      pnpm: ['/usr/local/bin/pnpm', '/opt/homebrew/bin/pnpm'],
      openclaw: ['/usr/local/bin/openclaw', '/opt/homebrew/bin/openclaw']
    }
    const preferred = macCandidates[command]?.find(path => fs.existsSync(path))
    return preferred || getNvmCommandPath(command) || null
  }

  if (process.platform === 'win32') {
    const base = getEnvValue(resolvedRuntimeEnv, 'ProgramFiles')
      || getEnvValue(process.env, 'ProgramFiles')
      || 'C:\\Program Files'
    const x86 = getEnvValue(resolvedRuntimeEnv, 'ProgramFiles(x86)')
      || getEnvValue(process.env, 'ProgramFiles(x86)')
      || 'C:\\Program Files (x86)'
    const appData = getEnvValue(resolvedRuntimeEnv, 'APPDATA')
      || getEnvValue(process.env, 'APPDATA')
      || join(os.homedir(), 'AppData', 'Roaming')
    const localAppData = getEnvValue(resolvedRuntimeEnv, 'LOCALAPPDATA')
      || getEnvValue(process.env, 'LOCALAPPDATA')
      || join(os.homedir(), 'AppData', 'Local')
    const pnpmHome = getPnpmHomeDir()
    const winCandidates: Record<string, string[]> = {
      node: expandWindowsCommandCandidates(
        join(base, 'nodejs', 'node'),
        join(x86, 'nodejs', 'node')
      ),
      npm: expandWindowsCommandCandidates(
        join(base, 'nodejs', 'npm'),
        join(x86, 'nodejs', 'npm'),
        join(appData, 'npm', 'npm'),
        join(localAppData, 'pnpm', 'npm'),
        join(pnpmHome, 'npm')
      ),
      pnpm: expandWindowsCommandCandidates(
        join(localAppData, 'pnpm', 'pnpm'),
        join(appData, 'npm', 'pnpm'),
        join(pnpmHome, 'pnpm'),
        join(base, 'nodejs', 'pnpm'),
        join(x86, 'nodejs', 'pnpm')
      ),
      openclaw: expandWindowsCommandCandidates(
        join(localAppData, 'pnpm', 'openclaw'),
        join(appData, 'npm', 'openclaw'),
        join(pnpmHome, 'openclaw'),
        join(base, 'nodejs', 'openclaw'),
        join(x86, 'nodejs', 'openclaw')
      )
    }

    const matchedPath = winCandidates[command]?.find(path => fs.existsSync(path)) || null
    if (matchedPath) {
      log.info('[KNOWN COMMAND PATH]', { command, matchedPath })
    }
    return matchedPath
  }

  return null
}

function normalizeCommandPath(commandPath: string | null, commandName: string) {
  if (!commandPath) {
    return null
  }

  if (process.platform !== 'win32') {
    return commandPath
  }

  const loweredCommandName = commandName.toLowerCase()
  const prefersScriptShim = ['npm', 'pnpm', 'openclaw'].includes(loweredCommandName)

  const candidates = commandPath.includes('\\') || commandPath.includes('/')
    ? [
        `${commandPath}.cmd`,
        `${commandPath}.exe`,
        `${commandPath}.bat`,
        commandPath
      ]
    : [
        getShellCommand(commandName),
        `${commandPath}.cmd`,
        `${commandPath}.exe`,
        `${commandPath}.bat`,
        commandPath
      ]

  if (!prefersScriptShim && fs.existsSync(commandPath)) {
    return commandPath
  }

  return candidates.find(candidate => {
    if (!candidate) {
      return false
    }

    if (!candidate.includes('\\') && !candidate.includes('/')) {
      return true
    }

    return fs.existsSync(candidate)
  }) || commandPath
}

function isNodeVersionSupported(version: string | null) {
  const normalized = normalizeVersion(version)
  return normalized ? gte(normalized, OPENCLAW_REQUIRED_NODE_VERSION) : false
}

function isRecoverableInstallError(message: string) {
  const lowered = message.toLowerCase()
  return [
    'eacces',
    'permission',
    'network',
    'timed out',
    'econn',
    'registry',
    'pnpm',
    'err_pnpm_no_global_bin_dir',
    'global-bin-dir',
    'pnpm_home',
    'node.js 自动安装未完成',
    'openclaw 命令未成功安装',
    'gateway service install failed',
    'schtasks create failed',
    '需要 node.js 22',
    'not detected',
    '下载'
  ].some(pattern => lowered.includes(pattern.toLowerCase()))
}

function isPermissionError(message: string) {
  const lowered = message.toLowerCase()
  return [
    'eacces',
    'permission denied',
    'operation not permitted',
    'administrator privileges',
    'access is denied',
    '拒绝访问',
    '权限'
  ].some(pattern => lowered.includes(pattern))
}

function isWindowsGatewayInstallFailure(message: string) {
  const lowered = message.toLowerCase()
  return lowered.includes('gateway service install failed')
    || lowered.includes('schtasks create failed')
    || lowered.includes('gateway service install did not complete successfully')
}

async function applyAutoRepair(message: string) {
  const lowered = message.toLowerCase()

  if (lowered.includes('registry') || lowered.includes('econn') || lowered.includes('network') || lowered.includes('下载')) {
    await ensureMirrorConfigured()
  }

  if (lowered.includes('pnpm')) {
    const npmPath = await whichCommand('npm')
    if (npmPath) {
      await runGlobalCommand(npmPath, ['install', '-g', 'pnpm'], getNodeMirrorEnv())
    }
  }

  if (lowered.includes('requires node >=') || lowered.includes('需要 node.js >=')) {
    const runtime = await getRuntimeStatus()
    if (runtime.commands.node.exists) {
      await tryUpgradeNodeWithManager(null)
    }
  }
}

function translateInstallError(message: string) {
  const lowered = message.toLowerCase()

  if (isWindowsGatewayInstallFailure(message)) {
    return {
      userMessage: 'OpenClaw 已安装，但 Windows 后台服务注册失败。',
      detail: `${message}\n\n你可以先执行 \`openclaw\` 启动，或执行 \`openclaw gateway run\` 前台运行网关。若需后台服务，请以管理员身份重试，或改用 WSL2。`
    }
  }

  if (lowered.includes('config overwrite')) {
    return {
      userMessage: '检测到已有 OpenClaw 配置文件，本次安装覆盖了旧配置并保留了备份。',
      detail: message
    }
  }

  if (lowered.includes('err_pnpm_no_global_bin_dir') || lowered.includes('global-bin-dir') || lowered.includes('pnpm_home')) {
    return {
      userMessage: 'pnpm 全局目录未准备完成，安装器正在尝试自动补齐。',
      detail: message
    }
  }

  if (lowered.includes('eacces') || lowered.includes('permission denied') || lowered.includes('administrator privileges')) {
    return {
      userMessage: '需要系统权限才能继续安装，请在弹出的系统授权窗口中点击允许。',
      detail: message
    }
  }

  if (lowered.includes('econn') || lowered.includes('network') || lowered.includes('timed out') || lowered.includes('下载') || lowered.includes('tls')) {
    return {
      userMessage: '网络连接异常，安装器已尝试自动修复镜像并重试。',
      detail: message
    }
  }

  if (lowered.includes('node.js') || lowered.includes('requires node >=')) {
    return {
      userMessage: `Node.js 版本不符合要求，安装器会尝试自动升级到 ${OPENCLAW_REQUIRED_NODE_VERSION} 或更高版本。`,
      detail: message
    }
  }

  if (lowered.includes('127.0.0.1:1234') || lowered.includes('custom-base-url') || lowered.includes('connection refused')) {
    return {
      userMessage: '本地模型接口不可用，OpenClaw 无法完成本地模型初始化。',
      detail: `${message}\n\n当前默认地址是 http://127.0.0.1:1234/v1。`
    }
  }

  if (lowered.includes('pnpm')) {
    return {
      userMessage: 'pnpm 安装或调用失败，请检查全局安装环境。',
      detail: message
    }
  }

  if (lowered.includes('openclaw') || lowered.includes('onboard')) {
    return {
      userMessage: 'OpenClaw 初始化没有完成，请查看详细日志。',
      detail: message
    }
  }

  return {
    userMessage: '安装没有完成，请重试。',
    detail: message
  }
}

function getNodeMirrorEnv() {
  if (!isMirrorRecommended()) {
    return {}
  }

  return {
    N_NODE_MIRROR: CN_NODE_MIRROR,
    NVM_NODEJS_ORG_MIRROR: CN_NODE_MIRROR
  }
}

function getPnpmHomeDir() {
  if (process.platform === 'win32') {
    return join(os.homedir(), 'AppData', 'Local', 'pnpm')
  }

  if (process.platform === 'darwin') {
    return join(os.homedir(), 'Library', 'pnpm')
  }

  return join(os.homedir(), '.local', 'share', 'pnpm')
}

function getPackageManagerEnv() {
  const pnpmHome = getPnpmHomeDir()
  fs.mkdirSync(pnpmHome, { recursive: true })

  return {
    ...getNodeMirrorEnv(),
    PNPM_HOME: pnpmHome,
    npm_config_global_bin_dir: pnpmHome,
    npm_config_prefix: pnpmHome,
    PATH: buildRuntimePath(pnpmHome)
  }
}

async function getDefaultOnboardArgs() {
  const defaultModelId = await resolvePreferredLocalModelId(DEFAULT_LOCAL_MODEL_BASE_URL, DEFAULT_LOCAL_MODEL_FALLBACK)

  return [
    'onboard',
    '--non-interactive',
    '--accept-risk',
    '--mode',
    'local',
    '--auth-choice',
    'custom-api-key',
    '--custom-base-url',
    DEFAULT_LOCAL_MODEL_BASE_URL,
    '--custom-model-id',
    defaultModelId,
    '--custom-compatibility',
    'openai',
    '--custom-api-key',
    'local',
    '--secret-input-mode',
    'plaintext',
    '--gateway-port',
    '18789',
    '--gateway-bind',
    'loopback',
    '--install-daemon',
    '--daemon-runtime',
    'node',
    '--skip-skills'
  ]
}

function buildModelRequestHeaders(apiKey?: string) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'Crayfish-Installer'
  }

  const normalizedApiKey = (apiKey || '').trim()
  if (normalizedApiKey && normalizedApiKey !== 'local') {
    headers.Authorization = `Bearer ${normalizedApiKey}`
    headers['x-api-key'] = normalizedApiKey
  }

  return headers
}

async function fetchAvailableModelIds(baseUrl: string, apiKey?: string) {
  const endpoint = buildModelsEndpoint(baseUrl)
  if (!endpoint) {
    return []
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: buildModelRequestHeaders(apiKey),
    signal: AbortSignal.timeout(2000)
  })

  if (!response.ok) {
    throw new Error(`获取模型列表失败: HTTP ${response.status}`)
  }

  return extractModelIds(await response.json())
}

async function fetchOllamaModelIds() {
  try {
    const ollamaPath = await whichCommand('ollama')
    if (!ollamaPath) {
      return []
    }

    const output = await runCommand(ollamaPath, ['list'])
    return output
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/)[0])
      .filter(Boolean)
  } catch (error) {
    log.warn('Failed to read local Ollama model list:', error)
    return []
  }
}

async function discoverLocalModelIds(baseUrl: string, fallback: string): Promise<LocalModelDiscoveryResult> {
  const ollamaModelIds = await fetchOllamaModelIds()
  if (ollamaModelIds.length > 0) {
    const defaultModelId = selectDefaultModelId(ollamaModelIds, fallback)
    log.info('[LOCAL MODEL DISCOVERY][OLLAMA]', { modelIds: ollamaModelIds, defaultModelId })
    return {
      source: 'ollama',
      modelIds: ollamaModelIds,
      defaultModelId
    }
  }

  try {
    const modelIds = await fetchAvailableModelIds(baseUrl)
    const defaultModelId = selectDefaultModelId(modelIds, fallback)
    log.info('[LOCAL MODEL DISCOVERY][OPENAI-COMPATIBLE]', { baseUrl, modelIds, defaultModelId })
    return {
      source: 'openai-compatible',
      modelIds,
      defaultModelId
    }
  } catch (error) {
    log.warn('Failed to fetch local model list, using fallback model id:', error)
    return {
      source: 'fallback',
      modelIds: [],
      defaultModelId: fallback
    }
  }
}

async function resolvePreferredLocalModelId(baseUrl: string, fallback: string) {
  const discovery = await discoverLocalModelIds(baseUrl, fallback)
  return discovery.defaultModelId
}

async function testOpenClawModelConnection(settings: OpenClawSettings): Promise<OpenClawModelConnectionResult> {
  const normalizedBaseUrl = settings.modelBaseUrl.trim()

  if (settings.modelProviderId === 'ollama' || isDefaultLocalModelBaseUrl(normalizedBaseUrl)) {
    const ollamaModelIds = await fetchOllamaModelIds()
    if (ollamaModelIds.length > 0) {
      return {
        success: true,
        message: `连接成功，已发现 ${ollamaModelIds.length} 个 Ollama 模型。`,
        modelIds: ollamaModelIds
      }
    }
  }

  const modelIds = await fetchAvailableModelIds(normalizedBaseUrl, settings.modelApiKey)
  return {
    success: true,
    message: modelIds.length > 0
      ? `连接成功，已读取到 ${modelIds.length} 个模型。`
      : '连接成功，但当前接口没有返回可用模型列表。',
    modelIds
  }
}

async function resolveSettingsModelId(currentConfig: OpenClawConfigObject, settings: OpenClawSettings) {
  const defaultsSection = asRecord(asRecord(currentConfig.agents).defaults)
  const modelSection = asRecord(defaultsSection.model)
  const hasConfiguredPrimaryModel = readString(modelSection.primary).trim().length > 0
  const defaultSettings = getDefaultOpenClawSettings()
  const shouldAutoDetectModelId = !settings.modelId.trim() || settings.modelId === defaultSettings.modelId

  const shouldUseOllamaDetection = settings.modelProviderId === 'ollama'
  const shouldUseLocalCompatibleDetection = isDefaultLocalModelBaseUrl(settings.modelBaseUrl)

  if (hasConfiguredPrimaryModel || (!shouldUseOllamaDetection && !shouldUseLocalCompatibleDetection) || !shouldAutoDetectModelId) {
    return settings
  }

  const fallbackModelId = settings.modelId || defaultSettings.modelId || DEFAULT_LOCAL_MODEL_FALLBACK
  const detectedModelId = shouldUseOllamaDetection
    ? selectDefaultModelId(await fetchOllamaModelIds(), fallbackModelId)
    : await resolvePreferredLocalModelId(settings.modelBaseUrl, fallbackModelId)

  return detectedModelId === settings.modelId
    ? settings
    : { ...settings, modelId: detectedModelId }
}

async function ensurePnpmHomeConfigured(pnpmPath: string | null) {
  const resolvedPnpmPath = pnpmPath || await getCommandExecutionPath('pnpm')
  if (!resolvedPnpmPath) {
    return
  }

  const pnpmHome = getPnpmHomeDir()
  fs.mkdirSync(pnpmHome, { recursive: true })

  logStepStart('ensure-pnpm-home-configured', { pnpmHome, pnpmPath: resolvedPnpmPath })
  const env = getPackageManagerEnv()
  await runCommand(resolvedPnpmPath, ['config', 'set', 'global-bin-dir', pnpmHome], env)
  await runCommand(resolvedPnpmPath, ['config', 'set', 'global-dir', join(pnpmHome, 'global')], env)
  logStepDone('ensure-pnpm-home-configured', { pnpmHome })
}

function buildRuntimePath(extraPath?: string) {
  const delimiter = process.platform === 'win32' ? ';' : ':'
  const rawSegments = [
    extraPath,
    ...(process.platform === 'win32' ? getWindowsRuntimePathCandidates() : []),
    getPathEnv(resolvedRuntimeEnv),
    getPathEnv(process.env)
  ]
    .filter(Boolean)
    .flatMap(value => value!.split(delimiter))
    .map(segment => segment.trim())
    .filter(Boolean)

  const seen = new Set<string>()
  const deduped = rawSegments.filter(segment => {
    const key = process.platform === 'win32' ? segment.toLowerCase() : segment
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })

  return deduped.join(delimiter)
}

function normalizeVersion(version: string | null) {
  if (!version) {
    return null
  }

  return coerce(version)?.version || null
}

function buildNodeVersionError(version: string | null, executablePath: string | null) {
  const detectedVersion = version || 'unknown'
  const detectedPath = executablePath || 'unknown'
  return `openclaw requires Node >=${OPENCLAW_REQUIRED_NODE_VERSION}. Detected: node ${detectedVersion} (exec: ${detectedPath}). Install Node: https://nodejs.org/en/download Upgrade Node and re-run openclaw.`
}

function getNvmCommandPath(command: string) {
  if (process.platform !== 'darwin') {
    return null
  }

  try {
    const versionsDir = join(os.homedir(), '.nvm', 'versions', 'node')
    if (!fs.existsSync(versionsDir)) {
      return null
    }

    const versions = fs.readdirSync(versionsDir)
      .filter(name => /^v\d+\.\d+\.\d+$/.test(name))
      .sort((left, right) => compare(left.replace(/^v/, ''), right.replace(/^v/, '')))

    for (let index = versions.length - 1; index >= 0; index -= 1) {
      const candidate = join(versionsDir, versions[index], 'bin', command)
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }
  } catch (error) {
    log.warn('Failed to inspect nvm directory:', error)
  }

  return null
}

async function tryUpgradeNodeWithManager(event: Electron.IpcMainInvokeEvent | null) {
  const mirrorEnv = getNodeMirrorEnv()

  if (process.platform === 'darwin') {
    const nvmInstalled = fs.existsSync(join(os.homedir(), '.nvm', 'nvm.sh'))
    if (nvmInstalled) {
      event && sendProgress(event, 'finalizing', 42, '检测到 nvm，正在升级 Node.js')
      await runShellCommand(
        `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; export NVM_NODEJS_ORG_MIRROR="${mirrorEnv.NVM_NODEJS_ORG_MIRROR || ''}"; nvm install ${OPENCLAW_REQUIRED_NODE_VERSION}; nvm alias default ${OPENCLAW_REQUIRED_NODE_VERSION}`,
        mirrorEnv
      )

      const runtime = await getRuntimeStatus()
      if (isNodeVersionSupported(runtime.commands.node.version)) {
        return true
      }
    }

    const nPath = await whichCommand('n')
    if (nPath) {
      event && sendProgress(event, 'finalizing', 46, '检测到 n，正在升级 Node.js')
      await runGlobalCommand(nPath, [OPENCLAW_REQUIRED_NODE_VERSION], mirrorEnv)

      const runtime = await getRuntimeStatus()
      if (isNodeVersionSupported(runtime.commands.node.version)) {
        return true
      }
    }
  }

  return false
}

async function runCommandAsAdministrator(command: string, args: string[], extraEnv: Record<string, string> = {}) {
  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    throw new Error('当前系统不支持自动请求管理员权限。')
  }

  const elevatedCommand = buildElevatedCommand(command, args, extraEnv)
  log.info('[ELEVATED START]', { command: elevatedCommand })

  return new Promise((resolve, reject) => {
    sudoPrompt.exec(
      elevatedCommand,
      { name: '小龙虾安装器' },
      (error, stdout, stderr) => {
        if (error) {
          log.error('[ELEVATED FAIL]', {
            command: elevatedCommand,
            stdout: summarizeOutput(stdout || ''),
            stderr: summarizeOutput(stderr || ''),
            message: error.message
          })
          reject(new Error((stderr || stdout || error.message).trim()))
          return
        }

        log.info('[ELEVATED DONE]', {
          command: elevatedCommand,
          stdout: summarizeOutput(stdout || ''),
          stderr: summarizeOutput(stderr || '')
        })
        resolve((stdout || stderr || '').trim())
      }
    )
  })
}

function buildShellCommand(command: string, args: string[], extraEnv: Record<string, string>) {
  const envAssignments = Object.entries({ ...extraEnv, PATH: buildRuntimePath(extraEnv.PATH) })
    .map(([key, value]) => `export ${key}=${shellQuote(value)}`)
    .join('; ')

  const commandPart = [command, ...args].map(shellQuote).join(' ')
  return [envAssignments, commandPart].filter(Boolean).join('; ')
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function quoteWindowsArgument(value: string) {
  if (!/[ \t"]/u.test(value)) {
    return value
  }

  return `"${value.replace(/"/g, '""')}"`
}

function buildElevatedCommand(command: string, args: string[], extraEnv: Record<string, string>) {
  const env = { ...extraEnv, PATH: buildRuntimePath(extraEnv.PATH) }

  if (process.platform === 'win32') {
    const envAssignments = Object.entries(env)
      .map(([key, value]) => `set "${key}=${value}"`)
      .join(' && ')
    const commandPart = [command, ...args].map(quoteWindowsArgument).join(' ')
    return [envAssignments, commandPart].filter(Boolean).join(' && ')
  }

  return buildShellCommand(command, args, env)
}
