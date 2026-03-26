import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { fileURLToPath } from 'url'
import { basename, dirname, join } from 'path'
import { exec } from 'child_process'
import fs from 'fs'
import os from 'os'
import https from 'https'
import log from 'electron-log'
import { execa, execaCommand } from 'execa'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

log.initialize()

let mainWindow: BrowserWindow | null = null

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
  node: CommandCheckResult
  npm: CommandCheckResult
  pnpm: CommandCheckResult
  openclaw: CommandCheckResult
  registry: {
    npm: string | null
    pnpm: string | null
  }
  mirrorRecommended: boolean
}

interface InstallResult {
  success: boolean
  error?: string
  detail?: string
  attempts?: number
  version?: {
    version: string
    installDate: string
    platform: string
    arch: string
  }
}

const NODE_LTS_BASE_URL = 'https://nodejs.org/dist/latest-v22.x/'
const OPENCLAW_REQUIRED_NODE_VERSION = '22.16.0'
const CN_NODE_MIRROR = 'https://npmmirror.com/mirrors/node'
const NPM_REGISTRY = 'https://registry.npmmirror.com'

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

function createWindow() {
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
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
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

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
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
    exists: runtime.openclaw.exists,
    path: runtime.openclaw.path,
    version: runtime.openclaw.version ? {
      version: runtime.openclaw.version,
      installDate: new Date().toISOString()
    } : null
  }
})

