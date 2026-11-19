import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react'
import { API_BASE_URL, fetchWithWakeRetry, isNetworkError } from '../api'
import { AdminLanguageSwitch, useAdminT } from './adminI18n'
import AdminForgotPassword from './AdminForgotPassword'
import { ADMIN_LOGIN_NOTICE_KEY } from './AdminFirstLogin'

type AdminLoginProps = {
  isLoggedIn: boolean
  userRole?: string
  onLogin: (token: string, user: AdminUser) => void
}

type AdminUser = {
  email: string
  name: string
  role: string
  avatar: string
  firstName?: string
  lastName?: string
}

const API_BASE = API_BASE_URL

/** One-time notice left by the first-login password change before it logged the admin out. */
function consumeLoginNotice(): boolean {
  try {
    const value = window.sessionStorage.getItem(ADMIN_LOGIN_NOTICE_KEY)
    window.sessionStorage.removeItem(ADMIN_LOGIN_NOTICE_KEY)
    return value === 'password-changed'
  } catch {
    return false
  }
}

function safeNextPath(value: string | null): string {
  const next = String(value ?? '').trim()
  return next.startsWith('/') && !next.startsWith('//') ? next : '/admin'
}

export default function AdminLogin({ isLoggedIn, userRole, onLogin }: AdminLoginProps) {
  const t = useAdminT()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // A started recovery (code window / new password) survives a page refresh.
  const [mode, setMode] = useState<'login' | 'forgot'>(() => {
    try { return window.sessionStorage.getItem('levelup-admin-reset-flow') ? 'forgot' : 'login' } catch { return 'login' }
  })
  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('levelup-admin-remembered-email') ?? ''
    }
    return ''
  })
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window !== 'undefined') {
      return Boolean(window.localStorage.getItem('levelup-admin-remembered-email'))
    }
    return false
  })
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(() =>
    searchParams.get('reason') === 'forbidden'
      ? { kind: 'error', message: "This account does not have administrator access. Sign in with the administrator account." }
      : searchParams.get('reset') === 'success' || consumeLoginNotice()
        ? { kind: 'success', message: "Password changed successfully. Now sign in." }
        : null
  )

  // Redirect if already logged in as admin
  useEffect(() => {
    const isAdmin = isLoggedIn && (userRole?.toLowerCase() === 'admin')
    if (isAdmin) {
      const next = safeNextPath(searchParams.get('next'))
      navigate(next, { replace: true })
    }
  }, [isLoggedIn, userRole, navigate, searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)

    if (!email.trim() || !password) {
      setNotice({ kind: 'error', message: "Enter your administrator email and password" })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetchWithWakeRetry(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      })

      const data = await response.json() as {
        ok?: boolean
        token?: string
        error?: string
        user?: { email: string; name: string; role?: string; avatar?: string; firstName?: string; lastName?: string }
      }

      if (!response.ok || !data.ok) {
        setNotice({ kind: 'error', message: data.error ?? t("Invalid email or password") })
        return
      }

      if (data.user?.role?.toLowerCase() !== 'admin') {
        // The credentials were valid but not for the administrator: close the session the
        // server just opened so no stray token stays alive.
        if (data.token) {
          void fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${data.token}` } }).catch(() => undefined)
        }
        setNotice({ kind: 'error', message: "Access denied. This login is strictly for administrators." })
        return
      }

      if (!data.token) {
        setNotice({ kind: 'error', message: "Authentication failed: No session token received." })
        return
      }

      // Handle Remember Me securely
      if (typeof window !== 'undefined') {
        if (rememberMe) {
          window.localStorage.setItem('levelup-admin-remembered-email', email.trim().toLowerCase())
        } else {
          window.localStorage.removeItem('levelup-admin-remembered-email')
        }
      }

      const user: AdminUser = {
        email: data.user.email,
        name: data.user.name,
        role: data.user.role ?? 'Admin',
        avatar: data.user.avatar ?? (data.user.name?.charAt(0)?.toUpperCase() ?? 'A'),
        firstName: data.user.firstName,
        lastName: data.user.lastName
      }

      onLogin(data.token, user)
      const next = safeNextPath(searchParams.get('next'))
      navigate(next, { replace: true })
    } catch (err) {
      const message = isNetworkError(err)
        ? t("The server is not responding right now (it may be starting up or updating). Please wait a minute and try again.")
        : (err instanceof Error ? err.message : t("Login failed"))
      setNotice({ kind: 'error', message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        <AdminLanguageSwitch />
        <div className="admin-login-brand">
          <div className="admin-brand-mark large"><ShieldCheck size={24} /></div>
          <h1>LEVEL UP</h1>
          <p>{t("Administrator Access")}</p>
        </div>

        {mode === 'login' ? (
          <form className="admin-login-form" onSubmit={(e) => void handleLogin(e)}>
            <h2>{t("Admin Login")}</h2>

            <label>
              <span>{t("Administrator Email")}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setNotice(null) }}
                placeholder="admin@levelup.kg"
                autoComplete="email"
                autoFocus
              />
            </label>

            <label>
              <span>{t("Password")}</span>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setNotice(null) }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={t("Toggle password visibility")}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            <div className="admin-login-options" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: 'auto', margin: 0 }}
                />
                <span>{t("Remember me")}</span>
              </label>

              <button type="button" className="text-button" onClick={() => { setMode('forgot'); setNotice(null) }}>
                {t("Forgot Password?")}
              </button>
            </div>

            {notice && (
              <div className={`admin-notice admin-notice-${notice.kind}`}>
                {notice.kind === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                <span>{t(notice.message)}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary full-width" disabled={submitting}>
              {submitting ? (
                <>{t("Signing in…")}</>
              ) : (
                <><Lock size={15} /> {t("Sign in as Admin")}</>
              )}
            </button>

            <div className="admin-login-footer">
              <span>{t("Regular student?")}</span>
              <Link to="/auth">{t("Go to student login")}</Link>
            </div>
          </form>
        ) : (
          <AdminForgotPassword
            initialEmail={email}
            onCancel={() => { setMode('login'); setNotice(null) }}
            onDone={() => {
              setMode('login')
              setPassword('')
              setNotice({ kind: 'success', message: "Password changed successfully. Now sign in." })
            }}
          />
        )}
      </div>
    </div>
  )
}
