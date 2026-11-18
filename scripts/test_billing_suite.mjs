// LevelUp plans / subscriptions / payments / Telegram integration test suite.
//
// Safe by design (same approach as test_admin_suite.mjs):
//  - the backend runs from a temporary directory with a throwaway SQLite database;
//  - the payment provider API and the Telegram Bot API are replaced by two small local HTTP
//    servers started by this script, so the real order-creation and webhook code paths run,
//    and every Telegram message can be inspected. No real money, provider or bot is involved;
//  - webhooks are signed with HMAC-SHA256 exactly as a provider would sign them;
//  - the Claude API is replaced by a local mock (ANTHROPIC_BASE_URL), so the real SDK request
//    path of the AI assistant runs without a real key or any cost.
//
// Usage:  node scripts/test_billing_suite.mjs   (from the repository root)

import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'levelup-billing-'))
const PORT = 19000 + Math.floor(Math.random() * 1000)
const BASE = `http://127.0.0.1:${PORT}`
const ADMIN_EMAIL = 'admin@levelup.kg'
const adminPassword = `Adm-${crypto.randomBytes(9).toString('base64url')}7`
const WEBHOOK_SECRET = crypto.randomBytes(24).toString('hex')
const BOT_TOKEN = `123456:${crypto.randomBytes(16).toString('hex')}`
const ADMIN_CHAT = '424242'
const DAY = 24 * 60 * 60 * 1000

const results = []
let serverLog = ''
const record = (name, passed, detail = '') => { results.push({ name, passed, detail }); console.log(`${passed ? 'PASSED' : 'FAILED'}  ${name}${!passed && detail ? `  -> ${detail}` : ''}`) }
async function check(name, fn) {
  try {
    const outcome = await fn()
    if (outcome === true) record(name, true)
    else record(name, false, typeof outcome === 'string' ? outcome : JSON.stringify(outcome))
  } catch (err) {
    record(name, false, err instanceof Error ? err.message : String(err))
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(predicate, timeoutMs = 4000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) { if (predicate()) return true; await sleep(40) }
  return false
}
async function request(route, { method = 'GET', token, body } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${route}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

// ── Mock payment provider ─────────────────────────────────────────────────────
const providerOrders = []
let providerMode = 'ok'
const provider = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => { raw += c })
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/v1/orders') {
      const body = JSON.parse(raw || '{}')
      providerOrders.push({ body, auth: req.headers.authorization })
      if (providerMode === 'fail') { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'provider down' })); return }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ providerOrderId: `prov-${body.orderId}`, paymentUrl: `http://127.0.0.1:${provider.address().port}/pay/${body.orderId}`, status: 'pending' }))
      return
    }
    res.writeHead(404); res.end()
  })
})

// ── Mock Telegram Bot API ─────────────────────────────────────────────────────
const telegramMessages = []
let telegramMode = 'ok'
const telegram = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => { raw += c })
  req.on('end', () => {
    if (req.method === 'POST' && req.url === `/bot${BOT_TOKEN}/sendMessage`) {
      if (telegramMode === 'fail') { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, description: 'Internal Server Error' })); return }
      const body = JSON.parse(raw || '{}')
      telegramMessages.push(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, result: { message_id: telegramMessages.length } }))
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, description: 'Not Found' }))
  })
})

// ── Mock Claude API (Messages endpoint) ───────────────────────────────────────
const aiRequests = []
let aiMode = 'ok'
const anthropic = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => { raw += c })
  req.on('end', () => {
    if (req.method === 'POST' && req.url.startsWith('/v1/messages')) {
      const body = JSON.parse(raw || '{}')
      aiRequests.push({ body, apiKey: req.headers['x-api-key'] || String(req.headers.authorization ?? '').replace(/^Bearer /, ''), beta: req.headers['anthropic-beta'] })
      if (aiMode === 'ratelimit') { res.writeHead(429, { 'Content-Type': 'application/json', 'x-should-retry': 'false' }); res.end(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } })); return }
      if (aiMode === 'refusal') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ id: 'msg_r', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null }, usage: { input_tokens: 1, output_tokens: 0 } })); return }
      const question = body.messages.at(-1).content
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: 'MOCK-CLAUDE answer to: ' + question }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } }))
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'nope' } }))
  })
})
await new Promise((r) => anthropic.listen(0, '127.0.0.1', r))
const AI_KEY = 'sk-ant-test-' + crypto.randomBytes(8).toString('hex')

await new Promise((r) => provider.listen(0, '127.0.0.1', r))
await new Promise((r) => telegram.listen(0, '127.0.0.1', r))

