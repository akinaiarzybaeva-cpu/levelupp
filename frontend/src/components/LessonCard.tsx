import { Check, Lock } from 'lucide-react'

/** One lesson in the course-content list: number, title, duration and its state (current / done / locked). */
export default function LessonCard({ index, title, duration, isCurrent, isDone, isLocked, disabled, onClick }: {
  index: number
  title: string
  duration: string
  isCurrent: boolean
  isDone: boolean
  isLocked: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={[
        'sidebar-item',
        isCurrent ? 'active' : '',
        isDone ? 'done' : '',
        isLocked ? 'locked' : ''
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={disabled}
      aria-current={isCurrent ? 'step' : undefined}
    >
      <span className="sidebar-index">{index + 1}</span>
      <div className="sidebar-item-copy">
        <strong>{title}</strong>
        <small>{duration}</small>
      </div>
      <span className="sidebar-state">
        {isLocked ? <Lock size={14} /> : isDone ? <Check size={14} /> : isCurrent ? <span className="live-dot" /> : null}
      </span>
    </button>
  )
}
