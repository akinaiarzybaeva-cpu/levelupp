import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react'

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

function getApiBase(): string {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
  if (configured) return configured
  const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
  if (isLocal) return 'http://localhost:8787'
  return import.meta.env.PROD ? 'https://levelupp-2b3j.onrender.com' : 'http://localhost:8787'
}

const API_BASE = getApiBase()

export default function AdminLogin({ isLoggedIn, userRole, onLogin }: AdminLoginProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
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
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  // Redirect if already logged in as admin
  useEffect(() => {
    const isAdmin = isLoggedIn && (userRole?.toLowerCase() === 'admin')
    if (isAdmin) {
      const next = searchParams.get('next') ?? '/admin'
      navigate(next, { replace: true })
    }
  }, [isLoggedIn, userRole, navigate, searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)

    if (!email.trim() || !password) {
      setNotice({ kind: 'error', message: 'Enter your administrator email and password' })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
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
        setNotice({ kind: 'error', message: data.error ?? 'Invalid email or password' })
        return
      }

      if (data.user?.role?.toLowerCase() !== 'admin') {
        setNotice({ kind: 'error', message: 'Access denied. This login is strictly for administrators.' })
        return
      }

      if (!data.token) {
        setNotice({ kind: 'error', message: 'Authentication failed: No session token received.' })
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
      const next = searchParams.get('next') ?? '/admin'
      navigate(next, { replace: true })
    } catch (err) {
      const message = err instanceof Error && err.message === 'Failed to fetch'
        ? 'Cannot connect to backend server. Make sure the backend is running on port 8787.'
        : (err instanceof Error ? err.message : 'Login failed')
      setNotice({ kind: 'error', message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)

    if (!email.trim()) {
      setNotice({ kind: 'error', message: 'Enter the administrator email address' })
      return
    }

    setSubmitting(true)
    try {
      await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      })

      // Generic success message to protect against email enumeration
      setNotice({
        kind: 'success',
        message: 'If this email belongs to the administrator, a password reset link has been sent. Check your inbox (or the server console if email is in local mode).'
      })
    } catch {
      setNotice({ kind: 'success', message: 'Password reset request submitted. Check your inbox.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <div className="admin-brand-mark large"><ShieldCheck size={24} /></div>
          <h1>LEVEL UP</h1>
          <p>Administrator Access</p>
        </div>

        {mode === 'login' ? (
          <form className="admin-login-form" onSubmit={(e) => void handleLogin(e)}>
            <h2>Admin Login</h2>

            <label>
              <span>Administrator Email</span>
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
              <span>Password</span>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setNotice(null) }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password visibility">
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
                <span>Remember me</span>
              </label>

              <button type="button" className="text-button" onClick={() => { setMode('forgot'); setNotice(null) }}>
                Forgot Password?
              </button>
            </div>

            {notice && (
              <div className={`admin-notice admin-notice-${notice.kind}`}>
                {notice.kind === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                <span>{notice.message}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary full-width" disabled={submitting}>
              {submitting ? (
                <>Signing in…</>
              ) : (
                <><Lock size={15} /> Sign in as Admin</>
              )}
            </button>

            <div className="admin-login-footer">
              <span>Regular student?</span>
              <a href="/auth">Go to student login</a>
            </div>
          </form>
        ) : (
          <form className="admin-login-form" onSubmit={(e) => void handleForgotPassword(e)}>
            <h2>Reset Password</h2>
            <p className="admin-login-subtitle">Enter the administrator email to receive a password reset link.</p>

            <label>
              <span>Administrator Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setNotice(null) }}
                placeholder="admin@levelup.kg"
                autoComplete="email"
                autoFocus
              />
            </label>

            {notice && (
              <div className={`admin-notice admin-notice-${notice.kind}`}>
                {notice.kind === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                <span>{notice.message}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary full-width" disabled={submitting}>
              {submitting ? 'Sending Link…' : 'Send Reset Link'}
            </button>

            <button type="button" className="btn btn-secondary full-width" onClick={() => { setMode('login'); setNotice(null) }}>
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
