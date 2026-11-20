// Plans, subscriptions and access rules — the single source of truth for billing.
//
// Plans live in the `subscription_plans` table (price, duration, texts in KG/RU/EN,
// enabled flag) and can be edited from the admin panel. They are seeded once from the
// prices the project already used (config/plans.js) and the texts of the pricing page.
//
// A subscription is only ever activated by activateSubscription(), which is called
// after a verified payment webhook or by the administrator.

import crypto from 'node:crypto'
import { SUPPORTED_PLANS } from './config/plans.js'

export const PLAN_RANK = { free: 0, pro: 1, aipro: 2 }
/** Lessons available without a paid plan: guests see the first lesson, registered users the first three. */
export const GUEST_LESSON_LIMIT = 1
export const FREE_LESSON_LIMIT = 3
const DAY_MS = 24 * 60 * 60 * 1000

const SEED_TEXTS = {
  free: {
    name: 'FREE',
    label: { kg: 'Акысыз', ru: 'Бесплатный', en: 'Free' },
    description: {
      kg: 'Ар бир курстун алгачкы 3 сабагынан баштап, бардык курстар менен таанышыңыз.',
      ru: 'Начните с первых 3 уроков и ознакомьтесь со всеми курсами.',
      en: 'Explore the first 3 lessons and get familiar with all courses.'
    },
    features: {
      kg: ['Ар бир курстун алгачкы 3 сабагы', 'Бардык 6 курс менен таанышуу', 'Негизги тесттер', 'Окуу прогресси'],
      ru: ['Первые 3 урока каждого курса', 'Знакомство со всеми 6 курсами', 'Базовые тесты', 'Отслеживание прогресса'],
      en: ['First 3 lessons of every course', 'Explore all 6 courses', 'Base tests', 'Progress tracking']
    },
    featured: 0
  },
  pro: {
    name: 'PRO',
    label: { kg: 'Толук мүмкүнчүлүк', ru: 'Полный доступ', en: 'Full Access' },
    description: {
      kg: 'Бардык курстарга, сабактарга, практикага жана сертификаттарга толук жеткиликтүүлүк.',
      ru: 'Полный доступ ко всем курсам, урокам, практике и сертификатам.',
      en: 'Unlock all courses, lessons, practice tasks, and certifications.'
    },
    features: {
      kg: ['Бардык 6 курс', 'Ар бир курстун 20 сабагы', 'Видео жана теория', 'Практикалык тапшырмалар', 'Бардык тесттер', 'Сертификаттар'],
      ru: ['Все 6 курсов', 'Все 20 уроков каждого курса', 'Видеоуроки и теория', 'Практические задания', 'Все тесты', 'Сертификаты'],
      en: ['All 6 courses', 'All 20 lessons in each course', 'Videos and theory', 'Practice tasks', 'All tests', 'Certificates']
    },
    featured: 1
  },
  aipro: {
    name: 'AI PRO',
    label: { kg: 'Жасалма интеллект менен окуу', ru: 'Обучение с ИИ', en: 'AI-Powered Learning' },
    description: {
      kg: 'AI жардамчы менен татаал темаларды жана кодду оңой түшүнүңүз.',
      ru: 'Поддержка AI для объяснения тем, исправления кода и персональных заданий.',
      en: 'Learn with an AI mentor to break down topics and improve code faster.'
    },
    features: {
      kg: ['PRO тарифинин бардык мүмкүнчүлүктөрү', 'Жеке AI жардамчы', 'Татаал темаларды түшүндүрүү', 'Кодду оңдоо жана талдоо', 'Жеке практика тапшырмалары'],
      ru: ['Все возможности PRO', 'Персональный AI-помощник', 'Пояснение сложных тем', 'Исправление и анализ кода', 'Индивидуальные упражнения'],
      en: ['All PRO features', 'Personal AI assistant', 'Explain complex topics', 'Fix and analyze code', 'Custom practice tasks']
    },
    featured: 0
  }
}

