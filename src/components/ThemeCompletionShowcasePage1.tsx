import '../styles/theme-completion-showcase1.css'

const steps = [
  {
    state: 'complete',
    title: 'License Agreement',
    description: 'Review terms & conditions'
  },
  {
    state: 'complete',
    title: 'Installation Settings',
    description: 'Configure preferences'
  },
  {
    state: 'complete',
    title: 'Installation Progress',
    description: 'Installing files'
  },
  {
    state: 'current',
    title: 'Success',
    description: 'Ready to use',
    index: '4'
  }
] as const

const summaryItems = [
  { label: 'Install Location:', value: 'C:\\Program Files\\SoftwarePro' },
  { label: 'Version Installed:', value: 'v2.4.1 (Build 8920)' },
  { label: 'Space Used:', value: '450 MB' }
]

const resourceLinks = [
  { label: 'View Documentation', icon: 'book' },
  { label: 'Release Notes', icon: 'file' }
] as const

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="completion-theme-icon" viewBox="0 0 24 24">
      <path d="M5 12.5 9.2 16.7 19 7.5" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg aria-hidden="true" className="completion-theme-link-icon" viewBox="0 0 24 24">
      <path d="M4.5 6.5c0-1.1.9-2 2-2h5v14h-5a2 2 0 0 0-2 2Z" />
      <path d="M19.5 6.5c0-1.1-.9-2-2-2h-5v14h5a2 2 0 0 1 2 2Z" />
      <path d="M11.5 4.5h1" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg aria-hidden="true" className="completion-theme-link-icon" viewBox="0 0 24 24">
      <path d="M8 3.5h5.8L18.5 8v12a.5.5 0 0 1-.5.5H8A2.5 2.5 0 0 1 5.5 18V6A2.5 2.5 0 0 1 8 3.5Z" />
      <path d="M13.5 3.5V8H18" />
      <path d="M8.5 12h7" />
      <path d="M8.5 15.5h7" />
    </svg>
  )
}

function LinkIcon({ icon }: { icon: 'book' | 'file' }) {
  return icon === 'book' ? <BookIcon /> : <FileIcon />
}

export default function ThemeCompletionShowcasePage1() {
  return (
    <div className="completion-theme-shell">
      <section className="completion-theme-frame">
        <aside className="completion-theme-sidebar">
          <div className="completion-theme-brand">
            <div className="completion-theme-brand-mark">S</div>
            <div className="completion-theme-brand-name">SoftwarePro</div>
          </div>

          <ol className="completion-theme-steps">
            {steps.map((step, index) => (
              <li
                className={[
                  'completion-theme-step',
                  step.state === 'complete' ? 'is-complete' : '',
                  step.state === 'current' ? 'is-current' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                key={step.title}
              >
                {index < steps.length - 1 ? <span aria-hidden="true" className="completion-theme-step-line" /> : null}
                <span className="completion-theme-step-badge">
                  {step.state === 'complete' ? <CheckIcon /> : step.index}
                </span>
                <div className="completion-theme-step-copy">
                  <div className="completion-theme-step-title">{step.title}</div>
                  <div className="completion-theme-step-text">{step.description}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="completion-theme-version">v2.4.1 build 8920</div>
        </aside>

        <div className="completion-theme-main">
          <header className="completion-theme-header">
            <div>
              <h1>Installation Complete</h1>
              <p>SoftwarePro has been successfully installed.</p>
            </div>
          </header>

          <div className="completion-theme-content">
            <section className="completion-theme-success">
              <div className="completion-theme-success-badge" aria-hidden="true">
                <CheckIcon />
              </div>

              <div className="completion-theme-success-copy">
                <h2>Ready to Go!</h2>
                <p>
                  SoftwarePro v2.4.1 has been successfully installed on your system.
                  <br />
                  You can now start using the application.
                </p>
              </div>

              <section className="completion-theme-summary">
                <h3>Installation Summary</h3>
                <div className="completion-theme-summary-list">
                  {summaryItems.map((item) => (
                    <div className="completion-theme-summary-row" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <label className="completion-theme-launch">
                <input defaultChecked type="checkbox" />
                <span aria-hidden="true" className="completion-theme-launch-check">
                  <CheckIcon />
                </span>
                <span>Launch SoftwarePro now</span>
              </label>

              <div className="completion-theme-links">
                {resourceLinks.map((item, index) => (
                  <div className="completion-theme-link-wrap" key={item.label}>
                    {index > 0 ? <span aria-hidden="true" className="completion-theme-link-separator" /> : null}
                    <button className="completion-theme-resource-link" type="button">
                      <LinkIcon icon={item.icon} />
                      <span>{item.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <footer className="completion-theme-footer">
            <button className="completion-theme-primary-btn" type="button">
              <span>Finish</span>
              <CheckIcon />
            </button>
          </footer>
        </div>
      </section>
    </div>
  )
}
