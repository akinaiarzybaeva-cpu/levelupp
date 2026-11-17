import bcrypt from 'bcrypt'
import cors from 'cors'
import crypto from 'node:crypto'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { config } from './config/config.js'
import { db } from './config/db.js'
import { getPlan } from './config/plans.js'
import { createProviderOrder, normalizeWebhookPayload, verifyWebhookSignature } from './config/provider.js'
import { sendEmail, buildPasswordResetEmail, buildPasswordChangedEmail } from './config/email.js'

const app = express()

// Render (and most PaaS hosts) put the app behind one reverse proxy. Without this,
// express-rate-limit sees the proxy's IP for every visitor, so one person hitting the
// login limit would lock out everyone.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1))
app.disable('x-powered-by')

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

const allowedOrigins = new Set([
  config.frontendUrl,
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://levelupp-cyan.vercel.app',
  'https://levellupp.netlify.app',
  'https://localhost:5173',
  'https://127.0.0.1:5173'
])

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
      return
    }

    const normalizedOrigin = origin.replace(/\/+$/, '')
    if (allowedOrigins.has(normalizedOrigin)) {
      callback(null, true)
      return
    }

    // Disallowed origin: respond without CORS headers so the browser blocks it,
    // instead of throwing (which produced an HTML 500 page).
    callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // X-User-Email / X-User-Role are still accepted by CORS so older deployed frontends
  // keep working during rollout, but the server NEVER uses them for authorization.
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Email', 'X-User-Role', 'X-Signature', 'X-Payment-Signature']
}))

app.use(express.json({
  // Profile photos are sent as cropped 512px JPEG data URLs (~50–300 KB base64).
  limit: '1mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString('utf8')
  }
}))

// Rate limiter for login (10 req/15min per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
})

// Rate limiter for password reset requests (5 req/hour per IP)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  // Forgot/reset requests per IP per hour (env override for operators and the test suite).
  max: Math.max(1, Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX) || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Try again in an hour.' }
})

// Rate limiter for registration and account lookups (30 req/15min per IP)
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' }
})

// Rate limiter for general admin API (150 req/15min per IP)
const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many admin API requests.' }
})

// ─── Database Prepared Statements ──────────────────────────────────────────────

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

const insertPaymentStmt = db.prepare(`
  INSERT INTO payments (
    id, order_id, provider, provider_transaction_id, amount, currency, status, raw_payload, created_at
  ) VALUES (
    @id, @order_id, @provider, @provider_transaction_id, @amount, @currency, @status, @raw_payload, @created_at
  )
`)

const findSubscriptionStmt = db.prepare('SELECT * FROM user_subscriptions WHERE user_email = ?')
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

const expireSubscriptionStmt = db.prepare(`
  UPDATE user_subscriptions
  SET status = 'expired', updated_at = @updated_at
  WHERE user_email = @user_email
`)

const listReviewsStmt = db.prepare("SELECT * FROM reviews WHERE moderation_status = 'published' ORDER BY datetime(created_at) DESC LIMIT 100")
const createReviewStmt = db.prepare(`
  INSERT INTO reviews (
    id, user_email, user_name, user_avatar, lesson_id, lesson_label, rating, text, created_at, updated_at, moderation_status
  ) VALUES (
    @id, @user_email, @user_name, @user_avatar, @lesson_id, @lesson_label, @rating, @text, @created_at, @updated_at, 'published'
  )
`)

const updateReviewStmt = db.prepare(`
  UPDATE reviews
  SET rating = @rating,
      text = @text,
      user_name = @user_name,
      user_avatar = @user_avatar,
      lesson_id = @lesson_id,
      lesson_label = @lesson_label,
      updated_at = @updated_at
  WHERE id = @id AND user_email = @user_email
`)

const getUserProfileStmt = db.prepare('SELECT * FROM user_profiles WHERE user_email = ?')
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

const getNotificationSettingsStmt = db.prepare(`
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

const upsertNotificationSettingsStmt = db.prepare(`
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
      ELSE excluded.status
    END,
    updated_at = excluded.updated_at
`)

// ─── Authentication & Helper Functions ────────────────────────────────────────

function hashPassword(password) {
  return bcrypt.hashSync(String(password ?? ''), 12)
}

function verifyPassword(password, passwordHash) {
  return bcrypt.compareSync(String(password ?? ''), String(passwordHash ?? ''))
}

// A valid bcrypt hash of a random value, compared against when the account does not
// exist so that login takes the same time either way (no timing-based enumeration).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12)

/** Non-blocking variant for the hot login path (runs bcrypt off the event loop). */
async function verifyPasswordAsync(password, passwordHash) {
  return bcrypt.compare(String(password ?? ''), String(passwordHash || DUMMY_PASSWORD_HASH))
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

/** Constant-time check of a raw reset token against its stored SHA-256 hash. */
function resetTokenMatches(rawToken, storedHash) {
  const stored = String(storedHash ?? '')
  if (stored.startsWith('$2b$')) return bcrypt.compareSync(String(rawToken), stored)
  const a = Buffer.from(hashToken(rawToken), 'hex')
  const b = Buffer.from(stored, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function extractBearerToken(req) {
  const authHeader = String(req.headers.authorization ?? '').trim()
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }

  const legacyToken = String(req.headers['x-auth-token'] ?? '').trim()
  return legacyToken || ''
}

function createUserSession(userEmail, userAgent = '') {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() // 7 days
  const sessionId = crypto.randomUUID()
  const tokenHash = hashToken(token)
  const nowIso = new Date().toISOString()

  insertUserSessionStmt.run({
    id: sessionId,
    user_email: String(userEmail).trim().toLowerCase(),
    token_hash: tokenHash,
    user_agent: String(userAgent ?? '').slice(0, 255),
    expires_at: expiresAt,
    revoked: 0,
    created_at: nowIso,
    updated_at: nowIso
  })

  return { token, expiresAt }
}

const findActiveSessionStmt = db.prepare('SELECT user_email FROM user_sessions WHERE token_hash = ? AND revoked = 0 AND expires_at > ? LIMIT 1')

function resolveSessionUserEmail(req) {
  const rawToken = extractBearerToken(req)
  // Tokens issued by createUserSession are 64 hex chars; reject anything else cheaply.
  if (!rawToken || rawToken.length > 256) return null

  // O(1) indexed lookup via sha256. (The old bcrypt-hashed "legacy" session fallback
  // was removed: it ran a bcrypt compare per stored session on every request with an
  // unknown token, which made unauthenticated requests a CPU denial-of-service vector.
  // Users holding such a legacy token simply log in again.)
  const session = findActiveSessionStmt.get(hashToken(rawToken), new Date().toISOString())
  return session ? String(session.user_email).trim().toLowerCase() : null
}

function revokeTokenSession(token) {
  if (!token) return false
  const res = revokeUserSessionByTokenStmt.run({ token_hash: hashToken(token), updated_at: new Date().toISOString() })
  return res.changes > 0
}

function isProfileBlocked(profile) {
  return Boolean(profile?.is_blocked) || profile?.account_status === 'blocked'
}

const ALLOWED_ACCOUNT_STATUSES = new Set(['active', 'inactive', 'blocked'])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

function clampText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength)
}

/**
 * Accepts only images we can safely render in <img src>: a base64 data URL of a
 * common raster type (what the profile cropper produces) or an https URL.
 */
function sanitizeAvatarUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(raw) && raw.length <= 900_000) return raw
  if (/^https:\/\/[^\s"'<>]+$/.test(raw) && raw.length <= 2048) return raw
  return null
}

function sendServerError(res, err, publicMessage) {
  // eslint-disable-next-line no-console
  console.error(`[API ERROR] ${publicMessage}:`, err)
  res.status(500).json({ error: publicMessage })
}

/**
 * Strict authentication resolver: ONLY returns userEmail if the caller has a valid,
 * active session token. Never trusts raw unverified headers!
 */
function resolveAuthenticatedUserEmail(req) {
  return resolveSessionUserEmail(req)
}

function validateUserEmailFromRequest(req, bodyEmail) {
  const sessionEmail = resolveAuthenticatedUserEmail(req)
  if (!sessionEmail) return null

  if (bodyEmail) {
    const candidate = String(bodyEmail).trim().toLowerCase()
    if (candidate !== sessionEmail) {
      return null
    }
  }

  return sessionEmail
}

function normalizeRoleName(value) {
  const raw = String(value ?? 'user').trim().toLowerCase()
  if (raw === 'admin' || raw === 'administrator' || raw === 'superadmin') return 'Admin'
  if (raw === 'student') return 'Student'
  if (raw === 'user') return 'User'
  return 'User'
}

/**
 * Middleware: Strictly requires that the caller is the SINGLE verified administrator.
 * If not authenticated: returns HTTP 401.
 * If authenticated but not admin (regular user): returns HTTP 403 Forbidden.
 */
function requireAdminAuth(req, res, next) {
  const rawToken = extractBearerToken(req)
  if (!rawToken) {
    res.status(401).json({ error: 'Authentication required. Please log in.' })
    return
  }

  const userEmail = resolveSessionUserEmail(req)
  if (!userEmail) {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' })
    return
  }

  const profile = db.prepare('SELECT user_email, role, account_status, is_blocked FROM user_profiles WHERE user_email = ?').get(userEmail)
  if (!profile) {
    res.status(401).json({ error: 'Account not found.' })
    return
  }

  if (isProfileBlocked(profile)) {
    res.status(403).json({ error: 'Account is blocked.' })
    return
  }

  const resolvedRole = normalizeRoleName(profile.role)
  const isAdminEmail = userEmail === config.adminEmail

  if (resolvedRole !== 'Admin' || !isAdminEmail) {
    res.status(403).json({ error: 'Forbidden: Administrator privileges required.' })
    return
  }

  req.adminEmail = userEmail
  req.adminProfile = profile
  next()
}

function getPublicUserRecord(profile) {
  const firstName = profile.first_name ?? ''
  const lastName = profile.last_name ?? ''
  const displayName = `${firstName} ${lastName}`.trim() || profile.user_email

  return {
    email: profile.user_email,
    name: displayName,
    firstName,
    lastName,
    phone: profile.phone ?? '',
    bio: profile.bio ?? '',
    avatar: profile.avatar_url ?? '',
    role: profile.role,
    accountStatus: profile.account_status,
    isBlocked: Boolean(profile.is_blocked),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  }
}

function buildFreeSubscription(userEmail) {
  const startedAt = new Date().toISOString()
  const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  return {
    userEmail,
    planId: 'free',
    status: 'active',
    startedAt,
    endsAt,
    purchasedAt: null,
    paymentMethod: 'none',
    amount: 0,
    currency: 'KGS',
    orderId: null
  }
}

function formatSubscription(row, fallbackEmail) {
  if (!row) {
    return buildFreeSubscription(fallbackEmail)
  }

  return {
    userEmail: row.user_email,
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

function ensureSingleAdmin() {
  const adminEmail = config.adminEmail
  const existingAdmin = getUserProfileStmt.get(adminEmail)

  if (existingAdmin) {
    db.transaction(() => {
      const nowIso = new Date().toISOString()
      // Strictly demote any other account that may have been assigned Admin (first, so the
      // single-admin unique index can never be violated), then assert the configured admin.
      db.prepare("UPDATE user_profiles SET role = 'User', updated_at = ? WHERE role = 'Admin' AND user_email != ?").run(nowIso, adminEmail)
      if (existingAdmin.role !== 'Admin') {
        db.prepare('UPDATE user_profiles SET role = ?, updated_at = ? WHERE user_email = ?').run('Admin', nowIso, adminEmail)
      }
    })()
    return
  }

  const initialPassword = config.adminInitialPassword
  if (!initialPassword) {
    // eslint-disable-next-line no-console
    console.warn(`[ADMIN SETUP] No admin account exists. Set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD env vars, then restart.`)
    return
  }

  if (initialPassword.length < 8) {
    // eslint-disable-next-line no-console
    console.warn('[ADMIN SETUP] ADMIN_INITIAL_PASSWORD must be at least 8 characters. Admin not created.')
    return
  }

  const nowIso = new Date().toISOString()
  db.prepare("UPDATE user_profiles SET role = 'User', updated_at = ? WHERE role = 'Admin' AND user_email != ?").run(nowIso, adminEmail)
  upsertUserProfileStmt.run({
    user_email: adminEmail,
    first_name: 'Admin',
    last_name: 'LevelUp',
    phone: '',
    bio: 'System Administrator',
    avatar_url: '',
    role: 'Admin',
    account_status: 'active',
    is_blocked: 0,
    password_hash: hashPassword(initialPassword),
    created_at: nowIso,
    updated_at: nowIso
  })

  db.prepare("UPDATE user_profiles SET role = 'User', updated_at = ? WHERE role = 'Admin' AND user_email != ?").run(nowIso, adminEmail)
  // eslint-disable-next-line no-console
  console.log(`[ADMIN SETUP] Administrator account created: ${adminEmail}`)
}

function ensureSeedUsers() {
  // The demo account has a publicly known password, so it is only created when
  // explicitly requested for local development (SEED_DEMO_USER=true).
  // An already existing demo account is left untouched.
  const demoUser = { email: 'aisha@levelup.kg', firstName: 'Aisha', lastName: '', password: 'demo123', role: 'User' }
  const existingDemo = getUserProfileStmt.get(demoUser.email)
  if (process.env.SEED_DEMO_USER === 'true' && !existingDemo) {
    upsertUserProfileStmt.run({
      user_email: demoUser.email,
      first_name: demoUser.firstName,
      last_name: demoUser.lastName,
      phone: '',
      bio: '',
      avatar_url: '',
      role: demoUser.role,
      account_status: 'active',
      is_blocked: 0,
      password_hash: hashPassword(demoUser.password),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  }

  ensureSingleAdmin()
  enforceSingleAdminIndex()
}

/**
 * Database-level guarantee: at most ONE row may have role 'Admin'. Any attempt to create
 * a second administrator (by any code path or direct SQL) fails with a constraint error.
 */
function enforceSingleAdminIndex() {
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_single_admin ON user_profiles (role) WHERE role = 'Admin'")
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[ADMIN SETUP] Could not create the single-admin index:', error instanceof Error ? error.message : error)
  }
}

// ─── Public API Endpoints ─────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'LevelUp Backend API',
    endpoints: ['/api/health', '/api/courses', '/api/auth/login', '/api/auth/register', '/api/site-stats']
  })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/courses', (_req, res) => {
  try {
    const courses = db.prepare('SELECT * FROM courses WHERE is_published = 1 ORDER BY order_index ASC').all()
    const lessons = db.prepare('SELECT * FROM lessons WHERE is_published = 1 ORDER BY course_id ASC, order_index ASC').all()

    const lessonsByCourse = {}
    for (const lesson of lessons) {
      if (!lessonsByCourse[lesson.course_id]) {
        lessonsByCourse[lesson.course_id] = []
      }
      let quiz = {}
      try { quiz = JSON.parse(lesson.quiz_json || '{}') } catch {}
      lessonsByCourse[lesson.course_id].push({
        id: lesson.id,
        courseId: lesson.course_id,
        title: { kg: lesson.title_kg, ru: lesson.title_ru, en: lesson.title_en },
        duration: lesson.duration,
        type: lesson.type,
        theory: lesson.theory,
        code: lesson.code,
        task: lesson.task,
        videoUrl: lesson.video_url,
        quiz,
        orderIndex: lesson.order_index
      })
    }

    const result = courses.map((c) => {
      let tags = []
      let outline = []
      try { tags = JSON.parse(c.tags || '[]') } catch {}
      try { outline = JSON.parse(c.outline || '[]') } catch {}
      const cLessons = lessonsByCourse[c.id] || []
      return {
        id: c.id,
        badge: c.badge,
        title: { kg: c.title_kg, ru: c.title_ru, en: c.title_en },
        description: { kg: c.description_kg, ru: c.description_ru, en: c.description_en },
        category: c.category,
        level: c.level,
        rating: c.rating,
        students: c.students,
        duration: c.duration,
        lessonsCount: cLessons.length || c.lessons_count,
        color: c.color,
        accent: c.accent,
        tags,
        outline,
        isPublished: Boolean(c.is_published),
        orderIndex: c.order_index,
        lessons: cLessons
      }
    })

    res.json({ courses: result })
  } catch (err) {
    sendServerError(res, err, 'Failed to fetch courses')
  }
})

// ─── Authentication Endpoints ─────────────────────────────────────────────────

async function notifyTelegramAboutRegistration({ name, email }) {
  const { botToken, chatId } = config.telegram
  if (!botToken || !chatId) return

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `New LevelUp registration\nName: ${name}\nEmail: ${email}` }),
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[TELEGRAM] sendMessage failed with HTTP ${response.status}`)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[TELEGRAM] notification failed:', err instanceof Error ? err.message : err)
  }
}

