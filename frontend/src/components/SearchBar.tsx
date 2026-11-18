import { Search } from 'lucide-react'

/** Search input with the magnifier icon. `className` keeps each page's existing look. */
export default function SearchBar({ value, onChange, placeholder, ariaLabel, className = 'search-box' }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel?: string
  className?: string
}) {
  return (
    <label className={className}>
      <Search size={16} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={ariaLabel} />
    </label>
  )
}
