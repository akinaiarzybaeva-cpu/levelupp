// LevelUp backend integration test suite.
//
// Safe by design:
//  - starts the backend from a fresh temporary directory, so backend/.env is NOT loaded
//    (no real SMTP, Telegram, payment provider or production database is touched);
//  - e-mail goes to a tiny SMTP server started by this script on 127.0.0.1, so the real
//    nodemailer delivery path is exercised and every message can be inspected;
//  - uses a throwaway SQLite database that is deleted afterwards;
//  - generates a random admin password for this run only.
//
// Usage:  node scripts/test_admin_suite.mjs        (from the repository root)

import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const serverEntry = path.join(repoRoot, 'backend', 'src', 'server.js')
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'levelup-test-'))
const PORT = 18000 + Math.floor(Math.random() * 1000)
const BASE = `http://127.0.0.1:${PORT}`
const ADMIN_EMAIL = 'admin@levelup.kg'
let adminPassword = `Adm-${crypto.randomBytes(9).toString('base64url')}`

const results = []
let serverLog = ''

function record(name, passed, detail = '') {
  results.push({ name, passed, detail })
  console.log(`${passed ? 'PASSED' : 'FAILED'}  ${name}${!passed && detail ? `  -> ${detail}` : ''}`)
}

async function request(route, { method = 'GET', token, body, headers = {}, rawBody } = {}) {
  const finalHeaders = { ...headers }
  if (body !== undefined || rawBody !== undefined) finalHeaders['Content-Type'] = 'application/json'
  if (token) finalHeaders.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: finalHeaders,
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined)
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function check(name, fn) {
  try {
    const outcome = await fn()
    if (outcome === true) record(name, true)
    else record(name, false, typeof outcome === 'string' ? outcome : JSON.stringify(outcome))
  } catch (err) {
    record(name, false, err instanceof Error ? err.message : String(err))
  }
}

// ── Local SMTP sink: accepts AUTH and stores every delivered message ───────────
const mails = []
function decodeMime(raw) {
  const qp = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)))
  const b64 = [...raw.matchAll(/Content-Transfer-Encoding: base64\r?\n(?:[^\r\n]+\r?\n)*\r?\n([A-Za-z0-9+/=\r\n]+)/gi)]
    .map((m) => Buffer.from(m[1].replace(/\s+/g, ''), 'base64').toString('utf8'))
  return [qp, ...b64].join('\n')
}
/** RFC 2047 "Q" encoding: "_" is a space, "=XX" is a byte (UTF-8). */
function decodeQEncoded(text) {
  const bytes = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '_') bytes.push(0x20)
    else if (ch === '=' && /^[0-9A-F]{2}$/i.test(text.slice(i + 1, i + 3))) { bytes.push(parseInt(text.slice(i + 1, i + 3), 16)); i += 2 }
    else bytes.push(...Buffer.from(ch, 'utf8'))
  }
  return Buffer.from(bytes).toString('utf8')
}

const smtp = net.createServer((socket) => {
  let buffer = ''
  let inData = false
  let envelopeTo = []
  socket.write('220 levelup-test-smtp ready\r\n')
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    while (true) {
      if (inData) {
        const end = buffer.indexOf('\r\n.\r\n')
        if (end < 0) return
        const raw = buffer.slice(0, end)
        buffer = buffer.slice(end + 5)
        inData = false
        // Subject may be folded over several lines and RFC 2047 encoded (=?UTF-8?Q?...?=)
        const subjectRaw = (raw.match(/^Subject: (.+(?:\r?\n[ \t].+)*)/m) || [])[1] || ''
        const subject = subjectRaw
          .replace(/\r?\n[ \t]/g, ' ')
          .replace(/=\?UTF-8\?Q\?([^?]*)\?=\s*/gi, (_m, q) => decodeQEncoded(q))
        mails.push({ to: envelopeTo.map((t) => t.toLowerCase()), subject: subject.trim(), body: decodeMime(raw) })
        socket.write('250 OK queued\r\n')
        continue
      }
      const nl = buffer.indexOf('\r\n')
      if (nl < 0) return
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 2)
      const cmd = line.slice(0, 4).toUpperCase()
      if (cmd === 'EHLO' || cmd === 'HELO') socket.write('250-levelup-test-smtp\r\n250 AUTH PLAIN LOGIN\r\n')
      else if (cmd === 'AUTH') socket.write('235 Authentication successful\r\n')
      else if (cmd === 'MAIL') { envelopeTo = []; socket.write('250 OK\r\n') }
      else if (cmd === 'RCPT') { envelopeTo.push((line.match(/<([^>]+)>/) || [])[1] || ''); socket.write('250 OK\r\n') }
      else if (cmd === 'DATA') { inData = true; socket.write('354 End data with <CR><LF>.<CR><LF>\r\n') }
      else if (cmd === 'QUIT') { socket.write('221 Bye\r\n'); socket.end(); return }
      else socket.write('250 OK\r\n')
    }
  })
  socket.on('error', () => {})
})
await new Promise((resolve) => smtp.listen(0, '127.0.0.1', resolve))
const SMTP_PORT = smtp.address().port

