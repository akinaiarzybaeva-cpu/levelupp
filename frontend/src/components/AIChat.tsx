import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Clock3, Info, Lock, MessageSquareText, Plus, SendHorizonal, Sparkles, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AiServiceError, callAiAssistant, clearAiHistory, deleteAiExchange, fetchAiHistory, fetchAiKnowledge, type KnowledgeItem } from '../aiService'
import siteLogo from '../assets/logo.webp'
import { type UserSubscription } from '../subscriptionService'
import { translations, hasActiveAiAccess, LanguageSetterContext, type Lang, type Message } from '../appShared'
import LanguageSwitcher from './LanguageSwitcher'
import AIMessage from './AIMessage'
import { AI_CATEGORIES, AI_KEY_QUESTIONS, AI_UI, findKeyQuestion, type AiCategory } from './aiKeyQuestions'

/** Kept for backwards compatibility: the suggestions are the 15 prepared questions. */
export const aiSuggestions: Record<Lang, string[]> = {
  kg: AI_KEY_QUESTIONS.map((q) => q.text.kg),
  ru: AI_KEY_QUESTIONS.map((q) => q.text.ru),
  en: AI_KEY_QUESTIONS.map((q) => q.text.en),
}

type ChatMessage = Message & { createdAt?: string; questionId?: string | null }
type View = 'questions' | 'answer'

const LOCALES: Record<Lang, string> = { kg: 'ky-KG', ru: 'ru-RU', en: 'en-US' }

