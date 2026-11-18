import { API_BASE_URL } from '../api'
import { fetchJson, type Lang, type translations } from '../appShared'

/**
 * "Forgot password?" action of the sign-in form. Sends a real reset link; the server answers
 * identically whether or not the account exists, so this does not reveal which emails are registered.
 */
export default function ForgotPassword({ email, t, language, disabled, onBusyChange, onEmailError, onNotice }: {
  email: string
  t: (typeof translations)[Lang]
  language: Lang
  disabled?: boolean
  onBusyChange: (busy: boolean) => void
  onEmailError: (message: string) => void
  onNotice: (message: string | null) => void
}) {
  const requestReset = async () => {
    const normalized = email.trim().toLowerCase()
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      onEmailError(language === 'ru' ? 'Введите email, чтобы восстановить пароль' : language === 'kg' ? 'Сырсөздү калыбына келтирүү үчүн email жазыңыз' : 'Enter your email to reset the password')
      return
    }

    onBusyChange(true)
    onNotice(null)
    try {
      await fetchJson<{ ok: true }>(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, language })
      })
      onNotice(t.messages.resetLinkSent)
    } catch (error) {
      onNotice(error instanceof Error ? error.message : t.generic.error)
    } finally {
      onBusyChange(false)
    }
  }

  return (
    <button type="button" className="text-button" onClick={() => { void requestReset() }} disabled={disabled}>{t.auth.forget}</button>
  )
}
