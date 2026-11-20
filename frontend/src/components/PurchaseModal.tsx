import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bot, CheckCircle2, Clock3, FlaskConical, LayoutDashboard, Lock, RefreshCw, Send, ShieldCheck, WalletCards, X, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ApiError, getManualTransferConfig, getPaymentOrderStatus, submitDemoPayment, submitManualTransfer, type ManualTransferConfig } from '../paymentApi'
import { useDemoPaymentEnabled } from './PaymentModal'
import { accessPlanOf, formatDateTime, pick, useBilling, type Lang, type PlanView } from '../appShared'

/** The three wallets offered to buyers, in display order. `id` is what the backend stores. */
const WALLETS = [
  { id: 'MBank', label: 'MBank' },
  { id: 'Элсом', label: 'Элсом' },
  { id: 'O!Деньги', label: 'О!Деньги' }
] as const
type WalletId = (typeof WALLETS)[number]['id']

// Payment details are public server config: fetched once per page load.
let manualConfigPromise: Promise<ManualTransferConfig> | null = null
function loadManualConfig() {
  if (!manualConfigPromise) {
    manualConfigPromise = getManualTransferConfig().catch(() => {
      manualConfigPromise = null
      return { enabled: false } as ManualTransferConfig
    })
  }
  return manualConfigPromise
}