ipcMain.handle('check-dependencies', async () => {
  const runtime = await getRuntimeStatus()
  return {
    node: runtime.node.exists,
    npm: runtime.npm.exists,
    pnpm: runtime.pnpm.exists,
    openclaw: runtime.openclaw.exists,
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

  while (attempts < 3) {
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

      if (attempts >= 3 || !isRecoverableInstallError(rawMessage)) {
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

    if (!runtime.node.exists) {
      logStepStart('install-node-missing')
      sendProgress(event, 'preparing', 14, '未检测到 Node.js，正在下载安装官方 Node.js')
      await installNodeJs(event)
      runtime = await getRuntimeStatus()
      logStepDone('install-node-missing', runtime.node)
    }

    if (!runtime.node.exists) {
      throw new Error('Node.js 自动安装未完成，请检查系统安装权限后重试。')
    }

    if (!isNodeVersionSupported(runtime.node.version)) {
      logStepStart('upgrade-node-version', runtime.node)
      sendProgress(event, 'preparing', 18, `检测到 Node.js 版本过低，正在升级到 ${OPENCLAW_REQUIRED_NODE_VERSION} 或更高版本`)
      await upgradeNodeJs(event, runtime)
      runtime = await getRuntimeStatus()
      logStepDone('upgrade-node-version', runtime.node)
    }

    if (!isNodeVersionSupported(runtime.node.version)) {
      throw new Error(`需要 Node.js >=${OPENCLAW_REQUIRED_NODE_VERSION}，自动升级没有完成。`)
    }

    if (!runtime.npm.exists) {
      throw new Error('未检测到 npm，当前 Node.js 环境不完整。请重新安装 Node.js。')
    }

    if (!runtime.pnpm.exists) {
      logStepStart('install-pnpm', { npm: runtime.npm.path })
      sendProgress(event, 'preparing', 18, '正在安装 pnpm')
      await runGlobalCommand(getCommandPath(runtime.npm, 'npm'), ['install', '-g', 'pnpm'], getPackageManagerEnv())
      logStepDone('install-pnpm')
    }

    logStepStart('verify-pnpm')
    const runtimeAfterPnpm = await getRuntimeStatus()
    if (!runtimeAfterPnpm.pnpm.exists) {
      throw new Error('pnpm 安装失败，请检查网络或全局安装权限。')
    }
    logStepDone('verify-pnpm', runtimeAfterPnpm.pnpm)

    logStepStart('configure-mirror')
    sendProgress(event, 'preparing', 32, '正在配置国内镜像，提高下载速度')
    await ensureMirrorConfigured()
    logStepDone('configure-mirror')

    logStepStart('install-openclaw-package', { pnpm: runtimeAfterPnpm.pnpm.path })
    sendProgress(event, 'downloading', 52, '正在通过 pnpm 全局安装 openclaw')
    await ensurePnpmHomeConfigured(runtimeAfterPnpm.pnpm.path)
    await runGlobalCommand(getCommandPath(runtimeAfterPnpm.pnpm, 'pnpm'), ['add', '-g', 'openclaw@latest'], getPackageManagerEnv())
    logStepDone('install-openclaw-package')

    logStepStart('run-openclaw-onboard')
    sendProgress(event, 'finalizing', 78, '正在执行 OpenClaw 初始化')
    const runtimeAfterInstallCommand = await getRuntimeStatus()
    await runCommand(
      getCommandPath(runtimeAfterInstallCommand.openclaw, 'openclaw'),
      getDefaultOnboardArgs(),
      getPackageManagerEnv()
    )
    logStepDone('run-openclaw-onboard')

    logStepStart('verify-openclaw')
    const runtimeAfterInstall = await getRuntimeStatus()
    if (!runtimeAfterInstall.openclaw.exists) {
      throw new Error('openclaw 命令未成功安装。')
    }
    logStepDone('verify-openclaw', runtimeAfterInstall.openclaw)

    sendProgress(event, 'completed', 100, '安装完成，openclaw 和 daemon 已准备就绪')
    return {
      success: true,
      version: {
        version: runtimeAfterInstall.openclaw.version || 'latest',
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

ipcMain.handle('uninstall-openclaw', async (event) => {
  try {
    logStepStart('uninstall-openclaw')
    const runtime = await getRuntimeStatus()
    if (!runtime.pnpm.exists) {
      throw new Error('未检测到 pnpm，无法执行一键卸载。')
    }

    sendProgress(event, 'uninstalling', 30, '正在通过 pnpm 卸载 openclaw')
    await ensurePnpmHomeConfigured(runtime.pnpm.path)
    await runGlobalCommand(getCommandPath(runtime.pnpm, 'pnpm'), ['remove', '-g', 'openclaw'], getPackageManagerEnv())

    sendProgress(event, 'uninstalling', 75, '如已安装 daemon，请按 openclaw 提示完成停用')
    sendProgress(event, 'uninstalling', 100, '卸载完成')
    logStepDone('uninstall-openclaw')
    return { success: true }
  } catch (error) {
    logStepFail('uninstall-openclaw', error)
    log.error('Uninstall failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
})

ipcMain.handle('launch-openclaw', async () => {
  try {
    logStepStart('launch-check')
    const runtime = await getRuntimeStatus()
    await runCommand(getCommandPath(runtime.openclaw, 'openclaw'), ['--help'])
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
  const [node, npm, pnpm, openclaw, npmRegistry, pnpmRegistry] = await Promise.all([
    getCommandStatus('node', ['--version']),
    getCommandStatus('npm', ['--version']),
    getCommandStatus('pnpm', ['--version']),
    getCommandStatus('openclaw', ['--version']),
    readRegistry('npm'),
    readRegistry('pnpm')
  ])

  const runtime = {
    node,
    npm,
    pnpm,
    openclaw,
    registry: {
      npm: npmRegistry,
      pnpm: pnpmRegistry
    },
    mirrorRecommended: isMirrorRecommended()
  }
  logStepDone('get-runtime-status', runtime)
  return runtime
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
  logStepStart('upgrade-nodejs', runtime.node)
  const upgradedWithManager = await tryUpgradeNodeWithManager(event)

  if (upgradedWithManager) {
    logStepDone('upgrade-nodejs', 'manager')
    return
  }

  sendProgress(event, 'finalizing', 40, '未检测到可用的 Node 版本管理工具，正在切换到官方安装器')
  await installNodeJs(event)

  const refreshedRuntime = await getRuntimeStatus()
  if (!isNodeVersionSupported(refreshedRuntime.node.version)) {
    throw new Error(buildNodeVersionError(refreshedRuntime.node.version, refreshedRuntime.node.path))
  }

  if (!runtime.node.path || refreshedRuntime.node.path !== runtime.node.path) {
    log.info('Node.js 已通过官方安装器升级:', refreshedRuntime.node.path, refreshedRuntime.node.version)
  }
  logStepDone('upgrade-nodejs', refreshedRuntime.node)
}

async function getCommandStatus(command: string, versionArgs: string[]): Promise<CommandCheckResult> {
  const path = await whichCommand(command)
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

function whichCommand(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    const locator = process.platform === 'win32' ? 'where' : 'which'
    exec(`${locator} ${command}`, (error, stdout) => {
      if (error || !stdout.trim()) {
        const fallback = getKnownCommandPath(command)
        resolve(fallback)
        return
      }

      const firstLine = stdout.split(/\r?\n/).find(Boolean)?.trim() || null
      resolve(normalizeCommandPath(firstLine, command))
    })
  })
}

function runCommand(command: string, args: string[], extraEnv: Record<string, string> = {}): Promise<string> {
  const env = {
    ...process.env,
    ...extraEnv,
    PATH: buildRuntimePath(extraEnv.PATH)
  }
  const displayCommand = [command, ...args].join(' ')

  log.info('[COMMAND START]', {
    command,
    args,
    displayCommand,
    path: env.PATH
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

function runShellCommand(command: string, extraEnv: Record<string, string> = {}): Promise<string> {
  const shellPath = process.platform === 'win32'
    ? (process.env.ComSpec || 'cmd.exe')
    : (process.env.SHELL || '/bin/zsh')
  const env = {
    ...process.env,
    ...extraEnv,
    PATH: buildRuntimePath(extraEnv.PATH)
  }

  log.info('[SHELL START]', {
    shellPath,
    command,
    path: env.PATH
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

function readRegistry(tool: 'npm' | 'pnpm'): Promise<string | null> {
  return new Promise((resolve) => {
    exec(`${tool} config get registry`, (error, stdout) => {
      if (error) {
        resolve(null)
        return
      }

      const value = stdout.trim()
      resolve(value && value !== 'undefined' ? value : null)
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
    const base = process.env['ProgramFiles'] || 'C:\\Program Files'
    const x86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
    const winCandidates: Record<string, string[]> = {
      node: [join(base, 'nodejs', 'node.exe'), join(x86, 'nodejs', 'node.exe')],
      npm: [join(base, 'nodejs', 'npm.cmd'), join(x86, 'nodejs', 'npm.cmd')],
      pnpm: [join(base, 'nodejs', 'pnpm.cmd'), join(x86, 'nodejs', 'pnpm.cmd')],
      openclaw: [join(base, 'nodejs', 'openclaw.cmd'), join(x86, 'nodejs', 'openclaw.cmd')]
    }

    return winCandidates[command]?.find(path => fs.existsSync(path)) || null
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
  if (!version) {
    return false
  }

  const normalized = normalizeSemver(version)
  if (!normalized) {
    return false
  }

  return compareVersions(normalized, OPENCLAW_REQUIRED_NODE_VERSION) >= 0
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
    'node.js 自动安装未完成',
    'openclaw 命令未成功安装',
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
    if (runtime.node.exists) {
      await tryUpgradeNodeWithManager(null)
    }
  }
}

function translateInstallError(message: string) {
  const lowered = message.toLowerCase()

  if (lowered.includes('eacces') || lowered.includes('permission denied') || lowered.includes('administrator privileges')) {
    return {
      userMessage: '需要系统权限才能继续安装，请在弹出的系统授权窗口中点击允许。',
      detail: message
    }
  }

  if (lowered.includes('econn') || lowered.includes('network') || lowered.includes('timed out') || lowered.includes('下载')) {
    return {
      userMessage: '网络连接异常，安装器已尝试自动修复镜像并重试。',
      detail: message
    }
  }

  if (lowered.includes('node.js')) {
    return {
      userMessage: `Node.js 版本不符合要求，安装器会尝试自动升级到 ${OPENCLAW_REQUIRED_NODE_VERSION} 或更高版本。`,
      detail: message
    }
  }

  if (lowered.includes('pnpm')) {
    return {
      userMessage: 'pnpm 安装或调用失败，请重试。',
      detail: message
    }
  }

  if (lowered.includes('openclaw')) {
    return {
      userMessage: 'OpenClaw 安装或初始化没有完成。',
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

function getDefaultOnboardArgs() {
  return [
    'onboard',
    '--non-interactive',
    '--accept-risk',
    '--mode',
    'local',
    '--auth-choice',
    'custom-api-key',
    '--custom-base-url',
    'http://127.0.0.1:1234/v1',
    '--custom-model-id',
    'minimax-m2.5-gs32',
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
  const pathSegments = [extraPath, process.env.PATH].filter(Boolean)
  return pathSegments.join(process.platform === 'win32' ? ';' : ':')
}

function normalizeSemver(version: string) {
  const matched = version.trim().match(/v?(\d+)\.(\d+)\.(\d+)/)
  if (!matched) {
    return null
  }

  return `${matched[1]}.${matched[2]}.${matched[3]}`
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)

  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (diff !== 0) {
      return diff
    }
  }

  return 0
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
      .sort((left, right) => compareVersions(left.replace(/^v/, ''), right.replace(/^v/, '')))

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
      if (isNodeVersionSupported(runtime.node.version)) {
        return true
      }
    }

    const nPath = await whichCommand('n')
    if (nPath) {
      event && sendProgress(event, 'finalizing', 46, '检测到 n，正在升级 Node.js')
      await runGlobalCommand(nPath, [OPENCLAW_REQUIRED_NODE_VERSION], mirrorEnv)

      const runtime = await getRuntimeStatus()
      if (isNodeVersionSupported(runtime.node.version)) {
        return true
      }
    }
  }

  return false
}

async function runCommandAsAdministrator(command: string, args: string[], extraEnv: Record<string, string> = {}) {
  if (process.platform === 'darwin') {
    const shellCommand = buildShellCommand(command, args, extraEnv)
    const script = `do shell script "${escapeAppleScriptString(shellCommand)}" with administrator privileges`
    return runCommand('osascript', ['-e', script], extraEnv)
  }

  if (process.platform === 'win32') {
    const powerShellScript = [
      '$envMap = @{',
      ...Object.entries({ ...extraEnv, PATH: buildRuntimePath(extraEnv.PATH) }).map(([key, value]) => `  '${escapePowerShellSingleQuoted(key)}'='${escapePowerShellSingleQuoted(value)}'`),
      '}',
      `$psi = New-Object System.Diagnostics.ProcessStartInfo`,
      `$psi.FileName = '${escapePowerShellSingleQuoted(command)}'`,
      `$psi.Arguments = '${escapePowerShellSingleQuoted(args.map(escapeWindowsArgument).join(' '))}'`,
      `$psi.Verb = 'runas'`,
      `$psi.UseShellExecute = $true`,
      'foreach ($entry in $envMap.GetEnumerator()) { [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process") }',
      '$process = [System.Diagnostics.Process]::Start($psi)',
      '$process.WaitForExit()',
      'if ($process.ExitCode -ne 0) { exit $process.ExitCode }'
    ].join('; ')

    return runCommand('powershell.exe', ['-NoProfile', '-Command', powerShellScript], extraEnv)
  }

  throw new Error('当前系统不支持自动请求管理员权限。')
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

function escapeAppleScriptString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function escapePowerShellSingleQuoted(value: string) {
  return value.replace(/'/g, "''")
}

function escapeWindowsArgument(value: string) {
  if (!/[ \t"]/u.test(value)) {
    return value
  }

  return `"${value.replace(/"/g, '\\"')}"`
}
