import { useState } from 'react'

type ShowcaseState = 'default' | 'installing' | 'failed' | 'success'

const states: ShowcaseState[] = ['default', 'installing', 'failed', 'success']

const normalDetails = [
  { done: true, text: '已检查系统环境' },
  { done: true, text: '已准备下载源' },
  { done: false, text: '等待开始安装 OpenClaw' }
]

const errorDetails = [
  { done: true, text: '已完成环境检测' },
  { done: false, text: '下载依赖包时网络超时' },
  { done: false, text: '建议切换网络后重试' }
]

function CubeIcon() {
  return (
    <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2 8 3.6v12.8L12 22 4 18.4V5.6L12 2Zm0 2.2L6.8 6.5 12 8.8l5.2-2.3L12 4.2Zm-6 4v8.8l5 2.2V11L6 8.2Zm7 10.9 5-2.2V8.2l-5 2.8v8.1Z" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 9 16.5 19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export default function ThemeShowcasePage() {
  const [currentState, setCurrentState] = useState<ShowcaseState>('default')
  const [showDetails, setShowDetails] = useState(false)

  const isDefault = currentState === 'default'
  const isInstalling = currentState === 'installing'
  const isFailed = currentState === 'failed'
  const isSuccess = currentState === 'success'
  const detailRows = isFailed ? errorDetails : normalDetails

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface-50 p-4">
      <div className="w-full max-w-md">
        <main className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <header className="px-8 pb-4 pt-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-600 shadow-sm">
              <CubeIcon />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-slate-900">OpenClaw</h1>
            <p className="text-sm text-slate-500">智能环境配置向导</p>
          </header>

          <section className="relative min-h-[160px] px-8 py-4">
            {isDefault ? (
              <div className="space-y-3 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                  <span className="text-amber-400">⚡</span>
                  <span>无需命令行</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                  <span className="text-brand-500">✦</span>
                  <span>自动配置环境</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                  <span className="text-blue-400">🕒</span>
                  <span>约 1-3 分钟</span>
                </div>
              </div>
            ) : null}

            {isInstalling ? (
              <div className="text-center">
                <h2 className="mb-4 text-base font-semibold text-slate-800">正在为你准备 OpenClaw...</h2>
                <div className="relative mb-3 h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner">
                  <div className="h-full w-[65%] rounded-full bg-brand-500 transition-all duration-300" />
                </div>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="animate-pulse text-brand-600">正在下载必要组件...</span>
                  <span className="text-slate-500">65%</span>
                </div>
              </div>
            ) : null}

            {isFailed ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
                  <CloseIcon />
                </div>
                <h2 className="mb-2 text-base font-semibold text-slate-800">安装遇到问题</h2>
                <div className="mb-4 rounded-lg border border-red-100 bg-red-50/60 p-4 text-left">
                  <p className="mb-1 text-sm font-medium text-red-800">网络连接不稳定</p>
                  <p className="mb-2 text-xs text-slate-600">我们已自动重试 2 次，但未能解决。</p>
                  <p className="text-xs text-slate-500">请检查网络后点击下方按钮重试。</p>
                </div>
              </div>
            ) : null}

            {isSuccess ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-500">
                  <CheckIcon className="h-8 w-8" />
                </div>
                <h2 className="mb-2 text-lg font-bold text-slate-900">OpenClaw 已准备就绪</h2>
                <p className="text-sm text-slate-500">环境配置完成，现在可以直接启动使用。</p>
              </div>
            ) : null}
          </section>

          <section className="border-t border-slate-100 bg-slate-50/80 px-8 py-3">
            <button
              className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-700"
              onClick={() => setShowDetails((value) => !value)}
              type="button"
            >
              <span>查看安装详情</span>
              <ChevronIcon open={showDetails} />
            </button>

            {showDetails ? (
              <div className="mt-3 space-y-2">
                {detailRows.map((item) => (
                  <div className="flex items-center gap-2 text-xs text-slate-600" key={item.text}>
                    <span className={`inline-flex w-4 justify-center font-bold ${item.done ? 'text-green-500' : 'text-brand-500'}`}>
                      {item.done ? '✓' : '◌'}
                    </span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <footer className="space-y-3 px-8 py-5">
            {isDefault ? (
              <button className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-700" type="button">
                开始安装
              </button>
            ) : null}

            {isInstalling ? (
              <button className="w-full rounded-xl bg-slate-200 px-4 py-3 text-sm font-medium text-slate-500" disabled type="button">
                安装中...
              </button>
            ) : null}

            {isFailed ? (
              <>
                <button className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-700" type="button">
                  再试一次
                </button>
                <button className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50" type="button">
                  复制错误信息
                </button>
              </>
            ) : null}

            {isSuccess ? (
              <>
                <button className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-700" type="button">
                  启动 OpenClaw
                </button>
                <button className="w-full px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700" type="button">
                  重新安装
                </button>
              </>
            ) : null}
          </footer>
        </main>

        <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-sm">
          {states.map((state) => (
            <button
              className={`rounded-md px-3 py-1.5 transition ${
                currentState === state
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              key={state}
              onClick={() => setCurrentState(state)}
              type="button"
            >
              {state}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
