import { useState } from 'react'
import { BookOpen, Sparkles, X, ArrowRight, Bot, Star, CheckCircle2, Rocket, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { type SubscriptionPlanId } from '../subscriptionService'
import PaymentModal, { useDemoPaymentEnabled } from './PaymentModal'
import { translations, useLanguage, pick, PLAN_RANK, FREE_LESSON_LIMIT, useBilling, accessPlanOf, planPeriodLabel, formatDateTime, type Lang, type PlanView } from '../appShared'

/**
 * One pricing plan card (home page and pricing page). The button depends on who is looking:
 * guest → register / choose; current plan → renew; higher plan → upgrade; lower plan → included.
 */
export default function PricingCard({ plan, t, language }: { plan: PlanView; t: (typeof translations)[Lang]; language: Lang }) {
  const { subscription, isLoggedIn, refreshSubscription } = useBilling()
  const Icon = planIcons[plan.id] ?? Sparkles
  const current = isLoggedIn ? accessPlanOf(subscription) : null
  const isCurrent = current === plan.id
  const checkoutPath = `/pricing/checkout/${plan.id}`
  const demoEnabled = useDemoPaymentEnabled()
  const [payOpen, setPayOpen] = useState(false)
  // Logged-in users pay in the Demo Payment window; guests go through login first (ProtectedRoute).
  const useModal = isLoggedIn && demoEnabled === true && plan.id !== 'free'
  const openPayment = (event: React.MouseEvent) => {
    if (!useModal) return
    event.preventDefault()
    setPayOpen(true)
  }
  const paymentModal = useModal && (plan.id === 'pro' || plan.id === 'aipro') ? (
    <PaymentModal
      open={payOpen}
      onClose={() => setPayOpen(false)}
      plan={{ id: plan.id, name: plan.name, title: plan.label[language], price: plan.price, currency: plan.currency, durationDays: plan.durationDays }}
      language={language}
      onPaid={async () => { const fresh = await refreshSubscription(); return fresh ? accessPlanOf(fresh) : null }}
      endsAtText={(iso) => formatDateTime(iso, language)}
    />
  ) : null

  let action: React.ReactNode
  if (plan.id === 'free') {
    action = !isLoggedIn
      ? <Link to="/auth?mode=register" className="btn btn-secondary full-width">{t.buttons.startFree} <ArrowRight size={16} /></Link>
      : <span className="btn btn-secondary full-width is-static" aria-disabled="true"><CheckCircle2 size={16} /> {isCurrent ? pick(language, 'Учурдагы тариф', 'Ваш текущий тариф', 'Your current plan') : pick(language, 'Тарифиңизге кирет', 'Входит в ваш тариф', 'Included in your plan')}</span>
  } else if (isCurrent) {
    action = (
      <>
        <span className="btn btn-primary full-width is-static plan-active-btn" aria-disabled="true"><CheckCircle2 size={16} /> {pick(language, 'Тариф активдүү', 'Тариф активен', 'Plan active')}</span>
        <Link to={checkoutPath} className="text-link plan-renew-link" onClick={openPayment}><RefreshCw size={14} /> {pick(language, 'Узартуу', 'Продлить', 'Renew')}</Link>
      </>
    )
  } else if (current && PLAN_RANK[plan.id] < PLAN_RANK[current]) {
    action = <span className="btn btn-secondary full-width is-static" aria-disabled="true"><CheckCircle2 size={16} /> {pick(language, 'Тарифиңизге кирет', 'Входит в ваш тариф', 'Included in your plan')}</span>
  } else {
    const upgrading = current !== null && current !== 'free'
    const label = upgrading
      ? pick(language, `${plan.name} тарифине өтүү`, `Перейти на ${plan.name}`, `Upgrade to ${plan.name}`)
      : pick(language, 'Тарифти сатып алуу', 'Купить тариф', 'Buy plan')
    action = <Link to={checkoutPath} onClick={openPayment} className={plan.featured || plan.id === 'aipro' ? 'btn btn-primary full-width' : 'btn btn-secondary full-width'}>{label} <ArrowRight size={16} /></Link>
  }

  return (
    <div className={['pricing-card', plan.featured ? 'featured' : '', `plan-${plan.id}`, isCurrent ? 'is-current' : ''].filter(Boolean).join(' ')}>
      {isCurrent
        ? <span className="popular-badge current"><CheckCircle2 size={13} /> {pick(language, 'Сиздин тариф', 'Ваш тариф', 'Your plan')}</span>
        : plan.featured && <span className="popular-badge"><Star size={13} fill="currentColor" /> {pick(language, 'Популярдуу', 'Популярный', 'Popular')}</span>}
      <span className="plan-icon"><Icon size={22} /></span>
      <span className="plan-tag">{plan.name}</span>
      <h3>{plan.label[language]}</h3>
      <div className="price">{plan.price} {plan.currency === 'KGS' ? 'сом' : plan.currency}<span> / {planPeriodLabel(plan, language, t)}</span></div>
      <p>{plan.description[language]}</p>
      <ul>
        {plan.features[language].map((feature) => <li key={feature}><CheckCircle2 size={16} /> {feature}</li>)}
      </ul>
      {isCurrent && plan.id !== 'free' && subscription.endsAt && (
        <p className="plan-current-until">{pick(language, 'Чейин активдүү', 'Активен до', 'Active until')} <strong>{formatDateTime(subscription.endsAt, language)}</strong></p>
      )}
      {action}
      {paymentModal}
    </div>
  )
}

export const planIcons: Record<string, typeof BookOpen> = { free: BookOpen, pro: Rocket, aipro: Bot }

/** Side-by-side view of what each plan actually unlocks (the same rules the backend enforces). */
export function PlanComparison({ plans }: { plans: PlanView[] }) {
  const language = useLanguage()
  const yes = <CheckCircle2 size={18} className="cmp-yes" aria-label={pick(language, 'Бар', 'Есть', 'Included')} />
  const no = <X size={18} className="cmp-no" aria-label={pick(language, 'Жок', 'Нет', 'Not included')} />
  const ids = plans.map((plan) => plan.id)
  const rows: Array<{ label: string; values: Record<SubscriptionPlanId, React.ReactNode> }> = [
    { label: pick(language, 'Ар бир курстагы сабактар', 'Уроки в каждом курсе', 'Lessons in every course'), values: { free: pick(language, `Алгачкы ${FREE_LESSON_LIMIT}`, `Первые ${FREE_LESSON_LIMIT}`, `First ${FREE_LESSON_LIMIT}`), pro: pick(language, 'Баары', 'Все', 'All'), aipro: pick(language, 'Баары', 'Все', 'All') } },
    { label: pick(language, 'Окуу прогресси', 'Прогресс обучения', 'Learning progress'), values: { free: yes, pro: yes, aipro: yes } },
    { label: pick(language, 'Курсту толук бүтүрүү', 'Полное прохождение курса', 'Complete full courses'), values: { free: no, pro: yes, aipro: yes } },
    { label: pick(language, 'AI жардамчы', 'AI-ассистент', 'AI assistant'), values: { free: no, pro: no, aipro: yes } },
    { label: pick(language, 'Баасы', 'Цена', 'Price'), values: Object.fromEntries(plans.map((plan) => [plan.id, `${plan.price} ${plan.currency === 'KGS' ? 'сом' : plan.currency}`])) as Record<SubscriptionPlanId, React.ReactNode> }
  ]
  return (
    <section className="plan-comparison" aria-label={pick(language, 'Тарифтерди салыштыруу', 'Сравнение тарифов', 'Plan comparison')}>
      <h2>{pick(language, 'Тарифтерди салыштыруу', 'Сравнение тарифов', 'Compare plans')}</h2>
      <div className="plan-comparison-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">{pick(language, 'Мүмкүнчүлүк', 'Возможность', 'Feature')}</span></th>
              {plans.map((plan) => <th key={plan.id} scope="col" className={plan.featured ? 'featured' : ''}>{plan.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {ids.map((id) => <td key={id}>{row.values[id]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