function KeyQuestions({ language, locked, disabled, pricingPath, onAsk }: {
  language: Lang
  locked: boolean
  disabled: boolean
  pricingPath: string
  onAsk: (questionId: string) => void
}) {
  const ui = AI_UI[language]
  const [category, setCategory] = useState<AiCategory | 'all'>('all')
  const visible = AI_KEY_QUESTIONS.filter((q) => category === 'all' || q.category === category)
  const labelOf = (id: AiCategory) => AI_CATEGORIES.find((c) => c.id === id)?.label[language] ?? id

  return (
    <section className="ai-key-questions is-open" aria-label={ui.keyQuestions}>
      <div className="ai-key-head">
        <span className="ai-key-title">
          <Sparkles size={16} />
          <strong>{ui.keyQuestions}</strong>
          <span className="ai-key-count">{AI_KEY_QUESTIONS.length} {ui.questionsCount}</span>
        </span>
      </div>
      <p className="ai-key-hint">{locked ? ui.lockedText : ui.keyQuestionsHint}</p>
      <div className="ai-key-cats" role="tablist">
        <button type="button" role="tab" aria-selected={category === 'all'} className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>{ui.all}</button>
        {AI_CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={category === c.id} className={category === c.id ? 'active' : ''} onClick={() => setCategory(c.id)}>
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
            <button key={q.id} type="button" className="ai-key-card" data-question-id={q.id} disabled={disabled} onClick={() => onAsk(q.id)}>
              {body}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default function AIChat({ language, subscription, userEmail, pricingPath }: { language: Lang; subscription?: UserSubscription; userEmail?: string; pricingPath: string }) {
  const t = translations[language]
  const ui = AI_UI[language]
  const isAiUnlocked = hasActiveAiAccess(subscription)
  const setLanguage = useContext(LanguageSetterContext)
  const languageLabel = language === 'kg' ? 'Тил' : language === 'ru' ? 'Язык' : 'Language'
  const listRef = useRef<HTMLDivElement | null>(null)
  const mainRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // Knowledge base per language (question + answer by id), loaded from the server for AI Pro users.
  const [knowledge, setKnowledge] = useState<Partial<Record<Lang, Record<string, KnowledgeItem>>>>({})
  const [error, setError] = useState<string | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyFailed, setHistoryFailed] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [view, setView] = useState<View>('questions')

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
    try { window.localStorage.removeItem(`levelup-ai-chat-history:${userEmail}`) } catch { /* storage unavailable */ }
    fetchAiHistory()
      .then((saved) => { if (!cancelled) setMessages(saved.map((m) => ({ id: m.id, role: m.role, text: m.text, createdAt: m.createdAt, questionId: m.questionId ?? null }))) })
      .catch(() => { if (!cancelled) setHistoryFailed(true) })
      .finally(() => { if (!cancelled) setHistoryLoaded(true) })
    return () => { cancelled = true }
  }, [userEmail])

  // Switching the site language shows the questions AND the already opened answers in that language.
  const knowledgeLoaded = Boolean(knowledge[language])
  useEffect(() => {
    if (!isAiUnlocked || knowledgeLoaded) return
    let cancelled = false
    fetchAiKnowledge(language)
      .then((items) => { if (!cancelled) setKnowledge((current) => ({ ...current, [language]: Object.fromEntries(items.map((item) => [item.id, item])) })) })
      .catch(() => { /* saved texts are shown as they are */ })
    return () => { cancelled = true }
  }, [isAiUnlocked, language, knowledgeLoaded])

  const displayText = (message: ChatMessage) => {
    const item = message.questionId ? knowledge[language]?.[message.questionId] : undefined
    if (!item) return message.text
    return message.role === 'user' ? item.question : item.answer
  }

  // Keep the newest answer (or the "thinking" indicator) in view.
  useEffect(() => {
    const list = listRef.current
    if (!list || !historyLoaded || view !== 'answer') return
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading, historyLoaded, view])

  const scrollMainIntoView = () => window.setTimeout(() => mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)

  const showNotAllowed = () => {
    setNotAllowed(true)
    setView('questions')
    scrollMainIntoView()
  }

  const ask = async (questionId: string) => {
    if (isLoading || !isAiUnlocked) return
    const question = AI_KEY_QUESTIONS.find((q) => q.id === questionId)
    if (!question) { showNotAllowed(); return }

    setError(null)
    setNotAllowed(false)
    setConfirmClear(false)
    setView('answer')
    setIsLoading(true)
    const tempId = `pending-${Date.now()}`
    setMessages((current) => [...current, { id: tempId, role: 'user', text: question.text[language], questionId, createdAt: new Date().toISOString() }])

    try {
      // The server checks the id and returns the prepared answer from the LevelUp knowledge base.
      const result = await callAiAssistant({ questionId, language })
      const answer: ChatMessage = { id: result.answerId ?? `${Date.now()}-ai`, role: 'assistant', text: result.answer, questionId: result.questionId ?? questionId, createdAt: new Date().toISOString() }
      setMessages((current) => [...current.map((m) => (m.id === tempId ? { ...m, id: result.questionMessageId ?? tempId, text: result.question ?? m.text } : m)), answer])
    } catch (err) {
      setMessages((current) => current.filter((m) => m.id !== tempId))
      if (err instanceof AiServiceError && err.code === 'QUESTION_NOT_ALLOWED') showNotAllowed()
      else setError(err instanceof Error ? err.message : t.generic.error)
    } finally {
      setIsLoading(false)
    }
  }

  // Typed text is answered only when it IS one of the 15 questions; anything else gets the notice.
  const submitTyped = () => {
    const text = input.trim()
    if (!text || isLoading) return
    const match = findKeyQuestion(text)
    setInput('')
    if (!match) {
      showNotAllowed()
      return
    }
    void ask(match.id)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    submitTyped()
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submitTyped()
  }

  const clearChat = async () => {
    setConfirmClear(false)
    setError(null)
    try {
      if (userEmail) await clearAiHistory()
      setMessages([])
      setInput('')
      setView('questions')
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

  const hero = (text: string) => (
    <div className="ai-chat-hero">
      <div className="ai-chat-hero-top">
        <div className="ai-chat-lang"><LanguageSwitcher language={language} setLanguage={setLanguage} label={languageLabel} /></div>
        <span className="ai-chat-pro-badge"><Sparkles size={14} />AI Pro</span>
        <span className="ai-chat-user-avatar">{userInitial}</span>
      </div>
      <h2>{t.ai.title}</h2>
      <p>{text}</p>
      <div className="ai-chat-access-pill"><Sparkles size={15} />{t.ai.accessLabel}</div>
    </div>
  )

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
          {hero(t.ai.blocked)}
          <KeyQuestions language={language} locked disabled pricingPath={pricingPath} onAsk={() => undefined} />
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
        <button type="button" className="ai-chat-new-btn" onClick={() => { setNotAllowed(false); setView('questions'); if (messages.length) setConfirmClear(true) }} disabled={isLoading}>
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
                <button type="button" className="ai-chat-history-item-main ai-chat-history-open" onClick={() => setView('answer')}>
                  <MessageSquareText size={14} />
                  <div>
                    <strong>{displayText(message).slice(0, 38)}{displayText(message).length > 38 ? '…' : ''}</strong>
                    <span>{formatTime(message)}</span>
                  </div>
                </button>
                <button type="button" className="ai-chat-history-remove" onClick={() => { void removeHistoryItem(message.id) }} disabled={isLoading} aria-label={ui.deleteItem} title={ui.deleteItem}>
                  <Trash2 size={14} />
                </button>
              </article>
            ))
          )}
        </div>
      </aside>

      <div className="ai-chat-main" ref={mainRef}>
        {hero(t.ai.welcome)}

        {view === 'questions' ? (
          <>
            {notAllowed && (
              <div className="ai-not-allowed" role="alert">
                <Info size={18} />
                <p>{ui.notAllowed}</p>
              </div>
            )}
            <KeyQuestions language={language} locked={false} disabled={isLoading} pricingPath={pricingPath} onAsk={(id) => { void ask(id) }} />
            {messages.length > 0 && (
              <button type="button" className="ai-msg-action ai-open-answers" onClick={() => setView('answer')}>
                <MessageSquareText size={14} /><span>{ui.answerTitle} · {messages.filter((m) => m.role === 'assistant').length}</span>
              </button>
            )}
          </>
        ) : (
          <>
            <div className="ai-chat-toolbar">
              <button type="button" className="ai-back-btn" onClick={() => { setView('questions'); setNotAllowed(false) }}>
                <ArrowLeft size={16} /><span>{ui.backToQuestions}</span>
              </button>
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

            <div className="ai-chat-history ai-answer-block" ref={listRef} aria-live="polite" aria-label={ui.answerTitle}>
              {messages.map((message) => (
                <AIMessage
                  key={message.id}
                  role={message.role}
                  text={displayText(message)}
                  userLabel={userInitial}
                  copyLabel={ui.copy}
                  copiedLabel={ui.copied}
                  copyCodeLabel={ui.copyCode}
                />
              ))}
              {isLoading && <AIMessage role="assistant" text={ui.thinking} loading />}
            </div>
          </>
        )}

        {/* The confirmation is also reachable from "New chat" while the questions are shown. */}
        {view === 'questions' && confirmClear && (
          <div className="ai-chat-toolbar">
            <span className="ai-chat-confirm" role="alert">
              <span>{ui.clearConfirm}</span>
              <button type="button" className="ai-msg-action danger" onClick={() => { void clearChat() }}>{ui.confirmDelete}</button>
              <button type="button" className="ai-msg-action" onClick={() => setConfirmClear(false)}>{ui.cancel}</button>
            </span>
          </div>
        )}

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
              placeholder={ui.placeholder}
              rows={2}
              maxLength={300}
              disabled={isLoading}
            />
            <button type="submit" className="ai-chat-send-btn" disabled={isLoading || !input.trim()} aria-label={ui.send} title={ui.send}>
              <SendHorizonal size={18} />
            </button>
          </div>
          <small className="ai-chat-input-hint">{ui.onlyListHint}</small>
        </form>
      </div>
    </section>
  )
}
