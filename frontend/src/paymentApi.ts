import type { PaymentMethod, SubscriptionPlanId, UserSubscription } from './subscriptionService'
import { API_BASE_URL, fetchWithWakeRetry, withAuthHeaders } from './api'

type LangText = { kg: string; ru: string; en: string }

/** A plan as configured by the administrator (price, texts, availability). */
export type ApiPlan = {
  id: SubscriptionPlanId
  name: string
  price: number
  currency: string
  durationDays: number
  isEnabled: boolean
  isFeatured: boolean
  sortOrder: number
  label: LangText
  description: LangText
  features: { kg: string[]; ru: string[]; en: string[] }
}

type ApiSubscriptionResponse = {
  planId: SubscriptionPlanId
  status: 'active' | 'cancelled' | 'expired'
  startedAt: string | null
  endsAt: string | null
  purchasedAt: string | null
  cancelledAt: string | null
  paymentMethod: PaymentMethod | 'none' | 'admin' | 'admin_grant'
  amount: number
  currency: 'KGS'
  orderId: string | null
  accessPlan: SubscriptionPlanId
  hasAccess: boolean
  remainingDays: number
  pendingOrder: { orderId: string; planId: SubscriptionPlanId; amount: number; paymentMethod: string; createdAt: string; paymentUrl: string | null; provider?: string; paymentReference?: string | null } | null
  lastPaymentStatus: string | null
  lastReviewNote?: string | null
  accountId?: string | null
}

type CreateOrderParams = {
  userEmail: string
  userName: string
  planId: SubscriptionPlanId
  paymentMethod: PaymentMethod
}

type CreateOrderResponse = {
  orderId: string
  providerOrderId: string
  paymentUrl: string
  status: 'pending' | 'paid' | 'cancelled' | 'failed'
  amount: number
  currency: string
  reused?: boolean
}

export type PaymentOrderStatus = {
  orderId: string
  planId: SubscriptionPlanId
  status: 'pending' | 'paid' | 'cancelled' | 'failed'
  paymentMethod: PaymentMethod
  amount: number
  currency: 'KGS'
  activated: boolean
  provider?: string
  paymentReference?: string | null
  reviewNote?: string | null
}

export type SubscriptionHistory = {
  history: Array<{ id: string; event: string; planId: SubscriptionPlanId; status: string; startedAt: string | null; endsAt: string | null; amount: number; currency: string; paymentMethod: string | null; orderId: string | null; transactionId: string | null; createdAt: string }>
  orders: Array<{ orderId: string; planId: SubscriptionPlanId; amount: number; currency: string; paymentMethod: string; status: string; activated: boolean; transactionId: string | null; createdAt: string; updatedAt: string }>
}

export type ApiReview = {
  id: string
  userId: string
  name: string
  avatar: string
  lessonId: string
  lessonLabel: string
  rating: number
  text: string
  date: string
  createdAt: number
  updatedAt: number
}

/** Error carrying the HTTP status and the API's machine-readable `code`. */
export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string }
  if (!response.ok) {
    throw new ApiError(body.error ?? `Request failed (${response.status})`, response.status, body.code)
  }
  return body as T
}

export async function getPlans(): Promise<ApiPlan[]> {
  const response = await fetchWithWakeRetry(`${API_BASE_URL}/api/plans`)
  const data = await parseJsonResponse<{ plans: ApiPlan[] }>(response)
  return Array.isArray(data.plans) ? data.plans : []
}

export async function createPaymentOrder(params: CreateOrderParams): Promise<CreateOrderResponse> {
  const response = await fetchWithWakeRetry(`${API_BASE_URL}/api/payments/orders`, {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      userEmail: params.userEmail,
      userName: params.userName,
      planId: params.planId,
      paymentMethod: params.paymentMethod
    })
  })

  return parseJsonResponse<CreateOrderResponse>(response)
}

export type ManualTransferConfig = { enabled: boolean; bankName?: string; recipient?: string; account?: string; instructions?: string }

export async function getManualTransferConfig(): Promise<ManualTransferConfig> {
  const response = await fetchWithWakeRetry(`${API_BASE_URL}/api/payments/manual/config`)
  return parseJsonResponse<ManualTransferConfig>(response)
}

export async function getDemoPaymentConfig(): Promise<{ enabled: boolean }> {
  const response = await fetchWithWakeRetry(`${API_BASE_URL}/api/payments/demo/config`)
  return parseJsonResponse<{ enabled: boolean }>(response)
}

/**
 * Demo Payment: card number, expiry and CVV are validated in the browser and never sent.
 * `checkoutKey` is generated once per opened payment window so a retry cannot activate twice.
 */
