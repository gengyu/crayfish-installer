import { contextBridge, ipcRenderer } from 'electron'
import type {
  LocalModelDiscoveryResult,
  OpenClawAgentBundleResult,
  OpenClawModelConnectionResult,
  OpenClawPluginPreset,
  OpenClawSettings,
  OpenClawUninstallResult,
  OpenClawUninstallOptions
} from '../src/types'

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
  }>
  checkDiskSpace: () => Promise<{ available: boolean; path: string }>
  selectInstallPath: () => Promise<string | null>
  installOpenClaw: (installPath: string) => Promise<{ success: boolean; error?: string; detail?: string; warning?: string; warningDetail?: string; attempts?: number; installPath?: string; version?: { version: string; installDate: string; platform: string; arch: string } }>
  uninstallOpenClaw: (payload: { installPath: string; options: OpenClawUninstallOptions }) => Promise<OpenClawUninstallResult>
  launchOpenClaw: (installPath: string) => Promise<{ success: boolean; error?: string }>
  openDirectory: (dirPath: string) => Promise<void>
  getOpenClawSettings: () => Promise<OpenClawSettings>
  getLocalModelDiscovery: () => Promise<LocalModelDiscoveryResult>
  testOpenClawModelConnection: (settings: OpenClawSettings) => Promise<OpenClawModelConnectionResult>
  saveOpenClawSettings: (settings: OpenClawSettings) => Promise<{ success: boolean; configPath: string }>
  getOpenClawPluginPresets: () => Promise<OpenClawPluginPreset[]>
  applyOpenClawPluginPreset: (presetId: string) => Promise<{ success: boolean; configPath: string }>
  installOpenClawPluginPreset: (presetId: string) => Promise<{ success: boolean; message: string }>
  openOpenClawControlUi: () => Promise<{ success: boolean; url: string }>
  exportOpenClawAgentBundle: (payload: { name: string; description: string }) => Promise<OpenClawAgentBundleResult>
  importOpenClawAgentBundle: () => Promise<OpenClawAgentBundleResult>
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
  uninstallOpenClaw: (payload: { installPath: string; options: OpenClawUninstallOptions }) => ipcRenderer.invoke('uninstall-openclaw', payload),
  launchOpenClaw: (installPath: string) => ipcRenderer.invoke('launch-openclaw', installPath),
  openDirectory: (dirPath: string) => ipcRenderer.invoke('open-directory', dirPath),
  getOpenClawSettings: () => ipcRenderer.invoke('get-openclaw-settings'),
  getLocalModelDiscovery: () => ipcRenderer.invoke('get-local-model-discovery'),
  testOpenClawModelConnection: (settings: OpenClawSettings) => ipcRenderer.invoke('test-openclaw-model-connection', settings),
  saveOpenClawSettings: (settings: OpenClawSettings) => ipcRenderer.invoke('save-openclaw-settings', settings),
  getOpenClawPluginPresets: () => ipcRenderer.invoke('get-openclaw-plugin-presets'),
  applyOpenClawPluginPreset: (presetId: string) => ipcRenderer.invoke('apply-openclaw-plugin-preset', presetId),
  installOpenClawPluginPreset: (presetId: string) => ipcRenderer.invoke('install-openclaw-plugin-preset', presetId),
  openOpenClawControlUi: () => ipcRenderer.invoke('open-openclaw-control-ui'),
  exportOpenClawAgentBundle: (payload: { name: string; description: string }) => ipcRenderer.invoke('export-openclaw-agent-bundle', payload),
  importOpenClawAgentBundle: () => ipcRenderer.invoke('import-openclaw-agent-bundle'),
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