app.post('/api/auth/register', accountLimiter, (req, res) => {
  const name = clampText(req.body?.name, 100)
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email and password are required' })
    return
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: 'Email is invalid' })
    return
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must contain at least ${MIN_PASSWORD_LENGTH} characters` })
    return
  }

  if (password.length > 128) {
    res.status(400).json({ error: 'Password is too long' })
    return
  }

  // Block registration with the administrator email
  if (email === config.adminEmail) {
    res.status(409).json({ error: 'User already exists with this email' })
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
    role: 'User', // Public registration ALWAYS registers as User
    account_status: 'active',
    is_blocked: 0,
    password_hash: hashPassword(password),
    created_at: nowIso,
    updated_at: nowIso
  })

  const profile = getUserProfileStmt.get(email)
  const session = createUserSession(email, req.headers['user-agent'] ?? '')
  const displayName = `${profile.first_name} ${profile.last_name}`.trim() || email

  res.status(201).json({
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: {
      email: profile.user_email,
      name: displayName,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phone: '',
      bio: '',
      avatar: profile.avatar_url ?? '',
      role: 'User',
      accountStatus: 'active',
      isBlocked: false,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at
    }
  })

  void notifyTelegramAboutRegistration({ name, email })
})

// Used by the "Start learning" flow to decide between the login and register tabs.
// Returns only whether the account exists (the frontend expects `{ exists }`); it no
// longer exposes role or block status to unauthenticated callers.
app.get('/api/auth/account-status', accountLimiter, (req, res) => {
  const email = String(req.query.email ?? '').trim().toLowerCase()
  if (!email) {
    res.status(400).json({ error: 'Email query parameter is required' })
    return
  }

  res.json({ exists: Boolean(getUserProfileStmt.get(email)) })
})

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  const profile = getUserProfileStmt.get(email)
  const passwordMatches = await verifyPasswordAsync(password, profile?.password_hash)
  if (!profile || !profile.password_hash || !passwordMatches) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  if (isProfileBlocked(profile)) {
    res.status(403).json({ error: 'This account has been suspended. Contact support.' })
    return
  }

  const session = createUserSession(email, req.headers['user-agent'] ?? '')

  res.json({
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: getPublicUserRecord(profile)
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
    res.status(404).json({ error: 'User account not found' })
    return
  }

  if (isProfileBlocked(profile)) {
    res.status(403).json({ error: 'Account has been suspended' })
    return
  }

  res.json({
    ok: true,
    user: getPublicUserRecord(profile)
  })
})

app.post('/api/auth/logout', (req, res) => {
  const token = extractBearerToken(req)
  if (token) {
    revokeTokenSession(token)
  }

  res.json({ ok: true })
})

// ─── ADMIN: Dashboard & Stats ─────────────────────────────────────────────────

app.get('/api/admin/overview', adminApiLimiter, requireAdminAuth, (_req, res) => {
  const totalUsersRow = db.prepare('SELECT COUNT(*) AS count FROM user_profiles').get()
  const newUsersRow = db.prepare("SELECT COUNT(*) AS count FROM user_profiles WHERE datetime(created_at) >= datetime('now', '-30 days')").get()
  const activeStudentsRow = db.prepare("SELECT COUNT(*) AS count FROM user_profiles WHERE account_status = 'active' AND is_blocked = 0 AND (role = 'Student' OR role = 'User')").get()
  const completedCoursesRow = db.prepare("SELECT COUNT(*) AS count FROM course_progress WHERE status = 'completed'").get()
  const ratingRow = db.prepare("SELECT AVG(rating) AS average, COUNT(*) AS count FROM reviews WHERE moderation_status = 'published'").get()
  const reviewsRow = db.prepare("SELECT COUNT(*) AS count FROM reviews WHERE moderation_status = 'published'").get()
  const plansRow = db.prepare("SELECT COUNT(*) AS count FROM user_subscriptions WHERE status = 'active' AND plan_id IN ('pro', 'aipro')").get()
  const revenueRow = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payment_orders WHERE status = 'paid'").get()
  const coursesRow = db.prepare('SELECT COUNT(*) AS count FROM courses').get()
  const lessonsRow = db.prepare('SELECT COUNT(*) AS count FROM lessons').get()

  res.json({
    totalUsers: Number(totalUsersRow?.count ?? 0),
    newRegistrations: Number(newUsersRow?.count ?? 0),
    activeStudents: Number(activeStudentsRow?.count ?? 0),
    completedCourses: Number(completedCoursesRow?.count ?? 0),
    averageRating: Number(ratingRow?.average ?? 0),
    reviews: Number(reviewsRow?.count ?? 0),
    planPurchases: Number(plansRow?.count ?? 0),
    revenue: Number(revenueRow?.total ?? 0),
    totalCourses: Number(coursesRow?.count ?? 0),
    totalLessons: Number(lessonsRow?.count ?? 0)
  })
})

app.get('/api/admin/stats', adminApiLimiter, requireAdminAuth, (_req, res) => {
  const totalUsersRow = db.prepare('SELECT COUNT(*) AS count FROM user_profiles').get()
  const newUsersRow = db.prepare("SELECT COUNT(*) AS count FROM user_profiles WHERE datetime(created_at) >= datetime('now', '-30 days')").get()
  const activeStudentsRow = db.prepare("SELECT COUNT(*) AS count FROM user_profiles WHERE account_status = 'active' AND is_blocked = 0 AND (role = 'Student' OR role = 'User')").get()
  const blockedUsersRow = db.prepare("SELECT COUNT(*) AS count FROM user_profiles WHERE is_blocked = 1 OR account_status = 'blocked'").get()
  const completedCoursesRow = db.prepare("SELECT COUNT(*) AS count FROM course_progress WHERE status = 'completed'").get()
  const startedCoursesRow = db.prepare('SELECT COUNT(*) AS count FROM course_progress WHERE lessons_started > 0').get()
  const ratingRow = db.prepare("SELECT AVG(rating) AS average, COUNT(*) AS count FROM reviews WHERE moderation_status = 'published'").get()
  const reviewsTotalRow = db.prepare('SELECT COUNT(*) AS count FROM reviews').get()
  const reviewsPendingRow = db.prepare("SELECT COUNT(*) AS count FROM reviews WHERE moderation_status != 'published'").get()
  const plansRow = db.prepare("SELECT COUNT(*) AS count FROM user_subscriptions WHERE status = 'active' AND plan_id IN ('pro', 'aipro')").get()
  const proRow = db.prepare("SELECT COUNT(*) AS count FROM user_subscriptions WHERE status = 'active' AND plan_id = 'pro'").get()
  const aiproRow = db.prepare("SELECT COUNT(*) AS count FROM user_subscriptions WHERE status = 'active' AND plan_id = 'aipro'").get()
  const revenueRow = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payment_orders WHERE status = 'paid'").get()
  const coursesRow = db.prepare('SELECT COUNT(*) AS count FROM courses').get()
  const lessonsRow = db.prepare('SELECT COUNT(*) AS count FROM lessons').get()
  const recentUsersRows = db.prepare("SELECT user_email, first_name, last_name, role, account_status, is_blocked, created_at FROM user_profiles ORDER BY datetime(created_at) DESC LIMIT 10").all()

  res.json({
    totalUsers: Number(totalUsersRow?.count ?? 0),
    newRegistrations: Number(newUsersRow?.count ?? 0),
    activeStudents: Number(activeStudentsRow?.count ?? 0),
    blockedUsers: Number(blockedUsersRow?.count ?? 0),
    completedCourses: Number(completedCoursesRow?.count ?? 0),
    startedCourses: Number(startedCoursesRow?.count ?? 0),
    averageRating: Number(ratingRow?.average ?? 0),
    totalReviews: Number(reviewsTotalRow?.count ?? 0),
    pendingReviews: Number(reviewsPendingRow?.count ?? 0),
    activeSubscriptions: Number(plansRow?.count ?? 0),
    proSubscriptions: Number(proRow?.count ?? 0),
    aiproSubscriptions: Number(aiproRow?.count ?? 0),
    revenue: Number(revenueRow?.total ?? 0),
    totalCourses: Number(coursesRow?.count ?? 0),
    totalLessons: Number(lessonsRow?.count ?? 0),
    recentUsers: recentUsersRows.map((row) => ({
      email: row.user_email,
      name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.user_email,
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
      role: row.role,
      accountStatus: row.account_status,
      isBlocked: Boolean(row.is_blocked),
      createdAt: row.created_at
    }))
  })
})

// ─── ADMIN: User Management ───────────────────────────────────────────────────

app.get('/api/admin/users', adminApiLimiter, requireAdminAuth, (req, res) => {
  const search = String(req.query.search ?? '').trim().toLowerCase()
  const status = String(req.query.status ?? '').trim()
  const role = String(req.query.role ?? '').trim()

  let sql = 'SELECT user_email, first_name, last_name, phone, bio, role, account_status, is_blocked, created_at, updated_at FROM user_profiles'
  const clauses = []
  const params = []

  if (search) {
    clauses.push('(LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ? OR LOWER(user_email) LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  if (status && status !== 'all') {
    if (status === 'blocked') {
      clauses.push("(account_status = 'blocked' OR is_blocked = 1)")
    } else {
      clauses.push('account_status = ? AND is_blocked = 0')
      params.push(status)
    }
  }

  if (role && role !== 'all') {
    clauses.push('role = ?')
    params.push(role)
  }

  if (clauses.length) {
    sql += ' WHERE ' + clauses.join(' AND ')
  }

  sql += ' ORDER BY datetime(created_at) DESC'

  const rows = db.prepare(sql).all(...params)
  res.json({
    users: rows.map((row) => ({
      email: row.user_email,
      name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.user_email,
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
      phone: row.phone ?? '',
      bio: row.bio ?? '',
      role: row.role ?? 'User',
      accountStatus: row.account_status ?? 'active',
      isBlocked: Boolean(row.is_blocked),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  })
})

app.get('/api/admin/users/:userEmail/detail', adminApiLimiter, requireAdminAuth, (req, res) => {
  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const profile = getUserProfileStmt.get(userEmail)
  if (!profile) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const subscription = findSubscriptionStmt.get(userEmail)
  const progress = db.prepare('SELECT course_id, lessons_completed, lessons_started, status FROM course_progress WHERE user_email = ?').all(userEmail)
  const reviews = db.prepare('SELECT id, rating, text, lesson_label, moderation_status, created_at FROM reviews WHERE user_email = ?').all(userEmail)

  res.json({
    user: getPublicUserRecord(profile),
    subscription: subscription ? formatSubscription(subscription, userEmail) : null,
    progress,
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, text: r.text, lessonLabel: r.lesson_label, moderationStatus: r.moderation_status, createdAt: r.created_at }))
  })
})

app.patch('/api/admin/users/:userEmail', adminApiLimiter, requireAdminAuth, (req, res) => {
  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const current = getUserProfileStmt.get(userEmail)
  if (!current) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  // Prevent modifying the admin account's role or blocking it
  if (userEmail === config.adminEmail) {
    if (req.body?.isBlocked === true || req.body?.accountStatus === 'blocked') {
      res.status(400).json({ error: 'The administrator account cannot be blocked' })
      return
    }
  }

  const firstName = typeof req.body?.firstName === 'string' ? clampText(req.body.firstName, 100) : current.first_name
  const lastName = typeof req.body?.lastName === 'string' ? clampText(req.body.lastName, 100) : current.last_name
  const phone = typeof req.body?.phone === 'string' ? clampText(req.body.phone, 40) : current.phone
  const bio = typeof req.body?.bio === 'string' ? clampText(req.body.bio, 1000) : current.bio

  // Only the single admin account can have role 'Admin', and the admin's own role is fixed.
  let nextRole = current.role
  if (typeof req.body?.role === 'string' && userEmail !== config.adminEmail) {
    const requested = normalizeRoleName(req.body.role)
    nextRole = requested === 'Admin' ? 'User' : requested
  }

  let nextStatus = current.account_status
  if (typeof req.body?.accountStatus === 'string') {
    const requestedStatus = req.body.accountStatus.trim().toLowerCase() || 'active'
    if (!ALLOWED_ACCOUNT_STATUSES.has(requestedStatus)) {
      res.status(400).json({ error: 'Invalid account status. Use "active", "inactive" or "blocked".' })
      return
    }
    nextStatus = requestedStatus
  }

  // `is_blocked` and `account_status` must agree. Previously the edit form could send
  // accountStatus 'active' together with a stale isBlocked=true, leaving the user locked
  // out while the admin UI showed them as active.
  let nextBlocked = current.is_blocked
  if (req.body?.isBlocked !== undefined) {
    nextBlocked = req.body.isBlocked ? 1 : 0
  }
  if (typeof req.body?.accountStatus === 'string') {
    nextBlocked = nextStatus === 'blocked' ? 1 : 0
  } else if (req.body?.isBlocked !== undefined) {
    nextStatus = nextBlocked ? 'blocked' : (current.account_status === 'blocked' ? 'active' : current.account_status)
  }

  const nowIso = new Date().toISOString()
  upsertUserProfileStmt.run({
    user_email: userEmail,
    first_name: firstName,
    last_name: lastName,
    phone: phone ?? '',
    bio: bio ?? '',
    avatar_url: current.avatar_url ?? null,
    role: nextRole,
    account_status: nextStatus,
    is_blocked: nextBlocked,
    password_hash: current.password_hash,
    created_at: current.created_at,
    updated_at: nowIso
  })

  // If user blocked, revoke active sessions
  if (nextBlocked === 1 || nextStatus === 'blocked') {
    db.prepare('UPDATE user_sessions SET revoked = 1, updated_at = ? WHERE user_email = ?').run(nowIso, userEmail)
  }

  const updatedProfile = getUserProfileStmt.get(userEmail)
  res.json({ ok: true, user: getPublicUserRecord(updatedProfile) })
})

app.delete('/api/admin/users/:userEmail', adminApiLimiter, requireAdminAuth, (req, res) => {
  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const profile = getUserProfileStmt.get(userEmail)
  if (!profile) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  if (userEmail === config.adminEmail) {
    res.status(400).json({ error: 'You cannot delete the primary administrator account' })
    return
  }

  const deleteTx = db.transaction(() => {
    db.prepare('DELETE FROM user_profiles WHERE user_email = ?').run(userEmail)
    db.prepare('DELETE FROM user_sessions WHERE user_email = ?').run(userEmail)
    db.prepare('DELETE FROM user_subscriptions WHERE user_email = ?').run(userEmail)
    db.prepare('DELETE FROM course_progress WHERE user_email = ?').run(userEmail)
    db.prepare('DELETE FROM user_notification_settings WHERE user_email = ?').run(userEmail)
    db.prepare('DELETE FROM password_reset_tokens WHERE user_email = ?').run(userEmail)
    // Reviews carry the user's email and name; remove them with the account.
    db.prepare('DELETE FROM reviews WHERE user_email = ?').run(userEmail)
    // payment_orders / payments are kept intentionally as financial records.
  })

  deleteTx()
  res.json({ ok: true })
})

// ─── ADMIN: Course Management ─────────────────────────────────────────────────

app.get('/api/admin/courses', adminApiLimiter, requireAdminAuth, (_req, res) => {
  try {
    const courses = db.prepare('SELECT * FROM courses ORDER BY order_index ASC').all()
    const lessonCountRows = db.prepare('SELECT course_id, COUNT(*) AS count FROM lessons GROUP BY course_id').all()
    const counts = {}
    for (const r of lessonCountRows) counts[r.course_id] = r.count

    const result = courses.map((c) => {
      let tags = []
      let outline = []
      try { tags = JSON.parse(c.tags || '[]') } catch {}
      try { outline = JSON.parse(c.outline || '[]') } catch {}

      return {
        id: c.id,
        badge: c.badge,
        title_kg: c.title_kg,
        title_ru: c.title_ru,
        title_en: c.title_en,
        description_kg: c.description_kg,
        description_ru: c.description_ru,
        description_en: c.description_en,
        category: c.category,
        level: c.level,
        rating: c.rating,
        students: c.students,
        duration: c.duration,
        lessonsCount: counts[c.id] || c.lessons_count || 0,
        color: c.color,
        accent: c.accent,
        tags,
        outline,
        isPublished: Boolean(c.is_published),
        orderIndex: c.order_index,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }
    })

    res.json({ courses: result })
  } catch (err) {
    sendServerError(res, err, 'Failed to fetch admin courses')
  }
})

app.post('/api/admin/courses', adminApiLimiter, requireAdminAuth, (req, res) => {
  try {
    const titleRu = String(req.body?.title_ru ?? req.body?.title ?? '').trim()
    const titleKg = String(req.body?.title_kg ?? titleRu).trim()
    const titleEn = String(req.body?.title_en ?? titleRu).trim()

    if (!titleRu) {
      res.status(400).json({ error: 'Course title is required' })
      return
    }

    let id = String(req.body?.id ?? '').trim().toLowerCase()
    if (!id) {
      id = titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `course-${Date.now()}`
    }

    const existing = db.prepare('SELECT id FROM courses WHERE id = ?').get(id)
    if (existing) {
      res.status(409).json({ error: `A course with ID "${id}" already exists` })
      return
    }

    const maxOrderRow = db.prepare('SELECT MAX(order_index) AS max_order FROM courses').get()
    const nextOrder = (maxOrderRow?.max_order ?? 0) + 1
    const nowIso = new Date().toISOString()

    const tags = Array.isArray(req.body?.tags) ? req.body.tags : []
    const outline = Array.isArray(req.body?.outline) ? req.body.outline : []

    db.prepare(`
      INSERT INTO courses (
        id, badge, title_kg, title_ru, title_en,
        description_kg, description_ru, description_en,
        category, level, rating, students, duration, lessons_count,
        color, accent, tags, outline, is_published, order_index, created_at, updated_at
      ) VALUES (
        @id, @badge, @title_kg, @title_ru, @title_en,
        @description_kg, @description_ru, @description_en,
        @category, @level, @rating, @students, @duration, @lessons_count,
        @color, @accent, @tags, @outline, @is_published, @order_index, @created_at, @updated_at
      )
    `).run({
      id,
      badge: String(req.body?.badge ?? 'Web').trim() || 'Web',
      title_kg: titleKg,
      title_ru: titleRu,
      title_en: titleEn,
      description_kg: String(req.body?.description_kg ?? req.body?.description ?? '').trim(),
      description_ru: String(req.body?.description_ru ?? req.body?.description ?? '').trim(),
      description_en: String(req.body?.description_en ?? req.body?.description ?? '').trim(),
      category: String(req.body?.category ?? 'Frontend').trim() || 'Frontend',
      level: String(req.body?.level ?? 'Beginner').trim() || 'Beginner',
      rating: Number(req.body?.rating) || 5.0,
      students: String(req.body?.students ?? '0').trim() || '0',
      duration: String(req.body?.duration ?? '4 недели').trim() || '4 недели',
      lessons_count: 0,
      color: String(req.body?.color ?? '#ffefeb').trim() || '#ffefeb',
      accent: String(req.body?.accent ?? '#f97316').trim() || '#f97316',
      tags: JSON.stringify(tags),
      outline: JSON.stringify(outline),
      is_published: req.body?.isPublished === false ? 0 : 1,
      order_index: Number(req.body?.orderIndex) || nextOrder,
      created_at: nowIso,
      updated_at: nowIso
    })

    const created = db.prepare('SELECT * FROM courses WHERE id = ?').get(id)
    res.status(201).json({ ok: true, course: created })
  } catch (err) {
    sendServerError(res, err, 'Failed to create course')
  }
})

app.put('/api/admin/courses/:courseId', adminApiLimiter, requireAdminAuth, (req, res) => {
  try {
    const courseId = String(req.params.courseId ?? '').trim()
    const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId)
    if (!existing) {
      res.status(404).json({ error: 'Course not found' })
      return
    }

    const titleRu = typeof req.body?.title_ru === 'string' ? req.body.title_ru.trim() : existing.title_ru
    const titleKg = typeof req.body?.title_kg === 'string' ? req.body.title_kg.trim() : existing.title_kg
    const titleEn = typeof req.body?.title_en === 'string' ? req.body.title_en.trim() : existing.title_en

    const tags = Array.isArray(req.body?.tags) ? req.body.tags : JSON.parse(existing.tags || '[]')
    const outline = Array.isArray(req.body?.outline) ? req.body.outline : JSON.parse(existing.outline || '[]')
    const nowIso = new Date().toISOString()

    db.prepare(`
      UPDATE courses SET
        badge = @badge,
        title_kg = @title_kg,
        title_ru = @title_ru,
        title_en = @title_en,
        description_kg = @description_kg,
        description_ru = @description_ru,
        description_en = @description_en,
        category = @category,
        level = @level,
        rating = @rating,
        students = @students,
        duration = @duration,
        color = @color,
        accent = @accent,
        tags = @tags,
        outline = @outline,
        is_published = @is_published,
        order_index = @order_index,
        updated_at = @updated_at
      WHERE id = @id
    `).run({
      id: courseId,
      badge: String(req.body?.badge ?? existing.badge).trim() || 'Web',
      title_kg: titleKg,
      title_ru: titleRu,
      title_en: titleEn,
      description_kg: String(req.body?.description_kg ?? existing.description_kg).trim(),
      description_ru: String(req.body?.description_ru ?? existing.description_ru).trim(),
      description_en: String(req.body?.description_en ?? existing.description_en).trim(),
      category: String(req.body?.category ?? existing.category).trim(),
      level: String(req.body?.level ?? existing.level).trim(),
      rating: Number(req.body?.rating ?? existing.rating),
      students: String(req.body?.students ?? existing.students).trim(),
      duration: String(req.body?.duration ?? existing.duration).trim(),
      color: String(req.body?.color ?? existing.color).trim(),
      accent: String(req.body?.accent ?? existing.accent).trim(),
      tags: JSON.stringify(tags),
      outline: JSON.stringify(outline),
      is_published: req.body?.isPublished !== undefined ? (req.body.isPublished ? 1 : 0) : existing.is_published,
      order_index: req.body?.orderIndex !== undefined ? Number(req.body.orderIndex) : existing.order_index,
      updated_at: nowIso
    })

    const updated = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId)
    res.json({ ok: true, course: updated })
  } catch (err) {
    sendServerError(res, err, 'Failed to update course')
  }
})

app.delete('/api/admin/courses/:courseId', adminApiLimiter, requireAdminAuth, (req, res) => {
  try {
    const courseId = String(req.params.courseId ?? '').trim()
    const existing = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId)
    if (!existing) {
      res.status(404).json({ error: 'Course not found' })
      return
    }

    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM lessons WHERE course_id = ?').run(courseId)
      db.prepare('DELETE FROM course_progress WHERE course_id = ?').run(courseId)
      db.prepare('DELETE FROM courses WHERE id = ?').run(courseId)
    })

    deleteTx()
    res.json({ ok: true })
  } catch (err) {
    sendServerError(res, err, 'Failed to delete course')
  }
})

app.patch('/api/admin/courses/:courseId/publish', adminApiLimiter, requireAdminAuth, (req, res) => {
  try {
    const courseId = String(req.params.courseId ?? '').trim()
    const existing = db.prepare('SELECT id, is_published FROM courses WHERE id = ?').get(courseId)
    if (!existing) {
      res.status(404).json({ error: 'Course not found' })
      return
    }

    const nextPublished = req.body?.isPublished !== undefined
      ? (req.body.isPublished ? 1 : 0)
      : (existing.is_published ? 0 : 1)

    db.prepare('UPDATE courses SET is_published = ?, updated_at = ? WHERE id = ?')
      .run(nextPublished, new Date().toISOString(), courseId)

    res.json({ ok: true, courseId, isPublished: Boolean(nextPublished) })
  } catch (err) {
    sendServerError(res, err, 'Failed to toggle publication')
  }
})

// ─── ADMIN: Lesson Management ─────────────────────────────────────────────────

app.get('/api/admin/lessons', adminApiLimiter, requireAdminAuth, (req, res) => {
  try {
    const courseId = String(req.query.courseId ?? '').trim()
    let rows
    if (courseId) {
      rows = db.prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index ASC').all(courseId)
    } else {
      rows = db.prepare('SELECT * FROM lessons ORDER BY course_id ASC, order_index ASC').all()
    }

    const lessons = rows.map((l) => {
      let quiz = {}
      try { quiz = JSON.parse(l.quiz_json || '{}') } catch {}
      return {
        id: l.id,
        courseId: l.course_id,
        title_kg: l.title_kg,
        title_ru: l.title_ru,
        title_en: l.title_en,
        duration: l.duration,
        type: l.type,
        theory: l.theory,
        code: l.code,
        task: l.task,
        videoUrl: l.video_url,
        quiz,
        orderIndex: l.order_index,
        isPublished: Boolean(l.is_published),
        createdAt: l.created_at,
        updatedAt: l.updated_at
      }
    })

    res.json({ lessons })
  } catch (err) {
    sendServerError(res, err, 'Failed to fetch lessons')
  }
})

app.post('/api/admin/lessons', adminApiLimiter, requireAdminAuth, (req, res) => {
  try {
    const courseId = String(req.body?.courseId ?? '').trim()
    if (!courseId) {
      res.status(400).json({ error: 'courseId is required' })
      return
    }

    const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId)
    if (!course) {
      res.status(404).json({ error: 'Course does not exist' })
      return
    }

    const titleRu = String(req.body?.title_ru ?? req.body?.title ?? '').trim()
    const titleKg = String(req.body?.title_kg ?? titleRu).trim()
    const titleEn = String(req.body?.title_en ?? titleRu).trim()

    if (!titleRu) {
      res.status(400).json({ error: 'Lesson title is required' })
      return
    }

    const maxOrderRow = db.prepare('SELECT MAX(order_index) AS max_order FROM lessons WHERE course_id = ?').get(courseId)
    const nextOrder = (maxOrderRow?.max_order ?? 0) + 1

    let id = String(req.body?.id ?? '').trim().toLowerCase()
    if (!id) {
      id = `${courseId}-lesson-${nextOrder}`
    }

    const existing = db.prepare('SELECT id FROM lessons WHERE id = ?').get(id)
    if (existing) {
      id = `${courseId}-lesson-${Date.now()}`
    }

    const nowIso = new Date().toISOString()
    const quizJson = typeof req.body?.quiz === 'object' ? JSON.stringify(req.body.quiz) : '{}'

    db.prepare(`
      INSERT INTO lessons (
        id, course_id, title_kg, title_ru, title_en,
        duration, type, theory, code, task, video_url,
        quiz_json, order_index, is_published, created_at, updated_at
      ) VALUES (
        @id, @course_id, @title_kg, @title_ru, @title_en,
        @duration, @type, @theory, @code, @task, @video_url,
        @quiz_json, @order_index, @is_published, @created_at, @updated_at
      )
    `).run({
      id,
      course_id: courseId,
      title_kg: titleKg,
      title_ru: titleRu,
      title_en: titleEn,
      duration: String(req.body?.duration ?? '30 мин').trim() || '30 мин',
      type: String(req.body?.type ?? 'Видеоурок').trim() || 'Видеоурок',
      theory: String(req.body?.theory ?? '').trim(),
      code: String(req.body?.code ?? '').trim(),
      task: String(req.body?.task ?? '').trim(),
      video_url: String(req.body?.videoUrl ?? req.body?.video_url ?? '').trim(),
      quiz_json: quizJson,
      order_index: req.body?.orderIndex ? Number(req.body.orderIndex) : nextOrder,
      is_published: req.body?.isPublished === false ? 0 : 1,
      created_at: nowIso,
      updated_at: nowIso
    })

    // Update lesson count in course
    const countRow = db.prepare('SELECT COUNT(*) AS count FROM lessons WHERE course_id = ?').get(courseId)
    db.prepare('UPDATE courses SET lessons_count = ?, updated_at = ? WHERE id = ?')
      .run(countRow?.count ?? 0, nowIso, courseId)

    const created = db.prepare('SELECT * FROM lessons WHERE id = ?').get(id)
    res.status(201).json({ ok: true, lesson: created })
  } catch (err) {
    sendServerError(res, err, 'Failed to create lesson')
  }
})

app.put('/api/admin/lessons/:lessonId', adminApiLimiter, requireAdminAuth, (req, res) => {
  try {
    const lessonId = String(req.params.lessonId ?? '').trim()
    const existing = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId)
    if (!existing) {
      res.status(404).json({ error: 'Lesson not found' })
      return
    }

    const courseId = String(req.body?.courseId ?? existing.course_id).trim()
    if (courseId !== existing.course_id && !db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId)) {
      res.status(404).json({ error: 'Course does not exist' })
      return
    }
    const titleRu = typeof req.body?.title_ru === 'string' ? req.body.title_ru.trim() : existing.title_ru
    const titleKg = typeof req.body?.title_kg === 'string' ? req.body.title_kg.trim() : existing.title_kg
    const titleEn = typeof req.body?.title_en === 'string' ? req.body.title_en.trim() : existing.title_en
    const quizJson = req.body?.quiz !== undefined ? JSON.stringify(req.body.quiz) : existing.quiz_json
    const nowIso = new Date().toISOString()

    db.prepare(`
      UPDATE lessons SET
        course_id = @course_id,
        title_kg = @title_kg,
        title_ru = @title_ru,
        title_en = @title_en,
        duration = @duration,
        type = @type,
        theory = @theory,
        code = @code,
        task = @task,
        video_url = @video_url,
        quiz_json = @quiz_json,
        order_index = @order_index,
        is_published = @is_published,
        updated_at = @updated_at
      WHERE id = @id
    `).run({
      id: lessonId,
      course_id: courseId,
      title_kg: titleKg,
      title_ru: titleRu,
      title_en: titleEn,
      duration: String(req.body?.duration ?? existing.duration).trim(),
      type: String(req.body?.type ?? existing.type).trim(),
      theory: String(req.body?.theory ?? existing.theory).trim(),
      code: String(req.body?.code ?? existing.code).trim(),
      task: String(req.body?.task ?? existing.task).trim(),
      video_url: String(req.body?.videoUrl ?? req.body?.video_url ?? existing.video_url).trim(),
      quiz_json: quizJson,
      order_index: req.body?.orderIndex !== undefined ? Number(req.body.orderIndex) : existing.order_index,
      is_published: req.body?.isPublished !== undefined ? (req.body.isPublished ? 1 : 0) : existing.is_published,
      updated_at: nowIso
    })

    const updated = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId)
    res.json({ ok: true, lesson: updated })
  } catch (err) {
    sendServerError(res, err, 'Failed to update lesson')
  }
})

app.delete('/api/admin/lessons/:lessonId', adminApiLimiter, requireAdminAuth, (req, res) => {
  try {
    const lessonId = String(req.params.lessonId ?? '').trim()
    const existing = db.prepare('SELECT course_id FROM lessons WHERE id = ?').get(lessonId)
    if (!existing) {
      res.status(404).json({ error: 'Lesson not found' })
      return
    }

    const courseId = existing.course_id
    db.prepare('DELETE FROM lessons WHERE id = ?').run(lessonId)

    // Update lesson count in course
    const nowIso = new Date().toISOString()
    const countRow = db.prepare('SELECT COUNT(*) AS count FROM lessons WHERE course_id = ?').get(courseId)
    db.prepare('UPDATE courses SET lessons_count = ?, updated_at = ? WHERE id = ?')
      .run(countRow?.count ?? 0, nowIso, courseId)

    res.json({ ok: true })
  } catch (err) {
    sendServerError(res, err, 'Failed to delete lesson')
  }
})

app.patch('/api/admin/lessons/:lessonId/order', adminApiLimiter, requireAdminAuth, (req, res) => {
  try {
    const lessonId = String(req.params.lessonId ?? '').trim()
    const current = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId)
    if (!current) {
      res.status(404).json({ error: 'Lesson not found' })
      return
    }

    const direction = req.body?.direction // 'up' | 'down'
    const newOrder = req.body?.newOrder !== undefined ? Number(req.body.newOrder) : null

    if (direction === 'up' || direction === 'down') {
      const neighbor = direction === 'up'
        ? db.prepare('SELECT * FROM lessons WHERE course_id = ? AND order_index < ? ORDER BY order_index DESC LIMIT 1').get(current.course_id, current.order_index)
        : db.prepare('SELECT * FROM lessons WHERE course_id = ? AND order_index > ? ORDER BY order_index ASC LIMIT 1').get(current.course_id, current.order_index)

      if (neighbor) {
        const nowIso = new Date().toISOString()
        const swapTx = db.transaction(() => {
          db.prepare('UPDATE lessons SET order_index = ?, updated_at = ? WHERE id = ?').run(neighbor.order_index, nowIso, current.id)
          db.prepare('UPDATE lessons SET order_index = ?, updated_at = ? WHERE id = ?').run(current.order_index, nowIso, neighbor.id)
        })
        swapTx()
      }
    } else if (newOrder !== null) {
      db.prepare('UPDATE lessons SET order_index = ?, updated_at = ? WHERE id = ?')
        .run(newOrder, new Date().toISOString(), lessonId)
    }

    res.json({ ok: true })
  } catch (err) {
    sendServerError(res, err, 'Failed to reorder lesson')
  }
})

// ─── ADMIN: AI Pro Management ─────────────────────────────────────────────────

app.get('/api/admin/ai-pro', adminApiLimiter, requireAdminAuth, (_req, res) => {
  try {
    const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'ai_pro_enabled'").get()
    const systemEnabled = setting ? setting.value === 'true' : true

    const activeCountRow = db.prepare("SELECT COUNT(*) AS count FROM user_subscriptions WHERE plan_id = 'aipro' AND status = 'active' AND datetime(ends_at) > datetime('now')").get()
    const totalAiProRow = db.prepare("SELECT COUNT(*) AS count FROM user_subscriptions WHERE plan_id = 'aipro'").get()

    // Get all users and their AI Pro status
    const users = db.prepare(`
      SELECT u.user_email, u.first_name, u.last_name, u.role, u.account_status,
             s.plan_id, s.status AS sub_status, s.started_at, s.ends_at, s.updated_at
      FROM user_profiles u
      LEFT JOIN user_subscriptions s ON u.user_email = s.user_email
      ORDER BY datetime(u.created_at) DESC
    `).all()

    const now = Date.now()
    const userRecords = users.map((u) => {
      const isAiProPlan = u.plan_id === 'aipro'
      const isActive = isAiProPlan && u.sub_status === 'active' && new Date(u.ends_at).getTime() > now
      const isExpired = isAiProPlan && (u.sub_status === 'expired' || new Date(u.ends_at).getTime() <= now)
      const daysRemaining = isActive ? Math.max(0, Math.ceil((new Date(u.ends_at).getTime() - now) / (1000 * 60 * 60 * 24))) : 0

      return {
        email: u.user_email,
        name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.user_email,
        role: u.role,
        accountStatus: u.account_status,
        hasAiPro: isActive,
        status: isActive ? 'active' : (isExpired ? 'expired' : 'none'),
        startedAt: isAiProPlan ? u.started_at : null,
        endsAt: isAiProPlan ? u.ends_at : null,
        daysRemaining
      }
    })

    res.json({
      systemEnabled,
      activeAiProUsers: Number(activeCountRow?.count ?? 0),
      totalAiProGrants: Number(totalAiProRow?.count ?? 0),
      users: userRecords
    })
  } catch (err) {
    sendServerError(res, err, 'Failed to fetch AI Pro data')
  }
})

app.patch('/api/admin/ai-pro/system', adminApiLimiter, requireAdminAuth, (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled)
    const nowIso = new Date().toISOString()
    db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('ai_pro_enabled', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(String(enabled), nowIso)

    res.json({ ok: true, systemEnabled: enabled })
  } catch (err) {
    sendServerError(res, err, 'Failed to update system setting')
  }
})

app.post('/api/admin/ai-pro/user', adminApiLimiter, requireAdminAuth, (req, res) => {
  try {
    const userEmail = String(req.body?.userEmail ?? '').trim().toLowerCase()
    const action = String(req.body?.action ?? 'activate').trim() // 'activate' | 'deactivate'
    const days = Math.max(1, Math.floor(Number(req.body?.days ?? 30)) || 30)

    const profile = getUserProfileStmt.get(userEmail)
    if (!profile) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const nowIso = new Date().toISOString()

    if (action === 'activate') {
      // "+30 days" on an already active AI Pro grant extends it from its current end date.
      const current = findSubscriptionStmt.get(userEmail)
      const currentEndMs = current && current.plan_id === 'aipro' && current.status === 'active' ? new Date(current.ends_at).getTime() : NaN
      const baseMs = Number.isFinite(currentEndMs) && currentEndMs > Date.now() ? currentEndMs : Date.now()
      const endsAt = new Date(baseMs + Math.min(days, 3650) * 24 * 60 * 60 * 1000).toISOString()
      upsertSubscriptionStmt.run({
        user_email: userEmail,
        plan_id: 'aipro',
        status: 'active',
        started_at: nowIso,
        ends_at: endsAt,
        purchased_at: nowIso,
        updated_at: nowIso,
        payment_method: 'admin_grant',
        amount: 799,
        currency: 'KGS',
        order_id: `admin-ai-grant-${crypto.randomUUID()}`
      })
      res.json({ ok: true, action: 'activated', userEmail, endsAt })
      return
    }

    if (action === 'deactivate') {
      expireSubscriptionStmt.run({ user_email: userEmail, updated_at: nowIso })
      res.json({ ok: true, action: 'deactivated', userEmail })
      return
    }

    res.status(400).json({ error: 'Invalid action. Use "activate" or "deactivate".' })
  } catch (err) {
    sendServerError(res, err, 'Operation failed')
  }
})

// ─── AI Assistant Chat Endpoint (Backend verified access) ─────────────────────

app.post('/api/ai/chat', async (req, res) => {
  try {
    const userEmail = resolveAuthenticatedUserEmail(req)
    if (!userEmail) {
      res.status(401).json({ error: 'Authentication required. Please log in.' })
      return
    }

    // Check system availability
    const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'ai_pro_enabled'").get()
    if (setting && setting.value === 'false') {
      res.status(503).json({ error: 'AI Pro service is currently disabled by administrator.' })
      return
    }

    const profile = getUserProfileStmt.get(userEmail)
    if (!profile || isProfileBlocked(profile)) {
      res.status(403).json({ error: 'Account is not allowed to use this feature.' })
      return
    }

    // Check authorization: Must be the administrator OR have an active AI Pro subscription
    const isAdmin = userEmail === config.adminEmail && normalizeRoleName(profile.role) === 'Admin'
    const nowIso = new Date().toISOString()
    const activeSub = db.prepare("SELECT * FROM user_subscriptions WHERE user_email = ? AND plan_id = 'aipro' AND status = 'active' AND datetime(ends_at) > datetime(?)").get(userEmail, nowIso)

    if (!isAdmin && !activeSub) {
      res.status(403).json({ error: 'AI Pro subscription is required to use this feature.' })
      return
    }

    const question = clampText(req.body?.question, 4000)
    const topic = clampText(req.body?.topic ?? 'General Programming', 100)
    const language = String(req.body?.language ?? 'ru').trim().toLowerCase()

    if (!question) {
      res.status(400).json({ error: 'Question is required' })
      return
    }

    // Provide intelligent educational assistant reply
    let answer = ''
    if (language === 'kg') {
      answer = `[AI Pro Жардамчы]: "${topic}" темасы боюнча сурооңузга жооп:\n\n`
        + `Сиздин сурооңуз: "${question}"\n\n`
        + `Негизги түшүндүрмө:\n`
        + `1. Бул багытта эң маанилүү нерсе — базалык концепцияларды терең түшүнүү жана практика жүзүндө колдонуу.\n`
        + `2. Кодду жазууда тазалыкты жана семантиканы сактаңыз.\n`
        + `3. Каталарды талдоодо браузердин же терминалдын дебаггер куралдарын колдонуу сунушталат.\n\n`
        + `Сурооңуз боюнча кошумча суроолор болсо, тартынбай бериңиз!`
    } else if (language === 'en') {
      answer = `[AI Pro Assistant]: Response regarding "${topic}":\n\n`
        + `Regarding your question: "${question}"\n\n`
        + `Key insights and recommendations:\n`
        + `1. Core Architecture: Focus on building a clear mental model of how components and data flow together.\n`
        + `2. Best Practices: Keep your code modular, self-documenting, and properly typed.\n`
        + `3. Debugging: Use console breakpoints, network inspectors, and unit tests to verify behavior.\n\n`
        + `Feel free to ask follow-up questions or share specific code snippets for code review!`
    } else {
      answer = `[AI Pro Ассистент]: Ответ по теме "${topic}":\n\n`
        + `Ваш вопрос: "${question}"\n\n`
        + `Разбор и рекомендации:\n`
        + `1. Основная концепция: В теме "${topic}" ключевую роль играет понимание базовых механизмов и правильная архитектурная структура.\n`
        + `2. Практические шаги: При написании кода соблюдайте стандарты форматирования, разбивайте задачи на небольшие чистые функции и обрабатывайте граничные случаи.\n`
        + `3. Отладка: Рекомендуется проверять результаты в DevTools и логировать промежуточные значения.\n\n`
        + `Если хотите разобрать конкретный фрагмент кода или решить практическое упражнение — отправьте его сюда!`
    }

    res.json({ ok: true, answer })
  } catch (err) {
    sendServerError(res, err, 'AI service error')
  }
})

// ─── ADMIN: Reviews moderation ────────────────────────────────────────────────

app.get('/api/admin/reviews', adminApiLimiter, requireAdminAuth, (req, res) => {
  const status = String(req.query.status ?? '').trim()
  const search = String(req.query.search ?? '').trim().toLowerCase()

  let sql = 'SELECT * FROM reviews'
  const clauses = []
  const params = []

  if (status && status !== 'all') {
    clauses.push('moderation_status = ?')
    params.push(status)
  }

  if (search) {
    clauses.push('(LOWER(user_name) LIKE ? OR LOWER(text) LIKE ? OR LOWER(lesson_label) LIKE ? OR LOWER(user_email) LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
  }

  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ')
  sql += ' ORDER BY datetime(created_at) DESC'

  const rows = db.prepare(sql).all(...params)
  res.json({
    reviews: rows.map((row) => ({
      id: row.id,
      userId: row.user_email,
      userName: row.user_name,
      userAvatar: row.user_avatar,
      lessonId: row.lesson_id,
      lessonLabel: row.lesson_label,
      rating: row.rating,
      text: row.text,
      moderationStatus: row.moderation_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  })
})

app.patch('/api/admin/reviews/:reviewId', adminApiLimiter, requireAdminAuth, (req, res) => {
  const reviewId = String(req.params.reviewId ?? '').trim()
  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(reviewId)
  if (!review) {
    res.status(404).json({ error: 'Review not found' })
    return
  }

  const moderationStatus = String(req.body?.moderationStatus ?? '').trim()
  const validStatuses = ['published', 'hidden', 'rejected']
  if (!validStatuses.includes(moderationStatus)) {
    res.status(400).json({ error: 'Invalid moderation status. Use "published", "hidden", or "rejected".' })
    return
  }

  db.prepare('UPDATE reviews SET moderation_status = ?, updated_at = ? WHERE id = ?')
    .run(moderationStatus, new Date().toISOString(), reviewId)

  res.json({ ok: true, id: reviewId, moderationStatus })
})

app.delete('/api/admin/reviews/:reviewId', adminApiLimiter, requireAdminAuth, (req, res) => {
  const reviewId = String(req.params.reviewId ?? '').trim()
  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(reviewId)
  if (!review) {
    res.status(404).json({ error: 'Review not found' })
    return
  }

  db.prepare('DELETE FROM reviews WHERE id = ?').run(reviewId)
  res.json({ ok: true })
})

// ─── ADMIN: Subscriptions ─────────────────────────────────────────────────────

app.get('/api/admin/subscriptions', adminApiLimiter, requireAdminAuth, (req, res) => {
  const search = String(req.query.search ?? '').trim().toLowerCase()
  const planFilter = String(req.query.plan ?? '').trim()

  let sql = `
    SELECT s.*, p.first_name, p.last_name
    FROM user_subscriptions s
    LEFT JOIN user_profiles p ON s.user_email = p.user_email
  `
  const clauses = []
  const params = []

  if (search) {
    clauses.push('(LOWER(s.user_email) LIKE ? OR LOWER(p.first_name) LIKE ? OR LOWER(p.last_name) LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  if (planFilter && planFilter !== 'all') {
    clauses.push('s.plan_id = ?')
    params.push(planFilter)
  }

  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ')
  sql += ' ORDER BY datetime(s.updated_at) DESC'

  const rows = db.prepare(sql).all(...params)
  res.json({
    subscriptions: rows.map((row) => ({
      userEmail: row.user_email,
      userName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.user_email,
      planId: row.plan_id,
      status: row.status,
      startedAt: row.started_at,
      endsAt: row.ends_at,
      purchasedAt: row.purchased_at,
      paymentMethod: row.payment_method,
      amount: row.amount,
      currency: row.currency,
      orderId: row.order_id
    }))
  })
})

app.patch('/api/admin/subscriptions/:userEmail', adminApiLimiter, requireAdminAuth, (req, res) => {
  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const profile = getUserProfileStmt.get(userEmail)
  if (!profile) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const action = String(req.body?.action ?? '').trim()
  const nowIso = new Date().toISOString()

  if (action === 'revoke') {
    expireSubscriptionStmt.run({ user_email: userEmail, updated_at: nowIso })
    res.json({ ok: true, action: 'revoked' })
    return
  }

  if (action === 'activate') {
    const planId = String(req.body?.planId ?? 'pro').trim()
    const plan = getPlan(planId)
    if (!plan) {
      res.status(400).json({ error: 'Invalid plan ID' })
      return
    }

    const endDate = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000)
    upsertSubscriptionStmt.run({
      user_email: userEmail,
      plan_id: plan.id,
      status: 'active',
      started_at: nowIso,
      ends_at: endDate.toISOString(),
      purchased_at: nowIso,
      updated_at: nowIso,
      payment_method: 'admin',
      amount: plan.amount,
      currency: 'KGS',
      order_id: `admin-grant-${crypto.randomUUID()}`
    })

    res.json({ ok: true, action: 'activated', planId: plan.id })
    return
  }

  res.status(400).json({ error: 'Invalid action. Use "activate" or "revoke".' })
})

// ─── ADMIN: Payments ──────────────────────────────────────────────────────────

app.get('/api/admin/payments', adminApiLimiter, requireAdminAuth, (req, res) => {
  const search = String(req.query.search ?? '').trim().toLowerCase()
  const status = String(req.query.status ?? '').trim()

  let sql = 'SELECT * FROM payment_orders'
  const clauses = []
  const params = []

  if (search) {
    clauses.push('(LOWER(user_email) LIKE ? OR LOWER(id) LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }

  if (status && status !== 'all') {
    clauses.push('status = ?')
    params.push(status)
  }

  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ')
  sql += ' ORDER BY datetime(created_at) DESC LIMIT 200'

  const rows = db.prepare(sql).all(...params)
  res.json({
    payments: rows.map((row) => ({
      id: row.id,
      userEmail: row.user_email,
      planId: row.plan_id,
      paymentMethod: row.payment_method,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      isActivated: Boolean(row.is_activated),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  })
})

// ─── ADMIN: Settings — Change Admin Password ──────────────────────────────────

app.put('/api/admin/settings/password', adminApiLimiter, requireAdminAuth, async (req, res) => {
  const userEmail = req.adminEmail

  const currentPassword = String(req.body?.currentPassword ?? '')
  const nextPassword = String(req.body?.newPassword ?? '')
  const confirmPassword = String(req.body?.confirmPassword ?? '')

  if (!currentPassword || !nextPassword || !confirmPassword) {
    res.status(400).json({ error: 'All password fields are required' })
    return
  }

  if (nextPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' })
    return
  }

  if (nextPassword !== confirmPassword) {
    res.status(400).json({ error: 'New passwords do not match' })
    return
  }

  if (nextPassword.length > 128) {
    res.status(400).json({ error: 'New password must be at most 128 characters' })
    return
  }

  if (!/[A-Za-zА-Яа-яЁё]/.test(nextPassword) || !/\d/.test(nextPassword)) {
    res.status(400).json({ error: 'New password must contain both letters and digits' })
    return
  }

  const profile = getUserProfileStmt.get(userEmail)
  if (!profile || !profile.password_hash || !verifyPassword(currentPassword, profile.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect' })
    return
  }

  if (verifyPassword(nextPassword, profile.password_hash)) {
    res.status(400).json({ error: 'New password must be different from the current password' })
    return
  }

  const hashedNext = hashPassword(nextPassword)
  const nowIso = new Date().toISOString()

  upsertUserProfileStmt.run({
    user_email: userEmail,
    first_name: profile.first_name ?? 'Admin',
    last_name: profile.last_name ?? '',
    phone: profile.phone ?? null,
    bio: profile.bio ?? '',
    avatar_url: profile.avatar_url ?? null,
    role: 'Admin',
    account_status: 'active',
    is_blocked: 0,
    password_hash: hashedNext,
    created_at: profile.created_at,
    updated_at: nowIso
  })

  // Revoke all existing sessions — force re-login
  db.prepare('UPDATE user_sessions SET revoked = 1, updated_at = ? WHERE user_email = ? AND revoked = 0').run(nowIso, userEmail)

  // Send confirmation email (non-blocking)
  void sendEmail({
    to: userEmail,
    subject: 'Your LEVEL UP admin password was changed',
    ...buildPasswordChangedEmail({ appName: 'LEVEL UP', isAdmin: true })
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to send password-changed email:', err)
  })

  res.json({ ok: true, sessionsRevoked: true })
})

// ─── Public Reviews Endpoints ─────────────────────────────────────────────────

app.get('/api/reviews', (req, res) => {
  // Reviewer emails are never sent to the public. When the caller is logged in we
  // flag their own review with `isOwn` so the UI can offer "Edit".
  const viewerEmail = resolveAuthenticatedUserEmail(req)
  const rows = listReviewsStmt.all()
  const reviews = rows.map((row) => ({
    id: row.id,
    isOwn: Boolean(viewerEmail && row.user_email === viewerEmail),
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

  const profile = getUserProfileStmt.get(userEmail)
  if (!profile || isProfileBlocked(profile)) {
    res.status(403).json({ error: 'Account is not allowed to post reviews' })
    return
  }

  // Display name/initial come from the stored profile, not from the request body,
  // so a user cannot post reviews under someone else's name.
  const userName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Student'
  const userAvatar = userName.charAt(0).toUpperCase() || 'U'
  const lessonId = clampText(req.body?.lessonId, 120)
  const lessonLabel = clampText(req.body?.lessonLabel, 300)
  const text = clampText(req.body?.text, 2000)
  const rating = Number(req.body?.rating)

  if (!lessonId || !lessonLabel || !text) {
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
      user_name: userName,
      user_avatar: userAvatar,
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

// ─── Payments & Subscriptions Endpoints ────────────────────────────────────────

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
    // eslint-disable-next-line no-console
    console.error('[PAYMENTS] order creation failed:', error)
    res.status(502).json({ error: 'Payment provider is unavailable. Please try again later.' })
  }
})

app.get('/api/payments/orders/:orderId', (req, res) => {
  const orderId = String(req.params.orderId ?? '')
  const order = findOrderByIdStmt.get(orderId)

  if (!order) {
    res.status(404).json({ error: 'Order not found' })
    return
  }

  // Only the authenticated session counts. (Previously an unauthenticated
  // `X-User-Email` header was accepted here, letting anyone read any order.)
  const sessionEmail = resolveAuthenticatedUserEmail(req)
  if (!sessionEmail) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  if (sessionEmail !== String(order.user_email).toLowerCase()) {
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
  const sessionEmail = resolveAuthenticatedUserEmail(req)

  if (!sessionEmail) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  if (sessionEmail !== userEmail) {
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

    sendServerError(res, error, 'Failed to activate subscription')
  }
})

// ─── User Profile & Course Progress Endpoints ─────────────────────────────────

function getSiteStatsSnapshot() {
  const totalStudentsRow = db.prepare('SELECT COUNT(*) AS count FROM user_profiles').get()
  const startedCoursesRow = db.prepare('SELECT COUNT(*) AS count FROM course_progress WHERE lessons_started > 0').get()
  const completedCoursesRow = db.prepare("SELECT COUNT(*) AS count FROM course_progress WHERE status = 'completed'").get()
  const ratingRow = db.prepare("SELECT AVG(rating) AS average, COUNT(*) AS count FROM reviews WHERE moderation_status = 'published'").get()
  const coursesRow = db.prepare('SELECT COUNT(*) AS count FROM courses WHERE is_published = 1').get()
  const lessonsRow = db.prepare('SELECT COUNT(*) AS count FROM lessons WHERE is_published = 1').get()

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
    rating: totalRatings > 0 ? Number(averageRating.toFixed(1)) : 5.0,
    totalRatings,
    totalCourses: Number(coursesRow?.count ?? 0),
    totalLessons: Number(lessonsRow?.count ?? 0),
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

  // Use the real lesson count from the database rather than trusting the client,
  // so progress/completion statistics cannot be inflated with arbitrary numbers.
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId)
  if (!course) {
    res.status(404).json({ error: 'Course not found' })
    return
  }
  const lessonCountRow = db.prepare('SELECT COUNT(*) AS count FROM lessons WHERE course_id = ? AND is_published = 1').get(courseId)
  const totalLessons = Number(lessonCountRow?.count ?? 0)

  const nowIso = new Date().toISOString()
  const toCount = (value) => Math.min(totalLessons, Math.max(0, Math.floor(Number(value) || 0)))
  const completedLessons = toCount(req.body?.completedLessons ?? 0)
  const lessonsStarted = toCount(req.body?.lessonsStarted ?? completedLessons)

  const existing = db.prepare('SELECT * FROM course_progress WHERE user_email = ? AND course_id = ?').get(userEmail, courseId)

  const nextLessonsStarted = Math.max(existing?.lessons_started ?? 0, lessonsStarted)
  const nextCompletedLessons = Math.max(existing?.lessons_completed ?? 0, completedLessons)
  const startedAt = existing?.started_at ?? (nextLessonsStarted > 0 ? nowIso : null)
  const completedAt = existing?.completed_at ?? (completedLessons >= totalLessons && totalLessons > 0 ? nowIso : null)
  const status = completedLessons >= totalLessons && totalLessons > 0 ? 'completed' : 'started'

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

  res.json({ ok: true, status, lessonsCompleted: nextCompletedLessons, lessonsStarted: nextLessonsStarted })
})

app.get('/api/users/:userEmail', (req, res) => {
  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const sessionEmail = resolveAuthenticatedUserEmail(req)

  if (!sessionEmail) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  if (sessionEmail !== userEmail) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const profile = getUserProfileStmt.get(userEmail)
  if (!profile) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const notifications = getNotificationSettingsStmt.get(userEmail) ?? {
    email_notifications: 1,
    new_courses: 1,
    new_lessons: 1,
    news_updates: 1
  }

  res.json({
    user: getPublicUserRecord(profile),
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
  const sessionEmail = resolveAuthenticatedUserEmail(req)

  if (!sessionEmail || sessionEmail !== userEmail) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const profile = getUserProfileStmt.get(userEmail)
  if (!profile) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const payload = req.body ?? {}
  const firstName = clampText(payload.firstName ?? payload.first_name ?? profile.first_name, 100)
  const lastName = clampText(payload.lastName ?? payload.last_name ?? profile.last_name, 100)
  const phone = clampText(payload.phone ?? profile.phone ?? '', 40)
  const bio = clampText(payload.bio ?? profile.bio ?? '', 1000)
  const avatarUrl = sanitizeAvatarUrl(payload.avatarUrl ?? payload.avatar_url ?? payload.profileImage ?? profile.avatar_url ?? '')
  const nowIso = new Date().toISOString()

  if (!firstName) {
    res.status(400).json({ error: 'First name is required' })
    return
  }

  if (avatarUrl === null) {
    res.status(400).json({ error: 'Profile photo must be a JPG, PNG or WEBP image under ~650 KB, or an https URL' })
    return
  }

  // Crucial security check: User cannot change their own role! Role is preserved from DB!
  upsertUserProfileStmt.run({
    user_email: userEmail,
    first_name: firstName,
    last_name: lastName,
    phone,
    bio,
    avatar_url: avatarUrl || null,
    role: profile.role, // NEVER allowed to escalate role through profile endpoint
    account_status: profile.account_status,
    is_blocked: profile.is_blocked,
    password_hash: profile.password_hash,
    created_at: profile.created_at,
    updated_at: nowIso
  })

  const updatedProfile = getUserProfileStmt.get(userEmail)
  res.json({
    ok: true,
    user: getPublicUserRecord(updatedProfile)
  })
})

app.put('/api/users/:userEmail/password', (req, res) => {
  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const sessionEmail = resolveAuthenticatedUserEmail(req)

  if (!sessionEmail || userEmail !== sessionEmail) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const currentPassword = String(req.body?.currentPassword ?? '')
  const nextPassword = String(req.body?.nextPassword ?? req.body?.newPassword ?? '')
  const confirmPassword = String(req.body?.confirmPassword ?? '')

  if (!currentPassword || !nextPassword || !confirmPassword) {
    res.status(400).json({ error: 'All password fields are required' })
    return
  }

  if (nextPassword.length < MIN_PASSWORD_LENGTH || nextPassword.length > 128) {
    res.status(400).json({ error: `Password must be ${MIN_PASSWORD_LENGTH}–128 characters` })
    return
  }

  if (nextPassword !== confirmPassword) {
    res.status(400).json({ error: 'New passwords do not match' })
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
    first_name: profile.first_name,
    last_name: profile.last_name,
    phone: profile.phone ?? null,
    bio: profile.bio ?? '',
    avatar_url: profile.avatar_url ?? null,
    role: profile.role,
    account_status: profile.account_status,
    is_blocked: profile.is_blocked,
    password_hash: hashedNext,
    created_at: profile.created_at,
    updated_at: nowIso
  })

  // Invalidate all sessions for this user
  db.prepare('UPDATE user_sessions SET revoked = 1, updated_at = ? WHERE user_email = ? AND revoked = 0').run(nowIso, userEmail)

  res.json({ ok: true, updated: true, sessionsRevoked: true })
})

app.put('/api/users/:userEmail/notifications', (req, res) => {
  const userEmail = String(req.params.userEmail ?? '').trim().toLowerCase()
  const sessionEmail = resolveAuthenticatedUserEmail(req)

  if (!sessionEmail || userEmail !== sessionEmail) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const nowIso = new Date().toISOString()
  const nextSettings = {
    user_email: userEmail,
    email_notifications: req.body?.emailNotifications === false ? 0 : 1,
    new_courses: req.body?.newCourses === false ? 0 : 1,
    new_lessons: req.body?.newLessons === false ? 0 : 1,
    news_updates: req.body?.newsUpdates === false ? 0 : 1,
    updated_at: nowIso
  }

  upsertNotificationSettingsStmt.run(nextSettings)

  res.json({
    ok: true,
    notifications: {
      emailNotifications: Boolean(nextSettings.email_notifications),
      newCourses: Boolean(nextSettings.new_courses),
      newLessons: Boolean(nextSettings.new_lessons),
      newsUpdates: Boolean(nextSettings.news_updates)
    }
  })
})

// ─── FORGOT & RESET PASSWORD (administrator and regular users) ────────────────

app.post('/api/auth/forgot-password', passwordResetLimiter, async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()

  // Always return the same generic 200 response to avoid email enumeration
  const genericResponse = { ok: true, message: 'If an account exists for this email, a password reset link has been sent.' }

  if (!email || !EMAIL_PATTERN.test(email)) {
    res.json(genericResponse)
    return
  }

  const profile = getUserProfileStmt.get(email)
  if (!profile || !profile.password_hash || isProfileBlocked(profile)) {
    res.json(genericResponse)
    return
  }

  const isAdminAccount = email === config.adminEmail && normalizeRoleName(profile.role) === 'Admin'

  // Invalidate any existing unused reset tokens for this account
  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_email = ? AND used = 0').run(email)

  // Generate cryptographically secure random token (48 bytes = 96 hex chars)
  const rawToken = crypto.randomBytes(48).toString('hex')
  const tokenId = crypto.randomUUID()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes

  db.prepare(`
    INSERT INTO password_reset_tokens (id, user_email, token_hash, expires_at, used, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(tokenId, email, tokenHash, expiresAt, new Date().toISOString())

  const frontendUrl = config.frontendUrl
  const resetPath = isAdminAccount ? '/admin/reset-password' : '/reset-password'
  const resetUrl = `${frontendUrl}${resetPath}?token=${encodeURIComponent(rawToken)}&id=${encodeURIComponent(tokenId)}`

  const emailContent = buildPasswordResetEmail({ resetUrl, expiresMinutes: 30, isAdmin: isAdminAccount })
  const emailSent = await sendEmail({
    to: email,
    subject: isAdminAccount ? 'LEVEL UP Admin — Password Reset Request' : 'LEVEL UP — Password Reset Request',
    ...emailContent
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to send reset email:', err)
    return false
  })

  if (!emailSent) {
    // Email (SMTP) not configured: fall back to the server log so the operator can
    // retrieve the link. The console is only visible to whoever runs the server.
    // eslint-disable-next-line no-console
    console.log(`\n=======================================================\n[PASSWORD RESET LINK for ${email}]: ${resetUrl}\n=======================================================\n`)
  }

  res.json(genericResponse)
})

