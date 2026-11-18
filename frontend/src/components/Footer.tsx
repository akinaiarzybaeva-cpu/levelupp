import { Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import Logo from './Logo'
import { translations, type Lang } from '../appShared'

export default function Footer({ t }: { t: (typeof translations)[Lang] }) {
  const year = new Date().getFullYear()
  const contactLinks = [
    { href: 'mailto:support@levelup.kg', label: 'support@levelup.kg', icon: <Mail size={16} /> },
    { href: 'tel:+996555123456', label: '+996 555 123 456', icon: <Phone size={16} /> },
    { href: 'https://maps.google.com/?q=Bishkek,Kyrgyzstan', label: t.footer.address, icon: <MapPin size={16} /> }
  ]

  const socialLinks = [
    { href: 'https://t.me/levelupkg', label: 'Telegram', icon: <TelegramIcon className="footer-social-svg" /> },
    { href: 'https://www.instagram.com/levelup.kg/', label: 'Instagram', icon: <InstagramIcon className="footer-social-svg" /> },
    { href: 'https://www.youtube.com/@levelupkg', label: 'YouTube', icon: <YouTubeIcon className="footer-social-svg" /> }
  ]

  const navLinks = [
    { to: '/home', label: t.nav.home },
    { to: '/courses', label: t.nav.courses },
    { to: '/rating', label: t.nav.rating },
    { to: '/reviews', label: t.nav.reviews },
    { to: '/pricing', label: t.nav.pricing },
    { to: '/faq', label: t.nav.faq }
  ]

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand-column">
          <div className="brand footer-brand"><Logo imageClassName="footer-logo-image" /></div>
          <p className="footer-copy">{t.footer.description}</p>
        </div>

        <nav className="footer-column footer-nav-column" aria-label={t.footer.nav}>
          <h4>{t.footer.nav}</h4>
          <ul className="footer-list footer-nav-list">
            {navLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="footer-contact-item footer-nav-link">{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-column">
          <h4>{t.footer.contacts}</h4>
          <ul className="footer-list">
            {contactLinks.map((item) => (
              <li key={item.href}>
                <a href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel={item.href.startsWith('http') ? 'noreferrer' : undefined} className="footer-contact-item" aria-label={item.label} title={item.label}>
                  <span className="footer-icon">{item.icon}</span>
                  <span className="footer-contact-text">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-column">
          <h4>{t.footer.social}</h4>
          <ul className="footer-list footer-social-list">
            {socialLinks.map((item) => (
              <li key={item.label}>
                <a href={item.href} target="_blank" rel="noreferrer" className="footer-contact-item footer-social-link" aria-label={item.label} title={item.label}>
                  <span className="footer-icon footer-social-icon">{item.icon}</span>
                  <span className="footer-social-label">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container footer-divider" />

      <div className="container footer-bottom">
        <Link to="/privacy" className="footer-link">{t.footer.privacy}</Link>
        <Link to="/terms" className="footer-link">{t.footer.terms}</Link>
        <span className="footer-rights">© {year} LEVEL UP. {t.footer.rights}</span>
      </div>
    </footer>
  )
}

export function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M21.5 4.5c.4 1.2-1.8 3.2-5.4 5.8l-1.2 8.7c-.1.8-.7 1-1.4.5l-3.9-2.9-1.9 1.8c-.2.2-.4.4-.7.4l.2-4.3 8.1-7.3c.4-.3-.1-.5-.8-.2l-9.9 6.3-4.3-1.4c-.9-.3-.9-.9.2-1.4L20.5 3.2c.7-.3 1.3.1 1 1.3Z" fill="currentColor" />
    </svg>
  )
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M7 2.5h10A4.5 4.5 0 0 1 21.5 7v10a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 17V7A4.5 4.5 0 0 1 7 2.5Zm0 1.8A2.7 2.7 0 0 0 4.3 7v10a2.7 2.7 0 0 0 2.7 2.7h10a2.7 2.7 0 0 0 2.7-2.7V7a2.7 2.7 0 0 0-2.7-2.7H7Zm10.4 1.8h.5v.5h-.5v-.5ZM12 6.2A5.8 5.8 0 1 1 12 17.8 5.8 5.8 0 0 1 12 6.2Zm0 1.8A4 4 0 1 0 12 16.2 4 4 0 0 0 12 8Z" fill="currentColor" />
    </svg>
  )
}

export function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M21.6 7.38a2.9 2.9 0 0 0-2.04-2.05C17.8 5 12 5 12 5s-5.8 0-7.56.33A2.9 2.9 0 0 0 2.4 7.38 30.7 30.7 0 0 0 2 12a30.7 30.7 0 0 0 .4 4.62 2.9 2.9 0 0 0 2.04 2.05C6.2 19 12 19 12 19s5.8 0 7.56-.33a2.9 2.9 0 0 0 2.04-2.05A30.7 30.7 0 0 0 22 12a30.7 30.7 0 0 0-.4-4.62ZM10 15.5v-7l6 3.5-6 3.5Z" fill="currentColor" />
    </svg>
  )
}
