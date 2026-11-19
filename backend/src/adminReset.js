// Administrator password recovery with a one-time 6-digit e-mail code.
//
// Flow:  POST /api/auth/admin-reset/request  { email, language }        → code e-mailed (neutral answer)
//        POST /api/auth/admin-reset/verify   { email, code }            → one-time resetToken (10 min)
//        POST /api/auth/admin-reset/complete { email, resetToken, newPassword, confirmPassword, language }
//
// Security:
//  - the code is random (crypto.randomInt), stored only as a bcrypt hash, valid 5 minutes, single use;
//  - a new code invalidates the previous one; resending is limited to once per 60 s per e-mail;
//  - at most 5 wrong attempts per code (then it is burned), plus per-IP rate limits;
//  - the answer to /request is the same for any e-mail (no account enumeration);
//  - after a successful reset every session of the administrator is revoked.
import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import rateLimit from 'express-rate-limit'

export const CODE_TTL_MS = 5 * 60 * 1000
export const RESEND_COOLDOWN_MS = 60 * 1000
export const MAX_CODE_ATTEMPTS = 5
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000
const CODE_PATTERN = /^\d{6}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')

function safeEqualHex(a, b) {
  const x = Buffer.from(String(a), 'hex')
  const y = Buffer.from(String(b), 'hex')
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y)
}

