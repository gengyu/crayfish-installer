import { useState } from 'react'
import '../styles/theme-showcase.css'

const steps = [
  { number: 1, title: 'License Agreement', description: 'Review terms & conditions', active: true },
  { number: 2, title: 'Installation Settings', description: 'Configure preferences' },
  { number: 3, title: 'Installation Progress', description: 'Installing files' },
  { number: 4, title: 'Success', description: 'Ready to use' }
]

export default function ThemeShowcasePage() {
  const [accepted, setAccepted] = useState(false)

  return (
    <div className="theme-demo-shell">
      <section className="theme-demo-frame">
        <aside className="theme-demo-sidebar">
          <div className="theme-demo-brand">
            <div className="theme-demo-brand-mark">S</div>
            <div className="theme-demo-brand-name">SoftwarePro</div>
          </div>

          <ol className="theme-demo-steps">
            {steps.map((step, index) => (
              <li className={`theme-demo-step ${step.active ? 'is-active' : ''}`} key={step.number}>
                {index < steps.length - 1 ? <span className="theme-demo-step-line" aria-hidden="true" /> : null}
                <span className="theme-demo-step-badge">{step.number}</span>
                <div className="theme-demo-step-copy">
                  <div className="theme-demo-step-title">{step.title}</div>
                  <div className="theme-demo-step-text">{step.description}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="theme-demo-version">v2.4.1 build 8920</div>
        </aside>

        <div className="theme-demo-main">
          <header className="theme-demo-header">
            <h1>End User License Agreement</h1>
            <button className="theme-demo-language" type="button">
              <span className="theme-demo-language-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
                  <path d="M7 9.5h4M9 9.5v5M7.5 12h3" />
                  <path d="M14 9.5h3.5M15 14.5h1.5M13.75 13c1.4-.42 2.54-1.5 3-2.9M14.5 10.1c.38 1.35 1.27 2.42 2.5 3" />
                </svg>
              </span>
              English
            </button>
          </header>

          <div className="theme-demo-content">
            <p className="theme-demo-intro">
              Please read the following license agreement carefully before proceeding with the installation.
            </p>

            <article className="theme-demo-card">
              <h2>SOFTWAREPRO END USER LICENSE AGREEMENT</h2>

              <p>
                IMPORTANT - READ CAREFULLY: This End User License Agreement (&quot;EULA&quot;) is a legal
                agreement between you (either an individual or a single entity) and SoftwarePro Inc. for
                the software product identified above, which includes computer software and may include
                associated media, printed materials, and &quot;online&quot; or electronic documentation
                (&quot;SOFTWARE PRODUCT&quot;).
              </p>

              <h3>1. GRANT OF LICENSE.</h3>
              <p>
                SoftwarePro grants you the following rights provided that you comply with all terms and
                conditions of this EULA: Installation and Use. You may install and use a copy of the
                SOFTWARE PRODUCT on your personal computer or other device.
              </p>

              <h3>2. DESCRIPTION OF OTHER RIGHTS AND LIMITATIONS.</h3>
              <p>
                - Limitations on Reverse Engineering, Decompilation, and Disassembly. You may not reverse
                engineer, decompile, or disassemble the SOFTWARE PRODUCT.
              </p>
              <p>
                - Separation of Components. The SOFTWARE PRODUCT is licensed as a single product. Its
                component parts may not be separated for use on more than one device.
              </p>
              <p>
                - Termination. Without prejudice to any other rights, SoftwarePro may terminate this EULA
                if you fail to comply with the terms and conditions of this EULA.
              </p>

              <h3>3. COPYRIGHT.</h3>
              <p>
                All title and copyrights in and to the SOFTWARE PRODUCT, the accompanying printed
                materials, and any copies of the SOFTWARE PRODUCT are owned by SoftwarePro or its
                suppliers.
              </p>

              <div className="theme-demo-updated">Last updated: October 2023</div>
            </article>

            <label className="theme-demo-checkbox">
              <input
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                type="checkbox"
              />
              <span className="theme-demo-checkbox-mark" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="m3.5 8.2 2.6 2.6 6-6" />
                </svg>
              </span>
              <span>I have read and agree to the terms of the End User License Agreement</span>
            </label>
          </div>

          <footer className="theme-demo-footer">
            <button className="theme-demo-link-btn" type="button">Cancel</button>
            <div className="theme-demo-footer-actions">
              <button className="theme-demo-secondary-btn" type="button">Back</button>
              <button className="theme-demo-primary-btn" disabled={!accepted} type="button">Next</button>
            </div>
          </footer>
        </div>
      </section>
    </div>
  )
}
