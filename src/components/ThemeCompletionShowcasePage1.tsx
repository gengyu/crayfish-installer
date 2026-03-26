const steps = [
  { title: 'License Agreement', description: 'Review terms & conditions', state: 'complete' },
  { title: 'Installation Settings', description: 'Configure preferences', state: 'complete' },
  { title: 'Installation Progress', description: 'Installing files', state: 'complete' },
  { title: 'Success', description: 'Ready to use', state: 'current', badge: '4' }
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

function CheckIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 9.2 16.7 19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 6.5c0-1.1.9-2 2-2h5v14h-5a2 2 0 0 0-2 2Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M19.5 6.5c0-1.1-.9-2-2-2h-5v14h5a2 2 0 0 1 2 2Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3.5h5.8L18.5 8v12a.5.5 0 0 1-.5.5H8A2.5 2.5 0 0 1 5.5 18V6A2.5 2.5 0 0 1 8 3.5Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 3.5V8H18M8.5 12h7M8.5 15.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function ThemeCompletionShowcasePage1() {
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
                    <div className="absolute bottom-[-24px] left-[11px] top-7 w-[2px] bg-brand-success" />
                  ) : null}
                  <div
                    className={`z-10 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs text-white ring-4 ring-brand-50 ${
                      isCurrent ? 'bg-brand-purple shadow-[0_0_0_4px_rgba(107,70,193,0.2)]' : 'bg-brand-success'
                    }`}
                  >
                    {isComplete ? <CheckIcon /> : step.badge}
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm ${isCurrent ? 'font-bold' : 'font-semibold'} text-brand-900`}>{step.title}</p>
                    <p className="mt-1 text-xs text-brand-500">{step.description}</p>
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="mt-auto pt-8 text-xs text-brand-400">v2.4.1 build 8920</div>
        </aside>

        <div className="flex flex-1 flex-col bg-white">
          <header className="border-b border-brand-100 bg-white px-8 py-6">
            <h1 className="text-xl font-bold text-brand-900">Installation Complete</h1>
            <p className="mt-1 text-sm text-brand-500">SoftwarePro has been successfully installed.</p>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="flex w-full max-w-xl flex-col items-center space-y-8 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-brand-successLight text-brand-success shadow-lg">
                <CheckIcon className="h-12 w-12" />
              </div>

              <div>
                <h2 className="mb-2 text-2xl font-bold text-brand-900">Ready to Go!</h2>
                <p className="mx-auto max-w-md text-sm text-brand-500">
                  SoftwarePro v2.4.1 has been successfully installed on your system. You can now start using the application.
                </p>
              </div>

              <section className="w-full rounded-2xl border border-brand-100 bg-brand-50 p-6 text-left">
                <h3 className="mb-4 border-b border-brand-200 pb-2 text-sm font-semibold text-brand-900">Installation Summary</h3>
                <div className="space-y-3 text-sm text-brand-600">
                  {summaryItems.map((item) => (
                    <div className="flex justify-between gap-4" key={item.label}>
                      <span>{item.label}</span>
                      <strong className="text-brand-900">{item.value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <div className="w-full space-y-4 text-left">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-brand-200 p-3 transition hover:bg-brand-50">
                  <input className="h-5 w-5 rounded border-brand-300 accent-brand-purple" defaultChecked type="checkbox" />
                  <span className="text-sm font-medium text-brand-900">Launch SoftwarePro now</span>
                </label>

                <div className="flex justify-center gap-4 pt-2 text-sm">
                  {resourceLinks.map((item, index) => (
                    <div className="flex items-center gap-4" key={item.label}>
                      {index > 0 ? <span className="text-brand-300">|</span> : null}
                      <button className="inline-flex items-center gap-1 font-medium text-brand-purple transition hover:text-brand-purpleLight" type="button">
                        {item.icon === 'book' ? <BookIcon /> : <FileIcon />}
                        <span>{item.label}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-auto flex justify-end border-t border-brand-100 bg-brand-50 px-8 py-6">
            <button className="inline-flex items-center gap-2 rounded-lg bg-brand-purple px-8 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-brand-purpleLight hover:shadow-lg" type="button">
              <span>Finish</span>
              <CheckIcon />
            </button>
          </footer>
        </div>
      </section>
    </div>
  )
}
