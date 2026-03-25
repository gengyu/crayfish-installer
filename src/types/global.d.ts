import { ElectronAPI, SystemInfo } from '../electron/preload'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export { SystemInfo }
