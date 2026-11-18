import { Atom, Braces, Brackets, Brain, CodeXml, Component, Cpu, FileCode, Globe, LayoutGrid, Palette, Plug, SquareFunction, Tags, Variable, type LucideIcon } from 'lucide-react'
import type { Lang } from '../appShared'

export type AiCategory = 'html' | 'css' | 'javascript' | 'react' | 'ai' | 'python'

export type AiKeyQuestion = {
  id: string
  category: AiCategory
  icon: LucideIcon
  text: Record<Lang, string>
}

/** Category order and labels (technology names are the same in every language, AI is translated). */
export const AI_CATEGORIES: Array<{ id: AiCategory; label: Record<Lang, string> }> = [
  { id: 'html', label: { kg: 'HTML', ru: 'HTML', en: 'HTML' } },
  { id: 'css', label: { kg: 'CSS', ru: 'CSS', en: 'CSS' } },
  { id: 'javascript', label: { kg: 'JavaScript', ru: 'JavaScript', en: 'JavaScript' } },
  { id: 'react', label: { kg: 'React', ru: 'React', en: 'React' } },
  { id: 'ai', label: { kg: 'Жасалма интеллект', ru: 'ИИ', en: 'AI' } },
  { id: 'python', label: { kg: 'Python', ru: 'Python', en: 'Python' } },
]

/**
 * The 15 key questions of the AI assistant. Clicking one sends its text (in the current
 * language) to the real AI backend; no answer is stored here.
 */
export const AI_KEY_QUESTIONS: AiKeyQuestion[] = [
  { id: 'html-what', category: 'html', icon: FileCode, text: {
    kg: 'HTML деген эмне жана ал эмне үчүн керек?',
    ru: 'Что такое HTML и для чего он нужен?',
    en: 'What is HTML and what is it used for?' } },
  { id: 'html-tags', category: 'html', icon: Tags, text: {
    kg: 'Жаңы баштаган адам кайсы негизги HTML тегдерин билиши керек?',
    ru: 'Какие основные HTML-теги должен знать начинающий?',
    en: 'Which basic HTML tags should a beginner know?' } },
  { id: 'css-what', category: 'css', icon: Palette, text: {
    kg: 'CSS деген эмне жана ал кантип иштейт?',
    ru: 'Что такое CSS и как он работает?',
    en: 'What is CSS and how does it work?' } },
  { id: 'css-flex-grid', category: 'css', icon: LayoutGrid, text: {
    kg: 'Flexbox менен Grid\'дин айырмасы эмнеде?',
    ru: 'В чём разница между Flexbox и Grid?',
    en: 'What is the difference between Flexbox and Grid?' } },
  { id: 'js-what', category: 'javascript', icon: Braces, text: {
    kg: 'JavaScript деген эмне?',
    ru: 'Что такое JavaScript?',
    en: 'What is JavaScript?' } },
  { id: 'js-variables', category: 'javascript', icon: Variable, text: {
    kg: 'Өзгөрмөлөр деген эмне жана алардын кандай түрлөрү бар?',
    ru: 'Что такое переменные и какие их типы существуют?',
    en: 'What are variables and what types of them exist?' } },
  { id: 'js-functions', category: 'javascript', icon: SquareFunction, text: {
    kg: 'JavaScript\'теги функциялар деген эмне?',
    ru: 'Что такое функции в JavaScript?',
    en: 'What are functions in JavaScript?' } },
  { id: 'js-arrays', category: 'javascript', icon: Brackets, text: {
    kg: 'Массивдер жана объекттер деген эмне?',
    ru: 'Что такое массивы и объекты?',
    en: 'What are arrays and objects?' } },
  { id: 'react-what', category: 'react', icon: Atom, text: {
    kg: 'React деген эмне жана ал эмне үчүн колдонулат?',
    ru: 'Что такое React и для чего он используется?',
    en: 'What is React and what is it used for?' } },
  { id: 'react-components', category: 'react', icon: Component, text: {
    kg: 'React\'теги компоненттер деген эмне?',
    ru: 'Что такое компоненты в React?',
    en: 'What are components in React?' } },
  { id: 'js-api', category: 'javascript', icon: Plug, text: {
    kg: 'API деген эмне жана аны менен кантип иштөө керек?',
    ru: 'Что такое API и как с ним работать?',
    en: 'What is an API and how do you work with it?' } },
  { id: 'ai-what', category: 'ai', icon: Brain, text: {
    kg: 'Жасалма интеллект деген эмне?',
    ru: 'Что такое искусственный интеллект?',
    en: 'What is artificial intelligence?' } },
  { id: 'ai-ml', category: 'ai', icon: Cpu, text: {
    kg: 'Машиналык үйрөнүү кантип иштейт?',
    ru: 'Как работает машинное обучение?',
    en: 'How does machine learning work?' } },
  { id: 'python-what', category: 'python', icon: CodeXml, text: {
    kg: 'Python деген эмне жана ал кайда колдонулат?',
    ru: 'Что такое Python и где он применяется?',
    en: 'What is Python and where is it used?' } },
  { id: 'html-first-site', category: 'html', icon: Globe, text: {
    kg: 'Биринчи веб-сайтымды кантип түзсөм болот?',
    ru: 'Как создать свой первый веб-сайт?',
    en: 'How do I create my first website?' } },
]

