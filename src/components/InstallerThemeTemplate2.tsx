import { useState } from 'react'
import '../styles/installer-theme-template2.css'

type StepState = 'complete' | 'current' | 'upcoming'

interface StepItem {
  number: number
  title: string
  description: string
  state: StepState
}

const steps: StepItem[] = [
  { number: 1, title: 'License Agreement', description: 'Review terms and conditions', state: 'complete' },
  { number: 2, title: 'Installation Settings', description: 'Configure destination and runtime', state: 'complete' },
  { number: 3, title: 'Installation Progress', description: 'Installing core files', state: 'current' },
  { number: 4, title: 'Success', description: 'Ready to launch', state: 'upcoming' }
]

const logs = [
  '[10:45:01] Starting installation process...',
  '[10:45:02] Verifying system requirements... OK',
  '[10:45:05] Creating directory C:\\Program Files\\Crayfish...',
  '[10:45:06] Extracting package assets...',
  '[10:45:10] Copying runtime: webview2-loader.dll',
  '[10:45:16] Copying bundle: crayfish-core.pkg',
  '[10:45:18] Copying module: gateway-service.node',
  '[10:45:21] Copying file: core.dll (145.2 MB)...'
]

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 8.3 6.4 11l6-6.4" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.53 2.75h2.94l.58 2.43a7.57 7.57 0 0 1 1.85.77l2.13-1.28 2.08 2.08-1.28 2.13c.32.59.58 1.21.77 1.85l2.43.58v2.94l-2.43.58a7.57 7.57 0 0 1-.77 1.85l1.28 2.13-2.08 2.08-2.13-1.28a7.57 7.57 0 0 1-1.85.77l-.58 2.43h-2.94l-.58-2.43a7.57 7.57 0 0 1-1.85-.77l-2.13 1.28-2.08-2.08 1.28-2.13a7.57 7.57 0 0 1-.77-1.85l-2.43-.58v-2.94l2.43-.58c.19-.64.45-1.26.77-1.85L3.5 6.75l2.08-2.08 2.13 1.28c.59-.32 1.21-.58 1.85-.77l.97-2.43Z" />
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
    </svg>
  )
}

function DownloadCloudIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.5 18a4.5 4.5 0 0 1-.27-8.99A5.75 5.75 0 0 1 18.2 8.3 3.75 3.75 0 1 1 18 18H7.5Z" />
      <path d="M12 8.6v6.8" />
      <path d="m9.4 12.9 2.6 2.7 2.6-2.7" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 5.8v4.6l3 1.8" />
    </svg>
  )
}

function HourglassIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 3.5h10" />
      <path d="M5 16.5h10" />
      <path d="M6 3.5c0 3 1.9 4.2 4 5.7 2.1-1.5 4-2.7 4-5.7" />
      <path d="M6 16.5c0-3 1.9-4.2 4-5.7 2.1 1.5 4 2.7 4 5.7" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={open ? 'is-open' : ''} viewBox="0 0 16 16" aria-hidden="true">
      <path d="m6 3.5 4 4.5-4 4.5" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h10" />
      <path d="m9 4 4 4-4 4" />
    </svg>
  )
}

function StepBadge({ step }: { step: StepItem }) {
  if (step.state === 'complete') {
    return (
      <span className="installer-theme2-step-badge is-complete">
        <CheckIcon />
      </span>
    )
  }

  return (
    <span className={`installer-theme2-step-badge ${step.state === 'current' ? 'is-current' : 'is-upcoming'}`}>
      {step.number}
    </span>
  )
}

export default function InstallerThemeTemplate2() {
  const [showDetails, setShowDetails] = useState(true)
  const progress = 45

  return (
    <div className="installer-theme2-shell">
      <section className="installer-theme2-frame">
        <aside className="installer-theme2-sidebar">
          <div className="installer-theme2-brand">
            <div className="installer-theme2-brand-mark">C</div>
            <div className="installer-theme2-brand-name">Crayfish</div>
          </div>

          <ol className="installer-theme2-steps">
            {steps.map((step, index) => (
              <li
                className={`installer-theme2-step installer-theme2-step-${step.state}`}
                key={step.number}
              >
                {index < steps.length - 1 ? <span className="installer-theme2-step-line" aria-hidden="true" /> : null}
                <StepBadge step={step} />
                <div className="installer-theme2-step-copy">
                  <div className="installer-theme2-step-title">{step.title}</div>
                  <div className="installer-theme2-step-text">{step.description}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="installer-theme2-version">v2.4.1 build 8920</div>
        </aside>

        <div className="installer-theme2-main">
          <header className="installer-theme2-header">
            <div>
              <h1>Installing Crayfish</h1>
              <p>Please wait while the installation completes.</p>
            </div>
            <button className="installer-theme2-icon-btn" type="button" aria-label="Settings">
              <GearIcon />
            </button>
          </header>

          <div className="installer-theme2-content">
            <div className="installer-theme2-status-orbit" aria-hidden="true">
              <div className="installer-theme2-status-ring" />
              <div className="installer-theme2-status-core">
                <DownloadCloudIcon />
              </div>
            </div>

            <section className="installer-theme2-progress-panel">
              <div className="installer-theme2-progress-head">
                <div>
                  <h2>Copying core files...</h2>
                  <p>C:\Program Files\Crayfish\bin\core.dll</p>
                </div>
                <strong>{progress}%</strong>
              </div>

              <div className="installer-theme2-progress-track" aria-label={`Installation progress ${progress}%`}>
                <div className="installer-theme2-progress-fill" style={{ width: `${progress}%` }} />
              </div>

              <div className="installer-theme2-progress-meta">
                <div className="installer-theme2-meta-item">
                  <ClockIcon />
                  <span>Elapsed: 00:01:24</span>
                </div>
                <div className="installer-theme2-meta-item">
                  <HourglassIcon />
                  <span>Remaining: ~00:02:10</span>
                </div>
              </div>

              <div className="installer-theme2-divider" />

              <button
                className="installer-theme2-detail-toggle"
                onClick={() => setShowDetails((value) => !value)}
                type="button"
              >
                <ChevronIcon open={showDetails} />
                <span>{showDetails ? 'Hide Details' : 'Show Details'}</span>
              </button>

              {showDetails ? (
                <div className="installer-theme2-log" role="log" aria-live="polite">
                  {logs.map((line, index) => (
                    <div className={index === logs.length - 1 ? 'is-highlight' : ''} key={line}>
                      {line}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <footer className="installer-theme2-footer">
            <button className="installer-theme2-link-btn" type="button">
              Cancel
            </button>
            <div className="installer-theme2-footer-actions">
              <button className="installer-theme2-secondary-btn" disabled type="button">
                Back
              </button>
              <button className="installer-theme2-primary-btn" disabled type="button">
                <span>Next</span>
                <ArrowRightIcon />
              </button>
            </div>
          </footer>
        </div>
      </section>
    </div>
  )
}
