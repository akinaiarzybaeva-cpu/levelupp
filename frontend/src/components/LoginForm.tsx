import type { ReactNode } from 'react'
import { type Lang, type translations } from '../appShared'
import { PasswordInput } from './ui'

export type AuthFormState = { name: string; email: string; password: string; confirm: string }
export type AuthErrors = { name?: string; email?: string; password?: string; confirm?: string }

/** Email + password fields of the sign-in form. `children` renders under the fields (forgot-password link). */
export default function LoginForm({ form, errors, onChange, t, children }: {
  form: AuthFormState
  errors: AuthErrors
  onChange: (field: keyof AuthFormState, value: string) => void
  t: (typeof translations)[Lang]
  children?: ReactNode
}) {
  return (
    <>
      <label>
        <span>{t.auth.email}</span>
        <input type="email" value={form.email} onChange={(e) => onChange('email', e.target.value)} placeholder="name@example.com" autoComplete="email" aria-invalid={!!errors.email} />
        {errors.email && <small className="field-error">{errors.email}</small>}
      </label>

      <label>
        <span>{t.auth.password}</span>
        <PasswordInput value={form.password} onChange={(value) => onChange('password', value)} placeholder="••••••••" showLabel={t.auth.show} hideLabel={t.auth.hide} autoComplete="current-password" />
        {errors.password && <small className="field-error">{errors.password}</small>}
      </label>

      {children && <div className="options-row">{children}</div>}
    </>
  )
}
