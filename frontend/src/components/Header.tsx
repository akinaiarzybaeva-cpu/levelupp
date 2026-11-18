import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { HelpCircle, Home, LayoutGrid, LogOut, MessageSquareText, ShieldCheck, Trophy, WalletCards } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { renderAvatarContent, type Lang, type Theme, type UserProfile, type translations } from '../appShared'
import BurgerMenu, { BurgerButton, type NavItem } from './BurgerMenu'
import LanguageSwitcher from './LanguageSwitcher'
import Logo from './Logo'
import ThemeSwitcher from './ThemeSwitcher'

/** Icons for the desktop header links (shown in Light Mode). */
const headerNavIcons: Record<string, typeof Home> = {
  '/home': Home,
  '/courses': LayoutGrid,
  '/rating': Trophy,
  '/reviews': MessageSquareText,
  '/pricing': WalletCards,
  '/faq': HelpCircle,
  '/admin': ShieldCheck
}

/** Language + theme controls shown next to the account buttons. */
export function HeaderQuickControls({ t, language, setLanguage, theme, setTheme }: { t: (typeof translations)[Lang]; language: Lang; setLanguage: Dispatch<SetStateAction<Lang>>; theme: Theme; setTheme: Dispatch<SetStateAction<Theme>> }) {
  return (
    <div className="header-quick-controls">
      <LanguageSwitcher language={language} setLanguage={setLanguage} label={t.headerMenu.language} />
      <ThemeSwitcher theme={theme} setTheme={setTheme} toDarkLabel={t.headerMenu.night} toLightLabel={t.headerMenu.day} />
    </div>
  )
}

/** Sticky site header: logo, navigation, account actions, language/theme and the mobile burger menu. */
export default function Header({ t, user, isLoggedIn, isAdminUser, onLogout, language, setLanguage, theme, setTheme }: {
  t: (typeof translations)[Lang]
  user: UserProfile | null
  isLoggedIn: boolean
  isAdminUser: boolean
  onLogout: () => void
  language: Lang
  setLanguage: Dispatch<SetStateAction<Lang>>
  theme: Theme
  setTheme: Dispatch<SetStateAction<Theme>>
}) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const burgerMenuRef = useRef<HTMLDivElement | null>(null)
  const burgerButtonRef = useRef<HTMLButtonElement | null>(null)

  const navItems: NavItem[] = [
    { to: '/home', label: t.nav.home },
    { to: '/courses', label: t.nav.courses },
    { to: '/rating', label: t.nav.rating },
    { to: '/reviews', label: t.nav.reviews },
    { to: '/pricing', label: t.nav.pricing },
    ...(isAdminUser ? [{ to: '/admin', label: 'Admin Panel' }] : []),
    { to: '/faq', label: t.nav.faq }
  ]

  // Close the menu on navigation (render-time reset, no effect needed).
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setMobileOpen(false)
  }

  useEffect(() => {
    if (!mobileOpen) {
      document.documentElement.style.overflow = ''
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    const handleOutsidePress = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (burgerMenuRef.current?.contains(target)) return
      if (burgerButtonRef.current?.contains(target)) return
      setMobileOpen(false)
    }

    // Lock page scroll on <html>: locking <body> would make it a scroll container
    // and un-pin the sticky header while the menu is open.
    document.documentElement.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleOutsidePress)
    document.addEventListener('touchstart', handleOutsidePress)

    return () => {
      document.documentElement.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleOutsidePress)
      document.removeEventListener('touchstart', handleOutsidePress)
    }
  }, [mobileOpen])

  const closeMenu = () => setMobileOpen(false)

  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Logo to="/home" />

        <nav className="nav">
          {navItems.map((item) => {
            const NavIcon = headerNavIcons[item.to] ?? LayoutGrid
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')} onClick={closeMenu} title={item.label}>
                <NavIcon size={17} className="nav-item-icon" aria-hidden="true" />
                <span>{item.to === '/faq' ? 'FAQ' : item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="nav-actions">
          {isLoggedIn && user ? (
            <>
              <Link to="/dashboard" className="btn btn-secondary btn-login header-profile-chip" title={t.nav.profile}>
                <span className="avatar tiny">{user.profileImage ? <img src={user.profileImage} alt="" className="profile-avatar-image" /> : renderAvatarContent(user.avatar, user.name?.charAt(0)?.toUpperCase() || 'U')}</span>
                <span className="header-profile-name">{user.name}</span>
              </Link>
              <button type="button" className="btn btn-ghost header-logout" onClick={onLogout} aria-label={t.dashboard.logout} title={t.dashboard.logout}><LogOut size={18} /></button>
            </>
          ) : (
            <>
              <Link to="/auth" className="btn btn-secondary btn-login">{t.buttons.login}</Link>
              <Link to="/auth" className="btn btn-primary">{t.buttons.signup}</Link>
            </>
          )}

          <HeaderQuickControls t={t} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} />

          <BurgerButton open={mobileOpen} onToggle={() => setMobileOpen((v) => !v)} openLabel={t.headerMenu.open} closeLabel={t.headerMenu.close} buttonRef={burgerButtonRef} />
        </div>

        <BurgerMenu open={mobileOpen} onClose={closeMenu} menuRef={burgerMenuRef} navItems={navItems} t={t} user={user} isLoggedIn={isLoggedIn} isAdminUser={isAdminUser} onLogout={onLogout} />
      </div>
    </header>
  )
}
