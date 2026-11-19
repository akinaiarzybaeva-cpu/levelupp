import { API_BASE_URL, withAuthHeaders } from './api'

type Lang = 'kg' | 'ru' | 'en'

type AiRequest = {
  /** One of the 15 prepared questions (frontend/src/components/aiKeyQuestions.ts). */
  questionId: string
  language: Lang
}

/** questionMessageId / answerId = ids of the saved chat rows; question = the text in the chosen language. */
export type AiAnswer = { answer: string; questionId?: string; question?: string; questionMessageId?: string; answerId?: string }

export type SavedAiMessage = { id: string; role: 'user' | 'assistant'; text: string; questionId?: string | null; createdAt?: string }

/** One prepared question with its answer from the LevelUp knowledge base. */
export type KnowledgeItem = { id: string; question: string; answer: string }

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
  SERVER_OUTDATED: {
    kg: 'Серверде AI жардамчынын эски версиясы иштеп жатат. Backend\'ди жаңыртыңыз (deploy), андан кийин кайра аракет кылыңыз.',
    ru: 'На сервере работает старая версия AI-ассистента. Обновите (задеплойте) backend и попробуйте снова.',
    en: 'The server runs an old version of the AI assistant. Update (deploy) the backend and try again.',
  },
  QUESTION_NOT_ALLOWED: {
    kg: 'Сураныч, алдын ала даярдалган 15 суроонун бирин тандаңыз. Ассистент тизмедеги атайын суроолорго гана жооп берет.',
    ru: 'Пожалуйста, выберите один из 15 подготовленных вопросов. Ассистент отвечает только на специальные вопросы из списка.',
    en: 'Please select one of the 15 prepared questions. The assistant only answers questions from the provided list.',
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

export async function callAiAssistant({ questionId, language }: AiRequest): Promise<AiAnswer> {
  // Always go through our backend: it checks the session and the AI PRO subscription
  // and holds the API key. There is intentionally no direct-to-provider override.
  // Plain fetch: AI errors (502/503 from the provider) must not be auto-retried, every call is billed.
  const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ questionId, language }),
  })

  const data = await response.json().catch(() => ({})) as { answer?: string; error?: string; code?: string; questionId?: string; question?: string; questionMessageId?: string; answerId?: string }

  if (!response.ok) {
    // An older backend (before the 15-question version) does not know questionId and answers this.
    const outdated = response.status === 400 && !data.code && data.error === 'Question is required'
    const key = data.code && AI_ERROR_TEXT[data.code]
      ? data.code
      : outdated ? 'SERVER_OUTDATED' : response.status === 403 ? 'FORBIDDEN' : 'GENERIC'
    throw new AiServiceError(AI_ERROR_TEXT[key][language], response.status, data.code)
  }

  if (!data.answer) {
    throw new AiServiceError(AI_ERROR_TEXT.GENERIC[language], 502, 'AI_EMPTY')
  }

  return { answer: data.answer, questionId: data.questionId, question: data.question, questionMessageId: data.questionMessageId, answerId: data.answerId }
}

/** The 15 prepared questions with their answers in one language (AI Pro only, checked by the server). */
export async function fetchAiKnowledge(language: Lang): Promise<KnowledgeItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/ai/knowledge?language=${encodeURIComponent(language)}`, { headers: withAuthHeaders() })
  if (!response.ok) throw new AiServiceError('knowledge', response.status)
  const data = await response.json() as { items?: KnowledgeItem[] }
  return Array.isArray(data.items) ? data.items : []
}

/** The signed-in user's saved conversation (server-side, survives logout and other devices). */
export async function fetchAiHistory(): Promise<SavedAiMessage[]> {
  const response = await fetch(`${API_BASE_URL}/api/ai/history`, { headers: withAuthHeaders() })
  if (!response.ok) throw new AiServiceError('history', response.status)
  const data = await response.json() as { messages?: SavedAiMessage[] }
  return Array.isArray(data.messages) ? data.messages : []
}

export async function clearAiHistory(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/ai/history`, { method: 'DELETE', headers: withAuthHeaders() })
  if (!response.ok) throw new AiServiceError('history', response.status)
}

export async function deleteAiExchange(questionId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/ai/history/${encodeURIComponent(questionId)}`, { method: 'DELETE', headers: withAuthHeaders() })
  if (!response.ok && response.status !== 404) throw new AiServiceError('history', response.status)
}