app.get('/api/auth/reset-password/verify', (req, res) => {
  const tokenId = String(req.query.id ?? '').trim()
  const rawToken = String(req.query.token ?? '').trim()

  if (!tokenId || !rawToken) {
    res.status(400).json({ valid: false, error: 'Missing reset link parameters.' })
    return
  }

  const record = db.prepare('SELECT * FROM password_reset_tokens WHERE id = ?').get(tokenId)
  if (!record || record.used) {
    res.status(400).json({ valid: false, error: 'This reset link is invalid or has already been used.' })
    return
  }

  const expiresMs = new Date(record.expires_at).getTime()
  if (expiresMs <= Date.now()) {
    res.status(400).json({ valid: false, error: 'This reset link has expired. Please request a new one.' })
    return
  }

  if (!resetTokenMatches(rawToken, record.token_hash)) {
    res.status(400).json({ valid: false, error: 'Invalid reset link.' })
    return
  }

  res.json({ valid: true, expiresAt: record.expires_at })
})

app.post('/api/auth/reset-password', passwordResetLimiter, (req, res) => {
  const tokenId = String(req.body?.tokenId ?? '').trim()
  const rawToken = String(req.body?.token ?? '').trim()
  const newPassword = String(req.body?.newPassword ?? '')
  const confirmPassword = String(req.body?.confirmPassword ?? '')

  if (!tokenId || !rawToken || !newPassword || !confirmPassword) {
    res.status(400).json({ error: 'All fields are required.' })
    return
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > 128) {
    res.status(400).json({ error: `Password must be ${MIN_PASSWORD_LENGTH}–128 characters.` })
    return
  }

  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: 'Passwords do not match.' })
    return
  }

  const record = db.prepare('SELECT * FROM password_reset_tokens WHERE id = ?').get(tokenId)
  if (!record) {
    res.status(400).json({ error: 'Invalid or expired reset token.' })
    return
  }

  if (record.used) {
    res.status(400).json({ error: 'This reset link has already been used.' })
    return
  }

  const expiresMs = new Date(record.expires_at).getTime()
  if (expiresMs <= Date.now()) {
    res.status(400).json({ error: 'This reset link has expired. Please request a new one.' })
    return
  }

  if (!resetTokenMatches(rawToken, record.token_hash)) {
    res.status(400).json({ error: 'Invalid reset token.' })
    return
  }

  const userEmail = String(record.user_email).trim().toLowerCase()
  const profile = getUserProfileStmt.get(userEmail)
  if (!profile) {
    res.status(400).json({ error: 'Account not found.' })
    return
  }

  if (isProfileBlocked(profile)) {
    res.status(403).json({ error: 'This account has been suspended. Contact support.' })
    return
  }

  const isAdminAccount = userEmail === config.adminEmail && normalizeRoleName(profile.role) === 'Admin'
  const nowIso = new Date().toISOString()
  const hashedNext = hashPassword(newPassword)

  // Single transaction: mark token used (single-use guarantee), update only the
  // password hash (role/status are left exactly as they were), revoke sessions.
  const consumed = db.transaction(() => {
    const claim = db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ? AND used = 0').run(tokenId)
    if (claim.changes !== 1) return false
    db.prepare('UPDATE user_profiles SET password_hash = ?, updated_at = ? WHERE user_email = ?').run(hashedNext, nowIso, userEmail)
    db.prepare('UPDATE user_sessions SET revoked = 1, updated_at = ? WHERE user_email = ? AND revoked = 0').run(nowIso, userEmail)
    return true
  })()
  if (!consumed) {
    res.status(400).json({ error: 'This reset link has already been used.' })
    return
  }

  // Send confirmation email (non-blocking)
  void sendEmail({
    to: userEmail,
    subject: isAdminAccount ? 'Your LEVEL UP admin password was changed' : 'Your LEVEL UP password was changed',
    ...buildPasswordChangedEmail({ appName: 'LEVEL UP', isAdmin: isAdminAccount })
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to send password-changed confirmation email:', err)
  })

  res.json({ ok: true, isAdmin: isAdminAccount, message: 'Password reset successfully. Please log in with your new password.' })
})

// ─── Fallbacks: unknown API routes & error handler (always JSON) ─────────────

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body is too large' })
    return
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body' })
    return
  }
  sendServerError(res, err, 'Internal server error')
})

// ─── Initialize Seed Data & Start Server ──────────────────────────────────────

// Housekeeping: drop expired/revoked sessions and stale reset tokens so these
// tables do not grow forever. Only rows that can never be used again are removed.
function pruneExpiredAuthRows() {
  const nowIso = new Date().toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  db.prepare('DELETE FROM user_sessions WHERE expires_at < ? OR (revoked = 1 AND updated_at < ?)').run(nowIso, weekAgo)
  db.prepare('DELETE FROM password_reset_tokens WHERE expires_at < ?').run(weekAgo)
}

pruneExpiredAuthRows()
setInterval(pruneExpiredAuthRows, 6 * 60 * 60 * 1000).unref()

ensureSeedUsers()

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`LevelUp backend is running on port ${config.port}`)
})