export function initAdminReset(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_reset_codes (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      verified_at TEXT,
      reset_token_hash TEXT,
      reset_expires_at TEXT,
      reset_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_reset_codes_email ON admin_reset_codes (user_email, created_at);
  `)
}

/** Password rules shared with the admin settings form: 8–128 chars, letters and digits. */
export function adminPasswordProblem(password, confirmPassword) {
  if (!password || !confirmPassword) return 'All password fields are required'
  if (password.length < 8) return 'New password must be at least 8 characters'
  if (password.length > 128) return 'New password must be at most 128 characters'
  if (password !== confirmPassword) return 'New passwords do not match'
  if (!/[A-Za-zА-Яа-яЁёӨөҮүҢң]/.test(password) || !/\d/.test(password)) return 'New password must contain both letters and digits'
  return null
}

export function registerAdminResetRoutes(app, deps) {
  const { db, config, getUserProfileStmt, isProfileBlocked, normalizeRoleName, hashPassword, verifyPassword, sendEmail, buildAdminResetCodeEmail, buildPasswordChangedEmail, emailLanguage, emailLogoUrl } = deps

  const requestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: Math.max(1, Number(process.env.ADMIN_RESET_REQUEST_LIMIT_MAX) || 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password reset requests. Try again in an hour.', code: 'RATE_LIMITED' },
  })
  const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Math.max(1, Number(process.env.ADMIN_RESET_VERIFY_LIMIT_MAX) || 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again later.', code: 'RATE_LIMITED' },
  })

  // Resend cooldown for ANY e-mail (also unknown ones), so the 429 does not reveal the admin address.
  const lastRequestByEmail = new Map()

  const isAdminAccount = (email) => {
    const profile = getUserProfileStmt.get(email)
    const ok = Boolean(profile && profile.password_hash && email === config.adminEmail && normalizeRoleName(profile.role) === 'Admin' && !isProfileBlocked(profile))
    return ok ? profile : null
  }

  const latestCode = (email) => db.prepare('SELECT * FROM admin_reset_codes WHERE user_email = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(email)

  app.post('/api/auth/admin-reset/request', requestLimiter, async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
      res.status(400).json({ error: 'Enter a valid email address', code: 'INVALID_EMAIL' })
      return
    }

    const now = Date.now()
    const profile = isAdminAccount(email)
    // Admin: the last code in the database (survives restarts). Any other e-mail: memory, so that
    // the 429 behaves the same and does not reveal which address is the administrator's.
    const dbLast = profile ? latestCode(email) : null
    const last = profile ? (dbLast ? Date.parse(dbLast.created_at) : 0) : (lastRequestByEmail.get(email) ?? 0)
    if (now - last < RESEND_COOLDOWN_MS) {
      const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - (now - last)) / 1000)
      res.set('Retry-After', String(retryAfter))
      res.status(429).json({ error: 'Please wait before requesting a new code.', code: 'RESEND_COOLDOWN', retryAfter })
      return
    }
    const neutral = { ok: true, message: 'If this email belongs to the administrator, a 6-digit code has been sent.', cooldownSeconds: RESEND_COOLDOWN_MS / 1000, expiresInSeconds: CODE_TTL_MS / 1000 }

    if (!profile) {
      lastRequestByEmail.set(email, now)
      if (lastRequestByEmail.size > 5000) lastRequestByEmail.clear()
      res.json(neutral)
      return
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    const nowIso = new Date(now).toISOString()
    db.transaction(() => {
      // Only the newest code is valid.
      db.prepare('UPDATE admin_reset_codes SET used = 1 WHERE user_email = ? AND used = 0').run(email)
      db.prepare(`INSERT INTO admin_reset_codes (id, user_email, code_hash, attempts, expires_at, used, created_at)
        VALUES (?, ?, ?, 0, ?, 0, ?)`).run(crypto.randomUUID(), email, bcrypt.hashSync(code, 10), new Date(now + CODE_TTL_MS).toISOString(), nowIso)
    })()

    const content = buildAdminResetCodeEmail({ code, expiresMinutes: CODE_TTL_MS / 60000, language: emailLanguage(req.body?.language), logoUrl: emailLogoUrl() })
    const sent = await sendEmail({ to: email, subject: content.subject, html: content.html, text: content.text }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to send admin reset code:', err instanceof Error ? err.message : err)
      return false
    })
    if (!sent) {
      // SMTP is not configured (local development): the operator reads the code from the server console.
      // eslint-disable-next-line no-console
      console.log(`\n=======================================================\n[ADMIN PASSWORD RESET CODE for ${email}]: ${code} (valid 5 minutes)\n=======================================================\n`)
    }
    res.json(neutral)
  })

  app.post('/api/auth/admin-reset/verify', verifyLimiter, (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const code = String(req.body?.code ?? '').replace(/\s+/g, '')
    if (!email || !CODE_PATTERN.test(code)) {
      res.status(400).json({ error: 'Enter the 6-digit code from the email.', code: 'CODE_FORMAT' })
      return
    }

    const record = isAdminAccount(email) ? latestCode(email) : null
    if (!record || record.used) {
      res.status(400).json({ error: 'The code is invalid or has already been used. Request a new code.', code: 'CODE_INVALID', attemptsLeft: 0 })
      return
    }
    if (Date.parse(record.expires_at) <= Date.now()) {
      db.prepare('UPDATE admin_reset_codes SET used = 1 WHERE id = ?').run(record.id)
      res.status(400).json({ error: 'The code has expired. Request a new code.', code: 'CODE_EXPIRED' })
      return
    }
    if (record.attempts >= MAX_CODE_ATTEMPTS) {
      db.prepare('UPDATE admin_reset_codes SET used = 1 WHERE id = ?').run(record.id)
      res.status(429).json({ error: 'Too many wrong attempts. Request a new code.', code: 'TOO_MANY_ATTEMPTS', attemptsLeft: 0 })
      return
    }

    if (!bcrypt.compareSync(code, record.code_hash)) {
      const attempts = record.attempts + 1
      const burned = attempts >= MAX_CODE_ATTEMPTS
      db.prepare('UPDATE admin_reset_codes SET attempts = ?, used = ? WHERE id = ?').run(attempts, burned ? 1 : 0, record.id)
      if (burned) {
        res.status(429).json({ error: 'Too many wrong attempts. Request a new code.', code: 'TOO_MANY_ATTEMPTS', attemptsLeft: 0 })
        return
      }
      res.status(400).json({ error: 'Wrong code.', code: 'CODE_WRONG', attemptsLeft: MAX_CODE_ATTEMPTS - attempts })
      return
    }

    // Correct: the code is consumed and exchanged for a short-lived one-time reset token.
    const resetToken = crypto.randomBytes(32).toString('hex')
    const nowIso = new Date().toISOString()
    const claim = db.prepare(`UPDATE admin_reset_codes SET used = 1, verified_at = ?, reset_token_hash = ?, reset_expires_at = ?
      WHERE id = ? AND used = 0`).run(nowIso, sha256(resetToken), new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(), record.id)
    if (claim.changes !== 1) {
      res.status(400).json({ error: 'The code is invalid or has already been used. Request a new code.', code: 'CODE_INVALID' })
      return
    }
    res.json({ ok: true, resetToken, expiresInSeconds: RESET_TOKEN_TTL_MS / 1000 })
  })

  app.post('/api/auth/admin-reset/complete', verifyLimiter, (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const resetToken = String(req.body?.resetToken ?? '').trim()
    const newPassword = String(req.body?.newPassword ?? '')
    const confirmPassword = String(req.body?.confirmPassword ?? '')

    if (!email || !/^[a-f0-9]{64}$/.test(resetToken)) {
      res.status(400).json({ error: 'The reset session is invalid. Request a new code.', code: 'RESET_INVALID' })
      return
    }
    const problem = adminPasswordProblem(newPassword, confirmPassword)
    if (problem) {
      res.status(400).json({ error: problem, code: 'WEAK_PASSWORD' })
      return
    }

    const profile = isAdminAccount(email)
    const record = profile ? db.prepare('SELECT * FROM admin_reset_codes WHERE user_email = ? AND reset_token_hash IS NOT NULL ORDER BY created_at DESC, rowid DESC LIMIT 1').get(email) : null
    if (!record || record.reset_used || !safeEqualHex(sha256(resetToken), record.reset_token_hash)) {
      res.status(400).json({ error: 'The reset session is invalid. Request a new code.', code: 'RESET_INVALID' })
      return
    }
    if (Date.parse(record.reset_expires_at) <= Date.now()) {
      res.status(400).json({ error: 'The reset session has expired. Request a new code.', code: 'RESET_EXPIRED' })
      return
    }
    if (verifyPassword(newPassword, profile.password_hash)) {
      res.status(400).json({ error: 'New password must be different from the current password', code: 'SAME_PASSWORD' })
      return
    }

    const nowIso = new Date().toISOString()
    const hashed = hashPassword(newPassword)
    const done = db.transaction(() => {
      const claim = db.prepare('UPDATE admin_reset_codes SET reset_used = 1 WHERE id = ? AND reset_used = 0').run(record.id)
      if (claim.changes !== 1) return false
      db.prepare('UPDATE user_profiles SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE user_email = ?').run(hashed, nowIso, email)
      // Every open session (all devices) must sign in again with the new password.
      db.prepare('UPDATE user_sessions SET revoked = 1, updated_at = ? WHERE user_email = ? AND revoked = 0').run(nowIso, email)
      // Older e-mailed reset links and codes are no longer valid either.
      db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_email = ? AND used = 0').run(email)
      db.prepare('UPDATE admin_reset_codes SET used = 1 WHERE user_email = ? AND used = 0').run(email)
      return true
    })()
    if (!done) {
      res.status(400).json({ error: 'The reset session is invalid. Request a new code.', code: 'RESET_INVALID' })
      return
    }

    const mail = buildPasswordChangedEmail({ isAdmin: true, language: emailLanguage(req.body?.language), logoUrl: emailLogoUrl() })
    void sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text }).catch(() => undefined)
    res.json({ ok: true, sessionsRevoked: true, message: 'Password changed successfully. Now sign in.' })
  })
}
