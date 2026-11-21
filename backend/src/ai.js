// AI Pro assistant. Two providers, chosen by which key is set (server-side only, never sent to the frontend):
//   GEMINI_API_KEY      - Google Gemini (preferred when set)
//   GEMINI_MODEL        - optional, default gemini-3.5-flash; when it is overloaded the fallbacks below are tried
//   GEMINI_BASE_URL     - optional (used by local tests with a mock server)
//   ANTHROPIC_API_KEY   - Claude, used only when GEMINI_API_KEY is not set
//   AI_MODEL            - optional Claude model, default claude-opus-5-5
//   ANTHROPIC_BASE_URL  - optional, read by the Anthropic SDK itself (local tests)
// Without any key the endpoint answers 503 AI_NOT_CONFIGURED.
import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5'
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'
// Tried in this order when the chosen model is overloaded (503), rate-limited (429) or retired (404).
const GEMINI_FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest']
const LANGUAGE_NAMES = { kg: 'Kyrgyz (кыргыз тили)', ru: 'Russian', en: 'English' }

let cachedClient = null
let cachedKey = ''

export function aiConfig() {
  const geminiKey = String(process.env.GEMINI_API_KEY ?? '').trim()
  if (geminiKey) {
    return {
      configured: true,
      provider: 'gemini',
      model: String(process.env.GEMINI_MODEL ?? '').trim() || DEFAULT_GEMINI_MODEL,
      apiKey: geminiKey,
    }
  }
  const apiKey = String(process.env.ANTHROPIC_API_KEY ?? '').trim()
  return {
    configured: Boolean(apiKey),
    provider: apiKey ? 'anthropic' : null,
    model: String(process.env.AI_MODEL ?? '').trim() || DEFAULT_CLAUDE_MODEL,
    apiKey,
  }
}

function getClient(apiKey) {
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 })
    cachedKey = apiKey
  }
  return cachedClient
}

export class AiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

function buildSystemPrompt(language, topic) {
  const lang = LANGUAGE_NAMES[language] ?? LANGUAGE_NAMES.ru
  return [
    'You are the AI Pro tutor of LevelUp, an online IT education platform for students in Kyrgyzstan.',
    `Answer in ${lang}, even if earlier messages in the conversation are in another language. If the language is Kyrgyz, write correct literary Kyrgyz and do not mix in Kazakh words.`,
    'Give a complete, well-structured answer: a short definition, how it works, a practical example, and a tip on what to learn next. Use Markdown headings, lists and fenced code blocks.',
    `The student is currently studying: ${topic}.`,
    'Explain clearly and step by step, at the level of a motivated beginner. Use short code examples in Markdown code blocks when they help.',
    'If the question is unrelated to programming, IT or studying, answer briefly and steer back to learning.',
    'Do not invent facts about the platform (prices, certificates, teachers); say you do not know instead.',
  ].join('\n')
}

async function askClaude({ apiKey, model, system, messages }) {
  const client = getClient(apiKey)
  let response
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system,
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages,
    })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new AiError('AI provider rejected the server credentials.', 503, 'AI_AUTH_FAILED')
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiError('AI assistant is busy. Please try again in a minute.', 429, 'AI_RATE_LIMITED')
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new AiError('AI provider rejected the request.', 502, 'AI_BAD_REQUEST')
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiError('AI provider is temporarily unavailable.', 502, 'AI_PROVIDER_ERROR')
    }
    throw new AiError('AI provider is unreachable.', 502, 'AI_PROVIDER_ERROR')
  }

  if (response.stop_reason === 'refusal') {
    throw new AiError('The assistant cannot answer this question. Please rephrase it.', 422, 'AI_REFUSED')
  }
  const answer = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('').trim()
  return { answer, model: response.model, truncated: response.stop_reason === 'max_tokens' }
}

const GEMINI_BLOCKED = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'RECITATION', 'SPII']

