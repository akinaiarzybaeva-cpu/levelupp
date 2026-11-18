import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock } from 'lucide-react'
import { API_BASE_URL } from '../api'
import { AdminLanguageSwitch, useAdminT } from './adminI18n'
import { useLanguage } from '../appShared'

const API_BASE = API_BASE_URL

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (score <= 1) return { score, label: 'Weak', color: '#e53e3e' }
  if (score <= 2) return { score, label: 'Fair', color: '#dd6b20' }
  if (score <= 3) return { score, label: 'Good', color: '#d69e2e' }
  return { score, label: 'Strong', color: '#38a169' }
}

type ResetAudience = 'admin' | 'user'

/**
 * Password reset page. Used at /admin/reset-password (administrator) and
 * /reset-password (regular users); only the texts and the login route differ.
 */
export default function AdminResetPassword({ audience = 'admin' }: { audience?: ResetAudience }) {
  const t = useAdminT()
  const language = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const loginPath = audience === 'admin' ? '/admin/login' : '/auth?mode=login'
  const rawToken = searchParams.get('token') ?? ''
  const tokenId = searchParams.get('id') ?? ''
  const hasLinkParams = Boolean(rawToken && tokenId)
  const [tokenValid, setTokenValid] = useState<boolean | null>(hasLinkParams ? null : false)
  const [tokenError, setTokenError] = useState<string | null>(hasLinkParams ? null : t("Invalid reset link. The URL is missing required parameters."))
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!rawToken || !tokenId) return

    const verifyToken = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/reset-password/verify?token=${encodeURIComponent(rawToken)}&id=${encodeURIComponent(tokenId)}`)
        const data = await response.json() as { valid?: boolean; error?: string; expiresAt?: string }
        if (!response.ok || !data.valid) {
          setTokenValid(false)
          setTokenError(data.error ?? t("This reset link is invalid or has expired."))
        } else {
          setTokenValid(true)
        }
      } catch {
        setTokenValid(false)
        setTokenError(t("Could not verify the reset link. Check your connection."))
      }
    }

    void verifyToken()
  }, [rawToken, tokenId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)

    if (!newPassword || !confirmPassword) {
      setNotice({ kind: 'error', message: "Enter and confirm your new password" })
      return
    }

    if (newPassword.length < 8) {
      setNotice({ kind: 'error', message: "Password must be at least 8 characters" })
      return
    }

    if (newPassword !== confirmPassword) {
      setNotice({ kind: 'error', message: "Passwords do not match" })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          tokenId,
          newPassword,
          confirmPassword,
          language
        })
      })

      const data = await response.json() as { ok?: boolean; error?: string; message?: string }

      if (!response.ok || !data.ok) {
        setNotice({ kind: 'error', message: data.error ?? t("Password reset failed") })
        return
      }

      setDone(true)
      setNotice({ kind: 'success', message: "Password changed successfully. Now sign in." })

      // Redirect to the login page after 3 seconds
      setTimeout(() => {
        navigate(audience === 'admin' ? '/admin/login?reset=success' : loginPath, { replace: true })
      }, 3000)
    } catch (err) {
      setNotice({ kind: 'error', message: err instanceof Error ? err.message : t("Request failed") })
    } finally {
      setSubmitting(false)
    }
  }

  const strength = passwordStrength(newPassword)
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword

  if (tokenValid === null) {
    return (
      <div className="admin-login-shell">
        <div className="admin-login-card">
          <AdminLanguageSwitch />
          <div className="admin-login-brand">
            <div className="admin-brand-mark large"><Lock size={24} /></div>
            <h1>LEVEL UP</h1>
          </div>
          <div className="admin-loading-state">{t("Verifying reset link…")}</div>
        </div>
      </div>
    )
  }

  if (tokenValid === false) {
    return (
      <div className="admin-login-shell">
        <div className="admin-login-card">
          <AdminLanguageSwitch />
          <div className="admin-login-brand">
            <div className="admin-brand-mark large"><AlertCircle size={24} /></div>
            <h1>LEVEL UP</h1>
          </div>
          <div className="admin-notice admin-notice-error">
            <AlertCircle size={16} />
            <span>{t(tokenError ?? '')}</span>
          </div>
          <button type="button" className="btn btn-primary full-width" onClick={() => navigate(loginPath)}>
            {t("Back to Login")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        <AdminLanguageSwitch />
        <div className="admin-login-brand">
          <div className="admin-brand-mark large"><Lock size={24} /></div>
          <h1>LEVEL UP</h1>
          <p>{audience === 'admin' ? t("Set New Admin Password") : t("Set New Password")}</p>
        </div>

        {done ? (
          <div>
            <div className="admin-notice admin-notice-success">
              <CheckCircle size={16} />
              <span>{t(notice?.message ?? '')}</span>
            </div>
            <p className="admin-login-subtitle">{t("Redirecting to login page…")}</p>
            <button type="button" className="btn btn-primary full-width" onClick={() => navigate(loginPath, { replace: true })}>
              {t("Go to Login Now")}
            </button>
          </div>
        ) : (
          <form className="admin-login-form" onSubmit={(e) => void handleSubmit(e)}>
            <h2>{t("Reset Password")}</h2>
            <p className="admin-login-subtitle">{audience === 'admin' ? t("Enter a strong new administrator password.") : t("Enter a strong new password for your account.")}</p>

            <label>
              <span>{t("New Password")}</span>
              <div className="password-field">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setNotice(null) }}
                  placeholder={t("Min. 8 characters")}
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" onClick={() => setShowNew((v) => !v)} aria-label={t("Toggle visibility")}>
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {newPassword && (
                <div className="password-strength-bar">
                  <div
                    className="password-strength-fill"
                    style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }}
                  />
                  <span style={{ color: strength.color }}>{t(strength.label)}</span>
                </div>
              )}
            </label>

            <label>
              <span>{t("Confirm New Password")}</span>
              <div className="password-field">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setNotice(null) }}
                  placeholder={t("Repeat new password")}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={t("Toggle visibility")}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmPassword && (
                <small style={{ color: passwordsMatch ? '#38a169' : '#e53e3e' }}>
                  {passwordsMatch ? t("✓ Passwords match") : t("✗ Passwords do not match")}
                </small>
              )}
            </label>

            {notice && (
              <div className={`admin-notice admin-notice-${notice.kind}`}>
                {notice.kind === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                <span>{t(notice.message)}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary full-width" disabled={submitting}>
              {submitting ? t("Setting Password…") : t("Set New Password")}
            </button>

            <button type="button" className="btn btn-secondary full-width" onClick={() => navigate(loginPath)}>
              {t("Cancel")}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
