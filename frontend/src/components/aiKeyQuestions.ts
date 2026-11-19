import { Atom, Braces, Brain, Component, FileCode, GitBranch, Globe, Layers, Monitor, Palette, Rocket, SquareFunction, Variable, Workflow, Zap, type LucideIcon } from 'lucide-react'
import type { Lang } from '../appShared'

export type AiCategory = 'html-css' | 'javascript' | 'react' | 'tools' | 'ai' | 'basics'

export type AiKeyQuestion = {
  id: string
  category: AiCategory
  icon: LucideIcon
  text: Record<Lang, string>
}

export const AI_CATEGORIES: Array<{ id: AiCategory; label: Record<Lang, string> }> = [
  { id: 'html-css', label: { kg: 'HTML / CSS', ru: 'HTML / CSS', en: 'HTML / CSS' } },
  { id: 'javascript', label: { kg: 'JavaScript', ru: 'JavaScript', en: 'JavaScript' } },
  { id: 'react', label: { kg: 'React', ru: 'React', en: 'React' } },
  { id: 'tools', label: { kg: 'Куралдар', ru: 'Инструменты', en: 'Tools' } },
  { id: 'ai', label: { kg: 'Жасалма интеллект', ru: 'ИИ', en: 'AI' } },
  { id: 'basics', label: { kg: 'Негиздер', ru: 'Основы', en: 'Basics' } },
]

/**
 * The ONLY 15 questions the AI assistant answers. The backend keeps the same list
 * (backend/src/aiQuestions.js) and refuses any other text; the test suite checks both lists match.
 */
export const AI_KEY_QUESTIONS: AiKeyQuestion[] = [
  { id: 'html-what', category: 'html-css', icon: FileCode, text: {
    kg: 'HTML деген эмне жана ал эмне үчүн керек?',
    ru: 'Что такое HTML и для чего он нужен?',
    en: 'What is HTML and what is it used for?' } },
  { id: 'css-what', category: 'html-css', icon: Palette, text: {
    kg: 'CSS деген эмне?',
    ru: 'Что такое CSS?',
    en: 'What is CSS?' } },
  { id: 'html-vs-css', category: 'html-css', icon: Layers, text: {
    kg: 'HTML менен CSS\'тин айырмасы эмнеде?',
    ru: 'В чём разница между HTML и CSS?',
    en: 'What is the difference between HTML and CSS?' } },
  { id: 'js-what', category: 'javascript', icon: Braces, text: {
    kg: 'JavaScript деген эмне?',
    ru: 'Что такое JavaScript?',
    en: 'What is JavaScript?' } },
  { id: 'js-variable', category: 'javascript', icon: Variable, text: {
    kg: 'JavaScript\'теги өзгөрмө деген эмне?',
    ru: 'Что такое переменная в JavaScript?',
    en: 'What is a variable in JavaScript?' } },
  { id: 'js-function', category: 'javascript', icon: SquareFunction, text: {
    kg: 'Функция деген эмне?',
    ru: 'Что такое функция?',
    en: 'What is a function?' } },
  { id: 'react-what', category: 'react', icon: Atom, text: {
    kg: 'React деген эмне?',
    ru: 'Что такое React?',
    en: 'What is React?' } },
  { id: 'react-component', category: 'react', icon: Component, text: {
    kg: 'React\'теги компонент деген эмне?',
    ru: 'Что такое компонент в React?',
    en: 'What is a component in React?' } },
  { id: 'vite-what', category: 'tools', icon: Zap, text: {
    kg: 'Vite деген эмне?',
    ru: 'Что такое Vite?',
    en: 'What is Vite?' } },
  { id: 'git-github', category: 'tools', icon: GitBranch, text: {
    kg: 'Git жана GitHub деген эмне?',
    ru: 'Что такое Git и GitHub?',
    en: 'What are Git and GitHub?' } },
  { id: 'ai-what', category: 'ai', icon: Brain, text: {
    kg: 'Жасалма интеллект деген эмне?',
    ru: 'Что такое искусственный интеллект?',
    en: 'What is artificial intelligence?' } },
  { id: 'algorithm', category: 'basics', icon: Workflow, text: {
    kg: 'Алгоритм деген эмне?',
    ru: 'Что такое алгоритм?',
    en: 'What is an algorithm?' } },
  { id: 'frontend', category: 'basics', icon: Monitor, text: {
    kg: 'Frontend-иштеп чыгуу деген эмне?',
    ru: 'Что такое frontend-разработка?',
    en: 'What is frontend development?' } },
  { id: 'first-site', category: 'basics', icon: Globe, text: {
    kg: 'Биринчи веб-сайтымды кантип түзсөм болот?',
    ru: 'Как создать свой первый веб-сайт?',
    en: 'How do I create my first website?' } },
  { id: 'start-programming', category: 'basics', icon: Rocket, text: {
    kg: 'Программалоону үйрөнүүнү эмнеден баштоо керек?',
    ru: 'С чего начать изучение программирования?',
    en: 'Where should I start learning programming?' } },
]

