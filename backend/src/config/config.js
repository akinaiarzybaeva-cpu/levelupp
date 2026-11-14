import dotenv from 'dotenv'

dotenv.config()

const toInt = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const config = {
  port: toInt(process.env.PORT ?? process.env.BACKEND_PORT, 8787),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  backendPublicUrl: process.env.BACKEND_PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:8787',
  databaseUrl: String(process.env.DATABASE_URL ?? '').trim(),
  databasePath: process.env.DATABASE_PATH ?? './levelup.sqlite',
  databaseDriver: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
  telegram: {
    botToken: String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim(),
    chatId: String(process.env.TELEGRAM_CHAT_ID ?? '').trim()
  },
  payment: {
    provider: process.env.PAYMENT_PROVIDER ?? 'generic',
    apiBaseUrl: process.env.PAYMENT_API_BASE_URL ?? '',
    createOrderPath: process.env.PAYMENT_CREATE_ORDER_PATH ?? '/v1/orders',
    merchantId: process.env.PAYMENT_MERCHANT_ID ?? '',
    apiKey: process.env.PAYMENT_API_KEY ?? '',
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET ?? '',
    webhookSkipSignature: process.env.PAYMENT_SKIP_WEBHOOK_SIGNATURE === 'true',
    methodCodes: {
      MBank: process.env.PAYMENT_METHOD_MBANK_CODE ?? 'mbank',
      'Элсом': process.env.PAYMENT_METHOD_ELSOM_CODE ?? 'elsom',
      'O!Деньги': process.env.PAYMENT_METHOD_ODENGI_CODE ?? 'odengi'
    }
  }
}
