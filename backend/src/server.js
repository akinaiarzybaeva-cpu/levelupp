import bcrypt from 'bcrypt'
import cors from 'cors'
import crypto from 'node:crypto'
import express from 'express'
import { config } from './config/config.js'
import { db } from './config/db.js'
import { getPlan } from './config/plans.js'
import { createProviderOrder, normalizeWebhookPayload, verifyWebhookSignature } from './config/provider.js'

const app = express()

const allowedOrigins = new Set([config.frontendUrl, 'http://127.0.0.1:5173', 'http://localhost:5173'])
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Origin is not allowed by CORS'))
  }
}))
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8')
  }
}))

const insertOrderStmt = db.prepare(`
  INSERT INTO payment_orders (
    id, user_email, plan_id, payment_method, amount, currency, provider,
    provider_order_id, payment_url, status, created_at, updated_at
  ) VALUES (
    @id, @user_email, @plan_id, @payment_method, @amount, @currency, @provider,
    @provider_order_id, @payment_url, @status, @created_at, @updated_at
  )
`)

const findOrderByIdStmt = db.prepare('SELECT * FROM payment_orders WHERE id = ?')
const findOrderByProviderRefStmt = db.prepare('SELECT * FROM payment_orders WHERE provider_order_id = ? OR id = ? LIMIT 1')
const updateOrderStatusStmt = db.prepare(`
  UPDATE payment_orders
  SET status = @status,
      provider_payment_id = @provider_payment_id,
      provider_payload = @provider_payload,
      updated_at = @updated_at
  WHERE id = @id
`)

const markOrderActivatedStmt = db.prepare(`
  UPDATE payment_orders
  SET is_activated = 1, updated_at = @updated_at
  WHERE id = @id
`)

const upsertSubscriptionStmt = db.prepare(`
  INSERT INTO user_subscriptions (
    user_email, plan_id, status, started_at, ends_at, purchased_at, updated_at, payment_method, amount, currency, order_id
  ) VALUES (
    @user_email, @plan_id, @status, @started_at, @ends_at, @purchased_at, @updated_at, @payment_method, @amount, @currency, @order_id
  )
  ON CONFLICT(user_email) DO UPDATE SET
    plan_id = excluded.plan_id,
    status = excluded.status,
    started_at = excluded.started_at,
    ends_at = excluded.ends_at,
    purchased_at = excluded.purchased_at,
    updated_at = excluded.updated_at,
    payment_method = excluded.payment_method,
    amount = excluded.amount,
    currency = excluded.currency,
    order_id = excluded.order_id
`)

const findSubscriptionStmt = db.prepare('SELECT * FROM user_subscriptions WHERE user_email = ?')
const expireSubscriptionStmt = db.prepare(`
  UPDATE user_subscriptions
  SET plan_id = 'free',
      status = 'expired',
      updated_at = @updated_at,
      payment_method = 'none',
      amount = 0
  WHERE user_email = @user_email
`)

const insertPaymentStmt = db.prepare(`
  INSERT INTO payments (
    id, order_id, provider, provider_transaction_id, amount, currency, status, raw_payload, created_at
  ) VALUES (
    @id, @order_id, @provider, @provider_transaction_id, @amount, @currency, @status, @raw_payload, @created_at
  )
`)

const listReviewsStmt = db.prepare(`
  SELECT id, user_email, user_name, user_avatar, lesson_id, lesson_label, rating, text, created_at, updated_at
  FROM reviews
  ORDER BY datetime(created_at) DESC
`)

const getUserProfileStmt = db.prepare(`
  SELECT user_email, first_name, last_name, phone, bio, avatar_url, role, password_hash, created_at, updated_at
  FROM user_profiles
  WHERE user_email = ?
`)

const upsertUserProfileStmt = db.prepare(`
  INSERT INTO user_profiles (
    user_email, first_name, last_name, phone, bio, avatar_url, role, account_status, is_blocked, password_hash, created_at, updated_at
  ) VALUES (
    @user_email, @first_name, @last_name, @phone, @bio, @avatar_url, @role, @account_status, @is_blocked, @password_hash, @created_at, @updated_at
  )
  ON CONFLICT(user_email) DO UPDATE SET
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    bio = excluded.bio,
    avatar_url = excluded.avatar_url,
    role = excluded.role,
    account_status = excluded.account_status,
    is_blocked = excluded.is_blocked,
    password_hash = COALESCE(excluded.password_hash, user_profiles.password_hash),
    updated_at = excluded.updated_at
`)

const getUserNotificationSettingsStmt = db.prepare(`
  SELECT user_email, email_notifications, new_courses, new_lessons, news_updates, updated_at
  FROM user_notification_settings
  WHERE user_email = ?
`)

const insertUserSessionStmt = db.prepare(`
  INSERT INTO user_sessions (
    id, user_email, token_hash, user_agent, expires_at, revoked, created_at, updated_at
  ) VALUES (
    @id, @user_email, @token_hash, @user_agent, @expires_at, @revoked, @created_at, @updated_at
  )
`)

