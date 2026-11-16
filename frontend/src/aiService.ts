type AiRequest = {
  question: string
  language: 'kg' | 'ru' | 'en'
  topic: string
}

function getApiBase(): string {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
  if (configured) return configured
  const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
  if (isLocal) return 'http://localhost:8787'
  return import.meta.env.PROD ? 'https://levelupp-2b3j.onrender.com' : 'http://localhost:8787'
}

export async function callAiAssistant({ question, language, topic }: AiRequest): Promise<string> {
  const directApiUrl = import.meta.env.VITE_AI_API_URL as string | undefined
  const targetUrl = directApiUrl || `${getApiBase()}/api/ai/chat`
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('levelup-auth-token') : null

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
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
