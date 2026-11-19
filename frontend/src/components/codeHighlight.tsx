import type { ReactNode } from 'react'

/**
 * Small dependency-free syntax highlighter for the code examples of the AI assistant
 * (html, css, javascript / jsx, bash). Returns React elements — no HTML injection.
 */
type Rule = [type: string, source: string]

const STRING = String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|` + '`(?:\\\\.|[^`\\\\])*`'

const RULES: Record<string, Rule[]> = {
  javascript: [
    ['comment', String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`],
    ['string', STRING],
    ['tag', String.raw`<\/?[A-Za-z][\w.]*|\/?>`],
    ['keyword', String.raw`\b(?:function|return|let|const|var|if|else|for|while|do|switch|case|break|continue|export|default|import|from|new|class|extends|this|true|false|null|undefined|async|await|try|catch|throw|typeof)\b`],
    ['number', String.raw`\b\d+(?:\.\d+)?\b`],
    ['func', String.raw`\b[A-Za-z_$][\w$]*(?=\s*\()`],
  ],
  html: [
    ['comment', String.raw`<!--[\s\S]*?-->`],
    ['keyword', String.raw`<!DOCTYPE[^>]*>`],
    ['tag', String.raw`<\/?[A-Za-z][\w-]*|\/?>`],
    ['attr', String.raw`\b[A-Za-z-]+(?==)`],
    ['string', String.raw`"[^"\n]*"|'[^'\n]*'`],
  ],
  css: [
    ['comment', String.raw`\/\*[\s\S]*?\*\/`],
    ['selector', String.raw`^[^{}\n:;]+(?=\s*\{)`],
    ['prop', String.raw`[\w-]+(?=\s*:)`],
    ['string', String.raw`"[^"\n]*"|'[^'\n]*'`],
    ['number', String.raw`#[0-9a-fA-F]{3,8}\b|-?\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms)?\b`],
  ],
  bash: [
    ['comment', String.raw`#[^\n]*`],
    ['string', String.raw`"[^"\n]*"|'[^'\n]*'`],
    ['cmd', String.raw`^\s*[A-Za-z][\w-]*`],
    ['flag', String.raw`\s-{1,2}[A-Za-z][\w-]*`],
  ],
}
RULES.jsx = RULES.javascript
RULES.js = RULES.javascript
RULES.sh = RULES.bash
RULES.shell = RULES.bash

const compiled = new Map<string, RegExp>()
function regexFor(lang: string): RegExp | null {
  const rules = RULES[lang]
  if (!rules) return null
  if (!compiled.has(lang)) compiled.set(lang, new RegExp(rules.map(([, src]) => `(${src})`).join('|'), 'gm'))
  return compiled.get(lang) ?? null
}

export function highlightCode(code: string, language: string): ReactNode[] {
  const lang = language.toLowerCase()
  const re = regexFor(lang)
  if (!re) return [code]
  const rules = RULES[lang]
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  re.lastIndex = 0
  for (const match of code.matchAll(re)) {
    const start = match.index ?? 0
    const text = match[0]
    if (!text) continue
    const group = match.slice(1).findIndex((g) => g !== undefined)
    if (start > last) out.push(code.slice(last, start))
    // a leading space captured by the bash "flag" rule stays unstyled
    const lead = text.match(/^\s*/)?.[0] ?? ''
    if (lead) out.push(lead)
    out.push(<span key={key++} className={`tok-${rules[group]?.[0] ?? 'plain'}`}>{text.slice(lead.length)}</span>)
    last = start + text.length
  }
  if (last < code.length) out.push(code.slice(last))
  return out
}
