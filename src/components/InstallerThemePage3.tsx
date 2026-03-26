const steps = [
  { badge: '✓', title: 'License Agreement', description: 'Review terms & conditions', state: 'complete' },
  { badge: '2', title: 'Installation Settings', description: 'Configure preferences', state: 'current' },
  { badge: '3', title: 'Installation Progress', description: 'Installing files', state: 'upcoming' },
  { badge: '4', title: 'Success', description: 'Ready to use', state: 'upcoming' }
] as const

const shortcutItems = ['Desktop Shortcut', 'Start Menu Program Folder']
const componentItems = [
  { label: 'Core Files (Required)', disabled: true },
  { label: 'Example Templates (150 MB)', disabled: false }
] as const

function CheckIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 16 16" aria-hidden="true">
      <path d="m3.5 8.2 2.6 2.6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LanguageIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9.5h4M9 9.5v5M7.5 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 9.5h3.5M15 14.5h1.5M13.75 13c1.4-.42 2.54-1.5 3-2.9M14.5 10.1c.38 1.35 1.27 2.42 2.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h4l1.5 1.5H18.5A2.5 2.5 0 0 1 21 10v7.5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function ScopeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  )
}

function BoxIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export default function InstallerThemePage3() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 p-4 sm:p-6 lg:p-8">
      <section className="flex min-h-[600px] w-full max-w-[1000px] flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-xl md:flex-row">
        <aside className="flex w-full flex-col border-b border-brand-200 bg-brand-50 p-6 md:w-64 md:border-b-0 md:border-r md:p-8">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-900 text-sm font-bold text-white">S</div>
            <span className="text-lg font-bold text-brand-900">SoftwarePro</span>
          </div>

          <ol className="flex-1 space-y-6">
            {steps.map((step, index) => {
              const isComplete = step.state === 'complete'
              const isCurrent = step.state === 'current'

              return (
                <li className="relative flex items-start" key={step.title}>
                  {index < steps.length - 1 ? (
                    <div className={`absolute bottom-[-24px] left-[11px] top-7 w-[2px] ${isComplete ? 'bg-brand-900' : 'bg-brand-200'}`} />
                  ) : null}
                  <div
                    className={`z-10 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs ring-4 ring-brand-50 ${
                      isComplete || isCurrent
                        ? 'bg-brand-900 text-white'
                        : 'border-2 border-brand-300 bg-white text-brand-400'
                    }`}
                  >
                    {isComplete ? <CheckIcon /> : step.badge}
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm ${isCurrent ? 'font-bold text-brand-900' : isComplete ? 'font-semibold text-brand-900' : 'font-medium text-brand-500'}`}>
                      {step.title}
                    </p>
                    <p className={`mt-1 text-xs ${isComplete || isCurrent ? 'text-brand-500' : 'text-brand-400'}`}>
                      {step.description}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="mt-auto pt-8 text-xs text-brand-400">v2.4.1 build 8920</div>
        </aside>

        <div className="flex flex-1 flex-col bg-white">
          <header className="flex items-center justify-between border-b border-brand-100 bg-white px-8 py-6">
            <div>
              <h1 className="text-xl font-bold text-brand-900">Installation Settings</h1>
              <p className="mt-1 text-sm text-brand-500">Customize your installation preferences</p>
            </div>
            <button className="inline-flex items-center gap-2 text-sm text-brand-400 transition hover:text-brand-600" type="button">
              <LanguageIcon />
              <span>English</span>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-8">
            <form className="space-y-8">
              <section className="space-y-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-brand-900">
                  <span className="text-brand-500"><FolderIcon /></span>
                  <span>Install Location</span>
                </h2>

                <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                  <label className="mb-2 block text-sm font-medium text-brand-700" htmlFor="installer-path">
                    Destination Folder
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-md border border-brand-300 bg-white px-3 py-2 text-sm text-brand-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      id="installer-path"
                      readOnly
                      value="C:\\Program Files\\SoftwarePro"
                    />
                    <button className="rounded-md border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-brand-700 shadow-sm transition hover:bg-brand-50 hover:text-brand-900" type="button">
                      Browse...
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col gap-4 border-t border-brand-200 pt-3 text-sm sm:flex-row sm:gap-8">
                    <div className="flex items-center gap-2 text-brand-600">
                      <span className="text-brand-400">▣</span>
                      <span>Space required:</span>
                      <span className="font-semibold text-brand-900">1.2 GB</span>
                    </div>
                    <div className="flex items-center gap-2 text-brand-600">
                      <span className="text-brand-400">▤</span>
                      <span>Space available:</span>
                      <span className="font-semibold text-brand-900">45.8 GB</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-brand-900">
                  <span className="text-brand-500"><ScopeIcon /></span>
                  <span>Installation Scope</span>
                </h2>

                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-500 bg-brand-50 p-4">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-brand-900">
                      <span className="h-2 w-2 rounded-full bg-brand-900" />
                    </span>
                    <span className="flex flex-col">
                      <strong className="text-sm text-brand-900">Install for me only</strong>
                      <span className="text-sm text-brand-500">Installs only for the current user (John Doe)</span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-200 bg-white p-4">
                    <span className="mt-0.5 h-4 w-4 rounded-full border border-brand-300 bg-white" />
                    <span className="flex flex-col">
                      <strong className="text-sm text-brand-900">Install for all users</strong>
                      <span className="text-sm text-brand-500">Requires administrative privileges</span>
                    </span>
                  </label>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-brand-900">
                  <span className="text-brand-500"><BoxIcon /></span>
                  <span>Additional Options</span>
                </h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <article className="rounded-xl border border-brand-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-medium text-brand-800">Shortcuts</h3>
                    <div className="space-y-2">
                      {shortcutItems.map((item) => (
                        <label className="flex cursor-pointer items-center gap-3" key={item}>
                          <span className="relative flex h-4 w-4 items-center justify-center rounded border-2 border-brand-300 bg-white">
                            <span className="text-brand-900"><CheckIcon /></span>
                          </span>
                          <span className="text-sm text-brand-600 transition hover:text-brand-900">{item}</span>
                        </label>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-xl border border-brand-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-medium text-brand-800">Components</h3>
                    <div className="space-y-2">
                      {componentItems.map((item) => (
                        <label className="flex cursor-pointer items-center gap-3" key={item.label}>
                          <span className={`relative flex h-4 w-4 items-center justify-center rounded border-2 ${item.disabled ? 'border-brand-300 bg-brand-100 text-brand-500' : 'border-brand-300 bg-white text-brand-900'}`}>
                            <CheckIcon />
                          </span>
                          <span className={`text-sm ${item.disabled ? 'text-brand-500' : 'text-brand-600 transition hover:text-brand-900'}`}>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </article>
                </div>
              </section>
            </form>
          </div>

          <footer className="mt-auto flex items-center justify-between border-t border-brand-100 bg-brand-50 px-8 py-6">
            <button className="px-6 py-2.5 text-sm font-medium text-brand-600 transition hover:text-brand-900" type="button">
              Cancel
            </button>
            <div className="flex gap-3">
              <button className="rounded-lg border border-brand-200 bg-white px-6 py-2.5 text-sm font-medium text-brand-600 shadow-sm transition hover:bg-brand-50 hover:text-brand-900" type="button">
                Back
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg bg-brand-900 px-8 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-800" type="button">
                <span>Install</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </footer>
        </div>
      </section>
    </div>
  )
}
