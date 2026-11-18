export default function ProgressBar({ value, label, showValue = false }: { value: number; label?: string; showValue?: boolean }) {
  const safe = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  return (
    <div className="ui-progress">
      {(label || showValue) && (
        <div className="ui-progress-meta">
          {label && <span>{label}</span>}
          {showValue && <strong>{safe}%</strong>}
        </div>
      )}
      <div className="progress-bar" role="progressbar" aria-valuenow={safe} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span style={{ width: `${safe}%` }} />
      </div>
    </div>
  )
}
