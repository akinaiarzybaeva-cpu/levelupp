import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clock3, MessageSquareText, Paperclip, Plus, SendHorizonal, Sparkles, Trash2, Lightbulb } from 'lucide-react'
import { Link } from 'react-router-dom'
import { callAiAssistant } from '../aiService'
import siteLogo from '../assets/logo.webp'
import { type UserSubscription } from '../subscriptionService'
import { translations, pick, hasActiveAiAccess, type Lang, type Message } from '../appShared'
import AIMessage from './AIMessage'

export const aiSuggestions: Record<Lang, string[]> = {
  kg: ['HTML деген эмне жана эмнеден баштоо керек?', "JavaScript'те функция кантип жазылат?", "CSS Flexbox менен Grid'дин айырмасы", 'Программалоону үйрөнүү үчүн план түзүп бер'],
  ru: ['Что такое HTML и с чего начать?', 'Как написать функцию в JavaScript?', 'Чем отличается Flexbox от Grid в CSS?', 'Составь план изучения программирования'],
  en: ['What is HTML and where do I start?', 'How do I write a function in JavaScript?', 'Flexbox vs Grid in CSS — what is the difference?', 'Make me a plan to learn programming']
}

export default function AIChat({ language, subscription, userEmail, pricingPath }: { language: Lang; subscription?: UserSubscription; userEmail?: string; pricingPath: string }) {
  const t = translations[language]
  const isAiUnlocked = hasActiveAiAccess(subscription)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const storageKey = userEmail ? `levelup-ai-chat-history:${userEmail}` : null
  const welcomeMessage = useMemo<Message>(() => ({ id: 'welcome', role: 'assistant', text: t.ai.welcome }), [t.ai.welcome])
  const [messages, setMessages] = useState<Message[]>(() => [welcomeMessage])

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      setMessages([welcomeMessage])
      return
    }

    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      setMessages([welcomeMessage])
      return
    }

    try {
      const parsed = JSON.parse(raw) as Message[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed)
      } else {
        setMessages([welcomeMessage])
      }
    } catch {
      setMessages([welcomeMessage])
    }
  }, [storageKey, welcomeMessage])

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    window.localStorage.setItem(storageKey, JSON.stringify(messages))
  }, [messages, storageKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const sendQuestion = async (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || isLoading || !isAiUnlocked) return

    setError(null)
    const userMessage: Message = { id: Date.now().toString(), role: 'user', text: trimmed }
    setMessages((current) => [...current, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const history = messages
        .filter((message) => message.id !== 'welcome')
        .map((message) => ({ role: message.role, content: message.text }))
      const answer = await callAiAssistant({ question: trimmed, language, topic: 'general programming', history })
      setMessages((current) => [...current, { id: `${Date.now()}-ai`, role: 'assistant', text: answer }])
    } catch (err) {
      const text = err instanceof Error ? err.message : t.generic.error
      setError(text)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await sendQuestion(input)
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (!isLoading) {
      void sendQuestion(input)
    }
  }

  const resetChat = () => {
    setError(null)
    setInput('')
    setMessages([welcomeMessage])
  }

  const historyItems = useMemo(
    () => messages.filter((message) => message.role === 'user').slice(-6).reverse(),
    [messages]
  )

  const formatTime = useCallback((id: string) => {
    const stamp = Number(id.split('-')[0] || id)
    if (!Number.isFinite(stamp)) {
      return language === 'ru' ? 'только что' : language === 'kg' ? 'азыр' : 'just now'
    }
    return new Date(stamp).toLocaleTimeString(language === 'kg' ? 'ky-KG' : language === 'ru' ? 'ru-RU' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [language])

  const removeHistoryItem = (id: string) => {
    setMessages((current) => {
      const filtered = current.filter((item) => item.id !== id)
      return filtered.length > 0 ? filtered : [welcomeMessage]
    })
  }

  const userInitial = (userEmail?.trim()?.charAt(0) || 'U').toUpperCase()

  if (!isAiUnlocked) {
    return (
      <section className="detail-card ai-chat-panel ai-chat-shell ai-chat-shell-locked">
        <aside className="ai-chat-sidebar">
          <Link className="ai-chat-brand" to="/dashboard">
            <img src={siteLogo} alt="LevelUp" className="ai-chat-brand-logo" />
          </Link>
          <button type="button" className="ai-chat-new-btn" disabled>
            <MessageSquareText size={18} />
            <span>{t.ai.newChat}</span>
            <Plus size={16} />
          </button>
          <div className="ai-chat-history-title">
            <Clock3 size={16} />
            <span>{t.ai.history}</span>
          </div>
          <p className="ai-chat-history-empty">{t.ai.historyEmpty}</p>
        </aside>

        <div className="ai-chat-main">
          <div className="ai-chat-hero">
            <div className="ai-chat-hero-top">
              <span className="ai-chat-pro-badge"><Sparkles size={14} />AI Pro</span>
              <span className="ai-chat-user-avatar">{userInitial}</span>
            </div>
            <h2>{t.ai.title}</h2>
            <p>{t.ai.blocked}</p>
            <div className="ai-chat-access-pill"><Sparkles size={15} />{t.ai.accessLabel}</div>
          </div>
          <div className="ai-chat-locked-actions">
            <Link to={pricingPath} className="btn btn-primary">{t.ai.connectPlan}</Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="detail-card ai-chat-panel ai-chat-shell">
      <aside className="ai-chat-sidebar">
        <Link className="ai-chat-brand" to="/dashboard">
          <img src={siteLogo} alt="LevelUp" className="ai-chat-brand-logo" />
        </Link>
        <button type="button" className="ai-chat-new-btn" onClick={resetChat} disabled={isLoading}>
          <MessageSquareText size={18} />
          <span>{t.ai.newChat}</span>
          <Plus size={16} />
        </button>

        <div className="ai-chat-history-title">
          <Clock3 size={16} />
          <span>{t.ai.history}</span>
        </div>
        <div className="ai-chat-history-list">
          {historyItems.length === 0 ? (
            <p className="ai-chat-history-empty">{t.ai.historyEmpty}</p>
          ) : (
            historyItems.map((message) => (
              <article key={message.id} className="ai-chat-history-item">
                <div className="ai-chat-history-item-main">
                  <MessageSquareText size={14} />
                  <div>
                    <strong>{message.text.slice(0, 38)}{message.text.length > 38 ? '…' : ''}</strong>
                    <span>{formatTime(message.id)}</span>
                  </div>
                </div>
                <button type="button" className="ai-chat-history-remove" onClick={() => removeHistoryItem(message.id)} aria-label="Delete chat message">
                  <Trash2 size={14} />
                </button>
              </article>
            ))
          )}
        </div>
      </aside>

      <div className="ai-chat-main">
        <div className="ai-chat-hero">
          <div className="ai-chat-hero-top">
            <span className="ai-chat-pro-badge"><Sparkles size={14} />AI Pro</span>
            <span className="ai-chat-user-avatar">{userInitial}</span>
          </div>
          <h2>{t.ai.title}</h2>
          <p>{t.ai.welcome}</p>
          <div className="ai-chat-access-pill"><Sparkles size={15} />{t.ai.accessLabel}</div>
        </div>

        <div className="ai-chat-history">
          {messages.map((message) => (
            <AIMessage key={message.id} role={message.role} text={message.text} userLabel={userInitial} />
          ))}
          {messages.length <= 1 && !isLoading && (
            <div className="ai-suggestions" aria-label={pick(language, 'Даяр суроолор', 'Готовые вопросы', 'Suggested questions')}>
              {aiSuggestions[language].map((question) => (
                <button key={question} type="button" className="ai-suggestion" onClick={() => { void sendQuestion(question) }}>
                  <Lightbulb size={16} /> <span>{question}</span>
                </button>
              ))}
            </div>
          )}
          {isLoading && <AIMessage role="assistant" text={t.ai.generating} loading />}
          <div ref={bottomRef} />
        </div>

        {error && <div className="error-message ai-chat-error">{error}</div>}

        <form className="ai-chat-form" onSubmit={handleSubmit}>
          <label htmlFor="ai-assistant-input" className="ai-chat-input-label">{t.ai.inputLabel}</label>
          <div className="ai-chat-input-shell">
            <Paperclip size={18} />
            <textarea
              id="ai-assistant-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={t.ai.placeholder}
              rows={2}
              disabled={isLoading}
            />
            <button type="submit" className="ai-chat-send-btn" disabled={isLoading || !input.trim()} aria-label={t.buttons.send}>
              <SendHorizonal size={18} />
            </button>
          </div>
          <small className="ai-chat-input-hint">{t.ai.inputHint}</small>
        </form>
      </div>
    </section>
  )
}
