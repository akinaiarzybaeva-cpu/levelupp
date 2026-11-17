import type { PaymentMethod, SubscriptionPlanId, UserSubscription } from './subscriptionService'
import { API_BASE_URL, withAuthHeaders } from './api'

type ApiSubscriptionResponse = {
  planId: SubscriptionPlanId | 'free'
  status: 'active' | 'expired' | 'inactive'
  startedAt: string
  endsAt: string
  purchasedAt: string | null
  paymentMethod: PaymentMethod | 'none'
  amount: number
  currency: 'KGS'
  orderId: string | null
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
  status: 'pending' | 'paid' | 'cancelled'
}

export type PaymentOrderStatus = {
  orderId: string
  planId: SubscriptionPlanId
  status: 'pending' | 'paid' | 'cancelled'
  paymentMethod: PaymentMethod
  amount: number
  currency: 'KGS'
  activated: boolean
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

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed (${response.status})`)
  }
  return body as T
}

export async function createPaymentOrder(params: CreateOrderParams): Promise<CreateOrderResponse> {
  const response = await fetch(`${API_BASE_URL}/api/payments/orders`, {
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

export async function getPaymentOrderStatus(orderId: string): Promise<PaymentOrderStatus> {
  const response = await fetch(`${API_BASE_URL}/api/payments/orders/${encodeURIComponent(orderId)}`, {
    headers: withAuthHeaders()
  })

  return parseJsonResponse<PaymentOrderStatus>(response)
}

export async function getServerSubscription(userEmail: string): Promise<UserSubscription> {
  const response = await fetch(`${API_BASE_URL}/api/subscription/${encodeURIComponent(userEmail)}`, {
    headers: withAuthHeaders()
  })

  const data = await parseJsonResponse<ApiSubscriptionResponse>(response)

  return {
    planId: data.planId,
    status: data.status,
    startedAt: data.startedAt,
    endsAt: data.endsAt,
    lastUpdated: data.purchasedAt ?? data.startedAt,
    price: data.amount,
    currency: data.currency,
    paymentMethod: data.paymentMethod,
    history: [],
    autoRenew: false
  }
}

export async function getReviewsFromServer(): Promise<ApiReview[]> {
  const response = await fetch(`${API_BASE_URL}/api/reviews`, { headers: withAuthHeaders() })
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
  const response = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params)
  })

  return parseJsonResponse<{ ok: true; id: string; created?: boolean; updated?: boolean }>(response)
}
