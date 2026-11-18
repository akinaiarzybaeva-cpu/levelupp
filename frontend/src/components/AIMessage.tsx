import { Fragment, useState, type ReactNode } from 'react'
import { Brain, Check, Copy, RefreshCw, UserRound } from 'lucide-react'

/** Inline Markdown: `code`, **bold**, *italic*. Rendered as React elements (no HTML injection). */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*)/g
  let last = 0
  let index = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > last) parts.push(text.slice(last, start))
    const token = match[0]
    const key = `${keyPrefix}-${index++}`
    if (token.startsWith('`')) parts.push(<code key={key}>{token.slice(1, -1)}</code>)
    else if (token.startsWith('**')) parts.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    else parts.push(<em key={key}>{token.slice(1, -1)}</em>)
    last = start + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** Block Markdown used by the AI answers: headings, lists, fenced code, quotes, paragraphs. */
function renderMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    const fence = line.match(/^\s*```\s*([\w+#.-]*)\s*$/)
    if (fence) {
      const code: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++])
      i++ // closing fence (or end of text)
      blocks.push(
        <pre key={key++} className="ai-md-code" data-lang={fence[1] || undefined}>
          {fence[1] && <span className="ai-md-code-lang">{fence[1]}</span>}
          <code>{code.join('\n')}</code>
        </pre>
      )
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const content = renderInline(heading[2], `h${key}`)
      blocks.push(level <= 2 ? <h3 key={key++} className="ai-md-h">{content}</h3> : <h4 key={key++} className="ai-md-h">{content}</h4>)
      i++
      continue
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''))
      blocks.push(<ul key={key++}>{items.map((item, n) => <li key={n}>{renderInline(item, `u${key}-${n}`)}</li>)}</ul>)
      continue
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))
      blocks.push(<ol key={key++}>{items.map((item, n) => <li key={n}>{renderInline(item, `o${key}-${n}`)}</li>)}</ol>)
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''))
      blocks.push(<blockquote key={key++}>{renderInline(quote.join(' '), `q${key}`)}</blockquote>)
      continue
    }

    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      blocks.push(<hr key={key++} />)
      i++
      continue
    }

    if (!line.trim()) {
      i++
      continue
    }

    const paragraph: string[] = []
    while (
      i < lines.length && lines[i].trim() &&
      !/^\s*```/.test(lines[i]) && !/^#{1,4}\s/.test(lines[i]) &&
      !/^\s*[-*•]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i]) && !/^\s*>/.test(lines[i])
    ) paragraph.push(lines[i++])
    blocks.push(
      <p key={key++}>
        {paragraph.map((row, n) => <Fragment key={n}>{n > 0 && <br />}{renderInline(row, `p${key}-${n}`)}</Fragment>)}
      </p>
    )
  }
  return blocks
}

/** One chat bubble of the AI assistant: assistant answer, user question, or the "thinking…" indicator. */
export default function AIMessage({ role, text, userLabel, loading = false, onRegenerate, regenerateLabel, copyLabel, copiedLabel, busy = false }: {
  role: 'assistant' | 'user'
  text: string
  /** Shown above the user's own messages (their initial). */
  userLabel?: string
  loading?: boolean
  /** Only passed for the last answer: asks the AI for a new answer to the same question. */
  onRegenerate?: () => void
  regenerateLabel?: string
  copyLabel?: string
  copiedLabel?: string
  busy?: boolean
}) {
  const [copied, setCopied] = useState(false)

  if (loading) {
    return (
      <div className="ai-chat-message assistant loading" aria-live="polite" role="status">
        <span className="ai-thinking-orb" aria-hidden="true"><Brain size={15} /></span>
        <span>{text}</span>
        <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
    )
  }

  const isAssistant = role === 'assistant'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={isAssistant ? 'ai-chat-message assistant' : 'ai-chat-message user'}>
      <div className="ai-chat-message-head">
        {isAssistant ? <Brain size={14} /> : <UserRound size={14} />}
        <span>{isAssistant ? 'LevelUp AI' : userLabel}</span>
      </div>
      {isAssistant ? <div className="ai-md">{renderMarkdown(text)}</div> : <p>{text}</p>}
      {isAssistant && (copyLabel || onRegenerate) && (
        <div className="ai-chat-message-actions">
          {copyLabel && (
            <button type="button" className="ai-msg-action" onClick={() => { void copy() }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? copiedLabel : copyLabel}</span>
            </button>
          )}
          {onRegenerate && (
            <button type="button" className="ai-msg-action ai-msg-regenerate" onClick={onRegenerate} disabled={busy}>
              <RefreshCw size={14} />
              <span>{regenerateLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
