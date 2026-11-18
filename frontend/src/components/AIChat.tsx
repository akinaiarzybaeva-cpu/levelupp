import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Clock3, Lock, MessageSquareText, Plus, SendHorizonal, Sparkles, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { callAiAssistant, clearAiHistory, deleteAiExchange, fetchAiHistory } from '../aiService'
import siteLogo from '../assets/logo.webp'
import { type UserSubscription } from '../subscriptionService'
import { translations, hasActiveAiAccess, type Lang, type Message } from '../appShared'
import AIMessage from './AIMessage'
import { AI_CATEGORIES, AI_KEY_QUESTIONS, AI_UI, type AiCategory } from './aiKeyQuestions'

/** Kept for backwards compatibility: the first suggestions are now the 15 key questions. */
export const aiSuggestions: Record<Lang, string[]> = {
  kg: AI_KEY_QUESTIONS.map((q) => q.text.kg),
  ru: AI_KEY_QUESTIONS.map((q) => q.text.ru),
  en: AI_KEY_QUESTIONS.map((q) => q.text.en),
}

type ChatMessage = Message & { createdAt?: string }

const LOCALES: Record<Lang, string> = { kg: 'ky-KG', ru: 'ru-RU', en: 'en-US' }

function KeyQuestions({ language, locked, disabled, pricingPath, onAsk, open, onToggle }: {
  language: Lang
  locked: boolean
  disabled: boolean
  pricingPath: string
  onAsk: (text: string) => void
  open: boolean
  onToggle: () => void
}) {
  const ui = AI_UI[language]
  const [category, setCategory] = useState<AiCategory | 'all'>('all')
  const visible = AI_KEY_QUESTIONS.filter((q) => category === 'all' || q.category === category)
  const labelOf = (id: AiCategory) => AI_CATEGORIES.find((c) => c.id === id)?.label[language] ?? id

  return (
    <section className={`ai-key-questions${open ? ' is-open' : ''}`} aria-label={ui.keyQuestions}>
      <button type="button" className="ai-key-head" onClick={onToggle} aria-expanded={open}>
        <span className="ai-key-title">
          <Sparkles size={16} />
          <strong>{ui.keyQuestions}</strong>
          <span className="ai-key-count">{AI_KEY_QUESTIONS.length} {ui.questionsCount}</span>
        </span>
        <span className="ai-key-toggle">{open ? ui.hide : ui.show}<ChevronDown size={16} /></span>
      </button>

      {open && (
        <>
          <p className="ai-key-hint">{locked ? ui.lockedText : ui.keyQuestionsHint}</p>
          <div className="ai-key-cats" role="tablist">
            <button type="button" role="tab" aria-selected={category === 'all'} className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>{ui.all}</button>
            {AI_CATEGORIES.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={category === c.id} className={category === c.id ? `active cat-${c.id}` : `cat-${c.id}`} onClick={() => setCategory(c.id)}>
                {c.label[language]}
              </button>
            ))}
          </div>
          <div className="ai-key-grid">
            {visible.map((q) => {
              const Icon = q.icon
              const body = (
                <>
                  <span className={`ai-key-icon cat-${q.category}`}><Icon size={17} /></span>
                  <span className="ai-key-text">
                    <small>{labelOf(q.category)}</small>
                    <span>{q.text[language]}</span>
                  </span>
                  {locked && <Lock size={14} className="ai-key-lock" />}
                </>
              )
              return locked ? (
                <Link key={q.id} to={pricingPath} className="ai-key-card locked" data-question-id={q.id}>{body}</Link>
              ) : (
                <button key={q.id} type="button" className="ai-key-card" data-question-id={q.id} disabled={disabled} onClick={() => onAsk(q.text[language])}>
                  {body}
                </button>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

export default function AIChat({ language, subscription, userEmail, pricingPath }: { language: Lang; subscription?: UserSubscription; userEmail?: string; pricingPath: string }) {
  const t = translations[language]
  const ui = AI_UI[language]
  const isAiUnlocked = hasActiveAiAccess(subscription)
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyFailed, setHistoryFailed] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [questionsOpen, setQuestionsOpen] = useState(true)
  const welcomeMessage = useMemo<ChatMessage>(() => ({ id: 'welcome', role: 'assistant', text: t.ai.welcome }), [t.ai.welcome])

  // Saved conversation of the signed-in user (stored on the server, not in the browser).
  useEffect(() => {
    let cancelled = false
    setHistoryLoaded(false)
    setHistoryFailed(false)
    setMessages([])
    if (!userEmail) {
      setHistoryLoaded(true)
      return
    }
    // Older versions kept the chat in localStorage; the server is the source of truth now.
    try { window.localStorage.removeItem(`levelup-ai-chat-history:${userEmail}`) } catch { /* storage unavailable */ }
    fetchAiHistory()
      .then((saved) => {
        if (cancelled) return
        setMessages(saved.map((m) => ({ id: m.id, role: m.role, text: m.text, createdAt: m.createdAt })))
        if (saved.length > 0) setQuestionsOpen(false)
      })
      .catch(() => { if (!cancelled) setHistoryFailed(true) })
      .finally(() => { if (!cancelled) setHistoryLoaded(true) })
    return () => { cancelled = true }
  }, [userEmail])

  // Keep the newest message (or the "thinking" indicator) in view.
  useEffect(() => {
    const list = listRef.current
    if (!list || !historyLoaded) return
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading, historyLoaded])

  const toHistory = (items: ChatMessage[]) => items.map((m) => ({ role: m.role, content: m.text }))

  const sendQuestion = async (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || isLoading || !isAiUnlocked) return

    setError(null)
    setConfirmClear(false)
    const previous = messages
    const tempId = `pending-${Date.now()}`
    setMessages((current) => [...current, { id: tempId, role: 'user', text: trimmed, createdAt: new Date().toISOString() }])
    setInput('')
    setIsLoading(true)

    try {
      const result = await callAiAssistant({ question: trimmed, language, topic: 'general programming', history: toHistory(previous) })
      setMessages((current) => [
        ...current.map((m) => (m.id === tempId ? { ...m, id: result.questionId ?? tempId } : m)),
        { id: result.answerId ?? `${Date.now()}-ai`, role: 'assistant', text: result.answer, createdAt: new Date().toISOString() },
      ])
    } catch (err) {
      // The question was not answered (and not saved): take it back into the input field.
      setMessages((current) => current.filter((m) => m.id !== tempId))
      setInput(trimmed)
      setError(err instanceof Error ? err.message : t.generic.error)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const regenerate = async (answerId: string) => {
    if (isLoading || !isAiUnlocked) return
    const index = messages.findIndex((m) => m.id === answerId)
    const question = index > 0 ? messages[index - 1] : undefined
    if (!question || question.role !== 'user') return

    setError(null)
    setIsLoading(true)
    setRegeneratingId(answerId)
    try {
      const result = await callAiAssistant({ question: question.text, language, topic: 'general programming', history: toHistory(messages.slice(0, index - 1)), regenerate: true })
      setMessages((current) => current.map((m) => {
        if (m.id === answerId) return { id: result.answerId ?? `${Date.now()}-ai`, role: 'assistant', text: result.answer, createdAt: new Date().toISOString() }
        if (m.id === question.id && result.questionId) return { ...m, id: result.questionId }
        return m
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t.generic.error)
    } finally {
      setIsLoading(false)
      setRegeneratingId(null)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void sendQuestion(input)
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!isLoading) void sendQuestion(input)
  }

  const clearChat = async () => {
    setConfirmClear(false)
    setError(null)
    try {
      if (userEmail) await clearAiHistory()
      setMessages([])
      setInput('')
      setQuestionsOpen(true)
    } catch {
      setError(t.generic.error)
    }
  }

  const removeHistoryItem = async (id: string) => {
    setError(null)
    try {
      if (!id.startsWith('pending-')) await deleteAiExchange(id)
      setMessages((current) => {
        const index = current.findIndex((m) => m.id === id)
        if (index < 0) return current
        const removeNext = current[index + 1]?.role === 'assistant' ? 1 : 0
        return current.filter((_, n) => n < index || n > index + removeNext)
      })
    } catch {
      setError(t.generic.error)
    }
  }

  const historyItems = useMemo(() => messages.filter((m) => m.role === 'user' && !m.id.startsWith('pending-')).slice(-8).reverse(), [messages])

  const formatTime = useCallback((message: ChatMessage) => {
    const stamp = message.createdAt ? Date.parse(message.createdAt) : Number.NaN
    if (!Number.isFinite(stamp)) return language === 'ru' ? 'только что' : language === 'kg' ? 'азыр' : 'just now'
    const date = new Date(stamp)
    const sameDay = date.toDateString() === new Date().toDateString()
    return date.toLocaleString(LOCALES[language], sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }, [language])

  const userInitial = (userEmail?.trim()?.charAt(0) || 'U').toUpperCase()
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id
  const shown: ChatMessage[] = [welcomeMessage, ...messages]

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
          <KeyQuestions language={language} locked disabled pricingPath={pricingPath} onAsk={() => undefined} open onToggle={() => undefined} />
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
        <button type="button" className="ai-chat-new-btn" onClick={() => (messages.length ? setConfirmClear(true) : setQuestionsOpen(true))} disabled={isLoading}>
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
                    <span>{formatTime(message)}</span>
                  </div>
                </div>
                <button type="button" className="ai-chat-history-remove" onClick={() => { void removeHistoryItem(message.id) }} disabled={isLoading} aria-label={ui.deleteItem} title={ui.deleteItem}>
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

        <KeyQuestions
          language={language}
          locked={false}
          disabled={isLoading}
          pricingPath={pricingPath}
          onAsk={(text) => { void sendQuestion(text) }}
          open={questionsOpen}
          onToggle={() => setQuestionsOpen((v) => !v)}
        />

        <div className="ai-chat-toolbar">
          <span>{t.ai.history}{messages.length > 0 ? ` · ${messages.filter((m) => m.role === 'user').length}` : ''}</span>
          {confirmClear ? (
            <span className="ai-chat-confirm" role="alert">
              <span>{ui.clearConfirm}</span>
              <button type="button" className="ai-msg-action danger" onClick={() => { void clearChat() }}>{ui.confirmDelete}</button>
              <button type="button" className="ai-msg-action" onClick={() => setConfirmClear(false)}>{ui.cancel}</button>
            </span>
          ) : (
            <button type="button" className="ai-msg-action" onClick={() => setConfirmClear(true)} disabled={isLoading || messages.length === 0}>
              <Trash2 size={14} /><span>{ui.clearHistory}</span>
            </button>
          )}
        </div>

        <div className="ai-chat-history" ref={listRef} aria-live="polite">
          {shown.map((message) => (
            message.id === regeneratingId ? null : (
              <AIMessage
                key={message.id}
                role={message.role}
                text={message.text}
                userLabel={userInitial}
                copyLabel={message.id === 'welcome' ? undefined : ui.copy}
                copiedLabel={ui.copied}
                regenerateLabel={ui.regenerate}
                onRegenerate={message.id === lastAssistantId && message.id !== 'welcome' ? () => { void regenerate(message.id) } : undefined}
                busy={isLoading}
              />
            )
          ))}
          {isLoading && <AIMessage role="assistant" text={ui.thinking} loading />}
        </div>

        {(error || historyFailed) && <div className="error-message ai-chat-error" role="alert">{error ?? ui.historyError}</div>}

        <form className="ai-chat-form" onSubmit={handleSubmit}>
          <label htmlFor="ai-assistant-input" className="ai-chat-input-label">{t.ai.inputLabel}</label>
          <div className="ai-chat-input-shell">
            <Sparkles size={18} />
            <textarea
              id="ai-assistant-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={t.ai.placeholder}
              rows={2}
              maxLength={4000}
              disabled={isLoading}
            />
            <button type="submit" className="ai-chat-send-btn" disabled={isLoading || !input.trim()} aria-label={ui.send} title={ui.send}>
              <SendHorizonal size={18} />
            </button>
          </div>
          <small className="ai-chat-input-hint">{t.ai.inputHint}</small>
        </form>
      </div>
    </section>
  )
}