async function askGemini({ apiKey, model, system, messages }) {
  const baseUrl = String(process.env.GEMINI_BASE_URL ?? '').trim().replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com'
  const contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  // Gemini 3+ models think before answering; 'low' keeps answers fast (seconds instead of a minute).
  const bodyFor = (name) => JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { maxOutputTokens: 8192, ...(/^gemini-[12]\./.test(name) ? {} : { thinkingConfig: { thinkingLevel: 'low' } }) },
  })

  const models = [model, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== model)]
  let lastStatus = 0
  const deadline = Date.now() + 100_000
  for (const name of models) {
    const timeLeft = deadline - Date.now()
    if (timeLeft < 5_000) break
    let response
    try {
      response = await fetch(`${baseUrl}/v1beta/models/${encodeURIComponent(name)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: bodyFor(name),
        signal: AbortSignal.timeout(Math.min(45_000, timeLeft)),
      })
    } catch (error) {
      // Timeout or network error on this model: try the next one.
      lastStatus = 0
      // eslint-disable-next-line no-console
      console.warn(`[AI] Gemini ${name} failed: ${error instanceof Error ? error.name : error}`)
      continue
    }
    const data = await response.json().catch(() => ({}))
    if (response.ok) {
      const candidate = data.candidates?.[0]
      if (!candidate && data.promptFeedback?.blockReason) {
        throw new AiError('The assistant cannot answer this question. Please rephrase it.', 422, 'AI_REFUSED')
      }
      const answer = (candidate?.content?.parts ?? []).filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('').trim()
      if (!answer && GEMINI_BLOCKED.includes(candidate?.finishReason)) {
        throw new AiError('The assistant cannot answer this question. Please rephrase it.', 422, 'AI_REFUSED')
      }
      return { answer, model: data.modelVersion || name, truncated: candidate?.finishReason === 'MAX_TOKENS' }
    }
    lastStatus = response.status
    const message = String(data.error?.message ?? '')
    // eslint-disable-next-line no-console
    console.warn(`[AI] Gemini ${name} answered ${response.status}: ${message.slice(0, 200)}`)
    if (response.status === 401 || response.status === 403 || (response.status === 400 && /api key/i.test(message))) {
      throw new AiError('AI provider rejected the server credentials.', 503, 'AI_AUTH_FAILED')
    }
    if (![404, 429, 500, 503].includes(response.status)) {
      throw new AiError('AI provider rejected the request.', 502, 'AI_BAD_REQUEST')
    }
  }
  if (lastStatus === 429) throw new AiError('AI assistant is busy. Please try again in a minute.', 429, 'AI_RATE_LIMITED')
  throw new AiError('AI provider is temporarily unavailable.', 502, 'AI_PROVIDER_ERROR')
}

// history: optional [{role:'user'|'assistant', content:string}] earlier turns of this user's chat (read from the server DB).
export async function askAssistant({ question, topic, language, history = [] }) {
  const { configured, provider, model, apiKey } = aiConfig()
  if (!configured) {
    throw new AiError('AI assistant is not configured on the server (GEMINI_API_KEY is missing).', 503, 'AI_NOT_CONFIGURED')
  }

  const system = buildSystemPrompt(language, topic)
  const messages = [...history, { role: 'user', content: question }]
  const result = provider === 'gemini'
    ? await askGemini({ apiKey, model, system, messages })
    : await askClaude({ apiKey, model, system, messages })

  if (!result.answer) {
    throw new AiError('The AI response was empty. Please try a different question.', 502, 'AI_EMPTY')
  }
  return result
}

// ─── Chat history (per authenticated user, stored server-side) ───────────────
const HISTORY_LIMIT = 200

export function initAiHistory(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      language TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_user ON ai_chat_messages (user_email, id);
  `)
  // id of the prepared question (lets the page show the saved answer in the current site language)
  const columns = new Set(db.prepare('PRAGMA table_info(ai_chat_messages)').all().map((c) => c.name))
  if (!columns.has('question_id')) db.exec('ALTER TABLE ai_chat_messages ADD COLUMN question_id TEXT')
}

export function listAiHistory(db, userEmail, limit = 100) {
  const rows = db.prepare('SELECT id, role, content, language, question_id, created_at FROM ai_chat_messages WHERE user_email = ? ORDER BY id DESC LIMIT ?').all(userEmail, limit)
  return rows.reverse().map((row) => ({ id: String(row.id), role: row.role, text: row.content, language: row.language, questionId: row.question_id ?? null, createdAt: row.created_at }))
}

// Saves one question/answer pair. With replaceLast the previous answer to the same question
// (the one being regenerated) is replaced instead of duplicated.
export function saveAiExchange(db, { userEmail, question, answer, language, questionId = null, replaceLast = false, isSameQuestion = (text) => text === question }) {
  const tx = db.transaction(() => {
    if (replaceLast) {
      const last = db.prepare('SELECT id, role, content FROM ai_chat_messages WHERE user_email = ? ORDER BY id DESC LIMIT 2').all(userEmail)
      if (last.length === 2 && last[0].role === 'assistant' && last[1].role === 'user' && isSameQuestion(last[1].content)) {
        db.prepare('DELETE FROM ai_chat_messages WHERE id IN (?, ?)').run(last[0].id, last[1].id)
      }
    }
    const now = new Date()
    const insert = db.prepare('INSERT INTO ai_chat_messages (user_email, role, content, language, question_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    const q = insert.run(userEmail, 'user', question, language, questionId, now.toISOString())
    const a = insert.run(userEmail, 'assistant', answer, language, questionId, new Date(now.getTime() + 1).toISOString())
    db.prepare(`DELETE FROM ai_chat_messages WHERE user_email = ? AND id NOT IN (
      SELECT id FROM ai_chat_messages WHERE user_email = ? ORDER BY id DESC LIMIT ?)`).run(userEmail, userEmail, HISTORY_LIMIT)
    return { questionId: String(q.lastInsertRowid), answerId: String(a.lastInsertRowid) }
  })
  return tx()
}

export function clearAiHistory(db, userEmail) {
  return db.prepare('DELETE FROM ai_chat_messages WHERE user_email = ?').run(userEmail).changes
}

// Deletes one saved question together with the answer that directly follows it.
export function deleteAiExchange(db, userEmail, questionId) {
  const id = Number(questionId)
  if (!Number.isInteger(id) || id <= 0) return 0
  const question = db.prepare("SELECT id FROM ai_chat_messages WHERE id = ? AND user_email = ? AND role = 'user'").get(id, userEmail)
  if (!question) return 0
  const next = db.prepare('SELECT id, role FROM ai_chat_messages WHERE user_email = ? AND id > ? ORDER BY id ASC LIMIT 1').get(userEmail, id)
  const ids = next && next.role === 'assistant' ? [id, next.id] : [id]
  return db.prepare(`DELETE FROM ai_chat_messages WHERE user_email = ? AND id IN (${ids.map(() => '?').join(',')})`).run(userEmail, ...ids).changes
}
