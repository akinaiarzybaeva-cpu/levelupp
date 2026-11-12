export const SUPPORTED_PLANS = {
  pro: {
    id: 'pro',
    amount: 499,
    currency: 'KGS',
    durationDays: 30
  },
  aipro: {
    id: 'aipro',
    amount: 799,
    currency: 'KGS',
    durationDays: 30
  }
}

export function getPlan(planId) {
  if (!planId) return null
  const normalized = String(planId).toLowerCase()
  return SUPPORTED_PLANS[normalized] ?? null
}
