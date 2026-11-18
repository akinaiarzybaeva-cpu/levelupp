import { API_BASE_URL, withAuthHeaders } from './api'

type Lang = 'kg' | 'ru' | 'en'

type AiRequest = {
  question: string
  language: Lang
  topic: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export class AiServiceError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const AI_ERROR_TEXT: Record<string, Record<Lang, string>> = {
  AI_NOT_CONFIGURED: {
    kg: 'AI жардамчы серверде азырынча туташтырыла элек. Администраторго кайрылыңыз.',
    ru: 'AI-ассистент пока не подключён на сервере. Обратитесь к администратору.',
    en: 'The AI assistant is not configured on the server yet. Please contact the administrator.',
  },
  AI_RATE_LIMITED: {
    kg: 'AI жардамчы азыр бош эмес. Бир мүнөттөн кийин кайра аракет кылыңыз.',
    ru: 'AI-ассистент сейчас перегружен. Попробуйте через минуту.',
    en: 'The AI assistant is busy. Please try again in a minute.',
  },
  AI_REFUSED: {
    kg: 'Бул суроого жооп берүү мүмкүн эмес. Суроону башкача жазып көрүңүз.',
    ru: 'Ассистент не может ответить на этот вопрос. Попробуйте сформулировать иначе.',
    en: 'The assistant cannot answer this question. Please rephrase it.',
  },
  FORBIDDEN: {
    kg: 'AI жардамчы активдүү AI PRO тарифи менен гана жеткиликтүү.',
    ru: 'AI-ассистент доступен только с активным тарифом AI PRO.',
    en: 'The AI assistant requires an active AI PRO plan.',
  },
  GENERIC: {
    kg: 'AI кызматы убактылуу жеткиликсиз. Кийинчерээк аракет кылыңыз.',
    ru: 'AI-сервис временно недоступен. Попробуйте позже.',
    en: 'AI service is temporarily unavailable. Please try again later.',
  },
}

export async function callAiAssistant({ question, language, topic, history = [] }: AiRequest): Promise<string> {
  // Always go through our backend: it checks the session and the AI PRO subscription
  // and holds the API key. There is intentionally no direct-to-provider override.
  // Plain fetch: AI errors (502/503 from the provider) must not be auto-retried, every call is billed.
  const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question, language, topic, history: history.slice(-10) }),
  })

  const data = await response.json().catch(() => ({})) as { answer?: string; error?: string; code?: string }

  if (!response.ok) {
    const key = data.code && AI_ERROR_TEXT[data.code]
      ? data.code
      : response.status === 403 ? 'FORBIDDEN' : 'GENERIC'
    throw new AiServiceError(AI_ERROR_TEXT[key][language], response.status, data.code)
  }

  if (!data.answer) {
    throw new AiServiceError(AI_ERROR_TEXT.GENERIC[language], 502, 'AI_EMPTY')
  }

  return data.answer
}
