import { useState, useEffect } from 'react'
import type { SystemInfo } from './types'
import Installer from './components/Installer'

function App() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [existingInstall, setExistingInstall] = useState<{ exists: boolean; path: string | null; version: { version: string; installDate: string } | null } | null>(null)

  const refreshInstallation = () => {
    window.electronAPI.checkExistingInstallation().then(setExistingInstall)
  }

  useEffect(() => {
    window.electronAPI.getPlatform().then(setSystemInfo)
    refreshInstallation()
  }, [])

  const platformDisplay = systemInfo 
    ? `${systemInfo.platform} (${systemInfo.arch}) - ${systemInfo.totalMemory} 内存`
    : '检测中...'

  return (
    <div className="app">
      <main>
        <Installer systemInfo={systemInfo} existingInstall={existingInstall} onInstallationChanged={refreshInstallation} />
      </main>
      <footer className="app-footer">
        <p>平台: {platformDisplay}</p>
        <p>
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault()
              window.open('https://github.com/openclaw/openclaw', '_blank')
            }}
          >
            查看 OpenClaw 项目源码
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App
