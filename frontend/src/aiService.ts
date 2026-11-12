type AiRequest = {
  question: string
  language: 'kg' | 'ru' | 'en'
  topic: string
}

export async function callAiAssistant({ question, language, topic }: AiRequest): Promise<string> {
  const apiUrl = import.meta.env.VITE_AI_API_URL as string | undefined

  if (!apiUrl) {
    return `AI API is not configured yet. Add VITE_AI_API_URL to connect a real backend for ${topic} questions in ${language}.`
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, language, topic })
  })

  if (!response.ok) {
    throw new Error('AI service is temporarily unavailable. Please try again later.')
  }

  const data = (await response.json()) as { answer?: string }
  if (!data.answer) {
    throw new Error('The AI response was empty. Please try a different question.')
  }

  return data.answer
}
