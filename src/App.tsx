import { useState, useEffect } from 'react'
import type { ExistingInstall, SystemInfo } from './types'
import Installer from './components/Installer'
import OpenClawSettingsPage from './components/OpenClawSettingsPage'

function App() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [existingInstall, setExistingInstall] = useState<ExistingInstall | null>(null)
  const [showInstallerView, setShowInstallerView] = useState(false)

  const refreshInstallation = () => {
    window.electronAPI.checkExistingInstallation().then((nextInstall: ExistingInstall) => {
      setExistingInstall(nextInstall)

      if (!nextInstall.exists) {
        setShowInstallerView(false)
      }
    })
  }

  useEffect(() => {
    window.electronAPI.getPlatform().then(setSystemInfo)
    refreshInstallation()
  }, [])

  const platformDisplay = systemInfo 
    ? `${systemInfo.platform} (${systemInfo.arch}) - ${systemInfo.totalMemory} 内存`
    : '检测中...'

  const showSettings = Boolean(existingInstall?.exists) && !showInstallerView

  return (
    showSettings ? (
      <OpenClawSettingsPage
        existingInstall={existingInstall}
        onGoToInstaller={() => setShowInstallerView(true)}
      />
    ) : (
      <div className="relative flex min-h-screen flex-col pt-14">
        <div className="window-drag fixed inset-x-0 top-0 z-20 h-14 pl-20" />
        <main className="flex flex-1 items-center justify-center p-4">
          <Installer
            systemInfo={systemInfo}
            existingInstall={existingInstall}
            onInstallationChanged={refreshInstallation}
            onBackToSettings={existingInstall?.exists ? () => setShowInstallerView(false) : undefined}
          />
        </main>
        <footer className="px-4 pb-3 text-center text-xs text-slate-500">
          <p>平台: {platformDisplay}</p>
          <p>
            <a 
              href="#" 
              className="window-no-drag text-slate-600 transition hover:underline"
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
  )
}

export default App
