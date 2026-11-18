import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bot, CheckCircle2, CreditCard, LayoutDashboard, Lock, ShieldCheck, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ApiError, getDemoPaymentConfig, submitDemoPayment } from '../paymentApi'

type Lang = 'kg' | 'ru' | 'en'
const pick = (lang: Lang, kg: string, ru: string, en: string) => (lang === 'kg' ? kg : lang === 'en' ? en : ru)

export type DemoPaymentPlan = { id: 'pro' | 'aipro'; name: string; title: string; price: number; currency: string; durationDays: number }

// ── Demo-mode flag (fetched once per page load) ──────────────────────────────
let demoConfigPromise: Promise<boolean> | null = null
function loadDemoEnabled() {
  if (!demoConfigPromise) {
    demoConfigPromise = getDemoPaymentConfig().then((cfg) => cfg.enabled).catch(() => {
      demoConfigPromise = null
      return false
    })
  }
  return demoConfigPromise
}
/** null while loading, then whether the backend accepts Demo Payment. */
export function useDemoPaymentEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    void loadDemoEnabled().then((value) => { if (active) setEnabled(value) })
    return () => { active = false }
  }, [])
  return enabled
}

// ── Card helpers (browser only: card data never leaves this component) ───────
const onlyDigits = (value: string) => value.replace(/\D/g, '')
const formatCardNumber = (value: string) => onlyDigits(value).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
const formatExpiry = (value: string) => {
  const digits = onlyDigits(value).slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}