export async function submitDemoPayment(params: { planId: SubscriptionPlanId; cardholderName: string; checkoutKey: string }): Promise<{ orderId: string; transactionId: string; status: 'paid'; planId: SubscriptionPlanId; endsAt: string | null; accessPlan: SubscriptionPlanId; alreadyProcessed?: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/payments/demo`, {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params)
  })
  return parseJsonResponse(response)
}

export type ManualTransferParams = {
  planId: SubscriptionPlanId
  fullName: string
  email: string
  payerName: string
  paymentReference: string
  receiptNote?: string
}

export async function submitManualTransfer(params: ManualTransferParams): Promise<{ orderId: string; status: 'pending'; paymentReference: string }> {
  const response = await fetch(`${API_BASE_URL}/api/payments/manual`, {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params)
  })
  return parseJsonResponse(response)
}

export async function getPaymentOrderStatus(orderId: string): Promise<PaymentOrderStatus> {
  const response = await fetchWithWakeRetry(`${API_BASE_URL}/api/payments/orders/${encodeURIComponent(orderId)}`, {
    headers: withAuthHeaders()
  })

  return parseJsonResponse<PaymentOrderStatus>(response)
}

function toUserSubscription(data: ApiSubscriptionResponse): UserSubscription {
  // `planId`/`status` keep their old meaning for existing checks: the plan the user can use now.
  // A cancelled plan that is still paid stays usable until `endsAt` (rawStatus tells it apart).
  const usable = data.hasAccess
  const startedAt = data.startedAt ?? new Date().toISOString()
  return {
    planId: usable ? data.accessPlan : data.planId,
    status: usable ? 'active' : data.planId === 'free' ? 'active' : 'expired',
    startedAt,
    endsAt: data.endsAt ?? startedAt,
    lastUpdated: data.purchasedAt ?? startedAt,
    price: data.amount,
    currency: data.currency,
    paymentMethod: (data.paymentMethod === 'admin' || data.paymentMethod === 'admin_grant' ? 'none' : data.paymentMethod) as PaymentMethod | 'none',
    history: [],
    autoRenew: false,
    rawStatus: data.planId === 'free' ? 'free' : data.status,
    accessPlan: data.accessPlan,
    hasAccess: data.hasAccess,
    remainingDays: data.remainingDays,
    purchasedAt: data.purchasedAt,
    cancelledAt: data.cancelledAt,
    grantedByAdmin: data.paymentMethod === 'admin' || data.paymentMethod === 'admin_grant',
    pendingOrder: data.pendingOrder,
    lastPaymentStatus: data.lastPaymentStatus,
    lastReviewNote: data.lastReviewNote ?? null,
    accountId: data.accountId ?? null,
    synced: true
  }
}

export async function getServerSubscription(userEmail: string): Promise<UserSubscription> {
  const response = await fetchWithWakeRetry(`${API_BASE_URL}/api/subscription/${encodeURIComponent(userEmail)}`, {
    headers: withAuthHeaders()
  })
  return toUserSubscription(await parseJsonResponse<ApiSubscriptionResponse>(response))
}

export async function cancelServerSubscription(userEmail: string): Promise<UserSubscription> {
  const response = await fetchWithWakeRetry(`${API_BASE_URL}/api/subscription/${encodeURIComponent(userEmail)}/cancel`, {
    method: 'POST',
    headers: withAuthHeaders()
  })
  return toUserSubscription(await parseJsonResponse<ApiSubscriptionResponse>(response))
}

export async function getSubscriptionHistory(userEmail: string): Promise<SubscriptionHistory> {
  const response = await fetchWithWakeRetry(`${API_BASE_URL}/api/subscription/${encodeURIComponent(userEmail)}/history`, {
    headers: withAuthHeaders()
  })
  return parseJsonResponse<SubscriptionHistory>(response)
}

export async function getReviewsFromServer(): Promise<ApiReview[]> {
  const response = await fetchWithWakeRetry(`${API_BASE_URL}/api/reviews`, { headers: withAuthHeaders() })
  const data = await parseJsonResponse<{ reviews: ApiReview[] }>(response)
  return Array.isArray(data.reviews) ? data.reviews : []
}

type SaveReviewParams = {
  lessonId: string
  lessonLabel: string
  rating: number
  text: string
}

// The reviewer's identity and display name are taken from the session on the server.
export async function saveReviewToServer(params: SaveReviewParams): Promise<{ id: string; created?: boolean; updated?: boolean }> {
  const response = await fetchWithWakeRetry(`${API_BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params)
  })

  return parseJsonResponse<{ ok: true; id: string; created?: boolean; updated?: boolean }>(response)
}