const revokeUserSessionByTokenStmt = db.prepare(`
  UPDATE user_sessions
  SET revoked = 1,
      updated_at = @updated_at
  WHERE token_hash = @token_hash AND revoked = 0
`)

const upsertUserNotificationSettingsStmt = db.prepare(`
  INSERT INTO user_notification_settings (
    user_email, email_notifications, new_courses, new_lessons, news_updates, updated_at
  ) VALUES (
    @user_email, @email_notifications, @new_courses, @new_lessons, @news_updates, @updated_at
  )
  ON CONFLICT(user_email) DO UPDATE SET
    email_notifications = excluded.email_notifications,
    new_courses = excluded.new_courses,
    new_lessons = excluded.new_lessons,
    news_updates = excluded.news_updates,
    updated_at = excluded.updated_at
`)

const createReviewStmt = db.prepare(`
  INSERT INTO reviews (
    id, user_email, user_name, user_avatar, lesson_id, lesson_label, rating, text, created_at, updated_at
  ) VALUES (
    @id, @user_email, @user_name, @user_avatar, @lesson_id, @lesson_label, @rating, @text, @created_at, @updated_at
  )
`)

const updateReviewStmt = db.prepare(`
  UPDATE reviews
  SET rating = @rating,
      text = @text,
      lesson_id = @lesson_id,
      lesson_label = @lesson_label,
      updated_at = @updated_at
  WHERE id = @id AND user_email = @user_email
`)

const upsertCourseProgressStmt = db.prepare(`
 INSERT INTO course_progress (
   user_email, course_id, started_at, completed_at, lessons_started, lessons_completed, status, created_at, updated_at
 ) VALUES (
   @user_email, @course_id, @started_at, @completed_at, @lessons_started, @lessons_completed, @status, @created_at, @updated_at
 )
 ON CONFLICT(user_email, course_id) DO UPDATE SET
   started_at = COALESCE(excluded.started_at, course_progress.started_at),
   completed_at = CASE
     WHEN excluded.completed_at IS NOT NULL THEN excluded.completed_at
     ELSE course_progress.completed_at
   END,
   lessons_started = CASE
     WHEN excluded.lessons_started > course_progress.lessons_started THEN excluded.lessons_started
     ELSE course_progress.lessons_started
   END,
   lessons_completed = CASE
     WHEN excluded.lessons_completed > course_progress.lessons_completed THEN excluded.lessons_completed
     ELSE course_progress.lessons_completed
   END,
   status = CASE
     WHEN excluded.status = 'completed' THEN 'completed'
     WHEN course_progress.status = 'completed' THEN 'completed'
     ELSE 'started'
   END,
   updated_at = excluded.updated_at
`)

function buildFreeSubscription(email) {
  const now = new Date().toISOString()
  return {
    userEmail: email,
    planId: 'free',
    status: 'active',
    startedAt: now,
    endsAt: now,
    purchasedAt: null,
    paymentMethod: 'none',
    amount: 0,
    currency: 'KGS',
    orderId: null
  }
}

function formatSubscription(row, userEmail) {
  if (!row) return buildFreeSubscription(userEmail)
  return {
    userEmail,
    planId: row.plan_id,
    status: row.status,
    startedAt: row.started_at,
    endsAt: row.ends_at,
    purchasedAt: row.purchased_at,
    paymentMethod: row.payment_method,
    amount: row.amount,
    currency: row.currency,
    orderId: row.order_id
  }
}

function extractBearerToken(req) {
  const authHeader = String(req.headers.authorization ?? '').trim()
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }

  const legacyToken = String(req.headers['x-auth-token'] ?? '').trim()
  return legacyToken || ''
}

function resolveAuthenticatedUserEmail(req, requestEmailOverride = '') {
  const sessionEmail = resolveSessionUserEmail(req)
  const headerEmail = String(req.headers['x-user-email'] ?? '').trim().toLowerCase()
  const requestEmail = String(requestEmailOverride || '').trim().toLowerCase()

  const candidates = [sessionEmail, headerEmail, requestEmail].filter(Boolean)
  if (!candidates.length) return null

  const resolved = candidates[0]
  for (const candidate of candidates.slice(1)) {
    if (candidate !== resolved) {
      return null
    }
  }

  return resolved
}

function validateUserEmailFromRequest(req, bodyEmail) {
  const requestEmail = String(bodyEmail ?? '').trim().toLowerCase()
  const resolved = resolveAuthenticatedUserEmail(req, requestEmail)
  if (!resolved) {
    return null
  }

  return resolved
}

function resolveSessionUserEmail(req) {
  const rawToken = extractBearerToken(req)
  if (!rawToken) return null

  const nowIso = new Date().toISOString()
  const rows = db.prepare('SELECT * FROM user_sessions WHERE revoked = 0 AND expires_at > ?').all(nowIso)

  for (const row of rows) {
    if (bcrypt.compareSync(rawToken, row.token_hash)) {
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        db.prepare('UPDATE user_sessions SET revoked = 1, updated_at = ? WHERE id = ?').run(nowIso, row.id)
        return null
      }

      return String(row.user_email).trim().toLowerCase()
    }
  }

  return null
}