/** Interface texts of the AI assistant that are not in the shared site translations. */
export const AI_UI: Record<Lang, {
  keyQuestions: string
  keyQuestionsHint: string
  all: string
  show: string
  hide: string
  clearHistory: string
  clearConfirm: string
  regenerate: string
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
}> = {
  kg: {
    keyQuestions: 'Негизги суроолор',
    keyQuestionsHint: 'Суроону тандаңыз — AI аны дароо талдап, толук жооп берет.',
    all: 'Баары',
    show: 'Көрсөтүү',
    hide: 'Жашыруу',
    clearHistory: 'Тарыхты тазалоо',
    clearConfirm: 'Бүт чат тарыхын өчүрөсүзбү?',
    regenerate: 'Жоопту кайра түзүү',
    copy: 'Көчүрүү',
    copied: 'Көчүрүлдү',
    thinking: 'AI ойлонуп жатат...',
    send: 'Жөнөтүү',
    lockedTitle: 'AI Pro менен суроо бериңиз',
    lockedText: 'Бул 15 суроого жана каалаган башка суроого AI жардамчынын толук жообун алуу үчүн AI Pro тарифин туташтырыңыз.',
    historyError: 'Чат тарыхын жүктөө мүмкүн болгон жок.',
    confirmDelete: 'Өчүрүү',
    cancel: 'Жокко чыгаруу',
    deleteItem: 'Суроону тарыхтан өчүрүү',
    questionsCount: 'суроо',
  },
  ru: {
    keyQuestions: 'Ключевые вопросы',
    keyQuestionsHint: 'Выберите вопрос — ИИ сразу разберёт его и даст подробный ответ.',
    all: 'Все',
    show: 'Показать',
    hide: 'Скрыть',
    clearHistory: 'Очистить историю',
    clearConfirm: 'Удалить всю историю чата?',
    regenerate: 'Сгенерировать заново',
    copy: 'Копировать',
    copied: 'Скопировано',
    thinking: 'ИИ думает...',
    send: 'Отправить',
    lockedTitle: 'Задавайте вопросы с AI Pro',
    lockedText: 'Подключите тариф AI Pro, чтобы получать подробные ответы ИИ на эти 15 вопросов и любые другие.',
    historyError: 'Не удалось загрузить историю чата.',
    confirmDelete: 'Удалить',
    cancel: 'Отмена',
    deleteItem: 'Удалить вопрос из истории',
    questionsCount: 'вопросов',
  },
  en: {
    keyQuestions: 'Key questions',
    keyQuestionsHint: 'Pick a question — the AI will break it down and give a detailed answer.',
    all: 'All',
    show: 'Show',
    hide: 'Hide',
    clearHistory: 'Clear history',
    clearConfirm: 'Delete the whole chat history?',
    regenerate: 'Regenerate answer',
    copy: 'Copy',
    copied: 'Copied',
    thinking: 'AI is thinking...',
    send: 'Send',
    lockedTitle: 'Ask questions with AI Pro',
    lockedText: 'Connect the AI Pro plan to get detailed AI answers to these 15 questions and any others.',
    historyError: 'Could not load the chat history.',
    confirmDelete: 'Delete',
    cancel: 'Cancel',
    deleteItem: 'Delete question from history',
    questionsCount: 'questions',
  },
}
