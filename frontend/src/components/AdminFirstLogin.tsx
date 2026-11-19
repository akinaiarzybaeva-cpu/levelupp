import { useState } from 'react'
import { AlertCircle, CheckCircle, Eye, EyeOff, LogOut, ShieldAlert } from 'lucide-react'
import { useLanguage } from '../appShared'
import { AdminLanguageSwitch, useAdminT } from './adminI18n'
import { adminFetch, passwordStrength } from './adminShared'

export const ADMIN_LOGIN_NOTICE_KEY = 'levelup-admin-login-notice'

/**
 * Shown instead of the admin panel while the account still uses the initial password
 * (ADMIN_INITIAL_PASSWORD). The backend refuses every other admin request until it is changed.
 */
export default function AdminFirstLogin({ adminEmail, onLogout }: { adminEmail: string; onLogout: () => void }) {
  const t = useAdminT()
  const language = useLanguage()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const strength = passwordStrength(newPassword)
  const match = newPassword && confirmPassword && newPassword === confirmPassword

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice(null)
    if (!currentPassword || !newPassword || !confirmPassword) return setNotice({ kind: 'error', message: 'All password fields are required' })
    if (newPassword.length < 8) return setNotice({ kind: 'error', message: 'New password must be at least 8 characters' })
    if (newPassword !== confirmPassword) return setNotice({ kind: 'error', message: 'New passwords do not match' })
    if (!/[A-Za-zА-Яа-яЁёӨөҮүҢң]/.test(newPassword) || !/\d/.test(newPassword)) return setNotice({ kind: 'error', message: 'New password must contain both letters and digits' })
    if (newPassword === currentPassword) return setNotice({ kind: 'error', message: 'New password must be different from the current password' })

    setBusy(true)
    try {
      await adminFetch('/api/admin/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword, language }),
      })
      setNotice({ kind: 'success', message: 'Password changed successfully. You will be logged out.' })
      try { window.sessionStorage.setItem(ADMIN_LOGIN_NOTICE_KEY, 'password-changed') } catch { /* storage unavailable */ }
      window.setTimeout(onLogout, 1500)
    } catch (err) {
      setNotice({ kind: 'error', message: err instanceof Error ? err.message : 'Password change failed' })
      setBusy(false)
    }
  }

  const field = (key: 'current' | 'next' | 'confirm', label: string, value: string, setValue: (v: string) => void, autoComplete: string) => (
    <label>
      <span>{label}</span>
      <div className="password-field">
        <input type={show[key] ? 'text' : 'password'} value={value} onChange={(e) => { setValue(e.target.value); setNotice(null) }} autoComplete={autoComplete} maxLength={128} autoFocus={key === 'current'} />
        <button type="button" onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))} aria-label={t("Toggle visibility")}>{show[key] ? <EyeOff size={15} /> : <Eye size={15} />}</button>
      </div>
    </label>
  )

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card admin-first-login">
        <AdminLanguageSwitch />
        <div className="admin-login-brand">
          <div className="admin-brand-mark large"><ShieldAlert size={24} /></div>
          <h1>LEVEL UP</h1>
          <p>{t("First sign-in")}</p>
        </div>
        <form className="admin-login-form" onSubmit={(e) => void submit(e)}>
          <h2>{t("Change the initial password")}</h2>
          <p className="admin-login-subtitle">{t("For security, replace the initial password before you start working. After the change, sign in again with the new password.")}</p>
          <div className="admin-info-row admin-account-email"><span>{t("Admin Email")}</span><strong>{adminEmail}</strong></div>
          {field('current', t("Current Password"), currentPassword, setCurrentPassword, 'current-password')}
          {field('next', t("New Password"), newPassword, setNewPassword, 'new-password')}
          {newPassword && (
            <div className="password-strength-bar">
              <div className="password-strength-fill" style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }} />
              <span style={{ color: strength.color }}>{t(strength.label)}</span>
            </div>
          )}
          {field('confirm', t("Confirm New Password"), confirmPassword, setConfirmPassword, 'new-password')}
          {confirmPassword && <small style={{ color: match ? '#38a169' : '#e53e3e' }}>{match ? t("✓ Passwords match") : t("✗ Passwords do not match")}</small>}
          {notice && (
            <div className={`admin-notice admin-notice-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
              {notice.kind === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              <span>{t(notice.message)}</span>
            </div>
          )}
          <button type="submit" className="btn btn-primary full-width" disabled={busy}>{busy ? t("Saving…") : t("Change password")}</button>
          <button type="button" className="btn btn-secondary full-width" onClick={onLogout} disabled={busy}><LogOut size={15} /> {t("Logout")}</button>
        </form>
      </div>
    </div>
  )
}