function getPublicUserRecord(profile) {
  if (!profile) return null
  return {
    email: profile.user_email,
    name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.user_email,
    firstName: profile.first_name ?? '',
    lastName: profile.last_name ?? '',
    phone: profile.phone ?? '',
    bio: profile.bio ?? '',
    avatar: profile.avatar_url ?? '',
    role: profile.role ?? 'User',
    createdAt: profile.created_at ?? new Date().toISOString(),
    accountStatus: profile.account_status ?? 'active',
    isBlocked: Boolean(profile.is_blocked)
  }
}

function ensureSeedUsers() {
  const seedUsers = [
    { email: 'aisha@levelup.kg', firstName: 'Aisha', lastName: '', password: 'demo123', role: 'User' },
    { email: 'admin@levelup.kg', firstName: 'Admin', lastName: '', password: 'admin123', role: 'Admin' }
  ]

  for (const seed of seedUsers) {
    const existing = getUserProfileStmt.get(seed.email)
    if (existing) continue

    upsertUserProfileStmt.run({
      user_email: seed.email,
      first_name: seed.firstName,
      last_name: seed.lastName,
      phone: '',
      bio: '',
      avatar_url: '',
      role: seed.role,
      account_status: 'active',
      is_blocked: 0,
      password_hash: hashPassword(seed.password),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/register', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email and password are required' })
    return
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Email is invalid' })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must contain at least 6 characters' })
    return
  }

  const existing = getUserProfileStmt.get(email)
  if (existing) {
    res.status(409).json({ error: 'User already exists with this email' })
    return
  }

  const nowIso = new Date().toISOString()
  const nameParts = name.split(/\s+/).filter(Boolean)
  upsertUserProfileStmt.run({
    user_email: email,
    first_name: nameParts[0] ?? '',
    last_name: nameParts.slice(1).join(' '),
    phone: '',
    bio: '',
    avatar_url: '',
    role: 'User',
    account_status: 'active',
    is_blocked: 0,
    password_hash: hashPassword(password),
    created_at: nowIso,
    updated_at: nowIso
  })

  const profile = getUserProfileStmt.get(email)
  const session = createUserSession(email, req.headers['user-agent'] ?? '')

  res.status(201).json({
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      email: profile.user_email,
      name: `${profile.first_name} ${profile.last_name}`.trim() || email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phone: '',
      bio: '',
      avatar: '',
      role: profile.role,
      createdAt: profile.created_at,
      accountStatus: profile.account_status,
      isBlocked: Boolean(profile.is_blocked)
    }
  })
})

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  const profile = getUserProfileStmt.get(email)
  if (!profile || !profile.password_hash || !verifyPassword(password, profile.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  if (profile.account_status === 'blocked' || profile.is_blocked) {
    res.status(403).json({ error: 'This account has been blocked' })
    return
  }

  const session = createUserSession(email, req.headers['user-agent'] ?? '')

  res.json({
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      email: profile.user_email,
      name: `${profile.first_name} ${profile.last_name}`.trim() || profile.user_email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phone: profile.phone ?? '',
      bio: profile.bio ?? '',
      avatar: profile.avatar_url ?? '',
      role: profile.role,
      createdAt: profile.created_at,
      accountStatus: profile.account_status,
      isBlocked: Boolean(profile.is_blocked)
    }
  })
})

app.get('/api/auth/session', (req, res) => {
  const email = resolveAuthenticatedUserEmail(req)
  if (!email) {
    res.status(401).json({ error: 'Session expired or invalid' })
    return
  }

  const profile = getUserProfileStmt.get(email)
  if (!profile) {
    res.status(401).json({ error: 'Session invalid' })
    return
  }

  if (profile.account_status === 'blocked' || profile.is_blocked) {
    res.status(403).json({ error: 'This account has been blocked' })
    return
  }

  res.json({
    ok: true,
    user: {
      email: profile.user_email,
      name: `${profile.first_name} ${profile.last_name}`.trim() || profile.user_email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phone: profile.phone ?? '',
      bio: profile.bio ?? '',
      avatar: profile.avatar_url ?? '',
      role: profile.role,
      createdAt: profile.created_at,
      accountStatus: profile.account_status,
      isBlocked: Boolean(profile.is_blocked)
    }
  })
})

app.post('/api/auth/logout', (req, res) => {
  const token = extractBearerToken(req)
  if (token) {
    revokeTokenSession(token)
  }

  res.json({ ok: true })
})

