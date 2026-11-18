import { Brain, UserRound } from 'lucide-react'

/** One chat bubble of the AI assistant: assistant answer, user question, or the "typing…" indicator. */
export default function AIMessage({ role, text, userLabel, loading = false }: {
  role: 'assistant' | 'user'
  text: string
  /** Shown above the user's own messages (their initial). */
  userLabel?: string
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="ai-chat-message assistant loading" aria-live="polite">
        <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>{text}
      </div>
    )
  }
  const isAssistant = role === 'assistant'
  return (
    <div className={isAssistant ? 'ai-chat-message assistant' : 'ai-chat-message user'}>
      <div className="ai-chat-message-head">
        {isAssistant ? <Brain size={14} /> : <UserRound size={14} />}
        <span>{isAssistant ? 'LevelUp AI' : userLabel}</span>
      </div>
      <p>{text}</p>
    </div>
  )
}
