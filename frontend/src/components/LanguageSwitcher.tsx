import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'
import type { Lang } from '../appShared'

const LANGUAGES: readonly Lang[] = ['kg', 'ru', 'en']

/** KG / RU / EN dropdown. Closes on outside click, touch and Escape. */
export default function LanguageSwitcher({ language, setLanguage, label }: {
  language: Lang
  setLanguage: (language: Lang) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('touchstart', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('touchstart', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="header-lang" ref={wrapRef}>
      <button
        type="button"
        className="header-lang-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe size={18} />
        <span>{language.toUpperCase()}</span>
        <ChevronDown size={15} className={open ? 'header-lang-chevron open' : 'header-lang-chevron'} />
      </button>
      <div className={open ? 'header-lang-menu open' : 'header-lang-menu'} role="listbox" aria-label={label}>
        {LANGUAGES.map((item) => (
          <button
            key={item}
            type="button"
            role="option"
            aria-selected={language === item}
            className={language === item ? 'header-lang-option active' : 'header-lang-option'}
            tabIndex={open ? 0 : -1}
            onClick={() => { setLanguage(item); setOpen(false) }}
          >
            {item.toUpperCase()}
            {language === item && <Check size={14} />}
          </button>
        ))}
      </div>
    </div>
  )
}
