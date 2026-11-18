import { Star } from 'lucide-react'

/** Read-only stars, or an accessible 1–5 picker when `onChange` is given. */
export default function RatingStars({ value, onChange, size = 18, label }: { value: number; onChange?: (value: number) => void; size?: number; label?: string }) {
  const rounded = Math.round(Number(value) || 0)
  if (!onChange) {
    return (
      <span className="ui-stars" role="img" aria-label={label ?? `${Number(value || 0).toFixed(1)} / 5`}>
        {[1, 2, 3, 4, 5].map((item) => (
          <Star key={item} size={size} className={item <= rounded ? 'on' : ''} fill={item <= rounded ? 'currentColor' : 'none'} aria-hidden="true" />
        ))}
      </span>
    )
  }
  return (
    <div className="ui-stars ui-stars-input stars-select" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((item) => (
        <button
          key={item}
          type="button"
          role="radio"
          aria-checked={rounded === item}
          aria-label={`${item} / 5`}
          className={item <= rounded ? 'star-button active' : 'star-button'}
          onClick={() => onChange(item)}
        >
          <Star size={size} fill={item <= rounded ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
