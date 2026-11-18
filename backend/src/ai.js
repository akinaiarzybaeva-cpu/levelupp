// AI Pro assistant backed by the Claude API (official Anthropic SDK).
// Configuration (server-side only, never exposed to the frontend):
//   ANTHROPIC_API_KEY   - required; without it the endpoint answers 503 AI_NOT_CONFIGURED
//   AI_MODEL            - optional, defaults to claude-opus-5-5
//   ANTHROPIC_BASE_URL  - optional, read by the SDK itself (used by local tests with a mock server)
import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_MODEL = 'claude-opus-5-5'
const LANGUAGE_NAMES = { kg: 'Kyrgyz (кыргыз тили)', ru: 'Russian', en: 'English' }

let cachedClient = null
let cachedKey = ''

export function aiConfig() {
  const apiKey = String(process.env.ANTHROPIC_API_KEY ?? '').trim()
  return {
    configured: Boolean(apiKey),
    model: String(process.env.AI_MODEL ?? '').trim() || DEFAULT_MODEL,
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
    `Answer in ${lang}. If the language is Kyrgyz, write correct literary Kyrgyz and do not mix in Kazakh words.`,
    `The student is currently studying: ${topic}.`,
    'Explain clearly and step by step, at the level of a motivated beginner. Use short code examples in Markdown code blocks when they help.',
    'If the question is unrelated to programming, IT or studying, answer briefly and steer back to learning.',
    'Do not invent facts about the platform (prices, certificates, teachers); say you do not know instead.',
  ].join('\n')
}

// history: optional [{role:'user'|'assistant', content:string}] from the current chat (already validated).
export async function askAssistant({ question, topic, language, history = [] }) {
  const { configured, model, apiKey } = aiConfig()
  if (!configured) {
    throw new AiError('AI assistant is not configured on the server (ANTHROPIC_API_KEY is missing).', 503, 'AI_NOT_CONFIGURED')
  }

  const client = getClient(apiKey)
  const messages = [...history, { role: 'user', content: question }]

  let response
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system: buildSystemPrompt(language, topic),
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

  const answer = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()

  if (!answer) {
    throw new AiError('The AI response was empty. Please try a different question.', 502, 'AI_EMPTY')
  }

  return { answer, model: response.model, truncated: response.stop_reason === 'max_tokens' }
}
