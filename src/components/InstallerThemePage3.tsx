import '../styles/installer-theme3.css'

const steps = [
  {
    number: 'done',
    title: 'License Agreement',
    description: 'Review terms & conditions'
  },
  {
    number: '2',
    title: 'Installation Settings',
    description: 'Configure preferences',
    active: true
  },
  {
    number: '3',
    title: 'Installation Progress',
    description: 'Installing files'
  },
  {
    number: '4',
    title: 'Success',
    description: 'Ready to use'
  }
]

const shortcutItems = ['Desktop Shortcut', 'Start Menu Program Folder']

const componentItems = [
  { label: 'Core Files (Required)', disabled: true },
  { label: 'Example Templates (150 MB)' }
]

export default function InstallerThemePage3() {
  return (
    <div className="installer-theme3-shell">
      <section className="installer-theme3-frame">
        <aside className="installer-theme3-sidebar">
          <div className="installer-theme3-brand">
            <div className="installer-theme3-brand-mark">S</div>
            <div className="installer-theme3-brand-name">SoftwarePro</div>
          </div>

          <ol className="installer-theme3-steps">
            {steps.map((step, index) => (
              <li
                className={[
                  'installer-theme3-step',
                  step.active ? 'is-active' : '',
                  step.number === 'done' ? 'is-complete' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                key={step.title}
              >
                {index < steps.length - 1 ? <span className="installer-theme3-step-line" aria-hidden="true" /> : null}
                <span className="installer-theme3-step-badge">{step.number === 'done' ? '✓' : step.number}</span>
                <div className="installer-theme3-step-copy">
                  <div className="installer-theme3-step-title">{step.title}</div>
                  <div className="installer-theme3-step-text">{step.description}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="installer-theme3-version">v2.4.1 build 8920</div>
        </aside>

        <div className="installer-theme3-main">
          <header className="installer-theme3-header">
            <div>
              <h1>Installation Settings</h1>
              <p>Customize your installation preferences</p>
            </div>
            <button className="installer-theme3-language" type="button">
              <span className="installer-theme3-language-icon" aria-hidden="true">A</span>
              English
            </button>
          </header>

          <div className="installer-theme3-content">
            <section className="installer-theme3-section">
              <div className="installer-theme3-section-heading">
                <span className="installer-theme3-section-icon" aria-hidden="true">⌂</span>
                <h2>Install Location</h2>
              </div>

              <div className="installer-theme3-panel">
                <label className="installer-theme3-label" htmlFor="installer-theme3-path">
                  Destination Folder
                </label>
                <div className="installer-theme3-input-row">
                  <input
                    className="installer-theme3-input"
                    id="installer-theme3-path"
                    readOnly
                    value="C:\\Program Files\\SoftwarePro"
                  />
                  <button className="installer-theme3-ghost-btn" type="button">
                    Browse...
                  </button>
                </div>

                <div className="installer-theme3-divider" />

                <div className="installer-theme3-metrics">
                  <div className="installer-theme3-metric">
                    <span className="installer-theme3-metric-icon" aria-hidden="true">▣</span>
                    <span className="installer-theme3-metric-label">Space required:</span>
                    <strong>1.2 GB</strong>
                  </div>
                  <div className="installer-theme3-metric">
                    <span className="installer-theme3-metric-icon" aria-hidden="true">▤</span>
                    <span className="installer-theme3-metric-label">Space available:</span>
                    <strong className="is-success">45.8 GB</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="installer-theme3-section">
              <div className="installer-theme3-section-heading">
                <span className="installer-theme3-section-icon" aria-hidden="true">◉</span>
                <h2>Installation Scope</h2>
              </div>

              <div className="installer-theme3-options">
                <label className="installer-theme3-option-card is-selected">
                  <span className="installer-theme3-radio is-selected" aria-hidden="true" />
                  <span className="installer-theme3-option-copy">
                    <strong>Install for me only</strong>
                    <span>Installs only for the current user (John Doe)</span>
                  </span>
                </label>

                <label className="installer-theme3-option-card">
                  <span className="installer-theme3-radio" aria-hidden="true" />
                  <span className="installer-theme3-option-copy">
                    <strong>Install for all users</strong>
                    <span>Requires administrative privileges</span>
                  </span>
                </label>
              </div>
            </section>

            <section className="installer-theme3-section">
              <div className="installer-theme3-section-heading">
                <span className="installer-theme3-section-icon" aria-hidden="true">▤</span>
                <h2>Additional Options</h2>
              </div>

              <div className="installer-theme3-grid">
                <article className="installer-theme3-subpanel">
                  <h3>Shortcuts</h3>
                  <div className="installer-theme3-checklist">
                    {shortcutItems.map((item) => (
                      <label className="installer-theme3-check-item" key={item}>
                        <span className="installer-theme3-checkmark" aria-hidden="true">✓</span>
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </article>

                <article className="installer-theme3-subpanel">
                  <h3>Components</h3>
                  <div className="installer-theme3-checklist">
                    {componentItems.map((item) => (
                      <label
                        className={`installer-theme3-check-item ${item.disabled ? 'is-disabled' : ''}`}
                        key={item.label}
                      >
                        <span
                          className={`installer-theme3-checkmark ${item.disabled ? 'is-muted' : ''}`}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </article>
              </div>
            </section>
          </div>

          <footer className="installer-theme3-footer">
            <button className="installer-theme3-link-btn" type="button">
              Cancel
            </button>
            <div className="installer-theme3-footer-actions">
              <button className="installer-theme3-secondary-btn" type="button">
                Back
              </button>
              <button className="installer-theme3-primary-btn" type="button">
                Install
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </footer>
        </div>
      </section>
    </div>
  )
}