const expiryValid = (value: string) => {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value)
  if (!match) return false
  const now = new Date()
  return Number(`20${match[2]}`) * 12 + Number(match[1]) >= now.getFullYear() * 12 + now.getMonth() + 1
}
const cardBrand = (digits: string) => {
  if (digits.startsWith('4')) return 'VISA'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
  if (digits.startsWith('9417')) return 'Элкарт'
  return ''
}
const newCheckoutKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`)

type Phase = 'form' | 'processing' | 'success'

export default function DemoPaymentModal({ open, onClose, plan, language, onPaid, endsAtText }: {
  open: boolean
  onClose: (paid: boolean) => void
  plan: DemoPaymentPlan
  language: Lang
  /** Re-reads the subscription from the server; resolves to the plan the server now reports. */
  onPaid: () => Promise<string | null>
  endsAtText?: (iso: string) => string
}) {
  const titleId = useId()
  const [phase, setPhase] = useState<Phase>('form')
  const [holder, setHolder] = useState('')
  const [number, setNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [flipped, setFlipped] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [endsAt, setEndsAt] = useState<string | null>(null)
  const checkoutKey = useRef(newCheckoutKey())
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const currency = plan.currency === 'KGS' ? pick(language, 'сом', 'сом', 'KGS') : plan.currency
  const digits = onlyDigits(number)

  // Reset everything (including card data) whenever the window is opened again.
  useEffect(() => {
    if (!open) return
    setPhase('form'); setHolder(''); setNumber(''); setExpiry(''); setCvv(''); setFlipped(false)
    setErrors({}); setFormError(null); setEndsAt(null)
    checkoutKey.current = newCheckoutKey()
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 60)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.clearTimeout(timer); document.body.style.overflow = previousOverflow }
  }, [open])

  const close = () => {
    if (phase === 'processing') return
    const paid = phase === 'success'
    // Drop card data from memory as soon as the window closes.
    setNumber(''); setExpiry(''); setCvv(''); setHolder('')
    onClose(paid)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null

  const validate = () => {
    const next: Record<string, string> = {}
    const required = pick(language, 'Милдеттүү талаа', 'Обязательное поле', 'Required field')
    if (holder.trim().length < 2) next.holder = required
    else if (!/^[\p{L}\s'.-]+$/u.test(holder.trim()) || holder.trim().split(/\s+/).length < 2) next.holder = pick(language, 'Аты-жөнүн жазыңыз (мисалы, AIGERIM ASANOVA)', 'Укажите имя и фамилию (например, AIGERIM ASANOVA)', 'Enter first and last name (e.g. AIGERIM ASANOVA)')
    if (!digits) next.number = required
    else if (digits.length !== 16) next.number = pick(language, 'Карта номери 16 сандан турушу керек', 'Номер карты должен содержать 16 цифр', 'Card number must have 16 digits')
    if (!expiry) next.expiry = required
    else if (!expiryValid(expiry)) next.expiry = pick(language, 'Туура эмес же өтүп кеткен мөөнөт', 'Неверный или истёкший срок', 'Invalid or expired date')
    if (!cvv) next.cvv = required
    else if (!/^\d{3}$/.test(cvv)) next.cvv = pick(language, '3 сан', '3 цифры', '3 digits')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const errorText = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 401) return pick(language, 'Сессия бүттү. Кайра кириңиз.', 'Сессия истекла. Войдите снова.', 'Your session has expired. Please log in again.')
      if (err.code === 'PLAN_INCLUDED') return pick(language, 'Бул тариф учурдагы тарифиңизге кирет.', 'Этот тариф уже входит в ваш текущий тариф.', 'This plan is already included in your current plan.')
      if (err.code === 'PLAN_DISABLED' || err.code === 'PLAN_UNSUPPORTED') return pick(language, 'Бул тариф азыр жеткиликсиз.', 'Этот тариф сейчас недоступен.', 'This plan is not available right now.')
      if (err.code === 'DEMO_DISABLED') return pick(language, 'Карта менен төлөө азыр өчүрүлгөн.', 'Оплата картой сейчас отключена.', 'Card payment is turned off right now.')
      if (err.code === 'RATE_LIMITED') return pick(language, 'Өтө көп аракет. Бир аздан кийин кайталаңыз.', 'Слишком много попыток. Попробуйте позже.', 'Too many attempts. Please try again later.')
    }
    if (err instanceof TypeError) return pick(language, 'Сервер жооп бербей жатат. Бир мүнөттөн кийин кайталаңыз.', 'Сервер не отвечает. Попробуйте через минуту.', 'The server is not responding. Please try again in a minute.')
    return pick(language, 'Төлөм аяктаган жок. Тариф өзгөргөн жок.', 'Оплата не завершена. Тариф не изменился.', 'Payment was not completed. Your plan did not change.')
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    if (!validate()) return
    setPhase('processing')
    const started = Date.now()
    try {
      // Only the plan, the cardholder name and the one-time key are sent. Never the card data.
      const result = await submitDemoPayment({ planId: plan.id, cardholderName: holder.trim(), checkoutKey: checkoutKey.current })
      const confirmedPlan = await onPaid()
      const wait = 1400 - (Date.now() - started)
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      // Success is shown only when the backend confirmed the payment AND reports the plan as active.
      if (result.status !== 'paid' || confirmedPlan !== plan.id) {
        setPhase('form')
        setFormError(pick(language, 'Сервер тарифтин активдешүүсүн ырастаган жок. Жеке кабинетти текшериңиз.', 'Сервер не подтвердил активацию тарифа. Проверьте личный кабинет.', 'The server did not confirm the activation. Please check your dashboard.'))
        return
      }
      setNumber(''); setExpiry(''); setCvv('')
      setEndsAt(result.endsAt ?? null)
      setPhase('success')
    } catch (err) {
      setPhase('form')
      setFormError(errorText(err))
    }
  }

  const shownNumber = (digits + '•'.repeat(16 - digits.length)).replace(/(.{4})(?=.)/g, '$1 ')
  const brand = cardBrand(digits)

  return createPortal(
    <div className="pay-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <div className={`pay-modal phase-${phase}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button type="button" className="pay-modal-close" onClick={close} disabled={phase === 'processing'} aria-label={pick(language, 'Жабуу', 'Закрыть', 'Close')}><X size={18} /></button>

        <header className="pay-modal-head">
          <span className="pay-modal-icon"><CreditCard size={20} /></span>
          <div>
            <h2 id={titleId}>{pick(language, 'Тарифти төлөө', 'Оплата тарифа', 'Plan payment')}</h2>
            <p>{plan.name} · {plan.title}</p>
          </div>
          <div className="pay-modal-price"><strong>{plan.price} {currency}</strong><span>/ {pick(language, `${plan.durationDays} күн`, `${plan.durationDays} дней`, `${plan.durationDays} days`)}</span></div>
        </header>

        {phase === 'success' ? (
          <div className="pay-success" role="status" aria-live="polite">
            <span className="pay-success-check"><CheckCircle2 size={56} /></span>
            <h3>{pick(language, 'Төлөм ийгиликтүү аяктады!', 'Оплата успешно завершена!', 'Payment completed successfully!')}</h3>
            <p>
              {pick(language, `${plan.name} тарифи активдештирилди`, `Тариф ${plan.name} активирован`, `${plan.name} is now active`)}
              {endsAt && endsAtText ? ` · ${pick(language, 'чейин', 'до', 'until')} ${endsAtText(endsAt)}` : ''}
            </p>
            <div className="pay-success-actions">
              {plan.id === 'aipro' && <Link to="/dashboard/ai" className="btn btn-primary" onClick={() => onClose(true)}><Bot size={17} /> {pick(language, 'AI жардамчыны ачуу', 'Открыть AI-ассистента', 'Open AI assistant')}</Link>}
              <Link to="/dashboard" className={plan.id === 'aipro' ? 'btn btn-secondary' : 'btn btn-primary'} onClick={() => onClose(true)}><LayoutDashboard size={17} /> {pick(language, 'Жеке кабинет', 'Личный кабинет', 'Dashboard')}</Link>
              <button type="button" className="btn btn-secondary" onClick={close}>{pick(language, 'Жабуу', 'Закрыть', 'Close')}</button>
            </div>
          </div>
        ) : (
          <form className="pay-form" noValidate onSubmit={(event) => { void submit(event) }}>
            <div className={flipped ? 'pay-card-scene flipped' : 'pay-card-scene'} aria-hidden="true">
              <div className="pay-card">
                <div className="pay-card-face pay-card-front">
                  <div className="pay-card-top"><span className="pay-card-chip" /><span className="pay-card-brand">{brand || 'LevelUp'}</span></div>
                  <div className="pay-card-number">{shownNumber}</div>
                  <div className="pay-card-bottom">
                    <div><small>{pick(language, 'Карта ээси', 'Владелец', 'Card holder')}</small><span>{holder.trim().toUpperCase() || 'NAME SURNAME'}</span></div>
                    <div><small>{pick(language, 'Мөөнөт', 'Срок', 'Expires')}</small><span>{expiry || 'MM/YY'}</span></div>
                  </div>
                </div>
                <div className="pay-card-face pay-card-back">
                  <div className="pay-card-stripe" />
                  <div className="pay-card-cvv"><small>CVV</small><span>{'•'.repeat(cvv.length) || '•••'}</span></div>
                </div>
              </div>
            </div>

            <div className="pay-fields">
              <label className={errors.holder ? 'pay-field wide has-error' : 'pay-field wide'}>
                <span>{pick(language, 'Карта ээсинин аты-жөнү', 'Имя и фамилия владельца карты', 'Cardholder first and last name')}</span>
                <input ref={firstFieldRef} type="text" autoComplete="cc-name" maxLength={60} placeholder="AIGERIM ASANOVA" value={holder} onChange={(event) => setHolder(event.target.value.toUpperCase())} aria-invalid={!!errors.holder} disabled={phase === 'processing'} />
                {errors.holder && <small className="field-error">{errors.holder}</small>}
              </label>
              <label className={errors.number ? 'pay-field wide has-error' : 'pay-field wide'}>
                <span>{pick(language, 'Карта номери', 'Номер карты', 'Card number')}</span>
                <input type="text" inputMode="numeric" autoComplete="cc-number" maxLength={19} placeholder="0000 0000 0000 0000" value={number} onChange={(event) => setNumber(formatCardNumber(event.target.value))} aria-invalid={!!errors.number} disabled={phase === 'processing'} />
                {errors.number && <small className="field-error">{errors.number}</small>}
              </label>
              <label className={errors.expiry ? 'pay-field has-error' : 'pay-field'}>
                <span>{pick(language, 'Жарактуулук мөөнөтү', 'Срок действия', 'Expiry date')}</span>
                <input type="text" inputMode="numeric" autoComplete="cc-exp" maxLength={5} placeholder={pick(language, 'АА/ЖЖ', 'ММ/ГГ', 'MM/YY')} value={expiry} onChange={(event) => setExpiry(formatExpiry(event.target.value))} aria-invalid={!!errors.expiry} disabled={phase === 'processing'} />
                {errors.expiry && <small className="field-error">{errors.expiry}</small>}
              </label>
              <label className={errors.cvv ? 'pay-field has-error' : 'pay-field'}>
                <span>CVV / CVC</span>
                <input type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={3} placeholder="•••" value={cvv} onChange={(event) => setCvv(onlyDigits(event.target.value).slice(0, 3))} onFocus={() => setFlipped(true)} onBlur={() => setFlipped(false)} aria-invalid={!!errors.cvv} disabled={phase === 'processing'} />
                {errors.cvv && <small className="field-error">{errors.cvv}</small>}
              </label>
            </div>

            {formError && <p className="error-message" role="alert">{formError}</p>}

            <button type="submit" className="btn btn-primary pay-submit" disabled={phase === 'processing'}>
              {phase === 'processing'
                ? <><span className="pay-spinner" aria-hidden="true" /> {pick(language, 'Төлөм иштетилүүдө...', 'Обработка оплаты...', 'Processing payment...')}</>
                : <><ShieldCheck size={18} /> {pick(language, 'Төлөө', 'Оплатить', 'Pay')} {plan.price} {currency}</>}
            </button>

            <p className="pay-note"><Lock size={14} /> {pick(language,
              'Демо-төлөм: акча алынбайт. Карта маалыматтары серверге жөнөтүлбөйт жана сакталбайт.',
              'Демо-оплата: деньги не списываются. Данные карты не отправляются на сервер и не сохраняются.',
              'Demo payment: no money is charged. Card details are not sent to the server or stored.')}</p>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
