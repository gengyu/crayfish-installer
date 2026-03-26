import { contextBridge, ipcRenderer } from 'electron'

export interface SystemInfo {
  platform: string
  arch: string
  osRelease: string
  osVersion: string
  totalMemory: string
  freeMemory: string
  cpus: number
  homedir: string
}

export interface ElectronAPI {
  getPlatform: () => Promise<SystemInfo>
  getDefaultInstallPath: () => Promise<string>
  checkExistingInstallation: () => Promise<{ exists: boolean; path: string | null; version: { version: string; installDate: string } | null }>
  checkDependencies: () => Promise<Record<string, boolean>>
  getRuntimeStatus: () => Promise<{
    node: { exists: boolean; path: string | null; version: string | null }
    npm: { exists: boolean; path: string | null; version: string | null }
    pnpm: { exists: boolean; path: string | null; version: string | null }
    openclaw: { exists: boolean; path: string | null; version: string | null }
    gatewayRunning: boolean
    registry: { npm: string | null; pnpm: string | null }
    mirrorRecommended: boolean
  }>
  checkDiskSpace: () => Promise<{ available: boolean; path: string }>
  selectInstallPath: () => Promise<string | null>
  installOpenClaw: (installPath: string) => Promise<{ success: boolean; error?: string; detail?: string; warning?: string; warningDetail?: string; attempts?: number; installPath?: string; version?: { version: string; installDate: string; platform: string; arch: string } }>
  uninstallOpenClaw: (installPath: string) => Promise<{ success: boolean; error?: string }>
  launchOpenClaw: (installPath: string) => Promise<{ success: boolean; error?: string }>
  openDirectory: (dirPath: string) => Promise<void>
  onInstallProgress: (callback: (data: { stage: string; progress: number; detail?: string }) => void) => void
  removeInstallProgressListener: () => void
}

const api: ElectronAPI = {
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getDefaultInstallPath: () => ipcRenderer.invoke('get-default-install-path'),
  checkExistingInstallation: () => ipcRenderer.invoke('check-existing-installation'),
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  getRuntimeStatus: () => ipcRenderer.invoke('get-runtime-status'),
  checkDiskSpace: () => ipcRenderer.invoke('check-disk-space'),
  selectInstallPath: () => ipcRenderer.invoke('select-install-path'),
  installOpenClaw: (installPath: string) => ipcRenderer.invoke('install-openclaw', installPath),
  uninstallOpenClaw: (installPath: string) => ipcRenderer.invoke('uninstall-openclaw', installPath),
  launchOpenClaw: (installPath: string) => ipcRenderer.invoke('launch-openclaw', installPath),
  openDirectory: (dirPath: string) => ipcRenderer.invoke('open-directory', dirPath),
  onInstallProgress: (callback) => {
    ipcRenderer.on('install-progress', (_: unknown, data: { stage: string; progress: number; detail?: string }) => callback(data))
  },
  removeInstallProgressListener: () => {
    ipcRenderer.removeAllListeners('install-progress')
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
