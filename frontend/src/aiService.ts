import { API_BASE_URL, withAuthHeaders } from './api'

type AiRequest = {
  question: string
  language: 'kg' | 'ru' | 'en'
  topic: string
}

export async function callAiAssistant({ question, language, topic }: AiRequest): Promise<string> {
  const directApiUrl = String(import.meta.env.VITE_AI_API_URL ?? '').trim()
  const targetUrl = directApiUrl || `${API_BASE_URL}/api/ai/chat`

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question, language, topic })
  })

  const data = await response.json().catch(() => ({})) as { answer?: string; error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'AI service is temporarily unavailable. Please try again later.')
  }

  if (!data.answer) {
    throw new Error('The AI response was empty. Please try a different question.')
  }

  return data.answer
}
