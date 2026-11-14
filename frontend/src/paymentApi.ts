import type { PaymentMethod, SubscriptionPlanId, UserSubscription } from './subscriptionService'

function normalizeApiBaseUrl(value?: string): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const withoutTrailingSlash = raw.replace(/\/+$/, '')
  try {
    const url = new URL(withoutTrailingSlash)
    return `${url.protocol}//${url.host}`
  } catch {
    return withoutTrailingSlash
  }
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
  || (import.meta.env.PROD ? 'https://levelupp-2b3j.onrender.com' : 'http://localhost:8787')

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
  const body = await response.json() as { error?: string }
  if (!response.ok) {
    throw new Error(body.error ?? 'Request failed')
  }
  return body as T
}

export async function createPaymentOrder(params: CreateOrderParams): Promise<CreateOrderResponse> {
  const response = await fetch(`${API_BASE_URL}/api/payments/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': params.userEmail
    },
    body: JSON.stringify({
      userEmail: params.userEmail,
      userName: params.userName,
      planId: params.planId,
      paymentMethod: params.paymentMethod
    })
  })

  return parseJsonResponse<CreateOrderResponse>(response)
}

export async function getPaymentOrderStatus(orderId: string, userEmail: string): Promise<PaymentOrderStatus> {
  const response = await fetch(`${API_BASE_URL}/api/payments/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      'x-user-email': userEmail
    }
  })

  return parseJsonResponse<PaymentOrderStatus>(response)
}

export async function getServerSubscription(userEmail: string): Promise<UserSubscription> {
  const response = await fetch(`${API_BASE_URL}/api/subscription/${encodeURIComponent(userEmail)}`, {
    headers: {
      'x-user-email': userEmail
    }
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
  const response = await fetch(`${API_BASE_URL}/api/reviews`)
  const data = await parseJsonResponse<{ reviews: ApiReview[] }>(response)
  return Array.isArray(data.reviews) ? data.reviews : []
}

type SaveReviewParams = {
  userEmail: string
  userName: string
  userAvatar: string
  lessonId: string
  lessonLabel: string
  rating: number
  text: string
}

export async function saveReviewToServer(params: SaveReviewParams): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': params.userEmail
    },
    body: JSON.stringify(params)
  })

  await parseJsonResponse<{ ok: true }>(response)
}
