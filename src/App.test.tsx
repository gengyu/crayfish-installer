import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/Installer', () => ({
  default: ({ existingInstall, onInstallationChanged, onBackToSettings }: {
    existingInstall: { exists: boolean } | null
    onInstallationChanged: () => void
    onBackToSettings?: () => void
  }) => (
    <div>
      <div>Installer Mock: {existingInstall?.exists ? 'installed' : 'empty'}</div>
      <button onClick={onInstallationChanged} type="button">refresh-installation</button>
      {onBackToSettings ? <button onClick={onBackToSettings} type="button">back-to-settings</button> : null}
    </div>
  )
}))

vi.mock('./components/OpenClawSettingsPage', () => ({
  default: ({ existingInstall, onGoToInstaller }: {
    existingInstall: { path: string | null } | null
    onGoToInstaller: () => void
  }) => (
    <div>
      <div>Settings Mock: {existingInstall?.path || 'unknown'}</div>
      <button onClick={onGoToInstaller} type="button">go-to-installer</button>
    </div>
  )
}))

describe('App', () => {
  beforeEach(() => {
    window.electronAPI = {
      getPlatform: vi.fn().mockResolvedValue({
        platform: 'darwin',
        arch: 'arm64',
        osRelease: '24.4.0',
        osVersion: '15.4',
        totalMemory: '16 GB',
        freeMemory: '8 GB',
        cpus: 8,
        homedir: '/Users/tester'
      }),
      getDefaultInstallPath: vi.fn(),
      checkExistingInstallation: vi.fn(),
      checkDependencies: vi.fn(),
      getRuntimeStatus: vi.fn(),
      checkDiskSpace: vi.fn(),
      selectInstallPath: vi.fn(),
      installOpenClaw: vi.fn(),
      uninstallOpenClaw: vi.fn(),
      launchOpenClaw: vi.fn(),
      openDirectory: vi.fn(),
      getOpenClawSettings: vi.fn(),
      getLocalModelDiscovery: vi.fn(),
      testOpenClawModelConnection: vi.fn(),
      saveOpenClawSettings: vi.fn(),
      getOpenClawPluginPresets: vi.fn(),
      applyOpenClawPluginPreset: vi.fn(),
      installOpenClawPluginPreset: vi.fn(),
      openOpenClawControlUi: vi.fn(),
      exportOpenClawAgentBundle: vi.fn(),
      importOpenClawAgentBundle: vi.fn(),
      onInstallProgress: vi.fn(),
      removeInstallProgressListener: vi.fn()
    }
  })

  it('shows installer view and platform footer when no install exists', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    vi.mocked(window.electronAPI.checkExistingInstallation).mockResolvedValue({
      exists: false,
      path: null,
      version: null
    })

    render(<App />)

    expect(await screen.findByText('Installer Mock: empty')).toBeInTheDocument()
    expect(await screen.findByText('平台: darwin (arm64) - 16 GB 内存')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '查看 OpenClaw 项目源码' }))
    expect(openSpy).toHaveBeenCalledWith('https://github.com/openclaw/openclaw', '_blank')
  })

  it('switches from settings view back to installer when refreshed install disappears', async () => {
    const user = userEvent.setup()
    vi.mocked(window.electronAPI.checkExistingInstallation)
      .mockResolvedValueOnce({
        exists: true,
        path: '/Applications/OpenClaw',
        version: { version: '1.2.3', installDate: '2026-03-26' }
      })
      .mockResolvedValueOnce({
        exists: false,
        path: null,
        version: null
      })

    render(<App />)

    expect(await screen.findByText('Settings Mock: /Applications/OpenClaw')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'go-to-installer' }))
    expect(screen.getByText('Installer Mock: installed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'back-to-settings' }))
    expect(screen.getByText('Settings Mock: /Applications/OpenClaw')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'go-to-installer' }))

    await user.click(screen.getByRole('button', { name: 'refresh-installation' }))

    await waitFor(() => {
      expect(screen.getByText('Installer Mock: empty')).toBeInTheDocument()
    })
  })
})
