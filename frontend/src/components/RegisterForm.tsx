import { pick, type Lang, type translations } from '../appShared'
import type { AuthErrors, AuthFormState } from './LoginForm'
import { PasswordInput } from './ui'

/** Name, email, password and password-confirmation fields of the sign-up form. */
export default function RegisterForm({ form, errors, onChange, t, language }: {
  form: AuthFormState
  errors: AuthErrors
  onChange: (field: keyof AuthFormState, value: string) => void
  t: (typeof translations)[Lang]
  language: Lang
}) {
  return (
    <>
      <label>
        <span>{t.auth.name}</span>
        <input value={form.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Jane Doe" />
        {errors.name && <small className="field-error">{errors.name}</small>}
      </label>

      <label>
        <span>{t.auth.email}</span>
        <input type="email" value={form.email} onChange={(e) => onChange('email', e.target.value)} placeholder="name@example.com" autoComplete="email" aria-invalid={!!errors.email} />
        {errors.email && <small className="field-error">{errors.email}</small>}
      </label>

      <label>
        <span>{t.auth.password}</span>
        <PasswordInput value={form.password} onChange={(value) => onChange('password', value)} placeholder="••••••••" showLabel={t.auth.show} hideLabel={t.auth.hide} autoComplete="new-password" />
        {!errors.password && <small className="field-hint-inline">{pick(language, 'Минимум 8 белги', 'Минимум 8 символов', 'At least 8 characters')}</small>}
        {errors.password && <small className="field-error">{errors.password}</small>}
      </label>

      <label>
        <span>{t.auth.confirm}</span>
        <PasswordInput value={form.confirm} onChange={(value) => onChange('confirm', value)} placeholder="••••••••" showLabel={t.auth.show} hideLabel={t.auth.hide} autoComplete="new-password" />
        {errors.confirm && <small className="field-error">{errors.confirm}</small>}
      </label>
    </>
  )
}
