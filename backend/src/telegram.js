// Telegram Bot API notifications for the administrator (backend only).
//
// Purchase notifications are sent ONLY from the subscription activation path, i.e. after a
// verified payment webhook or an administrator grant. Every notification is claimed in the
// `telegram_notifications` table under a unique key (the payment transaction id), so the same
// transaction can never produce two messages, even if the provider repeats the webhook.

import crypto from 'node:crypto'

const SETTING_ENABLED = 'telegram_purchase_notifications_enabled'

export function initTelegram(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_notifications (
      id TEXT PRIMARY KEY,
      dedupe_key TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL,
      sent_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_telegram_notifications_created ON telegram_notifications (created_at);
  `)
}

export function telegramConfig() {
  return {
    botToken: String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim(),
    // TELEGRAM_ADMIN_CHAT_ID is the documented name; TELEGRAM_CHAT_ID is kept for existing deployments.
    chatId: String(process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '').trim(),
    apiBase: String(process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org').replace(/\/+$/, '')
  }
}

export function isPurchaseNotificationsEnabled(db) {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(SETTING_ENABLED)
  return row ? row.value === 'true' : true
}

export function setPurchaseNotificationsEnabled(db, enabled) {
  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(SETTING_ENABLED, enabled ? 'true' : 'false', new Date().toISOString())
}

const scrub = (text, token) => (token ? String(text).split(token).join('<token>') : String(text))

/** Sends one message. Retries once on network errors, 5xx and 429. Never throws. */
export async function sendTelegramMessage(text) {
  const { botToken, chatId, apiBase } = telegramConfig()
  if (!botToken || !chatId) return { ok: false, error: 'Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID missing)' }
  const url = `${apiBase}/bot${botToken}/sendMessage`
  let lastError = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000)
      })
      const body = await response.json().catch(() => ({}))
      if (response.ok && body.ok !== false) return { ok: true, messageId: body?.result?.message_id ?? null }
      lastError = `Telegram API ${response.status}: ${body.description ?? response.statusText}`
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable) break
      const waitS = Math.min(Number(body?.parameters?.retry_after) || 1, 5)
      await new Promise((r) => setTimeout(r, waitS * 1000))
    } catch (error) {
      lastError = `Network error: ${error instanceof Error ? error.message : String(error)}`
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  return { ok: false, error: scrub(lastError, botToken).slice(0, 500) }
}

const esc = (value) => String(value ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const bishkekTime = (iso) => {
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return '—'
  return `${date.toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} (Бишкек)`
}
const PLAN_LABEL = { free: 'FREE', pro: 'PRO', aipro: 'AI PRO' }
const KIND_LABEL = { new: 'New purchase', renewal: 'Renewal', upgrade: 'Upgrade', change: 'Plan change', admin: 'Activated by administrator' }
const LINE = '━━━━━━━━━━━━━━━━━━'

export function formatPurchaseMessage(info) {
  if (info.template === 'demo') return formatDemoPurchaseMessage(info)
  // Exact layout requested for admin notifications. Sent only after a verified payment,
  // an admin-approved manual transfer, or an explicit admin grant (paymentStatus says which).
  const lines = [
    '🛒 <b>NEW SUBSCRIPTION PURCHASED!</b>',
    '',
    LINE,
    '',
    '👤 <b>CUSTOMER INFORMATION</b>',
    '',
    `• Full name: ${esc(info.name)}`,
    `• Email: ${esc(info.email)}`,
    `• Username: ${esc(info.username)}`,
    `• Account ID: ${esc(info.accountId)}`,
    '',
    LINE,
    '',
    '💎 <b>PURCHASE INFORMATION</b>',
    '',
    `• Plan: ${esc(PLAN_LABEL[info.planId] ?? info.planId)}`,
    `• Price: ${esc(info.amount)} ${esc(info.currency)}`,
    `• Purchase date: ${esc(bishkekTime(info.purchasedAt))}`,
    `• Expiration date: ${esc(bishkekTime(info.endsAt))}`,
    `• Subscription status: ${esc(String(info.subscriptionStatus ?? '').toUpperCase())}`,
    '',
    LINE,
    '',
    '💳 <b>PAYMENT INFORMATION</b>',
    '',
    `• Payment method: ${esc(info.paymentMethod)}`,
    `• Transaction ID: <code>${esc(info.transactionId)}</code>`,
    `• Payment status: ${esc(info.paymentStatus)}`,
  ]
  if (info.kind && info.kind !== 'new') lines.push(`• Type: ${esc(KIND_LABEL[info.kind] ?? info.kind)}`)
  lines.push('', LINE, '', '🚀 LevelUp — Online Education Platform')
  return lines.join('\n')
}

export function formatRegistrationMessage(info) {
  return [
    '🟢 <b>NEW USER — LEVELUP</b>',
    '',
    `👤 Аты-жөнү: ${esc(info.name)}`,
    `📧 Email: ${esc(info.email)}`,
    `🆔 User ID: ${esc(info.userId)}`,
    `📅 Катталган күнү: ${esc(bishkekTime(info.registeredAt))}`,
    '🌐 Платформа: LevelUp',
    '✅ Статус: Жаңы колдонуучу катталды'
  ].join('\n')
}

/**
 * New-user notification: sent once per account (dedupe key = email + creation time, so a retried
 * request never sends twice). Never throws — a Telegram problem must not break registration.
 */
export async function notifyRegistration(db, info) {
  try {
    const key = `registration:${info.email}:${info.registeredAt}`
    const claimed = db.prepare("INSERT OR IGNORE INTO telegram_notifications (id, dedupe_key, kind, status, created_at) VALUES (?, ?, 'registration', 'sending', ?)").run(crypto.randomUUID(), key, new Date().toISOString())
    if (claimed.changes === 0) return { duplicate: true }
    const result = await sendTelegramMessage(formatRegistrationMessage(info))
    const skipped = !result.ok && /not configured/i.test(result.error ?? '')
    db.prepare('UPDATE telegram_notifications SET status = ?, error = ?, sent_at = ? WHERE dedupe_key = ?')
      .run(result.ok ? 'sent' : skipped ? 'skipped' : 'failed', result.ok ? null : result.error, result.ok ? new Date().toISOString() : null, key)
    if (!result.ok && !skipped) {
      // eslint-disable-next-line no-console
      console.warn('[TELEGRAM] registration notification failed:', result.error)
    } else if (result.ok) {
      // eslint-disable-next-line no-console
      console.log(`[TELEGRAM] registration notification sent for user ${info.userId}`)
    }
    return result.ok ? { sent: true } : { failed: result.error }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[TELEGRAM] registration notification error:', error instanceof Error ? error.message : error)
    return { failed: 'internal error' }
  }
}

/** Demo checkout notification (Russian). Never contains card number, CVV or expiry. */
export function formatDemoPurchaseMessage(info) {
  return [
    '🟢 <b>НОВАЯ ПОКУПКА ТАРИФА LEVELUP</b>',
    '',
    `👤 Имя пользователя: ${esc(info.name)}`,
    `📧 Email: ${esc(info.email)}`,
    `📦 Тариф: ${esc(PLAN_LABEL[info.planId] ?? info.planId)}`,
    `💰 Стоимость: ${esc(info.amount)} ${esc(info.currency === 'KGS' ? 'сом' : info.currency)}`,
    `📅 Дата покупки: ${esc(bishkekTime(info.purchasedAt))}`,
    '✅ Статус: Успешно активирован',
    '💳 Тип оплаты: Demo Payment'
  ].join('\n')
}

/**
 * Sends the purchase message once per dedupeKey. Returns { sent | duplicate | skipped | failed }.
 * Safe to call without awaiting: it never throws.
 */
export async function notifyPurchase(db, info, dedupeKey) {
  try {
    if (!isPurchaseNotificationsEnabled(db)) return { skipped: 'disabled' }
    const nowIso = new Date().toISOString()
    const key = `purchase:${dedupeKey}`
    const claimed = db.prepare("INSERT OR IGNORE INTO telegram_notifications (id, dedupe_key, kind, status, created_at) VALUES (?, ?, 'purchase', 'sending', ?)").run(crypto.randomUUID(), key, nowIso)
    if (claimed.changes === 0) {
      // Already sent (or being sent). A previously FAILED attempt may be retried once more.
      const retry = db.prepare("UPDATE telegram_notifications SET status = 'sending', error = NULL WHERE dedupe_key = ? AND status = 'failed'").run(key)
      if (retry.changes === 0) return { duplicate: true }
    }
    const result = await sendTelegramMessage(formatPurchaseMessage(info))
    db.prepare('UPDATE telegram_notifications SET status = ?, error = ?, sent_at = ? WHERE dedupe_key = ?')
      .run(result.ok ? 'sent' : 'failed', result.ok ? null : result.error, result.ok ? new Date().toISOString() : null, key)
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.warn('[TELEGRAM] purchase notification failed:', result.error)
    }
    return result.ok ? { sent: true } : { failed: result.error }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[TELEGRAM] purchase notification error:', error instanceof Error ? error.message : error)
    return { failed: 'internal error' }
  }
}

/** Admin "Send test message" button: a real Bot API call, logged like any other. */
export async function sendTestNotification(db) {
  const nowIso = new Date().toISOString()
  const result = await sendTelegramMessage(`✅ <b>LevelUp</b>: Telegram test message\n${esc(new Date(nowIso).toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek' }))} (Бишкек)\n\nPurchase notifications will arrive in this chat.`)
  db.prepare('INSERT INTO telegram_notifications (id, dedupe_key, kind, status, error, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), `test:${crypto.randomUUID()}`, 'test', result.ok ? 'sent' : 'failed', result.ok ? null : result.error, nowIso, result.ok ? nowIso : null)
  return result
}

export function telegramStatus(db) {
  const { botToken, chatId } = telegramConfig()
  const lastSuccess = db.prepare("SELECT sent_at, kind FROM telegram_notifications WHERE status = 'sent' ORDER BY datetime(sent_at) DESC LIMIT 1").get()
  const errors = db.prepare("SELECT kind, error, created_at FROM telegram_notifications WHERE status = 'failed' ORDER BY datetime(created_at) DESC LIMIT 10").all()
  const counts = db.prepare("SELECT status, COUNT(*) AS n FROM telegram_notifications WHERE kind = 'purchase' GROUP BY status").all()
  return {
    botTokenConfigured: Boolean(botToken),
    chatIdConfigured: Boolean(chatId),
    configured: Boolean(botToken && chatId),
    enabled: isPurchaseNotificationsEnabled(db),
    lastSuccessAt: lastSuccess?.sent_at ?? null,
    lastSuccessKind: lastSuccess?.kind ?? null,
    purchaseCounts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    recentErrors: errors.map((e) => ({ kind: e.kind, error: e.error, at: e.created_at }))
  }
}
