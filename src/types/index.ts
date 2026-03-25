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

export interface ExistingInstall {
  exists: boolean
  path: string | null
  version: { version: string; installDate: string } | null
}
