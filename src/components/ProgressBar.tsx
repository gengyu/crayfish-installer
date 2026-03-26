interface ProgressBarProps {
  progress: number
  stage: string
  detail?: string
}

export default function ProgressBar({ progress, stage, detail }: ProgressBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-brand-600">{stage}</span>
        <span className="text-slate-500">{progress}%</span>
      </div>
      {detail ? <div className="text-left text-xs text-slate-500">{detail}</div> : null}
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
