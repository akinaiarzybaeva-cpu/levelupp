import type { ReactNode } from 'react'
import { BookOpen, Brain, GraduationCap, HelpCircle, LayoutDashboard, LogOut, MessageSquareText, Settings, TrendingUp, WalletCards, X, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { pick, type Lang } from '../appShared'
import Logo from './Logo'

type SidebarItem = { label: string; icon: LucideIcon; to: string; action?: 'ai' | 'logout' }

/** Personal-dashboard navigation (shared by the dashboard and the profile pages). */
export default function Sidebar({ open, onClose, language, logoutLabel, onAi, onLogout, homeIcon = LayoutDashboard, children }: {
  open: boolean
  onClose: () => void
  language: Lang
  logoutLabel: string
  /** AI Assistant item: the page decides whether to open it or show the upgrade dialog. */
  onAi: () => void
  onLogout: () => void
  homeIcon?: LucideIcon
  /** Optional block under the navigation (e.g. current plan card). */
  children?: ReactNode
}) {
  const items: SidebarItem[] = [
    { label: pick(language, 'Башкы бет', 'Главная', 'Home'), icon: homeIcon, to: '/dashboard' },
    { label: pick(language, 'Курстар', 'Курсы', 'Courses'), icon: BookOpen, to: '/dashboard/courses' },
    { label: pick(language, 'Менин сабактарым', 'Мои уроки', 'My lessons'), icon: GraduationCap, to: '/dashboard/my-lessons' },
    { label: pick(language, 'Менин рейтингим', 'Мой рейтинг', 'My rating'), icon: TrendingUp, to: '/dashboard/rating' },
    { label: pick(language, 'Пикирлер', 'Отзывы', 'Reviews'), icon: MessageSquareText, to: '/dashboard/reviews' },
    { label: pick(language, 'Тарифтер', 'Тарифы', 'Pricing'), icon: WalletCards, to: '/dashboard/pricing' },
    { label: 'AI Assistant', icon: Brain, to: '/dashboard/ai', action: 'ai' },
    { label: 'FAQ', icon: HelpCircle, to: '/dashboard/faq' },
    { label: pick(language, 'Профиль жөндөөлөрү', 'Настройки профиля', 'Profile settings'), icon: Settings, to: '/dashboard/profile' },
    { label: logoutLabel, icon: LogOut, to: '/auth', action: 'logout' }
  ]

  return (
    <aside className={open ? 'dashboard-sidebar open' : 'dashboard-sidebar'}>
      <div className="dashboard-sidebar-header">
        <Logo to="/dashboard" className="brand dashboard-brand" ariaLabel="LEVEL UP dashboard" />
        <button type="button" className="dashboard-close-btn" onClick={onClose} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="dashboard-nav">
        {items.map(({ label, icon: Icon, to, action }) => {
          if (action === 'logout') {
            return (
              <button key={label} type="button" className="dashboard-nav-item danger" onClick={() => { onClose(); onLogout() }}>
                <Icon size={18} />
                <span>{label}</span>
              </button>
            )
          }
          if (action === 'ai') {
            return (
              <button key={label} type="button" className="dashboard-nav-item" onClick={() => { onClose(); onAi() }}>
                <Icon size={18} />
                <span>{label}</span>
              </button>
            )
          }
          return (
            <NavLink key={label} to={to} className={({ isActive }) => (isActive ? 'dashboard-nav-item active' : 'dashboard-nav-item')} onClick={onClose}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          )
        })}
      </nav>

      {children}
    </aside>
  )
}
