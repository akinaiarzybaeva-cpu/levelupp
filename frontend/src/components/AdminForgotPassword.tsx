import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle, Eye, EyeOff, KeyRound, Mail, RefreshCw, X } from 'lucide-react'
import { API_BASE_URL } from '../api'
import { useLanguage } from '../appShared'
import { useAdminT } from './adminI18n'
import { passwordStrength } from './adminShared'

type Step = 'email' | 'code' | 'password'
type FlowState = { step: Step; email: string; sentAt: number; expiresAt: number; resetToken?: string; resetExpiresAt?: number }
type Notice = { kind: 'success' | 'error' | 'info'; message: string; values?: Array<string | number> }

// Survives a page refresh (sessionStorage = this tab only, cleared when the tab is closed).
// Only the e-mail, timers and the short-lived one-time reset token are kept — never a password or the code.
const STORAGE_KEY = 'levelup-admin-reset-flow'
const CODE_LENGTH = 6

function loadFlow(): FlowState | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const flow = JSON.parse(raw) as FlowState
    if (flow.step === 'password' && (!flow.resetToken || (flow.resetExpiresAt ?? 0) <= Date.now())) return { ...flow, step: 'email', resetToken: undefined }
    return flow
  } catch {
    return null
  }
}

function saveFlow(flow: FlowState | null) {
  try {
    if (flow) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(flow))
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch { /* storage unavailable */ }
}

const mmss = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({})) as Record<string, unknown>
  return { ok: response.ok, status: response.status, data }
}

/**
 * "Forgot password?" for the administrator: e-mail → 6-digit code (5 min, resend after 60 s) →
 * new password twice → back to the login page.
 */