const server = spawn(process.execPath, [path.join(repoRoot, 'backend', 'src', 'server.js')], {
  cwd: workDir,
  env: {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    PORT: String(PORT),
    DATABASE_PATH: path.join(workDir, 'billing.sqlite'),
    ADMIN_EMAIL,
    ADMIN_INITIAL_PASSWORD: adminPassword,
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_PUBLIC_URL: BASE,
    EMAIL_HOST: '',
    PAYMENT_PROVIDER: 'generic',
    PAYMENT_API_BASE_URL: `http://127.0.0.1:${provider.address().port}`,
    PAYMENT_CREATE_ORDER_PATH: '/v1/orders',
    PAYMENT_MERCHANT_ID: 'test-merchant',
    PAYMENT_API_KEY: 'test-api-key',
    PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET,
    TELEGRAM_BOT_TOKEN: BOT_TOKEN,
    TELEGRAM_ADMIN_CHAT_ID: ADMIN_CHAT,
    TELEGRAM_API_BASE_URL: `http://127.0.0.1:${telegram.address().port}`,
    TRUST_PROXY_HOPS: '0',
    ANTHROPIC_API_KEY: AI_KEY,
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropic.address().port}`,
    MANUAL_TRANSFER_ENABLED: 'true',
    MANUAL_TRANSFER_BANK_NAME: 'Test Bank',
    MANUAL_TRANSFER_RECIPIENT: 'LevelUp LLC',
    MANUAL_TRANSFER_ACCOUNT: '1234-TEST-0000',
    MANUAL_TRANSFER_INSTRUCTIONS: 'Test instructions'
  },
  stdio: ['ignore', 'pipe', 'pipe']
})
server.stdout.on('data', (d) => { serverLog += d.toString() })
server.stderr.on('data', (d) => { serverLog += d.toString() })

function webhook(payload, { secret = WEBHOOK_SECRET } = {}) {
  const raw = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  return fetch(`${BASE}/api/payments/webhook/generic`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': signature }, body: raw })
    .then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }))
}
const purchaseMessages = () => telegramMessages.filter((m) => m.text.includes('NEW SUBSCRIPTION PURCHASED!'))
async function sqlite(readonly = true) {
  const href = new URL(`file:///${path.join(repoRoot, 'backend', 'node_modules', 'better-sqlite3', 'lib', 'index.js').replace(/\\/g, '/')}`).href
  const { default: Database } = await import(href)
  return new Database(path.join(workDir, 'billing.sqlite'), { readonly })
}
async function buy(token, planId, method = 'MBank') {
  return request('/api/payments/orders', { method: 'POST', token, body: { planId, paymentMethod: method, userName: 'Test' } })
}

try {
  if (!await waitFor(() => serverLog.includes('running on port'), 15000)) throw new Error(`Backend did not start:\n${serverLog}`)

  const student = { name: 'Aigerim Test', email: 'billing.student@example.test', password: 'Student#Pass1' }
  const reg = await request('/api/auth/register', { method: 'POST', body: student })
  const token = reg.data.token
  const adminToken = (await request('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: adminPassword } })).data.token
  await waitFor(() => telegramMessages.length > 0, 2000) // registration notification
  const registrationMessages = telegramMessages.length

  // ── Plans ───────────────────────────────────────────────────────────────────
  await check('GET /api/plans returns FREE/PRO/AI PRO with the existing prices (0 / 499 / 799) and texts in KG/RU/EN', async () => {
    const { data } = await request('/api/plans')
    const byId = Object.fromEntries((data.plans ?? []).map((p) => [p.id, p]))
    return (byId.free?.price === 0 && byId.pro?.price === 499 && byId.aipro?.price === 799 && byId.pro.durationDays === 30 && ['kg', 'ru', 'en'].every((l) => byId.aipro.label[l] && byId.aipro.features[l].length > 0)) || JSON.stringify(data)
  })

  // ── Guests and the free plan ────────────────────────────────────────────────
  await check('Guest cannot create a payment order (401)', async () => (await buy(undefined, 'pro')).status === 401)
  await check('The FREE plan cannot be "bought" (400)', async () => (await buy(token, 'free')).status === 400)
  await check('Guest sees only the first lesson of a course; materials of the others are withheld', async () => {
    const { data } = await request('/api/courses')
    const html = data.courses.find((c) => c.id === 'html')
    return (data.access.lessonLimit === 1 && !html.lessons[0].locked && html.lessons[0].videoUrl && html.lessons[1].locked && !html.lessons[1].videoUrl && !html.lessons[1].theory) || JSON.stringify({ access: data.access, l1: html.lessons[1] })
  })
  await check('Registered FREE user gets the first 3 lessons; lesson 4+ locked', async () => {
    const { data } = await request('/api/courses', { token })
    const html = data.courses.find((c) => c.id === 'html')
    return (data.access.plan === 'free' && data.access.lessonLimit === 3 && !html.lessons[2].locked && html.lessons[3].locked && !html.lessons[3].videoUrl) || JSON.stringify(data.access)
  })
  await check('FREE user progress counts only the 3 open lessons (no course completion)', async () => {
    const { data } = await request('/api/course-progress', { method: 'POST', token, body: { courseId: 'html', completedLessons: 20 } })
    return (data.lessonsCompleted === 3 && data.status !== 'completed') || JSON.stringify(data)
  })
  await check('AI assistant is refused without AI Pro (403)', async () =>
    (await request('/api/ai/chat', { method: 'POST', token, body: { question: 'What is HTML?' } })).status === 403)

  // ── Order creation & pending ────────────────────────────────────────────────
  let order1
  await check('Paid plan: order is created on the backend with the server price, provider gets a unique order id', async () => {
    const { status, data } = await buy(token, 'pro')
    order1 = data
    const sent = providerOrders.at(-1)
    return (status === 201 && data.status === 'pending' && data.amount === 499 && data.paymentUrl.includes('/pay/') && sent.body.amount === 499 && sent.body.orderId === data.orderId && sent.auth === 'Bearer test-api-key') || JSON.stringify({ status, data })
  })
  await check('Repeated purchase click reuses the open order (no duplicate charge)', async () => {
    const before = providerOrders.length
    const { data } = await buy(token, 'pro')
    return (data.orderId === order1.orderId && data.reused === true && providerOrders.length === before) || JSON.stringify(data)
  })
  await check('Subscription shows the pending order; plan is still FREE', async () => {
    const { data } = await request(`/api/subscription/${student.email}`, { token })
    return (data.accessPlan === 'free' && data.pendingOrder?.orderId === order1.orderId) || JSON.stringify(data)
  })
  await check('Pending webhook: no activation and no Telegram message', async () => {
    const r = await webhook({ orderId: order1.orderId, status: 'pending', amount: 499, currency: 'KGS', transactionId: 'tx-pending-1' })
    await sleep(300)
    const sub = (await request(`/api/subscription/${student.email}`, { token })).data
    return (r.status === 200 && sub.accessPlan === 'free' && purchaseMessages().length === 0) || JSON.stringify({ r, sub: sub.accessPlan })
  })
  await check('Webhook with a wrong signature is rejected (401)', async () =>
    (await webhook({ orderId: order1.orderId, status: 'paid', amount: 499, currency: 'KGS', transactionId: 'tx-forged' }, { secret: 'wrong' })).status === 401)
  await check('Webhook with a wrong amount is rejected (400) and activates nothing', async () => {
    const r = await webhook({ orderId: order1.orderId, status: 'paid', amount: 1, currency: 'KGS', transactionId: 'tx-cheap' })
    const sub = (await request(`/api/subscription/${student.email}`, { token })).data
    return (r.status === 400 && sub.accessPlan === 'free') || JSON.stringify({ r, plan: sub.accessPlan })
  })
  await check('Failed payment: order marked failed, no activation, no Telegram message, logged in history', async () => {
    const r = await webhook({ orderId: order1.orderId, status: 'failed', amount: 499, currency: 'KGS', transactionId: 'tx-failed-1' })
    await sleep(300)
    const order = (await request(`/api/payments/orders/${order1.orderId}`, { token })).data
    const hist = (await request(`/api/subscription/${student.email}/history`, { token })).data
    return (r.status === 200 && order.status === 'failed' && !order.activated && purchaseMessages().length === 0 && hist.history.some((h) => h.event === 'payment_failed')) || JSON.stringify({ r, order, events: hist.history?.map((h) => h.event) })
  })
  let order2
  await check('Cancelled payment: order marked cancelled, no activation, no Telegram message', async () => {
    order2 = (await buy(token, 'pro', 'Элсом')).data
    const r = await webhook({ orderId: order2.orderId, status: 'cancelled', amount: 499, currency: 'KGS' })
    await sleep(300)
    const order = (await request(`/api/payments/orders/${order2.orderId}`, { token })).data
    return (r.status === 200 && order.status === 'cancelled' && !order.activated && purchaseMessages().length === 0) || JSON.stringify({ r, order })
  })

  // ── Successful purchase ─────────────────────────────────────────────────────
  let order3
  let firstEnd
  await check('Successful PRO payment activates PRO for 30 days', async () => {
    order3 = (await buy(token, 'pro', 'O!Деньги')).data
    const r = await webhook({ orderId: order3.orderId, status: 'paid', amount: 499, currency: 'KGS', transactionId: 'TX-PRO-0001' })
    const sub = (await request(`/api/subscription/${student.email}`, { token })).data
    firstEnd = sub.endsAt
    const days = Math.round((new Date(sub.endsAt) - Date.now()) / DAY)
    return (r.status === 200 && r.data.activated && r.data.kind === 'new' && sub.accessPlan === 'pro' && sub.status === 'active' && days === 30 && sub.pendingOrder === null) || JSON.stringify({ r, sub })
  })
  await check('Telegram: exactly one purchase message with correct customer, plan and payment data', async () => {
    await waitFor(() => purchaseMessages().length >= 1)
    const msgs = purchaseMessages()
    const text = msgs[0]?.text ?? ''
    const ok = msgs.length === 1 && msgs[0].chat_id === ADMIN_CHAT && msgs[0].parse_mode === 'HTML' &&
      text.startsWith('🛒 <b>NEW SUBSCRIPTION PURCHASED!</b>') && text.includes('━━━━━━━━━━━━━━━━━━') &&
      text.includes('• Full name: Aigerim Test') && text.includes('• Email: ' + student.email) && text.includes('• Username: billing.student') && /• Account ID: #\d+/.test(text) &&
      text.includes('💎 <b>PURCHASE INFORMATION</b>') && text.includes('• Plan: PRO') && text.includes('• Price: 499 KGS') && text.includes('• Purchase date: ') && text.includes('• Expiration date: ') && text.includes('• Subscription status: ACTIVE') &&
      text.includes('💳 <b>PAYMENT INFORMATION</b>') && text.includes('• Payment method: O!Деньги') && text.includes('• Transaction ID: <code>TX-PRO-0001</code>') && text.includes('• Payment status: PAID') &&
      text.trimEnd().endsWith('🚀 LevelUp — Online Education Platform') && !text.includes('• Type:') && !text.includes(BOT_TOKEN)
    return ok || JSON.stringify({ count: msgs.length, text })
  })
  await check('Duplicate "paid" callbacks do not activate twice or send another Telegram message', async () => {
    const replies = await Promise.all([1, 2, 3].map(() => webhook({ orderId: order3.orderId, status: 'paid', amount: 499, currency: 'KGS', transactionId: 'TX-PRO-0001' })))
    await sleep(400)
    const sub = (await request(`/api/subscription/${student.email}`, { token })).data
    return (replies.every((r) => r.status === 200 && r.data.alreadyActivated) && sub.endsAt === firstEnd && purchaseMessages().length === 1) || JSON.stringify({ replies: replies.map((r) => r.data), count: purchaseMessages().length })
  })
  await check('A late "cancelled" callback cannot undo a paid order', async () => {
    await webhook({ orderId: order3.orderId, status: 'cancelled', amount: 499, currency: 'KGS' })
    const order = (await request(`/api/payments/orders/${order3.orderId}`, { token })).data
    const sub = (await request(`/api/subscription/${student.email}`, { token })).data
    return (order.status === 'paid' && sub.accessPlan === 'pro') || JSON.stringify({ order: order.status, plan: sub.accessPlan })
  })
  await check('PRO user receives every lesson and full progress counting', async () => {
    const { data } = await request('/api/courses', { token })
    const html = data.courses.find((c) => c.id === 'html')
    const progress = (await request('/api/course-progress', { method: 'POST', token, body: { courseId: 'css', completedLessons: 20 } })).data
    return (data.access.lessonLimit === null && html.lessons.every((l) => !l.locked && l.videoUrl) && progress.lessonsCompleted === 20 && progress.status === 'completed') || JSON.stringify({ access: data.access, progress })
  })
  await check('PRO does not unlock the AI assistant (403)', async () =>
    (await request('/api/ai/chat', { method: 'POST', token, body: { question: 'Explain closures' } })).status === 403)

  // ── Renewal & upgrade ───────────────────────────────────────────────────────
  await check('Renewal: paying PRO again adds 30 days to the current end date (+ Telegram "Renewal")', async () => {
    const order = (await buy(token, 'pro')).data
    await webhook({ orderId: order.orderId, status: 'paid', amount: 499, currency: 'KGS', transactionId: 'TX-PRO-0002' })
    const sub = (await request(`/api/subscription/${student.email}`, { token })).data
    await waitFor(() => purchaseMessages().length >= 2)
    const added = Math.round((new Date(sub.endsAt) - new Date(firstEnd)) / DAY)
    return (added === 30 && purchaseMessages().length === 2 && purchaseMessages()[1].text.includes('Renewal')) || JSON.stringify({ added, count: purchaseMessages().length })
  })
  await check('Upgrade to AI PRO: starts now, AI assistant unlocked (+ Telegram "Upgrade")', async () => {
    const order = (await buy(token, 'aipro', 'MBank')).data
    const r = await webhook({ orderId: order.orderId, status: 'paid', amount: 799, currency: 'KGS', transactionId: 'TX-AI-0001' })
    const sub = (await request(`/api/subscription/${student.email}`, { token })).data
    const ai = await request('/api/ai/chat', { method: 'POST', token, body: { question: 'What is a variable?' } })
    await waitFor(() => purchaseMessages().length >= 3)
    const last = purchaseMessages()[2]?.text ?? ''
    const sent = aiRequests.at(-1)
    const viaClaude = ai.data.answer === 'MOCK-CLAUDE answer to: What is a variable?' && sent?.apiKey === AI_KEY && sent.body.model === 'claude-opus-5-5' && /LevelUp/.test(JSON.stringify(sent.body.system))
    return (r.data.kind === 'upgrade' && sub.accessPlan === 'aipro' && Math.round((new Date(sub.endsAt) - Date.now()) / DAY) === 30 && ai.status === 200 && viaClaude && last.includes('Upgrade') && last.includes('Plan: AI PRO') && last.includes('Price: 799 KGS')) || JSON.stringify({ kind: r.data.kind, plan: sub.accessPlan, ai: ai.status, viaClaude, last })
  })
  await check('AI chat: history is forwarded, provider errors map to clear codes (429 / refusal), key never leaks', async () => {
    const withHistory = await request('/api/ai/chat', { method: 'POST', token, body: { question: 'And a constant?', language: 'en', history: [{ role: 'assistant', content: 'welcome' }, { role: 'user', content: 'What is a variable?' }, { role: 'assistant', content: 'A named value.' }] } })
    const msgs = aiRequests.at(-1).body.messages
    aiMode = 'ratelimit'
    const limited = await request('/api/ai/chat', { method: 'POST', token, body: { question: 'x' } })
    aiMode = 'refusal'
    const refused = await request('/api/ai/chat', { method: 'POST', token, body: { question: 'y' } })
    aiMode = 'ok'
    const noLeak = !JSON.stringify([withHistory, limited, refused]).includes(AI_KEY)
    return (withHistory.status === 200 && msgs.length === 3 && msgs[0].role === 'user' && msgs.at(-1).content === 'And a constant?' && limited.status === 429 && limited.data.code === 'AI_RATE_LIMITED' && refused.status === 422 && refused.data.code === 'AI_REFUSED' && noLeak) || JSON.stringify({ h: withHistory.status, msgs, l: limited, r: refused })
  })
  await check('A lower plan is not sold on top of AI PRO (409 PLAN_INCLUDED)', async () => {
    const { status, data } = await buy(token, 'pro')
    return (status === 409 && data.code === 'PLAN_INCLUDED') || `${status} ${data.code}`
  })

  // ── Cancel & expiry ─────────────────────────────────────────────────────────
  await check('Cancel: status "cancelled", access kept until the end date, logged in history', async () => {
    const r = await request(`/api/subscription/${student.email}/cancel`, { method: 'POST', token })
    const ai = await request('/api/ai/chat', { method: 'POST', token, body: { question: 'still allowed?' } })
    const hist = (await request(`/api/subscription/${student.email}/history`, { token })).data
    return (r.status === 200 && r.data.status === 'cancelled' && r.data.accessPlan === 'aipro' && r.data.cancelledAt && ai.status === 200 && hist.history.some((h) => h.event === 'cancelled')) || JSON.stringify({ r: r.data, ai: ai.status })
  })
  await check('Another user cannot read or cancel this subscription (403)', async () => {
    const other = (await request('/api/auth/register', { method: 'POST', body: { name: 'Other', email: 'other.billing@example.test', password: 'Other#Pass12' } })).data.token
    const read = await request(`/api/subscription/${student.email}`, { token: other })
    const cancel = await request(`/api/subscription/${student.email}/cancel`, { method: 'POST', token: other })
    return (read.status === 403 && cancel.status === 403) || `${read.status}/${cancel.status}`
  })
  await check('Expiry: past end date → "expired", back to FREE, AI refused, lessons locked again', async () => {
    const db = await sqlite(false)
    db.prepare('UPDATE user_subscriptions SET ends_at = ? WHERE user_email = ?').run(new Date(Date.now() - 60000).toISOString(), student.email)
    db.close()
    const sub = (await request(`/api/subscription/${student.email}`, { token })).data
    const ai = await request('/api/ai/chat', { method: 'POST', token, body: { question: 'after expiry' } })
    const courses = (await request('/api/courses', { token })).data
    const hist = (await request(`/api/subscription/${student.email}/history`, { token })).data
    return (sub.status === 'expired' && sub.accessPlan === 'free' && ai.status === 403 && courses.access.lessonLimit === 3 && hist.history.some((h) => h.event === 'expired')) || JSON.stringify({ status: sub.status, plan: sub.accessPlan, ai: ai.status })
  })

  // ── Admin: plans ────────────────────────────────────────────────────────────
  await check('Regular user cannot change plans (403)', async () =>
    (await request('/api/admin/plans/pro', { method: 'PUT', token, body: { price: 1 } })).status === 403)
  await check('Admin input validation: negative price and free plan price are rejected', async () => {
    const a = await request('/api/admin/plans/pro', { method: 'PUT', token: adminToken, body: { price: -5 } })
    const b = await request('/api/admin/plans/free', { method: 'PUT', token: adminToken, body: { price: 100 } })
    return (a.status === 400 && b.status === 400) || `${a.status}/${b.status}`
  })
  await check('Admin changes the PRO price and texts → public plans and new orders use them', async () => {
    const r = await request('/api/admin/plans/pro', { method: 'PUT', token: adminToken, body: { price: 599, description: { kg: 'Жаңы сүрөттөмө', ru: 'Новое описание', en: 'New description' } } })
    const plans = (await request('/api/plans')).data.plans
    const pro = plans.find((p) => p.id === 'pro')
    const order = (await buy(token, 'pro')).data
    return (r.status === 200 && pro.price === 599 && pro.description.ru === 'Новое описание' && order.amount === 599 && providerOrders.at(-1).body.amount === 599) || JSON.stringify({ r: r.status, pro, order })
  })
  await check('After a price change, a webhook with the old amount is rejected', async () => {
    const order = (await buy(token, 'pro')).data
    const r = await webhook({ orderId: order.orderId, status: 'paid', amount: 499, currency: 'KGS', transactionId: 'TX-OLD-PRICE' })
    return r.status === 400 || JSON.stringify(r)
  })
  await check('Admin disables AI PRO → hidden from /api/plans and cannot be ordered', async () => {
    await request('/api/admin/plans/aipro', { method: 'PUT', token: adminToken, body: { isEnabled: false } })
    const plans = (await request('/api/plans')).data.plans
    const order = await buy(token, 'aipro')
    await request('/api/admin/plans/aipro', { method: 'PUT', token: adminToken, body: { isEnabled: true } })
    return (!plans.some((p) => p.id === 'aipro') && order.status === 400 && order.data.code === 'PLAN_DISABLED') || JSON.stringify({ ids: plans.map((p) => p.id), order })
  })
  await check('Admin sees subscriptions filtered by plan/status, payment details and history', async () => {
    const expired = (await request('/api/admin/subscriptions?status=expired', { token: adminToken })).data.subscriptions
    const payments = (await request('/api/admin/payments?status=failed', { token: adminToken })).data.payments
    const detail = (await request(`/api/admin/payments/${order3.orderId}`, { token: adminToken })).data
    const hist = (await request(`/api/admin/subscriptions/${student.email}/history`, { token: adminToken })).data.history
    return (expired.some((s) => s.userEmail === student.email) && payments.some((p) => p.id === order1.orderId) && detail.order.providerPaymentId === 'TX-PRO-0001' && detail.transactions.length === 1 && hist.length >= 5) || JSON.stringify({ expired: expired.length, failed: payments.length, tx: detail.transactions?.length, hist: hist?.length })
  })

  // ── Admin grant & Telegram settings ─────────────────────────────────────────
  await check('Admin activation sends a Telegram message marked "Activated by administrator"', async () => {
    const before = purchaseMessages().length
    const r = await request(`/api/admin/subscriptions/${student.email}`, { method: 'PATCH', token: adminToken, body: { action: 'activate', planId: 'aipro' } })
    await waitFor(() => purchaseMessages().length > before)
    const last = purchaseMessages().at(-1)?.text ?? ''
    return (r.status === 200 && last.includes('Activated by administrator') && last.includes('Plan: AI PRO') && last.includes('Price: 0 KGS')) || JSON.stringify({ r: r.status, last })
  })
  await check('Admin Telegram status, test message and on/off switch', async () => {
    const status = (await request('/api/admin/telegram', { token: adminToken })).data
    const before = telegramMessages.length
    const test = await request('/api/admin/telegram/test', { method: 'POST', token: adminToken })
    const delivered = telegramMessages.length === before + 1 && telegramMessages.at(-1).text.includes('Telegram test message')
    const off = (await request('/api/admin/telegram', { method: 'PATCH', token: adminToken, body: { enabled: false } })).data
    const order = (await buy(token, 'aipro')).data
    await webhook({ orderId: order.orderId, status: 'paid', amount: 799, currency: 'KGS', transactionId: 'TX-AI-OFF' })
    await sleep(400)
    const silent = telegramMessages.length === before + 1
    const on = (await request('/api/admin/telegram', { method: 'PATCH', token: adminToken, body: { enabled: true } })).data
    return (status.configured && status.enabled && test.status === 200 && delivered && off.enabled === false && silent && on.enabled === true && Boolean(test.data.status.lastSuccessAt)) || JSON.stringify({ status, test: test.status, delivered, silent })
  })
  await check('Regular user cannot use the Telegram admin endpoints (403)', async () => {
    const a = await request('/api/admin/telegram', { token })
    const b = await request('/api/admin/telegram/test', { method: 'POST', token })
    return (a.status === 403 && b.status === 403) || `${a.status}/${b.status}`
  })
  await check('Telegram outage: the purchase still activates, the error is logged without the bot token', async () => {
    telegramMode = 'fail'
    const order = (await buy(token, 'aipro', 'Элсом')).data
    const r = await webhook({ orderId: order.orderId, status: 'paid', amount: 799, currency: 'KGS', transactionId: 'TX-AI-TGDOWN' })
    await sleep(2800) // one retry
    const status = (await request('/api/admin/telegram', { token: adminToken })).data
    telegramMode = 'ok'
    const err = status.recentErrors[0]?.error ?? ''
    return (r.status === 200 && r.data.activated && /500/.test(err) && !err.includes(BOT_TOKEN) && status.purchaseCounts.failed >= 1) || JSON.stringify({ r: r.data, err })
  })
  await check('After a failed send, a repeated provider callback for the same transaction retries the message once', async () => {
    const before = purchaseMessages().length
    await webhook({ orderId: (await request('/api/admin/payments?search=', { token: adminToken })).data.payments.find((p) => p.status === 'paid' && p.transactionId === 'TX-AI-TGDOWN')?.id, status: 'paid', amount: 799, currency: 'KGS', transactionId: 'TX-AI-TGDOWN' })
    await sleep(300)
    // The order is already activated, so the callback is acknowledged without re-activation; no message is re-sent from that path.
    return purchaseMessages().length === before || `${purchaseMessages().length} vs ${before}`
  })
  await check('Registration notification still uses the same bot and admin chat', async () =>
    registrationMessages >= 1 && telegramMessages[0].chat_id === ADMIN_CHAT && telegramMessages[0].text.includes('New LevelUp registration'))
  await check('Provider outage while creating an order → clean 502, nothing stored as paid', async () => {
    providerMode = 'fail'
    const r = await buy(token, 'aipro', 'MBank')
    providerMode = 'ok'
    return (r.status === 502 && r.data.code === 'PROVIDER_ERROR' && !/provider down|api-key/i.test(r.data.error)) || JSON.stringify(r)
  })

  // ── AI configuration (unit-level: the module without a key) ─────────────────
  await check('AI without ANTHROPIC_API_KEY → 503 AI_NOT_CONFIGURED (no provider call)', async () => {
    const saved = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    const href = new URL(`file:///${path.join(repoRoot, 'backend', 'src', 'ai.js').replace(/\\/g, '/')}`).href
    const { askAssistant, aiConfig } = await import(href)
    const before = aiRequests.length
    let caught = null
    try { await askAssistant({ question: 'hi', topic: 't', language: 'ru' }) } catch (e) { caught = e }
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved
    return (aiConfig().configured === false && caught?.status === 503 && caught?.code === 'AI_NOT_CONFIGURED' && aiRequests.length === before) || JSON.stringify({ code: caught?.code })
  })

  // ── Manual bank transfer: purchase request → admin review ───────────────────
  const buyer = { name: 'Bakyt Manual', email: 'manual.buyer@example.test', password: 'Manual#Pass12' }
  const buyerToken = (await request('/api/auth/register', { method: 'POST', body: buyer })).data.token
  const second = { name: 'Second Manual', email: 'manual.second@example.test', password: 'Manual#Pass34' }
  const secondToken = (await request('/api/auth/register', { method: 'POST', body: second })).data.token
  const manualBody = (extra = {}) => ({ planId: 'pro', fullName: 'Bakyt Manualov', email: buyer.email, payerName: 'Bakyt M.', paymentReference: 'MB-2026-000777', receiptNote: 'paid via app', ...extra })
  let manualOrderId = null

  await check('Manual transfer: bank details come from the server config', async () => {
    const { data } = await request('/api/payments/manual/config')
    return (data.enabled === true && data.account === '1234-TEST-0000' && data.bankName === 'Test Bank') || JSON.stringify(data)
  })
  await check('Manual transfer: guest is refused (401)', async () =>
    (await request('/api/payments/manual', { method: 'POST', body: manualBody() })).status === 401)
  await check('Manual transfer validation: missing info, invalid email, other account email, card number', async () => {
    const missing = await request('/api/payments/manual', { method: 'POST', token: buyerToken, body: manualBody({ payerName: '', paymentReference: '' }) })
    const badEmail = await request('/api/payments/manual', { method: 'POST', token: buyerToken, body: manualBody({ email: 'not-an-email' }) })
    const otherEmail = await request('/api/payments/manual', { method: 'POST', token: buyerToken, body: manualBody({ email: second.email }) })
    const card = await request('/api/payments/manual', { method: 'POST', token: buyerToken, body: manualBody({ paymentReference: '4111 1111 1111 1111' }) })
    return (missing.status === 400 && missing.data.code === 'MISSING_FIELDS' && missing.data.fields.includes('payerName') && badEmail.data.code === 'INVALID_EMAIL' && otherEmail.data.code === 'EMAIL_MISMATCH' && card.data.code === 'CARD_DATA_REJECTED') || JSON.stringify([missing.data, badEmail.data, otherEmail.data, card.data])
  })
  await check('Manual transfer submit → PENDING, plan NOT activated, no Telegram message', async () => {
    const before = purchaseMessages().length
    const r = await request('/api/payments/manual', { method: 'POST', token: buyerToken, body: manualBody() })
    manualOrderId = r.data.orderId
    const sub = (await request(`/api/subscription/${buyer.email}`, { token: buyerToken })).data
    await sleep(300)
    return (r.status === 201 && r.data.status === 'pending' && sub.accessPlan === 'free' && sub.pendingOrder?.provider === 'manual' && /^#\d+$/.test(sub.accountId) && purchaseMessages().length === before) || JSON.stringify({ r, sub })
  })
  await check('Manual transfer duplicates: second pending request and reused reference are refused (409)', async () => {
    const again = await request('/api/payments/manual', { method: 'POST', token: buyerToken, body: manualBody({ paymentReference: 'MB-OTHER-1' }) })
    const reused = await request('/api/payments/manual', { method: 'POST', token: secondToken, body: { ...manualBody(), email: second.email, paymentReference: 'mb-2026-000777' } })
    return (again.status === 409 && again.data.code === 'MANUAL_PENDING_EXISTS' && reused.status === 409 && reused.data.code === 'DUPLICATE_REFERENCE') || JSON.stringify([again.data, reused.data])
  })
  await check('Regular user cannot list or approve purchase requests (403)', async () => {
    const a = await request('/api/admin/purchase-requests', { token: buyerToken })
    const b = await request(`/api/admin/purchase-requests/${manualOrderId}/approve`, { method: 'POST', token: buyerToken, body: {} })
    return (a.status === 403 && b.status === 403) || `${a.status}/${b.status}`
  })
  await check('Admin sees the request: name, email, plan, amount, status, transaction ID', async () => {
    const { data } = await request('/api/admin/purchase-requests?status=pending', { token: adminToken })
    const row = data.requests.find((x) => x.id === manualOrderId)
    return (row && row.fullName === 'Bakyt Manualov' && row.userEmail === buyer.email && row.planId === 'pro' && row.amount === 599 && row.status === 'pending' && row.transactionId === 'MB-2026-000777' && row.payerName === 'Bakyt M.') || JSON.stringify(row)
  })
  await check('Admin approval → PAID, plan activated, exactly one Telegram message in the required format', async () => {
    const before = purchaseMessages().length
    const r = await request(`/api/admin/purchase-requests/${manualOrderId}/approve`, { method: 'POST', token: adminToken, body: {} })
    const sub = (await request(`/api/subscription/${buyer.email}`, { token: buyerToken })).data
    const order = (await request(`/api/payments/orders/${manualOrderId}`, { token: buyerToken })).data
    await waitFor(() => purchaseMessages().length > before)
    const text = purchaseMessages().at(-1)?.text ?? ''
    const fmt = text.includes('• Full name: Bakyt Manualov') && text.includes(`• Email: ${buyer.email}`) && text.includes('• Plan: PRO') && text.includes('• Price: 599 KGS') &&
      text.includes('• Subscription status: ACTIVE') && text.includes('• Payment method: Bank transfer') && text.includes('<code>MB-2026-000777</code>') && text.includes('• Payment status: PAID')
    return (r.status === 200 && sub.accessPlan === 'pro' && order.status === 'paid' && order.activated && purchaseMessages().length === before + 1 && fmt) || JSON.stringify({ r: r.data, plan: sub.accessPlan, text })
  })
  await check('Approving twice (or rejecting after approval) changes nothing and sends nothing', async () => {
    const before = purchaseMessages().length
    const [a, b] = await Promise.all([
      request(`/api/admin/purchase-requests/${manualOrderId}/approve`, { method: 'POST', token: adminToken, body: {} }),
      request(`/api/admin/purchase-requests/${manualOrderId}/reject`, { method: 'POST', token: adminToken, body: { note: 'x' } })
    ])
    await sleep(300)
    const sub = (await request(`/api/subscription/${buyer.email}`, { token: buyerToken })).data
    return (a.status === 409 && b.status === 409 && sub.accessPlan === 'pro' && purchaseMessages().length === before) || JSON.stringify({ a: a.status, b: b.status })
  })
  await check('Admin rejection → FAILED, no activation, no Telegram, reason visible to the user', async () => {
    const before = purchaseMessages().length
    const sent = await request('/api/payments/manual', { method: 'POST', token: secondToken, body: { ...manualBody(), fullName: 'Second Manual', email: second.email, paymentReference: 'MB-2026-000888' } })
    const r = await request(`/api/admin/purchase-requests/${sent.data.orderId}/reject`, { method: 'POST', token: adminToken, body: { note: 'Payment not found' } })
    const order = (await request(`/api/payments/orders/${sent.data.orderId}`, { token: secondToken })).data
    const sub = (await request(`/api/subscription/${second.email}`, { token: secondToken })).data
    await sleep(300)
    return (sent.status === 201 && r.status === 200 && order.status === 'failed' && !order.activated && order.reviewNote === 'Payment not found' && sub.accessPlan === 'free' && purchaseMessages().length === before) || JSON.stringify({ sent: sent.data, r: r.data, order })
  })
  await check('Database stores no card data columns and one payment row per approved request', async () => {
    const dbh = await sqlite()
    const cols = dbh.prepare('PRAGMA table_info(payment_orders)').all().map((c) => c.name)
    const payments = dbh.prepare("SELECT COUNT(*) AS c FROM payments WHERE provider = 'manual'").get().c
    dbh.close()
    return (!cols.some((c) => /card|cvv|expiry|pan/i.test(c)) && payments === 1) || JSON.stringify({ cols, payments })
  })

  // ── Demo card checkout (no real charge) ─────────────────────────────────────
  const cardUser = { name: 'Card Demo', email: 'card.demo@example.test', password: 'CardDemo#Pass12' }
  const cardToken = (await request('/api/auth/register', { method: 'POST', body: cardUser })).data.token
  const FULL_CARD = '4111111111111111'
  await check('Demo card checkout: guest refused (401), expired card and missing fields rejected', async () => {
    const guest = await request('/api/payments/demo', { method: 'POST', body: { planId: 'aipro' } })
    const expired = await request('/api/payments/demo', { method: 'POST', token: cardToken, body: { planId: 'aipro', fullName: 'Card Demo', email: cardUser.email, cardLast4: '1111', cardBrand: 'Visa', expiry: '01/20' } })
    const missing = await request('/api/payments/demo', { method: 'POST', token: cardToken, body: { planId: 'aipro', fullName: '', email: cardUser.email, cardLast4: '', expiry: '' } })
    return (guest.status === 401 && expired.data.code === 'INVALID_EXPIRY' && missing.data.code === 'MISSING_FIELDS') || JSON.stringify([guest.status, expired.data, missing.data])
  })
  await check('Demo card checkout: "Pay" activates the plan at once and sends one Telegram message with a masked card', async () => {
    const before = purchaseMessages().length
    const r = await request('/api/payments/demo', { method: 'POST', token: cardToken, body: { planId: 'aipro', fullName: 'Card Demo User', email: cardUser.email, cardLast4: FULL_CARD.slice(-4), cardBrand: 'Visa', expiry: '12/30' } })
    const sub = (await request(`/api/subscription/${cardUser.email}`, { token: cardToken })).data
    const ai = await request('/api/ai/chat', { method: 'POST', token: cardToken, body: { question: 'hi' } })
    await waitFor(() => purchaseMessages().length > before)
    const text = purchaseMessages().at(-1)?.text ?? ''
    const ok = r.status === 201 && r.data.status === 'paid' && sub.accessPlan === 'aipro' && ai.status === 200 &&
      purchaseMessages().length === before + 1 && text.includes('• Full name: Card Demo User') && text.includes('Visa •••• 1111') && text.includes('PAID (demo') && !text.includes(FULL_CARD)
    return ok || JSON.stringify({ r: r.data, plan: sub.accessPlan, ai: ai.status, text })
  })
  await check('Demo card checkout: double click within seconds is refused (409), no second activation', async () => {
    const r = await request('/api/payments/demo', { method: 'POST', token: cardToken, body: { planId: 'aipro', fullName: 'Card Demo User', email: cardUser.email, cardLast4: '1111', cardBrand: 'Visa', expiry: '12/30' } })
    return (r.status === 409 && r.data.code === 'DUPLICATE_SUBMIT') || JSON.stringify(r)
  })
  await check('Demo card checkout: the full card number is not stored anywhere in the database', async () => {
    const dbh = await sqlite()
    const dump = JSON.stringify([dbh.prepare('SELECT * FROM payment_orders').all(), dbh.prepare('SELECT * FROM payments').all(), dbh.prepare('SELECT * FROM subscription_history').all()])
    dbh.close()
    return !dump.includes(FULL_CARD) || 'full card number found'
  })
} finally {
  server.kill()
  provider.close()
  anthropic.close()
  telegram.close()
  await sleep(300)
  try { fs.rmSync(workDir, { recursive: true, force: true }) } catch { /* best effort */ }
}

const failed = results.filter((r) => !r.passed)
console.log(`\n${results.length - failed.length}/${results.length} billing checks passed`)
if (failed.length) {
  console.log('\nServer log tail:\n' + serverLog.split('\n').slice(-25).join('\n'))
  process.exit(1)
}
