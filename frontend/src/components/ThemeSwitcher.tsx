import { Moon, Sun } from 'lucide-react'
import type { Theme } from '../appShared'

/** Light / dark toggle. The labels describe the theme the button switches TO. */
export default function ThemeSwitcher({ theme, setTheme, toDarkLabel, toLightLabel }: {
  theme: Theme
  setTheme: (update: (current: Theme) => Theme) => void
  toDarkLabel: string
  toLightLabel: string
}) {
  const label = theme === 'light' ? toDarkLabel : toLightLabel
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
      aria-label={label}
      title={label}
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  )
}