export function initBilling(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'KGS',
      duration_days INTEGER NOT NULL DEFAULT 30,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      is_featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      label_json TEXT NOT NULL,
      description_json TEXT NOT NULL,
      features_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subscription_history (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      event TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT,
      ends_at TEXT,
      amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'KGS',
      payment_method TEXT,
      order_id TEXT,
      transaction_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_subscription_history_user ON subscription_history (user_email, created_at);
    -- One row per reminder already sent (e.g. "plan ends in 3 days" for one period), so it is never repeated.
    CREATE TABLE IF NOT EXISTS billing_notices (
      notice_key TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)

  const columns = new Set(db.prepare('PRAGMA table_info(user_subscriptions)').all().map((c) => c.name))
  if (!columns.has('cancelled_at')) db.exec('ALTER TABLE user_subscriptions ADD COLUMN cancelled_at TEXT')

  // Purchase-request details (customer info + manual bank transfer review). No card data is ever stored.
  const orderColumns = new Set(db.prepare('PRAGMA table_info(payment_orders)').all().map((c) => c.name))
  for (const [name, type] of [
    ['customer_name', 'TEXT'], ['customer_email', 'TEXT'], ['payer_name', 'TEXT'], ['payment_reference', 'TEXT'],
    ['receipt_note', 'TEXT'], ['reviewed_at', 'TEXT'], ['reviewed_by', 'TEXT'], ['review_note', 'TEXT'],
    ['customer_language', 'TEXT']
  ]) {
    if (!orderColumns.has(name)) db.exec(`ALTER TABLE payment_orders ADD COLUMN ${name} ${type}`)
  }
  // One bank reference can back only one purchase request.
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_manual_reference
    ON payment_orders (payment_reference) WHERE payment_reference IS NOT NULL`)
  // A demo checkout key can create only one order (no double activation).
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_demo_key
    ON payment_orders (provider_order_id) WHERE provider = 'demo'`)
  // At most one transfer awaiting review per user.
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_one_manual_pending
    ON payment_orders (user_email) WHERE provider = 'manual' AND status = 'pending'`)

  // Seed plans once. Prices come from the existing configuration; nothing is overwritten later.
  const insert = db.prepare(`
    INSERT OR IGNORE INTO subscription_plans
      (id, name, price, currency, duration_days, is_enabled, is_featured, sort_order, label_json, description_json, features_json, updated_at)
    VALUES (@id, @name, @price, @currency, @duration_days, 1, @is_featured, @sort_order, @label_json, @description_json, @features_json, @updated_at)
  `)
  const nowIso = new Date().toISOString()
  ;['free', 'pro', 'aipro'].forEach((id, index) => {
    const source = id === 'free' ? { amount: 0, currency: 'KGS', durationDays: 30 } : SUPPORTED_PLANS[id]
    const texts = SEED_TEXTS[id]
    insert.run({
      id,
      name: texts.name,
      price: source.amount,
      currency: source.currency,
      duration_days: source.durationDays,
      is_featured: texts.featured,
      sort_order: index,
      label_json: JSON.stringify(texts.label),
      description_json: JSON.stringify(texts.description),
      features_json: JSON.stringify(texts.features),
      updated_at: nowIso
    })
  })
}

const parse = (value, fallback) => { try { return JSON.parse(value) } catch { return fallback } }

function formatPlan(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    amount: Number(row.price),
    currency: row.currency,
    durationDays: Number(row.duration_days),
    isEnabled: Boolean(row.is_enabled),
    isFeatured: Boolean(row.is_featured),
    sortOrder: Number(row.sort_order),
    label: parse(row.label_json, {}),
    description: parse(row.description_json, {}),
    features: parse(row.features_json, {}),
    updatedAt: row.updated_at
  }
}

export function listPlans(db, { includeDisabled = false } = {}) {
  const rows = db.prepare(`SELECT * FROM subscription_plans ${includeDisabled ? '' : 'WHERE is_enabled = 1'} ORDER BY sort_order ASC`).all()
  return rows.map(formatPlan)
}

export function getPlanById(db, planId) {
  const id = String(planId ?? '').trim().toLowerCase()
  if (!(id in PLAN_RANK)) return null
  return formatPlan(db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(id))
}

const LANGS = ['kg', 'ru', 'en']
const cleanText = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)

/** Validates and applies an admin edit. Returns { plan } or { error }. */
export function updatePlan(db, planId, patch) {
  const current = getPlanById(db, planId)
  if (!current) return { error: 'Plan not found', status: 404 }
  const next = { ...current }

  if (patch.price !== undefined) {
    const price = Number(patch.price)
    if (!Number.isInteger(price) || price < 0 || price > 1000000) return { error: 'Price must be a whole number between 0 and 1000000', status: 400 }
    if (current.id === 'free' && price !== 0) return { error: 'The FREE plan must cost 0', status: 400 }
    if (current.id !== 'free' && price === 0) return { error: 'A paid plan cannot cost 0', status: 400 }
    next.price = price
  }
  if (patch.durationDays !== undefined) {
    const days = Number(patch.durationDays)
    if (!Number.isInteger(days) || days < 1 || days > 366) return { error: 'Duration must be 1–366 days', status: 400 }
    next.durationDays = days
  }
  if (patch.isEnabled !== undefined) {
    if (current.id === 'free' && !patch.isEnabled) return { error: 'The FREE plan cannot be disabled', status: 400 }
    next.isEnabled = Boolean(patch.isEnabled)
  }
  if (patch.isFeatured !== undefined) next.isFeatured = Boolean(patch.isFeatured)
  for (const field of ['label', 'description']) {
    if (patch[field] !== undefined) {
      if (typeof patch[field] !== 'object' || !patch[field]) return { error: `${field} must be an object with kg/ru/en`, status: 400 }
      next[field] = Object.fromEntries(LANGS.map((lang) => [lang, cleanText(patch[field][lang] ?? current[field][lang], field === 'label' ? 80 : 400)]))
      if (LANGS.some((lang) => !next[field][lang])) return { error: `${field} is required in KG, RU and EN`, status: 400 }
    }
  }
  if (patch.features !== undefined) {
    if (typeof patch.features !== 'object' || !patch.features) return { error: 'features must be an object with kg/ru/en lists', status: 400 }
    next.features = Object.fromEntries(LANGS.map((lang) => {
      const list = Array.isArray(patch.features[lang]) ? patch.features[lang] : current.features[lang] ?? []
      return [lang, list.map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 12)]
    }))
  }

  db.prepare(`
    UPDATE subscription_plans SET price = ?, duration_days = ?, is_enabled = ?, is_featured = ?,
      label_json = ?, description_json = ?, features_json = ?, updated_at = ? WHERE id = ?
  `).run(next.price, next.durationDays, next.isEnabled ? 1 : 0, next.isFeatured ? 1 : 0,
    JSON.stringify(next.label), JSON.stringify(next.description), JSON.stringify(next.features), new Date().toISOString(), current.id)
  return { plan: getPlanById(db, current.id) }
}

export function recordHistory(db, entry) {
  db.prepare(`
    INSERT INTO subscription_history (id, user_email, event, plan_id, status, started_at, ends_at, amount, currency, payment_method, order_id, transaction_id, created_at)
    VALUES (@id, @user_email, @event, @plan_id, @status, @started_at, @ends_at, @amount, @currency, @payment_method, @order_id, @transaction_id, @created_at)
  `).run({
    id: crypto.randomUUID(),
    started_at: null,
    ends_at: null,
    amount: 0,
    currency: 'KGS',
    payment_method: null,
    order_id: null,
    transaction_id: null,
    created_at: new Date().toISOString(),
    ...entry
  })
}

export function listHistory(db, userEmail, limit = 50) {
  return db.prepare('SELECT * FROM subscription_history WHERE user_email = ? ORDER BY datetime(created_at) DESC LIMIT ?').all(userEmail, limit).map((row) => ({
    id: row.id,
    event: row.event,
    planId: row.plan_id,
    status: row.status,
    startedAt: row.started_at,
    endsAt: row.ends_at,
    amount: row.amount,
    currency: row.currency,
    paymentMethod: row.payment_method,
    orderId: row.order_id,
    transactionId: row.transaction_id,
    createdAt: row.created_at
  }))
}

/** A paid plan gives access while it is active, or cancelled but not yet past its end date. */
function rowGivesAccess(row, nowMs = Date.now()) {
  if (!row || row.plan_id === 'free') return false
  if (row.status !== 'active' && row.status !== 'cancelled') return false
  const ends = new Date(row.ends_at).getTime()
  return Number.isFinite(ends) && ends > nowMs
}

/** Marks every paid subscription past its end date as expired (and logs it). */
export function expireDueSubscriptions(db) {
  const nowIso = new Date().toISOString()
  const due = db.prepare("SELECT * FROM user_subscriptions WHERE plan_id != 'free' AND status IN ('active', 'cancelled') AND datetime(ends_at) <= datetime(?)").all(nowIso)
  const tx = db.transaction(() => {
    for (const row of due) {
      db.prepare("UPDATE user_subscriptions SET status = 'expired', updated_at = ? WHERE user_email = ?").run(nowIso, row.user_email)
      recordHistory(db, { user_email: row.user_email, event: 'expired', plan_id: row.plan_id, status: 'expired', started_at: row.started_at, ends_at: row.ends_at })
    }
  })
  tx()
  return due.length
}

export function getSubscriptionRow(db, userEmail) {
  const row = db.prepare('SELECT * FROM user_subscriptions WHERE user_email = ?').get(userEmail)
  if (row && (row.status === 'active' || row.status === 'cancelled') && row.plan_id !== 'free' && !rowGivesAccess(row)) {
    expireDueSubscriptions(db)
    return db.prepare('SELECT * FROM user_subscriptions WHERE user_email = ?').get(userEmail)
  }
  return row
}

/** The plan whose features the user can use right now: 'free' | 'pro' | 'aipro'. */
export function getAccessPlan(db, userEmail) {
  if (!userEmail) return 'free'
  const row = getSubscriptionRow(db, userEmail)
  return rowGivesAccess(row) ? row.plan_id : 'free'
}

/**
 * Activates (or renews / upgrades) a subscription. Same plan while active → the new
 * period is added to the current end date. Higher plan → it starts now.
 * Returns { kind: 'new' | 'renewal' | 'upgrade' | 'change', subscription }.
 */
export function activateSubscription(db, { userEmail, planId, days, amount, currency = 'KGS', paymentMethod, orderId, transactionId, source }) {
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const current = db.prepare('SELECT * FROM user_subscriptions WHERE user_email = ?').get(userEmail)
  const currentActive = rowGivesAccess(current, nowMs)
  let kind = 'new'
  let startedAt = nowIso
  let baseMs = nowMs
  if (currentActive && current.plan_id === planId) {
    kind = 'renewal'
    startedAt = current.started_at
    baseMs = new Date(current.ends_at).getTime()
  } else if (currentActive && PLAN_RANK[planId] > PLAN_RANK[current.plan_id]) {
    kind = 'upgrade'
  } else if (currentActive) {
    kind = 'change'
  }
  const endsAt = new Date(baseMs + days * DAY_MS).toISOString()

  db.prepare(`
    INSERT INTO user_subscriptions (user_email, plan_id, status, started_at, ends_at, purchased_at, updated_at, payment_method, amount, currency, order_id, cancelled_at)
    VALUES (@user_email, @plan_id, 'active', @started_at, @ends_at, @purchased_at, @updated_at, @payment_method, @amount, @currency, @order_id, NULL)
    ON CONFLICT(user_email) DO UPDATE SET plan_id = excluded.plan_id, status = 'active', started_at = excluded.started_at,
      ends_at = excluded.ends_at, purchased_at = excluded.purchased_at, updated_at = excluded.updated_at,
      payment_method = excluded.payment_method, amount = excluded.amount, currency = excluded.currency,
      order_id = excluded.order_id, cancelled_at = NULL
  `).run({ user_email: userEmail, plan_id: planId, started_at: startedAt, ends_at: endsAt, purchased_at: nowIso, updated_at: nowIso, payment_method: paymentMethod, amount, currency, order_id: orderId })

  const event = source === 'admin' ? 'admin_grant' : kind === 'new' ? 'activated' : kind === 'renewal' ? 'renewed' : kind === 'upgrade' ? 'upgraded' : 'changed'
  recordHistory(db, { user_email: userEmail, event, plan_id: planId, status: 'active', started_at: startedAt, ends_at: endsAt, amount, currency, payment_method: paymentMethod, order_id: orderId, transaction_id: transactionId ?? null })
  return { kind, subscription: db.prepare('SELECT * FROM user_subscriptions WHERE user_email = ?').get(userEmail) }
}

/** User cancels: no further renewals; access stays until the paid period ends. */
export function cancelSubscription(db, userEmail) {
  const row = getSubscriptionRow(db, userEmail)
  if (!row || row.status !== 'active' || !rowGivesAccess(row)) return { error: 'There is no active paid subscription to cancel', status: 400 }
  const nowIso = new Date().toISOString()
  db.prepare("UPDATE user_subscriptions SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE user_email = ?").run(nowIso, nowIso, userEmail)
  recordHistory(db, { user_email: userEmail, event: 'cancelled', plan_id: row.plan_id, status: 'cancelled', started_at: row.started_at, ends_at: row.ends_at })
  return { subscription: db.prepare('SELECT * FROM user_subscriptions WHERE user_email = ?').get(userEmail) }
}

/** Admin adds `days` to the current paid period (the plan stays the same). */
export function extendSubscription(db, userEmail, days, adminEmail) {
  const count = Number(days)
  if (!Number.isInteger(count) || count < 1 || count > 366) return { error: 'Days must be a whole number between 1 and 366', status: 400 }
  const row = getSubscriptionRow(db, userEmail)
  if (!rowGivesAccess(row)) return { error: 'The user has no active paid plan to extend. Use "Grant" to give a plan.', status: 400, code: 'NO_ACTIVE_PLAN' }
  const nowIso = new Date().toISOString()
  const endsAt = new Date(new Date(row.ends_at).getTime() + count * DAY_MS).toISOString()
  db.prepare("UPDATE user_subscriptions SET ends_at = ?, status = 'active', cancelled_at = NULL, updated_at = ? WHERE user_email = ?").run(endsAt, nowIso, userEmail)
  recordHistory(db, { user_email: userEmail, event: 'admin_extend', plan_id: row.plan_id, status: 'active', started_at: row.started_at, ends_at: endsAt, payment_method: 'admin', transaction_id: adminEmail ? `admin:${adminEmail}` : null })
  return { subscription: db.prepare('SELECT * FROM user_subscriptions WHERE user_email = ?').get(userEmail) }
}

/** Paid plans that end within `withinDays` and were not reminded yet for this period. Marks them as reminded. */
export function claimEndingSoonReminders(db, withinDays = 3) {
  const nowMs = Date.now()
  const rows = db.prepare("SELECT * FROM user_subscriptions WHERE plan_id != 'free' AND status IN ('active', 'cancelled') AND datetime(ends_at) > datetime(?) AND datetime(ends_at) <= datetime(?)")
    .all(new Date(nowMs).toISOString(), new Date(nowMs + withinDays * DAY_MS).toISOString())
  const claim = db.prepare('INSERT OR IGNORE INTO billing_notices (notice_key, user_email, created_at) VALUES (?, ?, ?)')
  return rows.filter((row) => claim.run(`ending:${row.user_email}:${row.ends_at}`, row.user_email, new Date().toISOString()).changes === 1)
    .map((row) => ({ ...row, daysLeft: Math.max(1, Math.ceil((new Date(row.ends_at).getTime() - nowMs) / DAY_MS)) }))
}

/** Admin revokes access immediately. */
export function revokeSubscription(db, userEmail) {
  const row = db.prepare('SELECT * FROM user_subscriptions WHERE user_email = ?').get(userEmail)
  if (!row) return
  const nowIso = new Date().toISOString()
  db.prepare("UPDATE user_subscriptions SET status = 'expired', ends_at = ?, updated_at = ? WHERE user_email = ?").run(nowIso, nowIso, userEmail)
  recordHistory(db, { user_email: userEmail, event: 'admin_revoke', plan_id: row.plan_id, status: 'expired', started_at: row.started_at, ends_at: nowIso })
}

/** Public shape of a subscription for the user's own dashboard. */
export function formatSubscriptionForUser(db, userEmail) {
  const row = getSubscriptionRow(db, userEmail)
  const pending = db.prepare("SELECT * FROM payment_orders WHERE user_email = ? AND status = 'pending' ORDER BY datetime(created_at) DESC LIMIT 1").get(userEmail)
  const lastOrder = db.prepare('SELECT * FROM payment_orders WHERE user_email = ? ORDER BY datetime(created_at) DESC LIMIT 1').get(userEmail)
  const accessPlan = rowGivesAccess(row) ? row.plan_id : 'free'
  const base = row && row.plan_id !== 'free'
    ? {
        planId: row.plan_id,
        status: row.status,
        startedAt: row.started_at,
        endsAt: row.ends_at,
        purchasedAt: row.purchased_at,
        cancelledAt: row.cancelled_at ?? null,
        paymentMethod: row.payment_method,
        amount: row.amount,
        currency: row.currency,
        orderId: row.order_id
      }
    : { planId: 'free', status: 'active', startedAt: null, endsAt: null, purchasedAt: null, cancelledAt: null, paymentMethod: 'none', amount: 0, currency: 'KGS', orderId: null }
  return {
    userEmail,
    ...base,
    accessPlan,
    hasAccess: accessPlan !== 'free',
    remainingDays: accessPlan !== 'free' ? Math.max(0, Math.ceil((new Date(row.ends_at).getTime() - Date.now()) / DAY_MS)) : 0,
    pendingOrder: pending ? { orderId: pending.id, orderCode: `LU-${String(pending.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`, planId: pending.plan_id, amount: pending.amount, paymentMethod: pending.payment_method, createdAt: pending.created_at, paymentUrl: pending.payment_url, provider: pending.provider, paymentReference: pending.payment_reference ?? null } : null,
    lastReviewNote: lastOrder && lastOrder.provider === 'manual' && lastOrder.status === 'failed' ? (lastOrder.review_note ?? null) : null,
    lastPaymentStatus: lastOrder ? lastOrder.status : null
  }
}

/** How many lessons of each course the requester may open. Infinity = all. */
export function lessonLimitFor(accessPlan, isLoggedIn, isAdmin) {
  if (isAdmin || accessPlan === 'pro' || accessPlan === 'aipro') return Infinity
  return isLoggedIn ? FREE_LESSON_LIMIT : GUEST_LESSON_LIMIT
}