/** Same rules as the backend: case, spaces, quotes, final punctuation, ё/е do not matter. */
export function normalizeQuestion(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’‘`ʼ]/g, "'")
    .replace(/[«»"“”]/g, '')
    .replace(/[\s ]+/g, ' ')
    .replace(/[\s?!.。…]+$/u, '')
    .trim()
}

/** The prepared question a typed text corresponds to (any of the 3 languages), or undefined. */
export function findKeyQuestion(text: string): AiKeyQuestion | undefined {
  const needle = normalizeQuestion(text)
  if (!needle) return undefined
  return AI_KEY_QUESTIONS.find((q) => Object.values(q.text).some((t) => normalizeQuestion(t) === needle))
}

/** Interface texts of the AI assistant that are not in the shared site translations. */
export const AI_UI: Record<Lang, {
  keyQuestions: string
  keyQuestionsHint: string
  all: string
  clearHistory: string
  clearConfirm: string
  copyCode: string
  copy: string
  copied: string
  thinking: string
  send: string
  lockedTitle: string
  lockedText: string
  historyError: string
  confirmDelete: string
  cancel: string
  deleteItem: string
  questionsCount: string
  notAllowed: string
  backToQuestions: string
  onlyListHint: string
  answerTitle: string
  placeholder: string
}> = {
  kg: {
    keyQuestions: 'Негизги суроолор',
    keyQuestionsHint: 'Суроону тандаңыз — ассистент мисалдары менен толук жооп берет.',
    all: 'Баары',
    clearHistory: 'Тарыхты тазалоо',
    clearConfirm: 'Бүт чат тарыхын өчүрөсүзбү?',
    copyCode: 'Кодду көчүрүү',
    copy: 'Көчүрүү',
    copied: 'Көчүрүлдү',
    thinking: 'AI ойлонуп жатат...',
    send: 'Жөнөтүү',
    lockedTitle: 'AI Pro менен суроо бериңиз',
    lockedText: 'Бул 15 суроого мисалдары бар толук жоопторду алуу үчүн AI Pro тарифин туташтырыңыз.',
    historyError: 'Чат тарыхын жүктөө мүмкүн болгон жок.',
    confirmDelete: 'Өчүрүү',
    cancel: 'Жокко чыгаруу',
    deleteItem: 'Суроону тарыхтан өчүрүү',
    questionsCount: 'суроо',
    notAllowed: 'Сураныч, алдын ала даярдалган 15 суроонун бирин тандаңыз. Ассистент тизмедеги атайын суроолорго гана жооп берет.',
    backToQuestions: 'Суроолорго кайтуу',
    onlyListHint: 'Ассистент тизмедеги 15 суроого гана жооп берет. Суроону тандаңыз же анын текстин так жазыңыз.',
    answerTitle: 'AI жообу',
    placeholder: 'Тизмеден суроону жазыңыз же жогорудан тандаңыз…',
  },
  ru: {
    keyQuestions: 'Ключевые вопросы',
    keyQuestionsHint: 'Выберите вопрос — ассистент даст подробный ответ с примерами.',
    all: 'Все',
    clearHistory: 'Очистить историю',
    clearConfirm: 'Удалить всю историю чата?',
    copyCode: 'Копировать код',
    copy: 'Копировать',
    copied: 'Скопировано',
    thinking: 'ИИ думает...',
    send: 'Отправить',
    lockedTitle: 'Задавайте вопросы с AI Pro',
    lockedText: 'Подключите тариф AI Pro, чтобы получить подробные ответы с примерами на эти 15 вопросов.',
    historyError: 'Не удалось загрузить историю чата.',
    confirmDelete: 'Удалить',
    cancel: 'Отмена',
    deleteItem: 'Удалить вопрос из истории',
    questionsCount: 'вопросов',
    notAllowed: 'Пожалуйста, выберите один из 15 подготовленных вопросов. Ассистент отвечает только на специальные вопросы из списка.',
    backToQuestions: 'Назад к вопросам',
    onlyListHint: 'Ассистент отвечает только на 15 вопросов из списка. Выберите вопрос или введите его текст точно.',
    answerTitle: 'Ответ ИИ',
    placeholder: 'Введите вопрос из списка или выберите его выше…',
  },
  en: {
    keyQuestions: 'Key questions',
    keyQuestionsHint: 'Pick a question — the assistant gives a detailed answer with examples.',
    all: 'All',
    clearHistory: 'Clear history',
    clearConfirm: 'Delete the whole chat history?',
    copyCode: 'Copy code',
    copy: 'Copy',
    copied: 'Copied',
    thinking: 'AI is thinking...',
    send: 'Send',
    lockedTitle: 'Ask questions with AI Pro',
    lockedText: 'Connect the AI Pro plan to get detailed answers with examples to these 15 questions.',
    historyError: 'Could not load the chat history.',
    confirmDelete: 'Delete',
    cancel: 'Cancel',
    deleteItem: 'Delete question from history',
    questionsCount: 'questions',
    notAllowed: 'Please select one of the 15 prepared questions. The assistant only answers questions from the provided list.',
    backToQuestions: 'Back to questions',
    onlyListHint: 'The assistant only answers the 15 questions from the list. Pick a question or type its exact text.',
    answerTitle: 'AI answer',
    placeholder: 'Type a question from the list or pick one above…',
  },
}
