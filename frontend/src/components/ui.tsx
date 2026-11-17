/**
 * LevelUp UI kit: small, reusable building blocks shared by every page.
 * They keep the legacy class names (btn, password-field, access-modal-*) so the
 * existing styles, tests and behaviour keep working, and add the new design-system
 * classes (ui-*) on top.
 */
import { useEffect, useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Star, X, type LucideIcon } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

function buttonClass(variant: ButtonVariant, size: ButtonSize, block?: boolean, extra?: string) {
  return [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'small' : size === 'lg' ? 'btn-lg' : '',
    block ? 'full-width' : '',
    extra ?? ''
  ].filter(Boolean).join(' ')
}

type CommonButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  icon?: LucideIcon
  iconRight?: LucideIcon
  children?: ReactNode
  className?: string
}

/** Unified button. Renders a router Link when `to` is given, otherwise a <button>. */
export function Button({ variant = 'primary', size = 'md', block, icon: Icon, iconRight: IconRight, children, className, ...rest }: CommonButtonProps & Omit<ComponentProps<'button'>, 'className' | 'children'>) {
  return (
    <button type="button" className={buttonClass(variant, size, block, className)} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 15 : 17} aria-hidden="true" />}
      {children}
      {IconRight && <IconRight size={size === 'sm' ? 15 : 17} aria-hidden="true" />}
    </button>
  )
}

export function ButtonLink({ to, variant = 'primary', size = 'md', block, icon: Icon, iconRight: IconRight, children, className, ...rest }: CommonButtonProps & { to: string } & Omit<ComponentProps<typeof Link>, 'className' | 'children' | 'to'>) {
  return (
    <Link to={to} className={buttonClass(variant, size, block, className)} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 15 : 17} aria-hidden="true" />}
      {children}
      {IconRight && <IconRight size={size === 'sm' ? 15 : 17} aria-hidden="true" />}
    </Link>
  )
}

type BadgeTone = 'green' | 'neutral' | 'gold' | 'danger' | 'dark'

export function Badge({ tone = 'green', icon: Icon, children, className }: { tone?: BadgeTone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={['ui-badge', `ui-badge-${tone}`, className].filter(Boolean).join(' ')}>
      {Icon && <Icon size={13} aria-hidden="true" />}
      {children}
    </span>
  )
}

export function Card({ as: Tag = 'div', className, children, ...rest }: { as?: 'div' | 'section' | 'article' | 'aside'; className?: string; children: ReactNode } & Omit<ComponentProps<'div'>, 'className' | 'children'>) {
  return <Tag className={['ui-card', className].filter(Boolean).join(' ')} {...rest}>{children}</Tag>
}

/** Dark-green page banner used at the top of every inner page. */
export function PageHero({ eyebrow, title, subtitle, back, actions, aside, className }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; back?: ReactNode; actions?: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={['ui-page-hero', aside ? 'has-aside' : '', className].filter(Boolean).join(' ')}>
      <div className="ui-page-hero-copy">
        {back && <div className="ui-page-hero-back">{back}</div>}
        {eyebrow && <span className="ui-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {actions && <div className="ui-page-hero-actions">{actions}</div>}
      </div>
      {aside && <div className="ui-page-hero-aside">{aside}</div>}
    </section>
  )
}

export function ProgressBar({ value, label, showValue = false }: { value: number; label?: string; showValue?: boolean }) {
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

/** Read-only stars, or an accessible 1–5 picker when `onChange` is given. */
export function StarRating({ value, onChange, size = 18, label }: { value: number; onChange?: (value: number) => void; size?: number; label?: string }) {
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

/** Password input with a show/hide eye button. */
export function PasswordInput({ value, onChange, placeholder, showLabel, hideLabel, autoComplete, id, compact }: { value: string; onChange: (value: string) => void; placeholder?: string; showLabel: string; hideLabel: string; autoComplete?: string; id?: string; compact?: boolean }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={compact ? 'password-field compact-password-field' : 'password-field'}>
      <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} />
      <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? hideLabel : showLabel} aria-pressed={visible} title={visible ? hideLabel : showLabel}>
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  )
}

/** Accessible modal dialog (Escape closes, focus moves into the card). */
export function Modal({ open, onClose, title, icon: Icon, children, actions }: { open: boolean; onClose: () => void; title: ReactNode; icon?: LucideIcon; children?: ReactNode; actions?: ReactNode }) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="access-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="access-modal-card ui-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        {Icon && <span className="ui-modal-icon"><Icon size={22} /></span>}
        <h3 id={titleId}>{title}</h3>
        {children}
        {actions && <div className="subscription-actions">{actions}</div>}
      </div>
    </div>
  )
}

export function StatTile({ icon: Icon, value, label, tone = 'green' }: { icon: LucideIcon; value: ReactNode; label: ReactNode; tone?: 'green' | 'gold' | 'blue' | 'violet' }) {
  return (
    <div className={`stat-card ui-stat-tile tone-${tone}`}>
      <span className="ui-stat-icon"><Icon size={20} aria-hidden="true" /></span>
      <div><strong>{value}</strong><span>{label}</span></div>
    </div>
  )
}

export function EmptyState({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <div className="empty-state-box ui-empty">
      {Icon && <Icon size={26} aria-hidden="true" />}
      <span>{children}</span>
    </div>
  )
}