function mailsTo(email) {
  return mails.filter((m) => m.to.includes(email.toLowerCase()))
}

function lastResetLink(email) {
  const fromMail = mailsTo(email).map((m) => (m.body.match(/https?:\/\/[^\s"'<>]+reset-password\?token=[^\s"'<>]+/) || [])[0]).filter(Boolean)
  if (fromMail.length) return new URL(fromMail[fromMail.length - 1].replace(/&amp;/g, '&'))
  const pattern = new RegExp(`\\[PASSWORD RESET LINK for ${email.replace(/[.@]/g, '\\$&')}\\]: (\\S+)`, 'g')
  const matches = [...serverLog.matchAll(pattern)]
  return matches.length ? new URL(matches[matches.length - 1][1]) : null
}

async function sqlite(readonly = true) {
  const { default: Database } = await import(pathToBetterSqlite())
  return new Database(path.join(workDir, 'test.sqlite'), { readonly })
}

async function waitFor(predicate, timeoutMs = 4000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return true
    await new Promise((r) => setTimeout(r, 50))
  }
  return false
}

const server = spawn(process.execPath, [serverEntry], {
  cwd: workDir,
  env: {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    PORT: String(PORT),
    DATABASE_PATH: path.join(workDir, 'test.sqlite'),
    ADMIN_EMAIL,
    ADMIN_INITIAL_PASSWORD: adminPassword,
    FRONTEND_URL: 'http://localhost:5173',
    EMAIL_HOST: '127.0.0.1',
    EMAIL_PORT: String(SMTP_PORT),
    EMAIL_USER: 'test-smtp-user',
    EMAIL_PASS: 'test-smtp-pass',
    EMAIL_FROM: 'LevelUp Test <noreply@levelup.test>',
    TELEGRAM_BOT_TOKEN: '',
    PAYMENT_API_BASE_URL: '',
    TRUST_PROXY_HOPS: '0',
    PASSWORD_RESET_RATE_LIMIT_MAX: '40'
  },
  stdio: ['ignore', 'pipe', 'pipe']
})
server.stdout.on('data', (d) => { serverLog += d.toString() })
server.stderr.on('data', (d) => { serverLog += d.toString() })

try {
  const up = await waitFor(() => serverLog.includes('running on port'), 15000)
  if (!up) throw new Error(`Backend did not start:\n${serverLog}`)

  // ── Public endpoints ────────────────────────────────────────────────────────
  await check('Health endpoint responds', async () => (await request('/api/health')).data.status === 'ok')
  await check('Course catalog is seeded (8 courses, 160 lessons)', async () => {
    const { data } = await request('/api/courses')
    const lessons = data.courses.reduce((n, c) => n + c.lessons.length, 0)
    return data.courses.length === 8 && lessons === 160 || `courses=${data.courses.length} lessons=${lessons}`
  })
  await check('Demo account with known password is NOT seeded by default', async () => {
    const { data } = await request('/api/auth/account-status?email=aisha@levelup.kg')
    return data.exists === false || JSON.stringify(data)
  })

  // ── Registration ────────────────────────────────────────────────────────────
  const userA = { name: 'Test Student', email: 'student.a@example.test', password: 'Student#Pass1' }
  const userB = { name: 'Other Student', email: 'student.b@example.test', password: 'Student#Pass2' }
  let tokenA = ''
  let tokenB = ''

  await check('Register rejects password shorter than 8 chars', async () =>
    (await request('/api/auth/register', { method: 'POST', body: { ...userA, password: 'short1' } })).status === 400)
  await check('Register rejects invalid email', async () =>
    (await request('/api/auth/register', { method: 'POST', body: { ...userA, email: 'not-an-email' } })).status === 400)
  await check('Register valid user returns 201 + token, role User', async () => {
    const { status, data } = await request('/api/auth/register', { method: 'POST', body: userA })
    tokenA = data.token
    return (status === 201 && Boolean(tokenA) && data.user.role === 'User') || `${status} ${JSON.stringify(data)}`
  })
  await check('Register second user', async () => {
    const { status, data } = await request('/api/auth/register', { method: 'POST', body: userB })
    tokenB = data.token
    return status === 201 || status
  })
  await check('Duplicate registration rejected (409)', async () =>
    (await request('/api/auth/register', { method: 'POST', body: userA })).status === 409)
  await check('Registering the admin email is rejected', async () =>
    (await request('/api/auth/register', { method: 'POST', body: { name: 'X', email: ADMIN_EMAIL, password: 'Whatever#123' } })).status === 409)
  await check('Passwords are stored as bcrypt hashes', async () => {
    const { default: Database } = await import(pathToBetterSqlite())
    const db = new Database(path.join(workDir, 'test.sqlite'), { readonly: true })
    const row = db.prepare('SELECT password_hash FROM user_profiles WHERE user_email = ?').get(userA.email)
    db.close()
    return (row.password_hash.startsWith('$2b$12$') && !row.password_hash.includes(userA.password)) || row.password_hash.slice(0, 7)
  })
  await check('account-status only reveals existence', async () => {
    const { data } = await request(`/api/auth/account-status?email=${userA.email}`)
    return (data.exists === true && Object.keys(data).length === 1) || JSON.stringify(data)
  })

  // ── Login / session ─────────────────────────────────────────────────────────
  await check('Login with wrong password -> 401', async () =>
    (await request('/api/auth/login', { method: 'POST', body: { email: userA.email, password: 'wrong-password' } })).status === 401)
  await check('Login with unknown email -> 401 (same message)', async () => {
    const { status, data } = await request('/api/auth/login', { method: 'POST', body: { email: 'nobody@example.test', password: 'whatever123' } })
    return (status === 401 && data.error === 'Invalid email or password') || `${status} ${data.error}`
  })
  await check('Login with correct password -> token', async () => {
    const { status, data } = await request('/api/auth/login', { method: 'POST', body: { email: userA.email, password: userA.password } })
    if (data.token) tokenA = data.token
    return (status === 200 && Boolean(data.token)) || status
  })
  await check('Session endpoint accepts valid token', async () => (await request('/api/auth/session', { token: tokenA })).status === 200)
  await check('Session endpoint rejects bogus token (401)', async () => (await request('/api/auth/session', { token: 'deadbeef' })).status === 401)
  await check('Session endpoint rejects missing token (401)', async () => (await request('/api/auth/session')).status === 401)

  // ── Authorization (former X-User-Email bypass) ──────────────────────────────
  await check('SECURITY: X-User-Email header alone cannot read a profile', async () => {
    const { status } = await request(`/api/users/${userA.email}`, { headers: { 'X-User-Email': userA.email } })
    return status === 401 || status
  })
  await check('SECURITY: X-User-Email header alone cannot read a subscription', async () => {
    const { status } = await request(`/api/subscription/${userA.email}`, { headers: { 'X-User-Email': userA.email } })
    return status === 401 || status
  })
  await check("SECURITY: user B cannot read user A's profile (403)", async () =>
    (await request(`/api/users/${userA.email}`, { token: tokenB })).status === 403)
  await check("SECURITY: user B cannot edit user A's profile (403)", async () =>
    (await request(`/api/users/${userA.email}/profile`, { method: 'PUT', token: tokenB, body: { firstName: 'Hacked' } })).status === 403)

  // ── Profile ─────────────────────────────────────────────────────────────────
  await check('Profile update saves fields; role escalation ignored', async () => {
    const { status, data } = await request(`/api/users/${userA.email}/profile`, { method: 'PUT', token: tokenA, body: { firstName: 'Aibek', lastName: 'Test', phone: '+996 555 000 000', bio: 'Hi', role: 'Admin' } })
    return (status === 200 && data.user.firstName === 'Aibek' && data.user.role === 'User') || `${status} ${JSON.stringify(data.user)}`
  })
  await check('Profile rejects non-image avatar URL (javascript:)', async () =>
    (await request(`/api/users/${userA.email}/profile`, { method: 'PUT', token: tokenA, body: { avatarUrl: 'javascript:alert(1)' } })).status === 400)
  await check('Profile accepts a JPEG data-URL avatar', async () => {
    const tinyJpeg = `data:image/jpeg;base64,${Buffer.alloc(3000, 7).toString('base64')}`
    const { status, data } = await request(`/api/users/${userA.email}/profile`, { method: 'PUT', token: tokenA, body: { avatarUrl: tinyJpeg } })
    return (status === 200 && data.user.avatar === tinyJpeg) || status
  })
  await check('Notification settings persist', async () => {
    await request(`/api/users/${userA.email}/notifications`, { method: 'PUT', token: tokenA, body: { newsUpdates: false } })
    const { data } = await request(`/api/users/${userA.email}`, { token: tokenA })
    return (data.notifications.newsUpdates === false && data.notifications.newCourses === true) || JSON.stringify(data.notifications)
  })

  // ── Admin authentication & authorization ────────────────────────────────────
  let adminToken = ''
  await check('Admin can log in', async () => {
    const { status, data } = await request('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: adminPassword } })
    adminToken = data.token
    return (status === 200 && data.user.role === 'Admin') || `${status} ${JSON.stringify(data)}`
  })
  await check('SECURITY: regular user gets 403 on admin API', async () =>
    (await request('/api/admin/stats', { token: tokenA })).status === 403)
  await check('SECURITY: anonymous gets 401 on admin API', async () =>
    (await request('/api/admin/users')).status === 401)
  await check('SECURITY: spoofed X-User-Role header does not grant admin', async () =>
    (await request('/api/admin/stats', { token: tokenA, headers: { 'X-User-Role': 'Admin', 'X-User-Email': ADMIN_EMAIL } })).status === 403)
  await check('Admin stats reflect real database counts', async () => {
    const { data } = await request('/api/admin/stats', { token: adminToken })
    return (data.totalUsers === 3 && data.totalCourses === 8 && data.totalLessons === 160) || JSON.stringify({ u: data.totalUsers, c: data.totalCourses, l: data.totalLessons })
  })

  // ── Admin: user management ──────────────────────────────────────────────────
  await check('Admin cannot promote another user to Admin', async () => {
    const { data } = await request(`/api/admin/users/${userB.email}`, { method: 'PATCH', token: adminToken, body: { role: 'Admin' } })
    return data.user?.role === 'User' || JSON.stringify(data)
  })
  await check('Admin rejects invalid account status', async () =>
    (await request(`/api/admin/users/${userB.email}`, { method: 'PATCH', token: adminToken, body: { accountStatus: 'superuser' } })).status === 400)
  await check('Blocking a user revokes sessions and prevents login', async () => {
    await request(`/api/admin/users/${userB.email}`, { method: 'PATCH', token: adminToken, body: { accountStatus: 'blocked', isBlocked: true } })
    const session = await request('/api/auth/session', { token: tokenB })
    const login = await request('/api/auth/login', { method: 'POST', body: { email: userB.email, password: userB.password } })
    return (session.status === 401 && login.status === 403) || `session=${session.status} login=${login.status}`
  })
  await check('Unblocking via edit form (status active + stale isBlocked) really unblocks', async () => {
    const patch = await request(`/api/admin/users/${userB.email}`, { method: 'PATCH', token: adminToken, body: { accountStatus: 'active', isBlocked: true } })
    const login = await request('/api/auth/login', { method: 'POST', body: { email: userB.email, password: userB.password } })
    if (login.data.token) tokenB = login.data.token
    return (patch.data.user.isBlocked === false && login.status === 200) || `blocked=${patch.data.user?.isBlocked} login=${login.status}`
  })
  await check('Admin cannot block the admin account', async () =>
    (await request(`/api/admin/users/${ADMIN_EMAIL}`, { method: 'PATCH', token: adminToken, body: { isBlocked: true } })).status === 400)
  await check('Admin user detail endpoint', async () => {
    const { status, data } = await request(`/api/admin/users/${userA.email}/detail`, { token: adminToken })
    return (status === 200 && data.user.email === userA.email) || status
  })

  // ── Admin: courses & lessons (and their visibility on the public site) ──────
  await check('Admin creates a course', async () => {
    const { status } = await request('/api/admin/courses', { method: 'POST', token: adminToken, body: { id: 'test-course', title_ru: 'Тест', title_en: 'Test', title_kg: 'Тест', category: 'Frontend' } })
    return status === 201 || status
  })
  let lessonId = ''
  await check('Admin creates a lesson; it appears in the public catalog', async () => {
    const created = await request('/api/admin/lessons', { method: 'POST', token: adminToken, body: { courseId: 'test-course', title_ru: 'Урок 1', videoUrl: 'https://youtu.be/OLn2xxOF51Y' } })
    lessonId = created.data.lesson?.id
    const { data } = await request('/api/courses')
    const course = data.courses.find((c) => c.id === 'test-course')
    return (created.status === 201 && course?.lessons.length === 1) || `${created.status} ${JSON.stringify(course)}`
  })
  await check('Admin edits a course title', async () => {
    const { data } = await request('/api/admin/courses/test-course', { method: 'PUT', token: adminToken, body: { title_en: 'Test Edited' } })
    return data.course?.title_en === 'Test Edited' || JSON.stringify(data)
  })
  await check('Unpublishing hides the course from the public catalog', async () => {
    await request('/api/admin/courses/test-course/publish', { method: 'PATCH', token: adminToken, body: { isPublished: false } })
    const { data } = await request('/api/courses')
    return !data.courses.some((c) => c.id === 'test-course')
  })
  await check('Lesson reorder endpoint', async () =>
    (await request(`/api/admin/lessons/${lessonId}/order`, { method: 'PATCH', token: adminToken, body: { direction: 'down' } })).status === 200)
  await check('Moving a lesson to a non-existent course is rejected', async () =>
    (await request(`/api/admin/lessons/${lessonId}`, { method: 'PUT', token: adminToken, body: { courseId: 'nope' } })).status === 404)
  await check('Admin deletes lesson and course', async () => {
    const l = await request(`/api/admin/lessons/${lessonId}`, { method: 'DELETE', token: adminToken })
    const c = await request('/api/admin/courses/test-course', { method: 'DELETE', token: adminToken })
    return (l.status === 200 && c.status === 200) || `${l.status}/${c.status}`
  })

  // ── Reviews ─────────────────────────────────────────────────────────────────
  await check('Review requires authentication', async () =>
    (await request('/api/reviews', { method: 'POST', body: { lessonId: 'html-lesson-1', lessonLabel: 'x', rating: 5, text: 'hi' } })).status === 401)
  await check('Review rating must be 1..5', async () =>
    (await request('/api/reviews', { method: 'POST', token: tokenA, body: { lessonId: 'html-lesson-1', lessonLabel: 'x', rating: 9, text: 'hi' } })).status === 400)
  let reviewId = ''
  await check('Review created; display name comes from profile, not request', async () => {
    const { status, data } = await request('/api/reviews', { method: 'POST', token: tokenA, body: { lessonId: 'html-lesson-1', lessonLabel: 'HTML — 1', rating: 4, text: 'Great <b>course</b>', userName: 'Impersonated Admin' } })
    reviewId = data.id
    const list = await request('/api/reviews')
    const review = list.data.reviews.find((r) => r.id === reviewId)
    return (status === 201 && review?.name === 'Aibek Test') || `${status} ${review?.name}`
  })
  await check('SECURITY: public reviews do not expose reviewer emails', async () => {
    const { data } = await request('/api/reviews')
    return !JSON.stringify(data).includes('@') || 'email found in public payload'
  })
  await check('Own review flagged isOwn only for its author', async () => {
    const mine = (await request('/api/reviews', { token: tokenA })).data.reviews.find((r) => r.id === reviewId)
    const other = (await request('/api/reviews', { token: tokenB })).data.reviews.find((r) => r.id === reviewId)
    return (mine?.isOwn === true && other?.isOwn === false) || `${mine?.isOwn}/${other?.isOwn}`
  })
  await check('Admin hides review -> removed from public list', async () => {
    await request(`/api/admin/reviews/${reviewId}`, { method: 'PATCH', token: adminToken, body: { moderationStatus: 'hidden' } })
    return !(await request('/api/reviews')).data.reviews.some((r) => r.id === reviewId)
  })

  // ── Subscriptions & AI Pro ──────────────────────────────────────────────────
  await check('Default subscription is FREE', async () =>
    (await request(`/api/subscription/${userA.email}`, { token: tokenA })).data.planId === 'free')
  await check('AI chat refused without AI Pro (403)', async () =>
    (await request('/api/ai/chat', { method: 'POST', token: tokenA, body: { question: 'What is HTML?' } })).status === 403)
  await check('Admin grants PRO; user sees it', async () => {
    await request(`/api/admin/subscriptions/${userA.email}`, { method: 'PATCH', token: adminToken, body: { action: 'activate', planId: 'pro' } })
    const { data } = await request(`/api/subscription/${userA.email}`, { token: tokenA })
    return (data.planId === 'pro' && data.status === 'active') || JSON.stringify(data)
  })
  await check('Admin revokes subscription', async () => {
    await request(`/api/admin/subscriptions/${userA.email}`, { method: 'PATCH', token: adminToken, body: { action: 'revoke' } })
    return (await request(`/api/subscription/${userA.email}`, { token: tokenA })).data.status === 'expired'
  })
  await check('Admin grants AI Pro -> AI chat works', async () => {
    await request('/api/admin/ai-pro/user', { method: 'POST', token: adminToken, body: { userEmail: userA.email, action: 'activate', days: 30 } })
    const { status, data } = await request('/api/ai/chat', { method: 'POST', token: tokenA, body: { question: 'What is HTML?', language: 'en' } })
    return (status === 200 && typeof data.answer === 'string') || status
  })
  await check('"+30 days" extends an active AI Pro grant from its end date', async () => {
    const first = (await request(`/api/subscription/${userA.email}`, { token: tokenA })).data.endsAt
    await request('/api/admin/ai-pro/user', { method: 'POST', token: adminToken, body: { userEmail: userA.email, action: 'activate', days: 30 } })
    const second = (await request(`/api/subscription/${userA.email}`, { token: tokenA })).data.endsAt
    const diffDays = (new Date(second) - new Date(first)) / 86400000
    return Math.round(diffDays) === 30 || `diff=${diffDays}`
  })
  await check('AI Pro system switch off -> 503, on -> 200', async () => {
    await request('/api/admin/ai-pro/system', { method: 'PATCH', token: adminToken, body: { enabled: false } })
    const off = await request('/api/ai/chat', { method: 'POST', token: tokenA, body: { question: 'x' } })
    await request('/api/admin/ai-pro/system', { method: 'PATCH', token: adminToken, body: { enabled: true } })
    const on = await request('/api/ai/chat', { method: 'POST', token: tokenA, body: { question: 'x' } })
    return (off.status === 503 && on.status === 200) || `${off.status}/${on.status}`
  })

  // ── Payments (provider intentionally NOT configured in tests) ───────────────
  await check('Payment order without provider config fails cleanly (502, no internals)', async () => {
    const { status, data } = await request('/api/payments/orders', { method: 'POST', token: tokenA, body: { planId: 'pro', paymentMethod: 'MBank' } })
    return (status === 502 && !/credentials|config/i.test(data.error)) || `${status} ${data.error}`
  })
  await check('Webhook without valid signature rejected (401)', async () =>
    (await request('/api/payments/webhook/generic', { method: 'POST', body: { orderId: 'x', status: 'paid', amount: 499 } })).status === 401)

  // ── Course progress ─────────────────────────────────────────────────────────
  await check('Course progress clamps client-supplied counts to real lesson count', async () => {
    const { data } = await request('/api/course-progress', { method: 'POST', token: tokenA, body: { courseId: 'html', completedLessons: 9999, totalLessons: 1 } })
    return (data.lessonsCompleted === 20 && data.status === 'completed') || JSON.stringify(data)
  })
  await check('Course progress for unknown course -> 404', async () =>
    (await request('/api/course-progress', { method: 'POST', token: tokenA, body: { courseId: 'nope', completedLessons: 1 } })).status === 404)

  // ── Password change & recovery (user) ───────────────────────────────────────
  await check('User password change: wrong current password rejected', async () =>
    (await request(`/api/users/${userA.email}/password`, { method: 'PUT', token: tokenA, body: { currentPassword: 'nope', newPassword: 'NewStudent#1', confirmPassword: 'NewStudent#1' } })).status === 400)
  await check('User password change succeeds and revokes sessions', async () => {
    const change = await request(`/api/users/${userA.email}/password`, { method: 'PUT', token: tokenA, body: { currentPassword: userA.password, newPassword: 'NewStudent#1', confirmPassword: 'NewStudent#1' } })
    const session = await request('/api/auth/session', { token: tokenA })
    userA.password = 'NewStudent#1'
    return (change.status === 200 && session.status === 401) || `${change.status}/${session.status}`
  })
  await check('Forgot password (user) issues a reset link to /reset-password', async () => {
    const { data } = await request('/api/auth/forgot-password', { method: 'POST', body: { email: userA.email } })
    await waitFor(() => Boolean(lastResetLink(userA.email)))
    const link = lastResetLink(userA.email)
    return (data.ok === true && link?.pathname === '/reset-password') || `${JSON.stringify(data)} ${link}`
  })
  await check('Forgot password for unknown email gives identical response', async () => {
    const known = await request('/api/auth/forgot-password', { method: 'POST', body: { email: userB.email } })
    const unknown = await request('/api/auth/forgot-password', { method: 'POST', body: { email: 'ghost@example.test' } })
    return JSON.stringify(known.data) === JSON.stringify(unknown.data)
  })
  await check('Reset link verifies, resets password, and cannot be reused', async () => {
    const link = lastResetLink(userA.email)
    const token = link.searchParams.get('token')
    const id = link.searchParams.get('id')
    const verify = await request(`/api/auth/reset-password/verify?token=${token}&id=${id}`)
    const reset = await request('/api/auth/reset-password', { method: 'POST', body: { token, tokenId: id, newPassword: 'Recovered#Pass9', confirmPassword: 'Recovered#Pass9' } })
    const reuse = await request('/api/auth/reset-password', { method: 'POST', body: { token, tokenId: id, newPassword: 'Again#Pass99', confirmPassword: 'Again#Pass99' } })
    const login = await request('/api/auth/login', { method: 'POST', body: { email: userA.email, password: 'Recovered#Pass9' } })
    if (login.data.token) tokenA = login.data.token
    return (verify.data.valid === true && reset.status === 200 && reuse.status === 400 && login.status === 200) || `${verify.status}/${reset.status}/${reuse.status}/${login.status}`
  })
  await check('Reset with wrong token is rejected', async () => {
    await request('/api/auth/forgot-password', { method: 'POST', body: { email: userB.email } })
    await waitFor(() => Boolean(lastResetLink(userB.email)))
    const id = lastResetLink(userB.email).searchParams.get('id')
    return (await request('/api/auth/reset-password', { method: 'POST', body: { token: 'f'.repeat(96), tokenId: id, newPassword: 'Whatever#123', confirmPassword: 'Whatever#123' } })).status === 400
  })

  await check('Reset e-mail is really delivered over SMTP with the link', async () => {
    const mail = mailsTo(userA.email).find((m) => /password reset/i.test(m.subject))
    return (mail && /\/reset-password\?token=[0-9a-f]{96}/.test(mail.body.replace(/&amp;/g, '&')) && /30/.test(mail.body)) || JSON.stringify(mails.map((m) => m.subject))
  })
  await check('Confirmation e-mail is sent after a password reset', async () => {
    const ok = await waitFor(() => mailsTo(userA.email).some((m) => /changed/i.test(m.subject)))
    return ok || JSON.stringify(mailsTo(userA.email).map((m) => m.subject))
  })
  await check('Expired reset link is rejected (verify + reset)', async () => {
    await request('/api/auth/forgot-password', { method: 'POST', body: { email: userB.email } })
    await waitFor(() => Boolean(lastResetLink(userB.email)))
    const link = lastResetLink(userB.email)
    const id = link.searchParams.get('id')
    const token = link.searchParams.get('token')
    const db = await sqlite(false)
    db.prepare('UPDATE password_reset_tokens SET expires_at = ? WHERE id = ?').run(new Date(Date.now() - 60000).toISOString(), id)
    db.close()
    const verify = await request(`/api/auth/reset-password/verify?token=${token}&id=${id}`)
    const reset = await request('/api/auth/reset-password', { method: 'POST', body: { token, tokenId: id, newPassword: 'Expired#Pass1', confirmPassword: 'Expired#Pass1' } })
    const login = await request('/api/auth/login', { method: 'POST', body: { email: userB.email, password: 'Expired#Pass1' } })
    return (verify.status === 400 && reset.status === 400 && /expired/i.test(reset.data.error) && login.status === 401) || `${verify.status}/${reset.status}/${login.status}`
  })
  await check('Reset tokens are stored only as hashes (no raw token in the DB)', async () => {
    const link = lastResetLink(userB.email)
    const db = await sqlite()
    const row = db.prepare('SELECT token_hash FROM password_reset_tokens WHERE id = ?').get(link.searchParams.get('id'))
    db.close()
    return (row && row.token_hash !== link.searchParams.get('token') && /^[0-9a-f]{64}$/.test(row.token_hash)) || 'raw token stored'
  })
  await check('Two simultaneous resets with one token: exactly one succeeds', async () => {
    await request('/api/auth/forgot-password', { method: 'POST', body: { email: userB.email } })
    const before = mailsTo(userB.email).length
    await waitFor(() => mailsTo(userB.email).length > before)
    const link = lastResetLink(userB.email)
    const body = { token: link.searchParams.get('token'), tokenId: link.searchParams.get('id'), newPassword: 'Racer#Pass12', confirmPassword: 'Racer#Pass12' }
    const results = await Promise.all([1, 2, 3].map(() => request('/api/auth/reset-password', { method: 'POST', body })))
    const ok = results.filter((r) => r.status === 200).length
    if (ok === 1) userB.password = 'Racer#Pass12'
    return ok === 1 || results.map((r) => r.status).join(',')
  })
  await check('Database refuses a second Admin account (unique index)', async () => {
    const db = await sqlite(false)
    let refused = false
    try { db.prepare("UPDATE user_profiles SET role = 'Admin' WHERE user_email = ?").run(userB.email) } catch (e) { refused = /UNIQUE/i.test(String(e.message)) }
    const admins = db.prepare("SELECT COUNT(*) AS n FROM user_profiles WHERE role = 'Admin'").get().n
    db.close()
    return (refused && admins === 1) || `refused=${refused} admins=${admins}`
  })

  // ── Admin password change / recovery / logout ───────────────────────────────
  await check('Admin forgot-password link points to /admin/reset-password', async () => {
    await request('/api/auth/forgot-password', { method: 'POST', body: { email: ADMIN_EMAIL } })
    await waitFor(() => Boolean(lastResetLink(ADMIN_EMAIL)))
    return lastResetLink(ADMIN_EMAIL)?.pathname === '/admin/reset-password'
  })
  await check('Admin reset e-mail is delivered and links to /admin/reset-password', async () =>
    mailsTo(ADMIN_EMAIL).some((m) => /admin/i.test(m.subject) && /\/admin\/reset-password\?token=/.test(m.body.replace(/&amp;/g, '&'))) || JSON.stringify(mailsTo(ADMIN_EMAIL).map((m) => m.subject)))
  await check('Admin new password equal to the current one is rejected', async () => {
    const r = await request('/api/admin/settings/password', { method: 'PUT', token: adminToken, body: { currentPassword: adminPassword, newPassword: adminPassword, confirmPassword: adminPassword } })
    return (r.status === 400 && /different/i.test(r.data.error)) || `${r.status} ${r.data.error}`
  })
  await check('Admin weak new password (no digits) is rejected', async () => {
    const r = await request('/api/admin/settings/password', { method: 'PUT', token: adminToken, body: { currentPassword: adminPassword, newPassword: 'OnlyLettersHere', confirmPassword: 'OnlyLettersHere' } })
    return (r.status === 400 && /letters and digits/i.test(r.data.error)) || `${r.status} ${r.data.error}`
  })
  await check('Admin password change; old password stops working', async () => {
    const next = `Adm-${crypto.randomBytes(9).toString('base64url')}`
    const change = await request('/api/admin/settings/password', { method: 'PUT', token: adminToken, body: { currentPassword: adminPassword, newPassword: next, confirmPassword: next } })
    const old = await request('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: adminPassword } })
    adminPassword = next
    const fresh = await request('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: adminPassword } })
    adminToken = fresh.data.token
    return (change.status === 200 && old.status === 401 && fresh.status === 200) || `${change.status}/${old.status}/${fresh.status}`
  })
  await check('Admin password change sends a confirmation e-mail', async () =>
    (await waitFor(() => mailsTo(ADMIN_EMAIL).some((m) => /changed/i.test(m.subject)))) || JSON.stringify(mailsTo(ADMIN_EMAIL).map((m) => m.subject)))
  await check('Admin recovers access through the e-mailed reset link; sessions are revoked', async () => {
    const before = mailsTo(ADMIN_EMAIL).length
    await request('/api/auth/forgot-password', { method: 'POST', body: { email: ADMIN_EMAIL } })
    await waitFor(() => mailsTo(ADMIN_EMAIL).length > before)
    const link = lastResetLink(ADMIN_EMAIL)
    const next = `Adm-${crypto.randomBytes(9).toString('base64url')}7`
    const reset = await request('/api/auth/reset-password', { method: 'POST', body: { token: link.searchParams.get('token'), tokenId: link.searchParams.get('id'), newPassword: next, confirmPassword: next } })
    const oldSession = await request('/api/admin/stats', { token: adminToken })
    const oldLogin = await request('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: adminPassword } })
    adminPassword = next
    const fresh = await request('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: adminPassword } })
    adminToken = fresh.data.token
    const stats = await request('/api/admin/stats', { token: adminToken })
    return (link.pathname === '/admin/reset-password' && reset.status === 200 && oldSession.status === 401 && oldLogin.status === 401 && fresh.status === 200 && stats.status === 200) || `${reset.status}/${oldSession.status}/${oldLogin.status}/${fresh.status}/${stats.status}`
  })
  await check('Logout revokes the session token', async () => {
    await request('/api/auth/logout', { method: 'POST', token: adminToken })
    return (await request('/api/admin/stats', { token: adminToken })).status === 401
  })

  // ── Error handling ──────────────────────────────────────────────────────────
  await check('Malformed JSON returns JSON 400', async () => {
    const { status, data } = await request('/api/auth/login', { method: 'POST', rawBody: '{bad json' })
    return (status === 400 && typeof data.error === 'string') || status
  })
  await check('Unknown API route returns JSON 404', async () => {
    const { status, data } = await request('/api/does-not-exist')
    return (status === 404 && typeof data.error === 'string') || status
  })

  // ── Account deletion ────────────────────────────────────────────────────────
  await check('Admin deletes a user; their reviews are removed too', async () => {
    const login = await request('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: adminPassword } })
    const token = login.data.token
    await request(`/api/admin/reviews/${reviewId}`, { method: 'PATCH', token, body: { moderationStatus: 'published' } })
    const del = await request(`/api/admin/users/${userA.email}`, { method: 'DELETE', token })
    const reviews = await request('/api/admin/reviews', { token })
    return (del.status === 200 && !reviews.data.reviews.some((r) => r.id === reviewId)) || `${del.status}`
  })

  // ── Abuse protection (kept last: these exhaust the per-IP limits) ───────────
  await check('Password reset requests are rate-limited (429)', async () => {
    const statuses = []
    for (let i = 0; i < 45; i++) statuses.push((await request('/api/auth/forgot-password', { method: 'POST', body: { email: `nobody${i}@example.test` } })).status)
    return statuses.includes(429) || `no 429 in ${[...new Set(statuses)].join(',')}`
  })
  await check('Repeated wrong admin passwords are rate-limited (429)', async () => {
    const statuses = []
    for (let i = 0; i < 20; i++) statuses.push((await request('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: `wrong-${i}` } })).status)
    return statuses.includes(429) || `no 429 in ${[...new Set(statuses)].join(',')}`
  })
} finally {
  server.kill()
  smtp.close()
  await new Promise((r) => setTimeout(r, 300))
  try { fs.rmSync(workDir, { recursive: true, force: true }) } catch { /* temp dir cleanup best-effort */ }
}

function pathToBetterSqlite() {
  return new URL(`file:///${path.join(repoRoot, 'backend', 'node_modules', 'better-sqlite3', 'lib', 'index.js').replace(/\\/g, '/')}`).href
}

const failed = results.filter((r) => !r.passed)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) {
  console.log('\nServer log tail:\n' + serverLog.split('\n').slice(-25).join('\n'))
  process.exit(1)
}
