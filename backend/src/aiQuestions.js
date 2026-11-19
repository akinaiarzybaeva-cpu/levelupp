import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The AI assistant answers ONLY these 15 prepared questions (KG / RU / EN).
// The frontend copy lives in frontend/src/components/aiKeyQuestions.ts; the API test suite
// checks that both lists are identical.

export const AI_QUESTIONS = [
  { id: 'html-what', topic: 'HTML', text: {
    kg: 'HTML деген эмне жана ал эмне үчүн керек?',
    ru: 'Что такое HTML и для чего он нужен?',
    en: 'What is HTML and what is it used for?' } },
  { id: 'css-what', topic: 'CSS', text: {
    kg: 'CSS деген эмне?',
    ru: 'Что такое CSS?',
    en: 'What is CSS?' } },
  { id: 'html-vs-css', topic: 'HTML and CSS', text: {
    kg: 'HTML менен CSS\'тин айырмасы эмнеде?',
    ru: 'В чём разница между HTML и CSS?',
    en: 'What is the difference between HTML and CSS?' } },
  { id: 'js-what', topic: 'JavaScript', text: {
    kg: 'JavaScript деген эмне?',
    ru: 'Что такое JavaScript?',
    en: 'What is JavaScript?' } },
  { id: 'js-variable', topic: 'JavaScript', text: {
    kg: 'JavaScript\'теги өзгөрмө деген эмне?',
    ru: 'Что такое переменная в JavaScript?',
    en: 'What is a variable in JavaScript?' } },
  { id: 'js-function', topic: 'JavaScript', text: {
    kg: 'Функция деген эмне?',
    ru: 'Что такое функция?',
    en: 'What is a function?' } },
  { id: 'react-what', topic: 'React', text: {
    kg: 'React деген эмне?',
    ru: 'Что такое React?',
    en: 'What is React?' } },
  { id: 'react-component', topic: 'React', text: {
    kg: 'React\'теги компонент деген эмне?',
    ru: 'Что такое компонент в React?',
    en: 'What is a component in React?' } },
  { id: 'vite-what', topic: 'Vite (frontend tooling)', text: {
    kg: 'Vite деген эмне?',
    ru: 'Что такое Vite?',
    en: 'What is Vite?' } },
  { id: 'git-github', topic: 'Git and GitHub', text: {
    kg: 'Git жана GitHub деген эмне?',
    ru: 'Что такое Git и GitHub?',
    en: 'What are Git and GitHub?' } },
  { id: 'ai-what', topic: 'Artificial intelligence', text: {
    kg: 'Жасалма интеллект деген эмне?',
    ru: 'Что такое искусственный интеллект?',
    en: 'What is artificial intelligence?' } },
  { id: 'algorithm', topic: 'Algorithms', text: {
    kg: 'Алгоритм деген эмне?',
    ru: 'Что такое алгоритм?',
    en: 'What is an algorithm?' } },
  { id: 'frontend', topic: 'Frontend development', text: {
    kg: 'Frontend-иштеп чыгуу деген эмне?',
    ru: 'Что такое frontend-разработка?',
    en: 'What is frontend development?' } },
  { id: 'first-site', topic: 'Building a first website', text: {
    kg: 'Биринчи веб-сайтымды кантип түзсөм болот?',
    ru: 'Как создать свой первый веб-сайт?',
    en: 'How do I create my first website?' } },
  { id: 'start-programming', topic: 'Learning to program', text: {
    kg: 'Программалоону үйрөнүүнү эмнеден баштоо керек?',
    ru: 'С чего начать изучение программирования?',
    en: 'Where should I start learning programming?' } },
]

export const QUESTION_NOT_ALLOWED_MESSAGE = {
  ru: 'Пожалуйста, выберите один из 15 подготовленных вопросов. Ассистент отвечает только на специальные вопросы из списка.',
  kg: 'Сураныч, алдын ала даярдалган 15 суроонун бирин тандаңыз. Ассистент тизмедеги атайын суроолорго гана жооп берет.',
  en: 'Please select one of the 15 prepared questions. The assistant only answers questions from the provided list.',
}

/** Case, spacing, quotes, final punctuation, ё/е and apostrophe variants do not matter. */
export function normalizeQuestion(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’‘`ʼ]/g, "'")
    .replace(/[«»"“”]/g, '')
    .replace(/[\s ]+/g, ' ')
    .replace(/[\s?!.。…]+$/u, '')
    .trim()
}

const byId = new Map(AI_QUESTIONS.map((q) => [q.id, q]))
const byText = new Map()
for (const q of AI_QUESTIONS) for (const text of Object.values(q.text)) byText.set(normalizeQuestion(text), q)

/**
 * Returns the allowed question (text in the requested language) for a questionId, or for a text
 * that is exactly one of the 45 prepared questions. Anything else → null (no AI call).
 */
export function resolveAllowedQuestion({ questionId, question, language }) {
  const lang = ['kg', 'ru', 'en'].includes(language) ? language : 'ru'
  const id = typeof questionId === 'string' ? questionId.trim() : ''
  const item = id ? byId.get(id) : byText.get(normalizeQuestion(question))
  if (!item) return null
  // A questionId together with different text is treated as tampering.
  if (id && question != null && String(question).trim() && byText.get(normalizeQuestion(question)) !== item) return null
  return { id: item.id, topic: item.topic, text: item.text[lang] }
}

// ─── Knowledge base: one prepared answer per question and language ───────────
// backend/src/aiKnowledge/{kg,ru,en}.md, sections start with "<!-- q:<question id> -->".

const KNOWLEDGE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'aiKnowledge')

function loadKnowledge() {
  const out = {}
  for (const lang of ['kg', 'ru', 'en']) {
    const raw = fs.readFileSync(path.join(KNOWLEDGE_DIR, `${lang}.md`), 'utf8').replace(/\r\n/g, '\n')
    const parts = raw.split(/^<!-- q:([a-z-]+) -->\s*$/m)
    const answers = {}
    for (let i = 1; i < parts.length; i += 2) answers[parts[i]] = parts[i + 1].trim()
    // Fail fast: every prepared question must have its own answer in every language.
    for (const q of AI_QUESTIONS) {
      if (!answers[q.id]) throw new Error(`AI knowledge base: missing ${lang} answer for "${q.id}"`)
    }
    const extra = Object.keys(answers).filter((id) => !byId.has(id))
    if (extra.length) throw new Error(`AI knowledge base: unknown question ids in ${lang}.md: ${extra.join(', ')}`)
    out[lang] = answers
  }
  return out
}

const KNOWLEDGE = loadKnowledge()

export function getPreparedAnswer(questionId, language) {
  const lang = ['kg', 'ru', 'en'].includes(language) ? language : 'ru'
  return KNOWLEDGE[lang][questionId] ?? null
}

/** All 15 questions with their answers in one language (for the AI Pro page). */
export function getKnowledge(language) {
  const lang = ['kg', 'ru', 'en'].includes(language) ? language : 'ru'
  return AI_QUESTIONS.map((q) => ({ id: q.id, question: q.text[lang], answer: KNOWLEDGE[lang][q.id] }))
}