app.get('/api/admin/overview', (req, res) => {
  if (!ensureAdminAccess(req)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const totalUsersRow = db.prepare('SELECT COUNT(*) AS count FROM user_profiles').get()
  const newUsersRow = db.prepare("SELECT COUNT(*) AS count FROM user_profiles WHERE datetime(created_at) >= datetime('now', '-30 days')").get()
  const activeStudentsRow = db.prepare("SELECT COUNT(*) AS count FROM user_profiles WHERE account_status = 'active' AND is_blocked = 0 AND (role = 'Student' OR role = 'User')").get()
  const completedCoursesRow = db.prepare("SELECT COUNT(*) AS count FROM course_progress WHERE status = 'completed'").get()
  const ratingRow = db.prepare("SELECT AVG(rating) AS average, COUNT(*) AS count FROM reviews WHERE moderation_status = 'published'").get()
  const reviewsRow = db.prepare("SELECT COUNT(*) AS count FROM reviews WHERE moderation_status = 'published'").get()
  const plansRow = db.prepare("SELECT COUNT(*) AS count FROM user_subscriptions WHERE status = 'active' AND plan_id IN ('pro', 'aipro')").get()
  const revenueRow = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payment_orders WHERE status = 'paid'").get()

  res.json({
    totalUsers: Number(totalUsersRow?.count ?? 0),
    newRegistrations: Number(newUsersRow?.count ?? 0),
    activeStudents: Number(activeStudentsRow?.count ?? 0),
    completedCourses: Number(completedCoursesRow?.count ?? 0),
    averageRating: Number(ratingRow?.average ?? 0),
    reviews: Number(reviewsRow?.count ?? 0),
    planPurchases: Number(plansRow?.count ?? 0),
    revenue: Number(revenueRow?.total ?? 0)
  })
})

app.get('/api/admin/users', (req, res) => {
  if (!ensureAdminAccess(req)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const search = String(req.query.search ?? '').trim().toLowerCase()
  const status = String(req.query.status ?? '').trim()
  const role = String(req.query.role ?? '').trim()

  let sql = 'SELECT user_email, first_name, last_name, role, account_status, is_blocked, created_at FROM user_profiles'
  const clauses = []
  const params = []

  if (search) {
    clauses.push('(LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ? OR LOWER(user_email) LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  if (status) {
    clauses.push('account_status = ?')
    params.push(status)
  }

  if (role) {
    clauses.push('role = ?')
    params.push(role)
  }

  if (clauses.length) {
    sql += ' WHERE ' + clauses.join(' AND ')
  }

  sql += ' ORDER BY datetime(created_at) DESC'

  const rows = db.prepare(sql).all(...params)
  res.json({ users: rows.map((row) => ({
    email: row.user_email,
    name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.user_email,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    role: row.role ?? 'User',
    accountStatus: row.account_status ?? 'active',
    isBlocked: Boolean(row.is_blocked),
    createdAt: row.created_at
  })) })
})

app.patch('/api/admin/users/:userEmail', (req, res) => {
  if (!ensureAdminAccess(req)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const current = getUserProfileStmt.get(userEmail)
  if (!current) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const nextRole = normalizeRoleName(String(req.body?.role ?? current.role ?? 'User'))
  const nextStatus = String(req.body?.accountStatus ?? current.account_status ?? 'active').trim() || 'active'
  const nextBlocked = req.body?.isBlocked === true || req.body?.is_blocked === 1 || req.body?.isBlocked === 1

  upsertUserProfileStmt.run({
    user_email: userEmail,
    first_name: current.first_name,
    last_name: current.last_name,
    phone: current.phone ?? null,
    bio: current.bio ?? '',
    avatar_url: current.avatar_url ?? null,
    role: nextRole,
    account_status: nextStatus,
    is_blocked: nextBlocked ? 1 : 0,
    password_hash: current.password_hash,
    created_at: current.created_at,
    updated_at: new Date().toISOString()
  })

  res.json({ ok: true, user: { email: userEmail, role: nextRole, accountStatus: nextStatus, isBlocked: nextBlocked } })
})

app.delete('/api/admin/users/:userEmail', (req, res) => {
  if (!ensureAdminAccess(req)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const profile = getUserProfileStmt.get(userEmail)
  if (!profile) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  if (userEmail === 'admin@levelup.kg') {
    res.status(400).json({ error: 'You cannot delete the default administrator account' })
    return
  }

  db.prepare('DELETE FROM user_profiles WHERE user_email = ?').run(userEmail)
  res.json({ ok: true })
})

app.get('/api/reviews', (_req, res) => {
  const rows = listReviewsStmt.all()
  const reviews = rows.map((row) => ({
    id: row.id,
    userId: row.user_email,
    name: row.user_name,
    avatar: row.user_avatar,
    lessonId: row.lesson_id,
    lessonLabel: row.lesson_label,
    rating: row.rating,
    text: row.text,
    date: row.updated_at,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }))

  res.json({ reviews })
})

app.post('/api/reviews', (req, res) => {
  const userEmail = validateUserEmailFromRequest(req, req.body?.userEmail)
  if (!userEmail) {
    res.status(401).json({ error: 'User is not authorized to post this review' })
    return
  }

  const userName = String(req.body?.userName ?? '').trim()
  const userAvatar = String(req.body?.userAvatar ?? '').trim().slice(0, 2).toUpperCase() || 'U'
  const lessonId = String(req.body?.lessonId ?? '').trim()
  const lessonLabel = String(req.body?.lessonLabel ?? '').trim()
  const text = String(req.body?.text ?? '').trim()
  const rating = Number(req.body?.rating)

  if (!userName || !lessonId || !lessonLabel || !text) {
    res.status(400).json({ error: 'Review fields are required' })
    return
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Rating must be an integer between 1 and 5' })
    return
  }

  const existingReview = db.prepare('SELECT id FROM reviews WHERE user_email = ?').get(userEmail)
  const nowIso = new Date().toISOString()

  if (existingReview) {
    const updateResult = updateReviewStmt.run({
      id: existingReview.id,
      user_email: userEmail,
      rating,
      text,
      lesson_id: lessonId,
      lesson_label: lessonLabel,
      updated_at: nowIso
    })

    if (updateResult.changes === 0) {
      res.status(500).json({ error: 'Unable to update your review' })
      return
    }

    res.json({ ok: true, id: existingReview.id, updated: true })
    return
  }

  const reviewId = crypto.randomUUID()
  createReviewStmt.run({
    id: reviewId,
    user_email: userEmail,
    user_name: userName,
    user_avatar: userAvatar,
    lesson_id: lessonId,
    lesson_label: lessonLabel,
    rating,
    text,
    created_at: nowIso,
    updated_at: nowIso
  })

  res.status(201).json({ ok: true, id: reviewId, created: true })
})

app.post('/api/payments/orders', async (req, res) => {
  const userEmail = validateUserEmailFromRequest(req, req.body?.userEmail)
  if (!userEmail) {
    res.status(401).json({ error: 'User is not authorized to create this order' })
    return
  }

  const userName = typeof req.body?.userName === 'string' ? req.body.userName.trim() : ''
  const paymentMethod = typeof req.body?.paymentMethod === 'string' ? req.body.paymentMethod : ''
  const plan = getPlan(req.body?.planId)

  if (!plan) {
    res.status(400).json({ error: 'Unsupported subscription plan' })
    return
  }

  if (paymentMethod !== 'MBank' && paymentMethod !== 'Элсом' && paymentMethod !== 'O!Деньги') {
    res.status(400).json({ error: 'Unsupported payment method' })
    return
  }

  const internalOrderId = crypto.randomUUID()
  const nowIso = new Date().toISOString()

  try {
    const providerOrder = await createProviderOrder({
      internalOrderId,
      plan,
      paymentMethod,
      userEmail,
      userName
    })

    insertOrderStmt.run({
      id: internalOrderId,
      user_email: userEmail,
      plan_id: plan.id,
      payment_method: paymentMethod,
      amount: plan.amount,
      currency: plan.currency,
      provider: config.payment.provider,
      provider_order_id: providerOrder.providerOrderId,
      payment_url: providerOrder.paymentUrl,
      status: providerOrder.status,
      created_at: nowIso,
      updated_at: nowIso
    })

    res.status(201).json({
      orderId: internalOrderId,
      providerOrderId: providerOrder.providerOrderId,
      paymentUrl: providerOrder.paymentUrl,
      status: providerOrder.status
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment provider is unavailable'
    res.status(502).json({ error: message })
  }
})

app.get('/api/payments/orders/:orderId', (req, res) => {
  const userEmail = String(req.headers['x-user-email'] ?? '').trim().toLowerCase()
  const orderId = String(req.params.orderId ?? '')
  const order = findOrderByIdStmt.get(orderId)

  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }

  if (!userEmail || userEmail !== String(order.user_email).toLowerCase()) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  res.json({
    orderId: order.id,
    planId: order.plan_id,
    status: order.status,
    paymentMethod: order.payment_method,
    amount: order.amount,
    currency: order.currency,
    paymentUrl: order.payment_url,
    activated: Boolean(order.is_activated),
    createdAt: order.created_at,
    updatedAt: order.updated_at
  })
})

app.get('/api/subscription/:userEmail', (req, res) => {
  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const headerEmail = String(req.headers['x-user-email'] ?? '').trim().toLowerCase()

  if (!userEmail || userEmail !== headerEmail) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const row = findSubscriptionStmt.get(userEmail)
  if (!row) {
    res.json(buildFreeSubscription(userEmail))
    return
  }

  const endsAtMs = new Date(row.ends_at).getTime()
  if (row.plan_id !== 'free' && Number.isFinite(endsAtMs) && endsAtMs <= Date.now()) {
    const nowIso = new Date().toISOString()
    expireSubscriptionStmt.run({ user_email: userEmail, updated_at: nowIso })
    const expiredRow = findSubscriptionStmt.get(userEmail)
    res.json(formatSubscription(expiredRow, userEmail))
    return
  }

  res.json(formatSubscription(row, userEmail))
})

app.post('/api/payments/webhook/:provider', (req, res) => {
  const signature = req.headers['x-signature'] ?? req.headers['x-payment-signature'] ?? ''
  const verified = verifyWebhookSignature(req.rawBody ?? '', signature)

  if (!verified) {
    res.status(401).json({ error: 'Invalid webhook signature' })
    return
  }

  const normalized = normalizeWebhookPayload(req.body ?? {})
  if (!normalized.orderRef) {
    res.status(400).json({ error: 'Order reference is required' })
    return
  }

  const order = findOrderByProviderRefStmt.get(normalized.orderRef, normalized.orderRef)
  if (!order) {
    res.status(404).json({ error: 'Order not found for webhook event' })
    return
  }

  if (!Number.isFinite(normalized.amount) || normalized.amount !== Number(order.amount)) {
    res.status(400).json({ error: 'Amount mismatch in webhook payload' })
    return
  }

  if (normalized.currency !== String(order.currency)) {
    res.status(400).json({ error: 'Currency mismatch in webhook payload' })
    return
  }

  const nowIso = new Date().toISOString()
  updateOrderStatusStmt.run({
    id: order.id,
    status: normalized.status,
    provider_payment_id: normalized.paymentRef || null,
    provider_payload: JSON.stringify(req.body ?? {}),
    updated_at: nowIso
  })

  if (normalized.status !== 'paid') {
    res.json({ ok: true, status: normalized.status })
    return
  }

  if (order.is_activated) {
    res.json({ ok: true, status: 'paid', alreadyActivated: true })
    return
  }

  const plan = getPlan(order.plan_id)
  if (!plan) {
    res.status(400).json({ error: 'Unsupported plan in order' })
    return
  }

  const activateTx = db.transaction(() => {
    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)
    const startedAt = startDate.toISOString()
    const endsAt = endDate.toISOString()

    upsertSubscriptionStmt.run({
      user_email: order.user_email,
      plan_id: plan.id,
      status: 'active',
      started_at: startedAt,
      ends_at: endsAt,
      purchased_at: startedAt,
      updated_at: startedAt,
      payment_method: order.payment_method,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id
    })

    insertPaymentStmt.run({
      id: crypto.randomUUID(),
      order_id: order.id,
      provider: order.provider,
      provider_transaction_id: normalized.paymentRef || `tx-${order.id}`,
      amount: order.amount,
      currency: order.currency,
      status: 'completed',
      raw_payload: JSON.stringify(req.body ?? {}),
      created_at: startedAt
    })

    markOrderActivatedStmt.run({ id: order.id, updated_at: startedAt })
  })

  try {
    activateTx()
    res.json({ ok: true, status: 'paid', activated: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to activate subscription'
    if (message.includes('UNIQUE constraint failed: payments.provider_transaction_id')) {
      markOrderActivatedStmt.run({ id: order.id, updated_at: nowIso })
      res.json({ ok: true, status: 'paid', alreadyActivated: true })
      return
    }

    res.status(500).json({ error: message })
  }
})

function hashPassword(password) {
  return bcrypt.hashSync(String(password ?? ''), 12)
}

function verifyPassword(password, passwordHash) {
  return bcrypt.compareSync(String(password ?? ''), String(passwordHash ?? ''))
}

function createUserSession(userEmail, userAgent = '') {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
  const sessionId = crypto.randomUUID()
  const tokenHash = bcrypt.hashSync(token, 12)

  insertUserSessionStmt.run({
    id: sessionId,
    user_email: String(userEmail).trim().toLowerCase(),
    token_hash: tokenHash,
    user_agent: userAgent,
    expires_at: expiresAt,
    revoked: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })

  return { token, expiresAt }
}

function revokeTokenSession(token) {
  if (!token) return false

  const rows = db.prepare('SELECT * FROM user_sessions WHERE revoked = 0').all()
  for (const row of rows) {
    if (bcrypt.compareSync(token, row.token_hash)) {
      revokeUserSessionByTokenStmt.run({
        token_hash: row.token_hash,
        updated_at: new Date().toISOString()
      })
      return true
    }
  }

  return false
}

function normalizeUserProfileRecord(email, input = {}) {
  const firstName = String(input.firstName ?? input.first_name ?? '').trim()
  const lastName = String(input.lastName ?? input.last_name ?? '').trim()
  const name = String(input.name ?? '').trim()
  const phone = String(input.phone ?? '').trim()
  const bio = String(input.bio ?? '').trim()
  const avatarUrl = String(input.avatarUrl ?? input.avatar_url ?? input.profileImage ?? '').trim()
  const role = String(input.role ?? 'User').trim() || 'User'
  const nowIso = new Date().toISOString()

  return {
    user_email: String(email).trim().toLowerCase(),
    first_name: firstName || (name ? name.split(' ')[0] ?? '' : ''),
    last_name: lastName || (name ? name.split(' ').slice(1).join(' ') : ''),
    phone,
    bio,
    avatar_url: avatarUrl || null,
    role,
    account_status: String(input.accountStatus ?? 'active').trim() || 'active',
    is_blocked: input.isBlocked === true || input.is_blocked === 1 || input.is_blocked === true ? 1 : 0,
    password_hash: input.passwordHash ? String(input.passwordHash) : null,
    created_at: typeof input.createdAt === 'string' && input.createdAt ? input.createdAt : nowIso,
    updated_at: nowIso
  }
}

function normalizeRoleName(value) {
  const raw = String(value ?? 'user').trim().toLowerCase()
  if (raw === 'admin' || raw === 'administrator' || raw === 'superadmin') return 'Admin'
  if (raw === 'student') return 'Student'
  if (raw === 'user') return 'User'
  return 'User'
}

function ensureAdminAccess(req) {
  const userEmail = resolveAuthenticatedUserEmail(req) ?? String(req.headers['x-user-email'] ?? '').trim().toLowerCase()
  const headerRole = String(req.headers['x-user-role'] ?? '').trim()
  if (!userEmail) return false

  const profile = db.prepare('SELECT user_email, role, account_status, is_blocked FROM user_profiles WHERE user_email = ?').get(userEmail)
  const resolvedRole = normalizeRoleName(profile?.role ?? (headerRole || 'user'))
  const isAdminEmail = userEmail === 'admin@levelup.kg'
  const isBlocked = Boolean(profile?.account_status === 'blocked' || profile?.is_blocked === 1)

  if (isBlocked && !isAdminEmail) return false
  return resolvedRole === 'Admin' || isAdminEmail
}

function getSiteStatsSnapshot() {
  const totalStudentsRow = db.prepare('SELECT COUNT(*) AS count FROM user_profiles').get()
  const startedCoursesRow = db.prepare('SELECT COUNT(*) AS count FROM course_progress WHERE lessons_started > 0').get()
  const completedCoursesRow = db.prepare("SELECT COUNT(*) AS count FROM course_progress WHERE status = 'completed'").get()
  const ratingRow = db.prepare('SELECT AVG(rating) AS average, COUNT(*) AS count FROM reviews').get()

  const totalStudents = Number(totalStudentsRow?.count ?? 0)
  const startedCourses = Number(startedCoursesRow?.count ?? 0)
  const completedCourses = Number(completedCoursesRow?.count ?? 0)
  const totalRatings = Number(ratingRow?.count ?? 0)
  const averageRating = Number(ratingRow?.average ?? 0)
  const completionRate = startedCourses > 0 ? Number(((completedCourses / startedCourses) * 100).toFixed(1)) : 0

  return {
    students: totalStudents,
    startedCourses,
    completedCourses,
    completion: completionRate,
    rating: totalRatings > 0 ? Number(averageRating.toFixed(1)) : 0,
    totalRatings,
    updatedAt: new Date().toISOString()
  }
}

app.get('/api/site-stats', (_req, res) => {
  res.json(getSiteStatsSnapshot())
})

app.post('/api/course-progress', (req, res) => {
  const userEmail = validateUserEmailFromRequest(req, req.body?.userEmail)
  if (!userEmail) {
    res.status(401).json({ error: 'User is not authorized to update course progress' })
    return
  }

  const courseId = String(req.body?.courseId ?? '').trim()
  if (!courseId) {
    res.status(400).json({ error: 'Course id is required' })
    return
  }

  const totalLessons = Number(req.body?.totalLessons ?? 0)
  const completedLessons = Math.max(0, Number(req.body?.completedLessons ?? 0))
  const lessonsStarted = Math.max(0, Number(req.body?.lessonsStarted ?? completedLessons))
  const nowIso = new Date().toISOString()
  const existing = db.prepare('SELECT * FROM course_progress WHERE user_email = ? AND course_id = ?').get(userEmail, courseId)

  const nextLessonsStarted = Math.max(existing?.lessons_started ?? 0, lessonsStarted)
  const nextCompletedLessons = Math.max(existing?.lessons_completed ?? 0, completedLessons)
  const startedAt = existing?.started_at ?? (nextLessonsStarted > 0 ? nowIso : null)
  const completedAt = existing?.completed_at ?? (completedLessons >= totalLessons && totalLessons > 0 ? nowIso : null)
  const status = completedLessons >= totalLessons && totalLessons > 0 ? 'completed' : (nextLessonsStarted > 0 ? 'started' : 'started')

  upsertCourseProgressStmt.run({
    user_email: userEmail,
    course_id: courseId,
    started_at: startedAt,
    completed_at: completedAt,
    lessons_started: nextLessonsStarted,
    lessons_completed: nextCompletedLessons,
    status,
    created_at: existing?.created_at ?? nowIso,
    updated_at: nowIso
  })

  res.json({ ok: true, stats: getSiteStatsSnapshot() })
})

app.get('/api/users/:userEmail', (req, res) => {
  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const headerEmail = String(req.headers['x-user-email'] ?? '').trim().toLowerCase()

  if (!userEmail || userEmail !== headerEmail) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const profile = getUserProfileStmt.get(userEmail)
  const notifications = getUserNotificationSettingsStmt.get(userEmail) ?? {
    email_notifications: 1,
    new_courses: 1,
    new_lessons: 1,
    news_updates: 1
  }

  res.json({
    user: {
      email: userEmail,
      name: profile ? `${profile.first_name} ${profile.last_name}`.trim() || userEmail : userEmail,
      firstName: profile?.first_name ?? '',
      lastName: profile?.last_name ?? '',
      phone: profile?.phone ?? '',
      bio: profile?.bio ?? '',
      avatar: profile?.avatar_url ?? '',
      role: profile?.role ?? 'Student',
      createdAt: profile?.created_at ?? new Date().toISOString(),
      updatedAt: profile?.updated_at ?? new Date().toISOString()
    },
    notifications: {
      emailNotifications: Boolean(notifications.email_notifications),
      newCourses: Boolean(notifications.new_courses),
      newLessons: Boolean(notifications.new_lessons),
      newsUpdates: Boolean(notifications.news_updates)
    }
  })
})

app.put('/api/users/:userEmail/profile', (req, res) => {
  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const headerEmail = String(req.headers['x-user-email'] ?? '').trim().toLowerCase()

  if (!userEmail || userEmail !== headerEmail) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const payload = req.body ?? {}
  const profile = getUserProfileStmt.get(userEmail)
  const nextProfile = normalizeUserProfileRecord(userEmail, {
    ...payload,
    createdAt: profile?.created_at ?? payload.createdAt ?? new Date().toISOString(),
    passwordHash: profile?.password_hash ?? payload.passwordHash ?? null,
    role: payload.role ?? profile?.role ?? 'Student'
  })

  upsertUserProfileStmt.run(nextProfile)

  res.json({
    ok: true,
    user: {
      email: userEmail,
      name: `${nextProfile.first_name} ${nextProfile.last_name}`.trim() || userEmail,
      firstName: nextProfile.first_name,
      lastName: nextProfile.last_name,
      phone: nextProfile.phone,
      bio: nextProfile.bio,
      avatar: nextProfile.avatar_url ?? '',
      role: nextProfile.role,
      createdAt: nextProfile.created_at,
      updatedAt: nextProfile.updated_at
    }
  })
})

app.put('/api/users/:userEmail/password', (req, res) => {
  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const headerEmail = String(req.headers['x-user-email'] ?? '').trim().toLowerCase()

  if (!userEmail || userEmail !== headerEmail) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const currentPassword = String(req.body?.currentPassword ?? '')
  const nextPassword = String(req.body?.newPassword ?? '')
  const confirmPassword = String(req.body?.confirmPassword ?? '')

  if (!currentPassword || !nextPassword || !confirmPassword) {
    res.status(400).json({ error: 'Fill in all password fields' })
    return
  }

  if (nextPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long' })
    return
  }

  if (nextPassword !== confirmPassword) {
    res.status(400).json({ error: 'Passwords do not match' })
    return
  }

  const profile = getUserProfileStmt.get(userEmail)
  if (!profile || !profile.password_hash || !verifyPassword(currentPassword, profile.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect' })
    return
  }

  const hashedNext = hashPassword(nextPassword)
  const nowIso = new Date().toISOString()
  upsertUserProfileStmt.run({
    user_email: userEmail,
    first_name: profile?.first_name ?? userEmail.split('@')[0] ?? 'User',
    last_name: profile?.last_name ?? '',
    phone: profile?.phone ?? null,
    bio: profile?.bio ?? '',
    avatar_url: profile?.avatar_url ?? null,
    role: profile?.role ?? 'Student',
    password_hash: hashedNext,
    created_at: profile?.created_at ?? nowIso,
    updated_at: nowIso
  })

  res.json({ ok: true, updated: true })
})

app.put('/api/users/:userEmail/notifications', (req, res) => {
  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const headerEmail = String(req.headers['x-user-email'] ?? '').trim().toLowerCase()

  if (!userEmail || userEmail !== headerEmail) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const nextSettings = {
    user_email: userEmail,
    email_notifications: req.body?.emailNotifications === true ? 1 : 0,
    new_courses: req.body?.newCourses === true ? 1 : 0,
    new_lessons: req.body?.newLessons === true ? 1 : 0,
    news_updates: req.body?.newsUpdates === true ? 1 : 0,
    updated_at: new Date().toISOString()
  }

  upsertUserNotificationSettingsStmt.run(nextSettings)
  res.json({ ok: true, notifications: {
    emailNotifications: Boolean(nextSettings.email_notifications),
    newCourses: Boolean(nextSettings.new_courses),
    newLessons: Boolean(nextSettings.new_lessons),
    newsUpdates: Boolean(nextSettings.news_updates)
  } })
})

ensureSeedUsers()

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`LevelUp backend is running on port ${config.port}`)
})
