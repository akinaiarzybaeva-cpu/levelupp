import type { RefObject } from 'react'
import { Menu, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import type { Lang, UserProfile, translations } from '../appShared'

export type NavItem = { to: string; label: string }

/** The ☰ / ✕ button that opens the mobile menu. */
export function BurgerButton({ open, onToggle, openLabel, closeLabel, buttonRef }: {
  open: boolean
  onToggle: () => void
  openLabel: string
  closeLabel: string
  buttonRef: RefObject<HTMLButtonElement | null>
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="burger"
      onClick={onToggle}
      aria-label={open ? closeLabel : openLabel}
      aria-expanded={open}
    >
      {open ? <X size={20} /> : <Menu size={20} />}
    </button>
  )
}

/** Mobile dropdown menu: navigation, admin link and login / profile actions. */
export default function BurgerMenu({ open, onClose, menuRef, navItems, t, user, isLoggedIn, isAdminUser, onLogout }: {
  open: boolean
  onClose: () => void
  menuRef: RefObject<HTMLDivElement | null>
  navItems: NavItem[]
  t: (typeof translations)[Lang]
  user: UserProfile | null
  isLoggedIn: boolean
  isAdminUser: boolean
  onLogout: () => void
}) {
  return (
    <div ref={menuRef} className={`header-burger-menu ${open ? 'open' : ''}`} role="menu" aria-hidden={!open}>
      <div className="header-menu-block">
        <div className="header-menu-label">
          <span>{t.footer.nav}</span>
        </div>
        <nav className="header-mobile-nav" aria-label="Mobile navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'header-mobile-nav-item active' : 'header-mobile-nav-item')}
              onClick={onClose}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {isAdminUser && (
        <div className="header-menu-block">
          <Link to="/admin" className="btn btn-primary full-width" onClick={onClose}>Admin Panel</Link>
        </div>
      )}

      <div className="mobile-auth-actions">
        {isLoggedIn && user ? (
          <>
            <Link to="/dashboard" className="btn btn-secondary full-width" onClick={onClose}>{user.name}</Link>
            <button type="button" className="btn btn-primary full-width" onClick={() => { onClose(); onLogout() }}>{t.dashboard.logout}</button>
          </>
        ) : (
          <>
            <Link to="/auth" className="btn btn-secondary full-width" onClick={onClose}>{t.buttons.login}</Link>
            <Link to="/auth" className="btn btn-primary full-width" onClick={onClose}>{t.buttons.signup}</Link>
          </>
        )}
      </div>
    </div>
  )
}
