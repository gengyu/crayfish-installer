import { useState } from 'react'

const steps = [
  { title: 'License Agreement', description: 'Review terms & conditions', state: 'complete', badge: '✓' },
  { title: 'Installation Settings', description: 'Configure preferences', state: 'complete', badge: '✓' },
  { title: 'Installation Progress', description: 'Installing files', state: 'current', badge: '3' },
  { title: 'Success', description: 'Ready to use', state: 'upcoming', badge: '4' }
] as const

const logs = [
  '[10:45:01] Starting installation process...',
  '[10:45:02] Verifying system requirements... OK',
  '[10:45:05] Creating directory C:\\Program Files\\SoftwarePro...',
  '[10:45:06] Extracting package assets...',
  '[10:45:10] Copying runtime: webview2-loader.dll',
  '[10:45:16] Copying bundle: softwarepro-core.pkg',
  '[10:45:18] Copying module: gateway-service.node',
  '[10:45:21] Copying file: core.dll (145.2 MB)...'
]

function CheckIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 8.3 6.4 11l6-6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.53 2.75h2.94l.58 2.43a7.57 7.57 0 0 1 1.85.77l2.13-1.28 2.08 2.08-1.28 2.13c.32.59.58 1.21.77 1.85l2.43.58v2.94l-2.43.58a7.57 7.57 0 0 1-.77 1.85l1.28 2.13-2.08 2.08-2.13-1.28a7.57 7.57 0 0 1-1.85.77l-.58 2.43h-2.94l-.58-2.43a7.57 7.57 0 0 1-1.85-.77l-2.13 1.28-2.08-2.08 1.28-2.13a7.57 7.57 0 0 1-.77-1.85l-2.43-.58v-2.94l2.43-.58c.19-.64.45-1.26.77-1.85L3.5 6.75l2.08-2.08 2.13 1.28c.59-.32 1.21-.58 1.85-.77l.97-2.43Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function DownloadCloudIcon() {
  return (
    <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.5 18a4.5 4.5 0 0 1-.27-8.99A5.75 5.75 0 0 1 18.2 8.3 3.75 3.75 0 1 1 18 18H7.5Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8.6v6.8m0 0 2.6-2.7M12 15.4l-2.6-2.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`h-4 w-4 transition ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 16 16" aria-hidden="true">
      <path d="m6 3.5 4 4.5-4 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function InstallerThemeTemplate2() {
  const [showDetails, setShowDetails] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const progress = 47

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 p-4 sm:p-6 lg:p-8">
      <section className="flex min-h-[600px] w-full max-w-[1000px] flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-xl md:flex-row">
        <aside className="flex w-full flex-col border-b border-brand-200 bg-brand-50 p-6 md:w-64 md:border-b-0 md:border-r md:p-8">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-purple text-sm font-bold text-white">S</div>
            <span className="text-lg font-bold text-brand-900">SoftwarePro</span>
          </div>

          <ol className="flex-1 space-y-6">
            {steps.map((step, index) => {
              const isComplete = step.state === 'complete'
              const isCurrent = step.state === 'current'

              return (
                <li className="relative flex items-start" key={step.title}>
                  {index < steps.length - 1 ? (
                    <div className={`absolute bottom-[-24px] left-[11px] top-7 w-[2px] ${isComplete ? 'bg-brand-purple' : 'bg-brand-200'}`} />
                  ) : null}
                  <div
                    className={`z-10 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs ring-4 ring-brand-50 ${
                      isComplete
                        ? 'bg-brand-purple text-white'
                        : isCurrent
                          ? 'bg-brand-purple text-white shadow-[0_0_0_4px_rgba(107,70,193,0.2)]'
                          : 'border-2 border-brand-300 bg-white text-brand-400'
                    }`}
                  >
                    {isComplete ? <CheckIcon /> : step.badge}
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm ${isCurrent ? 'font-bold text-brand-900' : isComplete ? 'font-semibold text-brand-900' : 'font-medium text-brand-500'}`}>
                      {step.title}
                    </p>
                    <p className={`mt-1 text-xs ${isCurrent || isComplete ? 'text-brand-500' : 'text-brand-400'}`}>
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
              <h1 className="text-xl font-bold text-brand-900">Installing SoftwarePro</h1>
              <p className="mt-1 text-sm text-brand-500">Please wait while the installation completes.</p>
            </div>
            <div className="animate-pulse text-brand-purple">
              <GearIcon />
            </div>
          </header>

          <div className="flex flex-1 flex-col justify-center p-8">
            <div className="mx-auto w-full max-w-xl space-y-8">
              <div className="flex justify-center">
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-brand-50 text-brand-purple shadow-lg">
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-brand-purple border-t-transparent" />
                  <DownloadCloudIcon />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-brand-900">Copying core files...</h2>
                    <p className="mt-1 text-xs text-brand-500">C:\Program Files\SoftwarePro\bin\core.dll</p>
                  </div>
                  <div className="text-right text-2xl font-bold text-brand-purple">{progress}%</div>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-brand-100 shadow-inner">
                  <div className="h-full rounded-full bg-brand-purple transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>

                <div className="flex justify-between text-xs font-medium text-brand-500">
                  <span>Elapsed: 00:01:24</span>
                  <span>Remaining: ~00:02:10</span>
                </div>

                <div className="border-t border-brand-100 pt-4">
                  <button
                    className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 transition hover:text-brand-900"
                    onClick={() => setShowDetails((value) => !value)}
                    type="button"
                  >
                    <ChevronIcon open={showDetails} />
                    <span>{showDetails ? 'Hide Details' : 'Show Details'}</span>
                  </button>

                  {showDetails ? (
                    <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-brand-100 bg-slate-950 p-4 font-mono text-xs text-slate-200">
                      {logs.map((line, index) => (
                        <div className={index === logs.length - 1 ? 'text-brand-300' : 'text-slate-300'} key={line}>
                          {line}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-auto flex items-center justify-between border-t border-brand-100 bg-brand-50 px-8 py-6">
            <button
              className="px-6 py-2.5 text-sm font-medium text-brand-600 transition hover:text-red-600"
              onClick={() => setShowCancelModal(true)}
              type="button"
            >
              Cancel
            </button>
            <div className="flex gap-3">
              <button className="cursor-not-allowed rounded-lg border border-brand-200 bg-brand-100 px-6 py-2.5 text-sm font-medium text-brand-400 shadow-sm" disabled type="button">
                Back
              </button>
              <button className="cursor-not-allowed rounded-lg bg-brand-200 px-8 py-2.5 text-sm font-medium text-brand-400 shadow-sm" disabled type="button">
                Next
              </button>
            </div>
          </footer>
        </div>
      </section>

      {showCancelModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">!</div>
              <div>
                <h3 className="text-lg font-bold text-brand-900">Cancel Installation?</h3>
                <p className="mt-2 text-sm text-brand-500">
                  Are you sure you want to cancel the installation? This will stop the current process and roll back any changes made so far.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                onClick={() => setShowCancelModal(false)}
                type="button"
              >
                Resume Installation
              </button>
              <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700" type="button">
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