export default function AdminForgotPassword({ initialEmail, onDone, onCancel }: { initialEmail: string; onDone: () => void; onCancel: () => void }) {
  const t = useAdminT()
  const language = useLanguage()
  const [flow, setFlow] = useState<FlowState | null>(() => loadFlow())
  const [email, setEmail] = useState(() => flow?.email ?? initialEmail)
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''))
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState(() => (flow ? flow.sentAt + 60_000 : 0))
  const [now, setNow] = useState(() => Date.now())
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  const step: Step = flow?.step ?? 'email'

  useEffect(() => { saveFlow(flow) }, [flow])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (step === 'code') window.setTimeout(() => inputs.current[digits.findIndex((d) => !d) >= 0 ? digits.findIndex((d) => !d) : 0]?.focus(), 30)
    // focus only when the window opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const resendIn = Math.min(60_000, Math.max(0, cooldownUntil - now))
  const codeLeft = flow ? Math.min(5 * 60_000, flow.expiresAt - now) : 0
  const codeExpired = step === 'code' && codeLeft <= 0

  const requestCode = async (target: string) => {
    const clean = target.trim().toLowerCase()
    setNotice(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setNotice({ kind: 'error', message: 'Enter a valid email address' })
      return
    }
    setBusy(true)
    try {
      const { ok, status, data } = await postJson('/api/auth/admin-reset/request', { email: clean, language })
      if (status === 429 && data.code === 'RESEND_COOLDOWN') {
        const retry = Number(data.retryAfter) || 60
        setCooldownUntil(Date.now() + retry * 1000)
        setNotice({ kind: 'error', message: 'Please wait {0} s before requesting a new code.', values: [retry] })
        if (flow?.email === clean && flow.step === 'code') return
        setFlow({ step: 'code', email: clean, sentAt: Date.now() - (60 - retry) * 1000, expiresAt: flow?.email === clean ? flow.expiresAt : Date.now() + 5 * 60_000 })
        return
      }
      if (status === 404) {
        // The backend does not have the code endpoints yet (an older version is deployed).
        setNotice({ kind: 'error', message: 'Password recovery is not available on the server yet. The backend must be updated (deployed).' })
        return
      }
      if (!ok) {
        setNotice({ kind: 'error', message: String(data.error ?? 'Request failed') })
        return
      }
      const sentAt = Date.now()
      setCooldownUntil(sentAt + (Number(data.cooldownSeconds) || 60) * 1000)
      setDigits(Array(CODE_LENGTH).fill(''))
      setFlow({ step: 'code', email: clean, sentAt, expiresAt: sentAt + (Number(data.expiresInSeconds) || 300) * 1000 })
      setNotice({ kind: 'info', message: 'If this email belongs to the administrator, a 6-digit code has been sent.' })
    } catch {
      setNotice({ kind: 'error', message: 'Network error. Check your connection.' })
    } finally {
      setBusy(false)
    }
  }

  const verifyCode = async (code: string) => {
    if (!flow || busy) return
    setNotice(null)
    if (!/^\d{6}$/.test(code)) {
      setNotice({ kind: 'error', message: 'Enter the 6-digit code from the email.' })
      return
    }
    setBusy(true)
    try {
      const { ok, data } = await postJson('/api/auth/admin-reset/verify', { email: flow.email, code })
      if (!ok) {
        setDigits(Array(CODE_LENGTH).fill(''))
        window.setTimeout(() => inputs.current[0]?.focus(), 30)
        if (data.code === 'CODE_WRONG') setNotice({ kind: 'error', message: 'Wrong code. Attempts left: {0}', values: [Number(data.attemptsLeft ?? 0)] })
        else setNotice({ kind: 'error', message: String(data.error ?? 'Request failed') })
        return
      }
      setFlow({ ...flow, step: 'password', resetToken: String(data.resetToken), resetExpiresAt: Date.now() + (Number(data.expiresInSeconds) || 600) * 1000 })
      setNotice({ kind: 'success', message: 'Code confirmed. Set a new password.' })
    } catch {
      setNotice({ kind: 'error', message: 'Network error. Check your connection.' })
    } finally {
      setBusy(false)
    }
  }

  const setDigit = (index: number, raw: string) => {
    const onlyDigits = raw.replace(/\D/g, '')
    if (!onlyDigits) {
      setDigits((cur) => cur.map((d, i) => (i === index ? '' : d)))
      return
    }
    // Typing or pasting several digits fills the following boxes too.
    const next = [...digits]
    let i = index
    for (const ch of onlyDigits.slice(0, CODE_LENGTH - index)) next[i++] = ch
    setDigits(next)
    if (i < CODE_LENGTH) inputs.current[i]?.focus()
    else inputs.current[CODE_LENGTH - 1]?.blur()
    if (next.every(Boolean)) void verifyCode(next.join(''))
  }

  const onDigitKey = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault()
      setDigits((cur) => cur.map((d, i) => (i === index - 1 ? '' : d)))
      inputs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus()
    else if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus()
  }

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!flow?.resetToken) return
    setNotice(null)
    if (!newPassword || !confirmPassword) return setNotice({ kind: 'error', message: 'Enter and confirm your new password' })
    if (newPassword.length < 8) return setNotice({ kind: 'error', message: 'Password must be at least 8 characters' })
    if (newPassword !== confirmPassword) return setNotice({ kind: 'error', message: 'Passwords do not match' })
    if (!/[A-Za-zА-Яа-яЁёӨөҮүҢң]/.test(newPassword) || !/\d/.test(newPassword)) return setNotice({ kind: 'error', message: 'New password must contain both letters and digits' })
    setBusy(true)
    try {
      const { ok, data } = await postJson('/api/auth/admin-reset/complete', { email: flow.email, resetToken: flow.resetToken, newPassword, confirmPassword, language })
      if (!ok) {
        setNotice({ kind: 'error', message: String(data.error ?? 'Password reset failed') })
        if (data.code === 'RESET_INVALID' || data.code === 'RESET_EXPIRED') setFlow({ ...flow, step: 'email', resetToken: undefined })
        return
      }
      setFlow(null)
      saveFlow(null)
      onDone()
    } catch {
      setNotice({ kind: 'error', message: 'Network error. Check your connection.' })
    } finally {
      setBusy(false)
    }
  }

  const backToEmail = () => {
    setFlow(null)
    setDigits(Array(CODE_LENGTH).fill(''))
    setNotice(null)
  }

  const cancel = () => {
    saveFlow(null)
    setFlow(null)
    onCancel()
  }

  const noticeBox = notice && (
    <div className={`admin-notice admin-notice-${notice.kind === 'info' ? 'success' : notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.kind === 'error' ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
      <span>{t(notice.message, notice.values)}</span>
    </div>
  )

  if (step === 'password') {
    const strength = passwordStrength(newPassword)
    const match = newPassword && confirmPassword && newPassword === confirmPassword
    return (
      <form className="admin-login-form admin-reset-step" onSubmit={(e) => void savePassword(e)}>
        <div className="admin-reset-steps" aria-hidden="true"><i className="done" /><i className="done" /><i className="active" /></div>
        <h2>{t("Set New Password")}</h2>
        <p className="admin-login-subtitle">{t("Account: {0}", [flow?.email ?? ''])}</p>
        <label>
          <span>{t("New Password")}</span>
          <div className="password-field">
            <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setNotice(null) }} placeholder={t("Min. 8 characters")} autoComplete="new-password" autoFocus maxLength={128} />
            <button type="button" onClick={() => setShowNew((v) => !v)} aria-label={t("Toggle visibility")}>{showNew ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
          {newPassword && (
            <div className="password-strength-bar">
              <div className="password-strength-fill" style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }} />
              <span style={{ color: strength.color }}>{t(strength.label)}</span>
            </div>
          )}
        </label>
        <label>
          <span>{t("Confirm New Password")}</span>
          <div className="password-field">
            <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setNotice(null) }} placeholder={t("Repeat new password")} autoComplete="new-password" maxLength={128} />
            <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={t("Toggle visibility")}>{showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
          {confirmPassword && <small style={{ color: match ? '#38a169' : '#e53e3e' }}>{match ? t("✓ Passwords match") : t("✗ Passwords do not match")}</small>}
        </label>
        {noticeBox}
        <button type="submit" className="btn btn-primary full-width" disabled={busy}>{busy ? t("Setting Password…") : t("Save new password")}</button>
        <button type="button" className="btn btn-secondary full-width" onClick={cancel}>{t("Cancel")}</button>
      </form>
    )
  }

  return (
    <>
      <form className="admin-login-form admin-reset-step" onSubmit={(e) => { e.preventDefault(); void requestCode(email) }}>
        <div className="admin-reset-steps" aria-hidden="true"><i className="active" /><i /><i /></div>
        <h2>{t("Reset Password")}</h2>
        <p className="admin-login-subtitle">{t("Enter your administrator Gmail address. We will send a 6-digit code to it.")}</p>
        <label>
          <span>{t("Administrator Email")}</span>
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setNotice(null) }} placeholder="admin@gmail.com" autoComplete="email" autoFocus={step === 'email'} maxLength={254} />
        </label>
        {step === 'email' && noticeBox}
        <button type="submit" className="btn btn-primary full-width" disabled={busy || (resendIn > 0 && flow?.email === email.trim().toLowerCase())}>
          <Mail size={15} /> {busy && step === 'email' ? t("Sending…") : t("Send code")}
        </button>
        <button type="button" className="btn btn-secondary full-width" onClick={cancel}>{t("Back to Login")}</button>
      </form>

      {step === 'code' && flow && (
        <div className="admin-code-overlay" role="presentation">
          <div className="admin-code-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-code-title">
            <button type="button" className="admin-code-close" onClick={backToEmail} aria-label={t("Close")}><X size={18} /></button>
            <div className="admin-reset-steps" aria-hidden="true"><i className="done" /><i className="active" /><i /></div>
            <div className="admin-code-icon"><KeyRound size={22} /></div>
            <h2 id="admin-code-title">{t("Enter the code")}</h2>
            <p className="admin-login-subtitle">{t("We sent a 6-digit code to {0}. Check your inbox and the Spam folder.", [flow.email])}</p>

            <form onSubmit={(e) => { e.preventDefault(); void verifyCode(digits.join('')) }}>
              <div className="admin-otp" onPaste={(e) => { const text = e.clipboardData.getData('text'); if (/\d/.test(text)) { e.preventDefault(); setDigit(0, text) } }}>
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputs.current[index] = el }}
                    value={digit}
                    onChange={(e) => setDigit(index, e.target.value)}
                    onKeyDown={(e) => onDigitKey(index, e)}
                    onFocus={(e) => e.target.select()}
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={CODE_LENGTH}
                    aria-label={t("Digit {0}", [index + 1])}
                    disabled={busy || codeExpired}
                  />
                ))}
              </div>

              <p className={codeExpired ? 'admin-code-timer expired' : 'admin-code-timer'}>
                {codeExpired ? t("The code has expired. Request a new code.") : t("Code is valid for {0}", [mmss(codeLeft)])}
              </p>

              {noticeBox}

              <button type="submit" className="btn btn-primary full-width" disabled={busy || codeExpired || digits.some((d) => !d)}>
                {busy ? t("Checking…") : t("Confirm code")}
              </button>
              <div className="admin-code-actions">
                <button type="button" className="text-button" onClick={() => void requestCode(flow.email)} disabled={busy || resendIn > 0}>
                  <RefreshCw size={13} /> {resendIn > 0 ? t("Resend code in {0} s", [Math.ceil(resendIn / 1000)]) : t("Resend code")}
                </button>
                <button type="button" className="text-button" onClick={backToEmail}>{t("Change email")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