const shortOrder = (orderId: string | null | undefined) => (orderId ? `LU-${orderId.replace(/-/g, '').slice(0, 8).toUpperCase()}` : '')
const newCheckoutKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`)

type Phase = 'form' | 'sending' | 'pending' | 'checking' | 'success' | 'failed'

/**
 * Purchase window: plan, price, buyer, payment method (MBank / Элсом / О!Деньги), payment details
 * and "Send payment". A wallet with payment details configured on the server creates a request that
 * the administrator confirms; the plan is NOT activated before that. When no wallet is connected and
 * the server runs in DEMO mode, the same window offers a clearly labelled DEMO purchase instead.
 */
export default function PurchaseModal({ open, onClose, plan, language }: {
  open: boolean
  onClose: () => void
  plan: PlanView
  language: Lang
}) {
  const titleId = useId()
  const { userEmail, userName, subscription, refreshSubscription } = useBilling()
  const demoEnabled = useDemoPaymentEnabled()
  const [config, setConfig] = useState<ManualTransferConfig | null>(null)
  const [phase, setPhase] = useState<Phase>('form')
  const [method, setMethod] = useState<WalletId>('MBank')
  const [fullName, setFullName] = useState('')
  const [payerName, setPayerName] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [endsAt, setEndsAt] = useState<string | null>(null)
  const [wasDemo, setWasDemo] = useState(false)
  const [reviewNote, setReviewNote] = useState<string | null>(null)
  const checkoutKey = useRef(newCheckoutKey())
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const currency = plan.currency === 'KGS' ? 'сом' : plan.currency
  const current = accessPlanOf(subscription)
  const isRenewal = current === plan.id
  const pendingManual = subscription.pendingOrder && subscription.pendingOrder.provider === 'manual' ? subscription.pendingOrder : null

  useEffect(() => {
    if (!open) return
    let active = true
    void loadManualConfig().then((cfg) => { if (active) setConfig(cfg) })
    // A transfer already waiting for the administrator is shown instead of a second form.
    setPhase(pendingManual ? 'pending' : 'form')
    setOrderId(pendingManual?.orderId ?? null)
    setFullName(userName ?? ''); setPayerName(''); setReference(''); setNote(''); setConfirmed(false)
    setErrors({}); setFormError(null); setEndsAt(null); setWasDemo(false); setReviewNote(null)
    checkoutKey.current = newCheckoutKey()
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 60)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { active = false; window.clearTimeout(timer); document.body.style.overflow = previousOverflow }
    // Reset only when the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const busy = phase === 'sending' || phase === 'checking'
  const close = () => { if (!busy) onClose() }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null

  const wallet = config?.methods?.find((item) => item.id === method) ?? null
  // manual = real payment checked by the administrator; demo = test purchase, no money involved.
  const mode: 'manual' | 'demo' | 'unavailable' | 'loading' = config === null || demoEnabled === null
    ? 'loading'
    : wallet ? 'manual' : demoEnabled ? 'demo' : 'unavailable'
  const planTitle = `${plan.name} · ${plan.label[language]}`
  const periodText = pick(language, `${plan.durationDays} күн`, `${plan.durationDays} дней`, `${plan.durationDays} days`)

  const errorText = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 401) return pick(language, 'Сессия бүттү. Кайра кириңиз.', 'Сессия истекла. Войдите снова.', 'Your session has expired. Please log in again.')
      if (err.code === 'PLAN_INCLUDED') return pick(language, 'Бул тариф учурдагы тарифиңизге кирет.', 'Этот тариф уже входит в ваш текущий тариф.', 'This plan is already included in your current plan.')
      if (err.code === 'PLAN_DISABLED' || err.code === 'PLAN_UNSUPPORTED') return pick(language, 'Бул тариф азыр жеткиликсиз.', 'Этот тариф сейчас недоступен.', 'This plan is not available right now.')
      if (err.code === 'METHOD_UNSUPPORTED' || err.code === 'MANUAL_NOT_CONFIGURED') return pick(language, 'Бул төлөм ыкмасы азыр жеткиликсиз. Башкасын тандаңыз.', 'Этот способ оплаты сейчас недоступен. Выберите другой.', 'This payment method is not available right now. Choose another one.')
      if (err.code === 'DUPLICATE_REFERENCE') return pick(language, 'Бул транзакция номери мурун эле жөнөтүлгөн.', 'Этот номер транзакции уже был отправлен.', 'This transaction number has already been submitted.')
      if (err.code === 'MANUAL_PENDING_EXISTS') return pick(language, 'Сизде текшерүүнү күтүп жаткан төлөм бар. Администратордун жообун күтүңүз.', 'У вас уже есть платёж, ожидающий проверки. Дождитесь решения администратора.', 'You already have a payment awaiting review. Please wait for the administrator.')
      if (err.code === 'INVALID_REFERENCE') return pick(language, 'Транзакция номери туура эмес (4–64 белги: тамгалар, сандар, «-»).', 'Неверный номер транзакции (4–64 символа: буквы, цифры, «-»).', 'Invalid transaction number (4–64 characters: letters, digits, "-").')
      if (err.code === 'CARD_DATA_REJECTED') return pick(language, 'Карта номерин жазбаңыз — транзакциянын номерин гана көрсөтүңүз.', 'Не вводите номер карты — укажите только номер транзакции.', 'Do not enter a card number — use the transaction number only.')
      if (err.code === 'DEMO_DISABLED') return pick(language, 'DEMO режими өчүрүлгөн.', 'DEMO-режим отключён.', 'DEMO mode is turned off.')
      if (err.code === 'RATE_LIMITED') return pick(language, 'Өтө көп аракет. Бир аздан кийин кайталаңыз.', 'Слишком много попыток. Попробуйте позже.', 'Too many attempts. Please try again later.')
      if (err.code === 'MISSING_FIELDS') return pick(language, 'Бардык милдеттүү талааларды толтуруңуз.', 'Заполните все обязательные поля.', 'Please fill in all required fields.')
      return err.message
    }
    if (err instanceof TypeError) return pick(language, 'Сервер жооп бербей жатат. Бир мүнөттөн кийин кайталаңыз.', 'Сервер не отвечает. Попробуйте через минуту.', 'The server is not responding. Please try again in a minute.')
    return pick(language, 'Төлөм жөнөтүлгөн жок. Тариф өзгөргөн жок.', 'Платёж не отправлен. Тариф не изменился.', 'The payment was not sent. Your plan did not change.')
  }

  const validate = () => {
    const next: Record<string, string> = {}
    const required = pick(language, 'Милдеттүү талаа', 'Обязательное поле', 'Required field')
    if (fullName.trim().length < 2) next.fullName = required
    if (mode === 'manual') {
      if (payerName.trim().length < 2) next.payerName = required
      if (!reference.trim()) next.reference = required
      else if (!/^[A-Za-z0-9][A-Za-z0-9\-_/.# ]{3,63}$/.test(reference.trim())) next.reference = pick(language, '4–64 белги: тамгалар, сандар, «-»', '4–64 символа: буквы, цифры, «-»', '4–64 characters: letters, digits, "-"')
      else if (/(?:\d[ -]?){13,19}/.test(reference)) next.reference = pick(language, 'Карта номерин жазбаңыз', 'Не вводите номер карты', 'Do not enter a card number')
    }
    if (!confirmed) next.confirm = pick(language, 'Сатып алууну ырастаңыз', 'Подтвердите покупку', 'Please confirm the purchase')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    if (!userEmail || mode === 'loading' || mode === 'unavailable') return
    if (!validate()) return
    setPhase('sending')
    try {
      if (mode === 'manual') {
        const created = await submitManualTransfer({ planId: plan.id, fullName: fullName.trim(), email: userEmail, payerName: payerName.trim(), paymentReference: reference.trim(), receiptNote: note.trim() || undefined, paymentMethod: method, language })
        setOrderId(created.orderId)
        setPhase('pending')
        void refreshSubscription()
        return
      }
      const started = Date.now()
      const result = await submitDemoPayment({ planId: plan.id, cardholderName: fullName.trim(), checkoutKey: checkoutKey.current, language })
      const fresh = await refreshSubscription()
      const wait = 1200 - (Date.now() - started)
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      // Success only when the server confirms the order AND reports the plan as active.
      if (result.status !== 'paid' || (fresh && accessPlanOf(fresh) !== plan.id)) {
        setPhase('form')
        setFormError(pick(language, 'Сервер тарифтин активдешүүсүн ырастаган жок. Жеке кабинетти текшериңиз.', 'Сервер не подтвердил активацию тарифа. Проверьте личный кабинет.', 'The server did not confirm the activation. Please check your dashboard.'))
        return
      }
      setOrderId(result.orderId)
      setEndsAt(result.endsAt ?? fresh?.endsAt ?? null)
      setWasDemo(true)
      setPhase('success')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_REFERENCE') setErrors({ reference: errorText(err) })
      setFormError(errorText(err))
      setPhase('form')
    }
  }

  const checkStatus = async () => {
    if (!orderId) return
    setPhase('checking')
    setFormError(null)
    try {
      const order = await getPaymentOrderStatus(orderId)
      if (order.status === 'paid' && order.activated) {
        const fresh = await refreshSubscription()
        setEndsAt(fresh?.endsAt ?? null)
        setPhase('success')
      } else if (order.status === 'failed' || order.status === 'cancelled') {
        setReviewNote(order.reviewNote ?? null)
        void refreshSubscription()
        setPhase('failed')
      } else {
        setPhase('pending')
      }
    } catch (err) {
      setFormError(errorText(err))
      setPhase('pending')
    }
  }

  const accountComment = `LevelUp ${subscription.accountId ?? userEmail ?? ''} ${plan.name}`.trim()

  return createPortal(
    <div className="pay-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <div className={`pay-modal purchase-modal phase-${phase}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button type="button" className="pay-modal-close" onClick={close} disabled={busy} aria-label={pick(language, 'Жабуу', 'Закрыть', 'Close')}><X size={18} /></button>

        <header className="pay-modal-head">
          <span className="pay-modal-icon"><WalletCards size={20} /></span>
          <div>
            <h2 id={titleId}>{isRenewal ? pick(language, 'Тарифти узартуу', 'Продление тарифа', 'Renew plan') : pick(language, 'Тарифти сатып алуу', 'Покупка тарифа', 'Buy plan')}</h2>
            <p>{planTitle}</p>
          </div>
          <div className="pay-modal-price"><strong>{plan.price} {currency}</strong><span>/ {periodText}</span></div>
        </header>

        {phase === 'success' ? (
          <div className="pay-success purchase-success" role="status" aria-live="polite">
            <span className="purchase-success-burst" aria-hidden="true"><CheckCircle2 size={58} /></span>
            <h3>{wasDemo ? pick(language, 'DEMO-сатып алуу аяктады', 'DEMO-покупка завершена', 'DEMO purchase completed') : pick(language, 'Төлөм ырасталды!', 'Оплата подтверждена!', 'Payment confirmed!')}</h3>
            <p>
              {pick(language, `${plan.name} тарифи активдүү`, `Тариф ${plan.name} активен`, `${plan.name} is now active`)}
              {endsAt ? ` · ${pick(language, 'чейин', 'до', 'until')} ${formatDateTime(endsAt, language)}` : ''}
            </p>
            {wasDemo && <p className="purchase-demo-note"><FlaskConical size={14} /> {pick(language, 'DEMO режими: акча алынган жок.', 'DEMO-режим: деньги не списывались.', 'DEMO mode: no money was charged.')}</p>}
            {orderId && <p className="purchase-order-id">Order ID: <code>{shortOrder(orderId)}</code></p>}
            <div className="pay-success-actions">
              {plan.id === 'aipro' && <Link to="/dashboard/ai" className="btn btn-primary" onClick={onClose}><Bot size={17} /> {pick(language, 'AI жардамчыны ачуу', 'Открыть AI-ассистента', 'Open AI assistant')}</Link>}
              <Link to="/dashboard" className={plan.id === 'aipro' ? 'btn btn-secondary' : 'btn btn-primary'} onClick={onClose}><LayoutDashboard size={17} /> {pick(language, 'Жеке кабинет', 'Личный кабинет', 'Dashboard')}</Link>
            </div>
          </div>
        ) : phase === 'failed' ? (
          <div className="pay-success purchase-failed" role="alert">
            <span className="purchase-failed-icon" aria-hidden="true"><XCircle size={54} /></span>
            <h3>{pick(language, 'Төлөм ырасталган жок', 'Оплата не подтверждена', 'Payment not confirmed')}</h3>
            <p>{pick(language, 'Администратор төлөмдү тапкан жок, тариф өзгөргөн жок. Транзакция номерин текшерип, кайра жөнөтүңүз.', 'Администратор не нашёл платёж, тариф не изменился. Проверьте номер транзакции и отправьте снова.', 'The administrator could not find the payment; your plan did not change. Check the transaction number and send it again.')}</p>
            {reviewNote && <p><strong>{pick(language, 'Себеби', 'Причина', 'Reason')}:</strong> {reviewNote}</p>}
            <div className="pay-success-actions">
              <button type="button" className="btn btn-primary" onClick={() => { setOrderId(null); setPhase('form') }}><RefreshCw size={16} /> {pick(language, 'Кайра аракет кылуу', 'Попробовать снова', 'Try again')}</button>
            </div>
          </div>
        ) : phase === 'pending' || phase === 'checking' ? (
          <div className="pay-success purchase-pending" role="status" aria-live="polite">
            <span className="purchase-pending-icon" aria-hidden="true"><Clock3 size={50} /></span>
            <h3>{pick(language, 'Төлөм текшерилүүдө', 'Платёж на проверке', 'Payment under review')}</h3>
            <p>{pick(language, 'Өтүнмөңүз администраторго жөнөтүлдү. Төлөм ырасталгандан кийин гана тариф активдешет — сизге email келет. Бул терезени жаап койсоңуз болот.', 'Заявка отправлена администратору. Тариф активируется только после подтверждения оплаты — вам придёт письмо. Окно можно закрыть.', 'Your request was sent to the administrator. The plan activates only after the payment is confirmed — you will get an email. You can close this window.')}</p>
            {orderId && <p className="purchase-order-id">Order ID: <code>{shortOrder(orderId)}</code> · <span className="purchase-status-pill">{pick(language, 'Күтүлүүдө', 'Ожидает', 'Pending')}</span></p>}
            {formError && <p className="error-message" role="alert">{formError}</p>}
            <div className="pay-success-actions">
              <button type="button" className="btn btn-secondary" disabled={phase === 'checking'} onClick={() => { void checkStatus() }}>
                <RefreshCw size={16} className={phase === 'checking' ? 'spin' : ''} /> {phase === 'checking' ? pick(language, 'Текшерилүүдө...', 'Проверяем...', 'Checking...') : pick(language, 'Статусту текшерүү', 'Проверить статус', 'Check status')}
              </button>
              <button type="button" className="btn btn-primary" onClick={close}>{pick(language, 'Жабуу', 'Закрыть', 'Close')}</button>
            </div>
          </div>
        ) : (
          <form className="pay-form" noValidate onSubmit={(event) => { void submit(event) }}>
            <div className="pay-fields">
              <label className={errors.fullName ? 'pay-field has-error' : 'pay-field'}>
                <span>{pick(language, 'Аты-жөнү', 'Имя и фамилия', 'Full name')} *</span>
                <input ref={firstFieldRef} type="text" autoComplete="name" maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} aria-invalid={!!errors.fullName} disabled={busy} />
                {errors.fullName && <small className="field-error">{errors.fullName}</small>}
              </label>
              <label className="pay-field">
                <span>Email</span>
                <input type="email" value={userEmail ?? ''} readOnly aria-readonly="true" />
              </label>
            </div>

            <div>
              <p className="purchase-label">{pick(language, 'Төлөм ыкмасы', 'Способ оплаты', 'Payment method')}</p>
              <div className="payment-methods" role="radiogroup" aria-label={pick(language, 'Төлөм ыкмасы', 'Способ оплаты', 'Payment method')}>
                {WALLETS.map((item) => (
                  <button key={item.id} type="button" role="radio" aria-checked={method === item.id} className={method === item.id ? 'payment-method active' : 'payment-method'} onClick={() => setMethod(item.id)} disabled={busy}>
                    <WalletCards size={20} /><span>{item.label}</span>{method === item.id && <CheckCircle2 size={18} />}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'loading' && <p className="pay-note"><RefreshCw size={14} className="spin" /> {pick(language, 'Жүктөлүүдө...', 'Загрузка...', 'Loading...')}</p>}

            {mode === 'manual' && wallet && (
              <>
                <div className="bank-details" aria-label={pick(language, 'Төлөм реквизиттери', 'Реквизиты для оплаты', 'Payment details')}>
                  <div><span>{pick(language, 'Ыкма', 'Способ', 'Method')}</span><strong>{WALLETS.find((w) => w.id === wallet.id)?.label ?? wallet.id}</strong></div>
                  {wallet.recipient && <div><span>{pick(language, 'Алуучу', 'Получатель', 'Recipient')}</span><strong>{wallet.recipient}</strong></div>}
                  <div><span>{pick(language, 'Номер / эсеп', 'Номер / счёт', 'Number / account')}</span><strong>{wallet.account}</strong></div>
                  <div><span>{pick(language, 'Сумма', 'Сумма', 'Amount')}</span><strong>{plan.price} {currency}</strong></div>
                  <div><span>{pick(language, 'Төлөмдүн комментарийи', 'Комментарий к платежу', 'Payment comment')}</span><strong>{accountComment}</strong></div>
                  {wallet.instructions && <p>{wallet.instructions}</p>}
                </div>
                <div className="pay-fields">
                  <label className={errors.payerName ? 'pay-field has-error' : 'pay-field'}>
                    <span>{pick(language, 'Төлөөчүнүн аты-жөнү', 'ФИО плательщика', 'Payer name')} *</span>
                    <input type="text" maxLength={120} value={payerName} onChange={(event) => setPayerName(event.target.value)} aria-invalid={!!errors.payerName} disabled={busy} />
                    {errors.payerName && <small className="field-error">{errors.payerName}</small>}
                  </label>
                  <label className={errors.reference ? 'pay-field has-error' : 'pay-field'}>
                    <span>{pick(language, 'Транзакция номери', 'Номер транзакции', 'Transaction number')} *</span>
                    <input type="text" maxLength={64} autoComplete="off" placeholder={pick(language, 'Чектеги номер', 'Номер из чека', 'Number from the receipt')} value={reference} onChange={(event) => setReference(event.target.value)} aria-invalid={!!errors.reference} disabled={busy} />
                    {errors.reference && <small className="field-error">{errors.reference}</small>}
                  </label>
                  <label className="pay-field wide">
                    <span>{pick(language, 'Комментарий (милдеттүү эмес)', 'Комментарий (необязательно)', 'Comment (optional)')}</span>
                    <input type="text" maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} />
                  </label>
                </div>
              </>
            )}

            {mode === 'demo' && (
              <div className="purchase-demo-banner" role="note">
                <FlaskConical size={18} />
                <span>
                  <strong>DEMO</strong> · {pick(language,
                    'Бул төлөм ыкмасы азырынча туташтырыла элек. DEMO режиминде акча алынбайт — тариф текшерүү үчүн дароо активдешет.',
                    'Этот способ оплаты ещё не подключён. В DEMO-режиме деньги не списываются — тариф включается сразу для проверки.',
                    'This payment method is not connected yet. In DEMO mode no money is charged — the plan switches on at once for testing.')}
                </span>
              </div>
            )}

            {mode === 'unavailable' && (
              <p className="error-message" role="alert">{pick(language, 'Бул төлөм ыкмасы азырынча туташтырыла элек. Башка ыкманы тандаңыз же кийинчерээк аракет кылыңыз.', 'Этот способ оплаты пока не подключён. Выберите другой или попробуйте позже.', 'This payment method is not connected yet. Choose another one or try again later.')}</p>
            )}

            <label className={errors.confirm ? 'checkout-confirm has-error' : 'checkout-confirm'}>
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={busy} />
              <span>{pick(language, `${plan.name} тарифин ${plan.price} ${currency} суммасына сатып алууну ырастайм.`, `Подтверждаю покупку тарифа ${plan.name} на сумму ${plan.price} ${currency}.`, `I confirm the purchase of ${plan.name} for ${plan.price} ${currency}.`)}</span>
            </label>

            {formError && <p className="error-message" role="alert">{formError}</p>}

            <button type="submit" className="btn btn-primary pay-submit" disabled={busy || mode === 'loading' || mode === 'unavailable'}>
              {phase === 'sending'
                ? <><span className="pay-spinner" aria-hidden="true" /> {pick(language, 'Жөнөтүлүүдө...', 'Отправляем...', 'Sending...')}</>
                : mode === 'demo'
                  ? <><FlaskConical size={18} /> {pick(language, 'DEMO төлөмдү жөнөтүү', 'Отправить DEMO-платёж', 'Send DEMO payment')}</>
                  : <><Send size={18} /> {pick(language, 'Төлөмдү жөнөтүү', 'Отправить платёж', 'Send payment')} · {plan.price} {currency}</>}
            </button>

            <p className="pay-note">{mode === 'manual' ? <ShieldCheck size={14} /> : <Lock size={14} />} {mode === 'manual'
              ? pick(language, 'Тариф администратор төлөмдү ырастагандан кийин гана активдешет. Карта номерин, CVV же сырсөздү эч качан жазбаңыз.', 'Тариф активируется только после того, как администратор подтвердит платёж. Никогда не вводите номер карты, CVV или пароли.', 'The plan activates only after the administrator confirms the payment. Never enter a card number, CVV or passwords.')
              : pick(language, 'Карта маалыматтары суралбайт жана сакталбайт.', 'Данные карты не запрашиваются и не сохраняются.', 'No card details are requested or stored.')}</p>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
