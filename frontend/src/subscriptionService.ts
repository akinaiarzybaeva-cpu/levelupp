export type SubscriptionPlanId = 'free' | 'pro' | 'aipro'
export type SubscriptionStatus = 'active' | 'expired' | 'inactive'
export type PaymentMethod = 'MBank' | 'O!Деньги' | 'Элсом'
export type PaymentStatus = 'completed' | 'pending'

export type PaymentRecord = {
  id: string
  amount: number
  currency: 'KGS'
  planId: SubscriptionPlanId
  paymentMethod: PaymentMethod
  status: PaymentStatus
  createdAt: string
}

export type UserSubscription = {
  planId: SubscriptionPlanId
  status: SubscriptionStatus
  startedAt: string
  endsAt: string
  lastUpdated: string
  price: number
  currency: 'KGS'
  paymentMethod: PaymentMethod | 'none'
  history: PaymentRecord[]
  autoRenew: boolean
}

export const PLAN_META = {
  free: {
    id: 'free',
    name: 'FREE',
    price: 0,
    accent: '#6ba668',
    monthlyLabel: '0 сом'
  },
  pro: {
    id: 'pro',
    name: 'PRO',
    price: 499,
    accent: '#2c7a7b',
    monthlyLabel: '499 сом'
  },
  aipro: {
    id: 'aipro',
    name: 'AI PRO',
    price: 799,
    accent: '#7c3aed',
    monthlyLabel: '799 сом'
  }
} as const

export function normalizePlanId(value?: string | null): SubscriptionPlanId {
  if (value === 'pro' || value === 'aipro') return value
  return 'free'
}

export function getDefaultSubscription(planId: SubscriptionPlanId = 'free'): UserSubscription {
  const startedAt = new Date().toISOString()
  const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  return {
    planId,
    status: planId === 'free' ? 'active' : 'inactive',
    startedAt,
    endsAt,
    lastUpdated: startedAt,
    price: PLAN_META[planId].price,
    currency: 'KGS',
    paymentMethod: 'none',
    history: [],
    autoRenew: false
  }
}

export function getStoredSubscriptions(): Record<string, UserSubscription> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem('levelup-subscriptions')
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as Record<string, UserSubscription>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveStoredSubscriptions(subscriptions: Record<string, UserSubscription>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('levelup-subscriptions', JSON.stringify(subscriptions))
}

export function getUserSubscription(email?: string | null): UserSubscription {
  if (!email) return getDefaultSubscription('free')
  const subscriptions = getStoredSubscriptions()
  const raw = subscriptions[email]
  return raw ? normalizeSubscription(raw) : getDefaultSubscription('free')
}

export function setUserSubscription(email: string | null | undefined, next: UserSubscription) {
  if (!email) return
  const subscriptions = getStoredSubscriptions()
  subscriptions[email] = normalizeSubscription(next)
  saveStoredSubscriptions(subscriptions)
}

export function normalizeSubscription(value?: Partial<UserSubscription> | null, fallbackPlanId: SubscriptionPlanId = 'free'): UserSubscription {
  const fallback = getDefaultSubscription(fallbackPlanId)
  if (!value) return fallback

  const planId = normalizePlanId(value.planId)
  return {
    ...fallback,
    ...value,
    planId,
    status: value.status ?? fallback.status,
    startedAt: value.startedAt ?? fallback.startedAt,
    endsAt: value.endsAt ?? fallback.endsAt,
    lastUpdated: value.lastUpdated ?? fallback.lastUpdated,
    price: value.price ?? PLAN_META[planId].price,
    currency: value.currency ?? 'KGS',
    paymentMethod: value.paymentMethod ?? 'none',
    history: Array.isArray(value.history) ? value.history : [],
    autoRenew: Boolean(value.autoRenew)
  }
}

export function getRemainingDays(subscription?: UserSubscription | null): number {
  if (!subscription) return 0
  const endsAt = new Date(subscription.endsAt).getTime()
  const now = Date.now()
  const diff = Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24))
  return Math.max(diff, 0)
}

export function isSubscriptionExpired(subscription?: UserSubscription | null): boolean {
  if (!subscription) return false
  const endsAt = new Date(subscription.endsAt).getTime()
  return endsAt <= Date.now()
}

export function canAccessLesson(lessonIndex: number, planId: SubscriptionPlanId = 'free') {
  if (planId === 'free') return lessonIndex < 3
  return true
}

export function canAccessAiAssistant(planId: SubscriptionPlanId = 'free') {
  return planId === 'aipro'
}

export function canAccessPaidContent(planId: SubscriptionPlanId = 'free') {
  return planId === 'pro' || planId === 'aipro'
}

export function createActivatedSubscription(planId: SubscriptionPlanId = 'free', paymentMethod: PaymentMethod | 'none' = 'none') {
  const now = new Date()
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const normalizedMethod: PaymentMethod = paymentMethod === 'none' ? 'MBank' : paymentMethod

  const subscription: UserSubscription = {
    planId,
    status: 'active',
    startedAt: now.toISOString(),
    endsAt: nextMonth.toISOString(),
    lastUpdated: now.toISOString(),
    price: PLAN_META[planId].price,
    currency: 'KGS',
    paymentMethod: normalizedMethod,
    history: [
      {
        id: `payment-${Date.now()}`,
        amount: PLAN_META[planId].price,
        currency: 'KGS',
        planId,
        paymentMethod: normalizedMethod,
        status: 'completed',
        createdAt: now.toISOString()
      }
    ],
    autoRenew: true
  }

  return subscription
}

export function activateUserSubscription(email: string | null | undefined, planId: SubscriptionPlanId = 'free', paymentMethod: PaymentMethod | 'none' = 'none') {
  if (!email) return null

  const next = createActivatedSubscription(planId, paymentMethod)
  setUserSubscription(email, next)
  return next
}

export function setFreeSubscription(email: string | null | undefined) {
  if (!email) return null

  const subscription = getDefaultSubscription('free')
  setUserSubscription(email, subscription)
  return subscription
}

export function archiveExpiredPlans(email?: string | null) {
  if (!email) return null

  const current = getUserSubscription(email)
  if (current.planId === 'free') return current

  if (isSubscriptionExpired(current)) {
    const expired = { ...current, planId: 'free', status: 'expired', price: 0, paymentMethod: 'none', autoRenew: false } as UserSubscription
    setUserSubscription(email, expired)
    return expired
  }

  return current
}
