import crypto from 'node:crypto'
import { config } from './config.js'

const successStatuses = new Set(['paid', 'success', 'succeeded', 'completed'])
const cancelStatuses = new Set(['cancelled', 'canceled', 'failed', 'rejected', 'expired'])

function normalizeStatus(status) {
  const value = String(status ?? '').trim().toLowerCase()
  if (successStatuses.has(value)) return 'paid'
  if (cancelStatuses.has(value)) return 'cancelled'
  return 'pending'
}

function getMethodCode(paymentMethod) {
  const code = config.payment.methodCodes[paymentMethod]
  if (!code) {
    throw new Error(`Unsupported payment method: ${paymentMethod}`)
  }
  return code
}

export async function createProviderOrder({ internalOrderId, plan, paymentMethod, userEmail, userName }) {
  if (!config.payment.apiBaseUrl || !config.payment.apiKey || !config.payment.merchantId) {
    throw new Error('Payment provider credentials are not configured')
  }

  const endpoint = new URL(config.payment.createOrderPath, config.payment.apiBaseUrl).toString()
  const payload = {
    merchantId: config.payment.merchantId,
    orderId: internalOrderId,
    amount: plan.amount,
    currency: plan.currency,
    description: `LEVEL UP ${plan.id.toUpperCase()} subscription for ${plan.durationDays} days`,
    paymentMethod: getMethodCode(paymentMethod),
    callbackUrl: `${config.frontendUrl}/pricing/checkout/${plan.id}?orderId=${encodeURIComponent(internalOrderId)}`,
    webhookUrl: `${config.backendPublicUrl}/api/payments/webhook/${encodeURIComponent(config.payment.provider)}`,
    customer: {
      email: userEmail,
      name: userName ?? userEmail
    },
    metadata: {
      internalOrderId,
      userEmail,
      planId: plan.id,
      durationDays: plan.durationDays
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.payment.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const rawText = await response.text()
  let body = {}
  try {
    body = rawText ? JSON.parse(rawText) : {}
  } catch {
    throw new Error(`Provider returned invalid JSON: ${rawText.slice(0, 300)}`)
  }

  if (!response.ok) {
    const providerError = typeof body === 'object' && body && 'message' in body ? String(body.message) : response.statusText
    throw new Error(`Provider order creation failed: ${providerError}`)
  }

  const parsedBody = body
  const paymentUrl = parsedBody.paymentUrl ?? parsedBody.redirectUrl ?? parsedBody.url ?? null
  const providerOrderId = parsedBody.providerOrderId ?? parsedBody.orderId ?? parsedBody.id ?? internalOrderId
  const status = normalizeStatus(parsedBody.status ?? parsedBody.paymentStatus ?? 'pending')

  if (!paymentUrl) {
    throw new Error('Provider did not return a payment URL')
  }

  return {
    providerOrderId: String(providerOrderId),
    paymentUrl: String(paymentUrl),
    status
  }
}

export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (config.payment.webhookSkipSignature) return true
  if (!config.payment.webhookSecret) return false
  if (!signatureHeader) return false

  const expected = crypto.createHmac('sha256', config.payment.webhookSecret).update(rawBody).digest('hex')
  const incoming = String(signatureHeader).trim()
  const expectedBuffer = Buffer.from(expected)
  const incomingBuffer = Buffer.from(incoming)

  if (expectedBuffer.length !== incomingBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, incomingBuffer)
}

export function normalizeWebhookPayload(payload) {
  const status = normalizeStatus(payload.status ?? payload.paymentStatus ?? payload.result)
  const orderRef = payload.orderId ?? payload.providerOrderId ?? payload.merchantOrderId ?? payload.internalOrderId ?? payload.invoiceId
  const paymentRef = payload.paymentId ?? payload.transactionId ?? payload.id ?? null
  const amount = Number(payload.amount ?? payload.totalAmount)
  const currency = String(payload.currency ?? 'KGS')

  return {
    status,
    orderRef: orderRef ? String(orderRef) : '',
    paymentRef: paymentRef ? String(paymentRef) : '',
    amount,
    currency
  }
}
