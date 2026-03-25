interface ProgressBarProps {
  progress: number
  stage: string
  detail?: string
}

export default function ProgressBar({ progress, stage, detail }: ProgressBarProps) {
  return (
    <div className="progress-container">
      <div className="progress-info">
        <span className="stage-text">{stage}</span>
        <span className="progress-text">{progress}%</span>
      </div>
      {detail ? <div className="progress-detail">{detail}</div> : null}
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
