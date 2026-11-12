import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  Clock3,
  Code2,
  Cpu,
  Crown,
  GraduationCap,
  HelpCircle,
  Home,
  LayoutDashboard,
  LayoutGrid,
  Languages,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquareText,
  Moon,
  Paperclip,
  Phone,
  Plus,
  Search,
  SendHorizonal,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  UserRound,
  WalletCards,
  Trash2,
  X
} from 'lucide-react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { callAiAssistant } from './aiService'
import { courses, courseIndex, type Course } from './data'
import i18n from './i18n'
import siteLogo from './assets/лого.png'
import { createPaymentOrder, getPaymentOrderStatus, getReviewsFromServer, getServerSubscription, saveReviewToServer } from './paymentApi'
import {
  activateUserSubscription,
  archiveExpiredPlans,
  canAccessAiAssistant,
  getDefaultSubscription,
  getRemainingDays,
  isSubscriptionExpired,
  getUserSubscription,
  PLAN_META,
  setUserSubscription,
  type PaymentMethod,
  type SubscriptionPlanId,
  type UserSubscription
} from './subscriptionService'

type Lang = 'kg' | 'ru' | 'en'
type Theme = 'light' | 'dark'

type UserProfile = {
  name: string
  email: string
  password: string
  avatar: string
  role: string
  createdAt?: string
  firstName?: string
  lastName?: string
  phone?: string
  bio?: string
  profileImage?: string
}

type NotificationSettings = {
  emailNotifications: boolean
  newCourses: boolean
  newLessons: boolean
  newsUpdates: boolean
}

type UserProgress = {
  lessonsCompleted: string[]
  testsCompleted: number
  practiceCompleted: number
  coursesCompleted: string[]
  totalScore: number
  achievements: string[]
  lastUpdated: string
}

type SiteStats = {
  students: number
  completion: number
  rating: number
  totalRatings: number
  startedCourses: number
  completedCourses: number
  loading: boolean
  updatedAt?: string
}

type LeaderboardEntry = {
  id: string
  name: string
  avatar: string
  score: number
  courses: number
  achievements: string[]
  email: string
}

type Review = { id: string; name: string; avatar: string; rating: number; text: string; date: string; userId?: string; lessonId?: string; lessonLabel?: string; createdAt?: number; updatedAt?: number }
type Message = { id: string; role: 'assistant' | 'user'; text: string }

function getCurrentLanguage(): Lang {
  if (typeof window === 'undefined') return 'ru'

  const stored = window.localStorage.getItem('levelup-language') ?? 'ru'

  try {
    const parsed = JSON.parse(stored)
    if (parsed === 'kg' || parsed === 'ru' || parsed === 'en') return parsed
  } catch {
    // ignore and fall back below
  }

  if (stored === 'kg' || stored === 'ru' || stored === 'en') return stored as Lang
  return 'ru'
}

const defaultUser: UserProfile = {
  name: 'Aisha',
  email: 'aisha@levelup.kg',
  password: 'demo123',
  avatar: 'A',
  role: 'Frontend Developer'
}

const adminUser: UserProfile = {
  name: 'Admin',
  email: 'admin@levelup.kg',
  password: '',
  avatar: 'A',
  role: 'Admin'
}

const defaultNotificationSettings: NotificationSettings = {
  emailNotifications: true,
  newCourses: true,
  newLessons: true,
  newsUpdates: true
}

const defaultReviews: Review[] = []

const faqData = [
  {
    q: { kg: 'Как быстро можно начать обучение?', ru: 'Как быстро можно начать обучение?', en: 'How quickly can I start learning?' },
    a: { kg: 'Сразу после регистрации — выберите курс, пройдите вводный урок и начинайте изучение.', ru: 'Сразу после регистрации: выберите курс, пройдите вводный урок и начните обучение.', en: 'Right after registration: choose a course, complete the onboarding lesson, and start learning.' }
  },
  {
    q: { kg: 'Курстарда практикалар бар ма?', ru: 'Есть ли практические задания?', en: 'Are there practical tasks?' },
    a: { kg: 'Иә. Арбір курс 20 сабақтан тұрады, практикалық тапсырмалар мен тесттер бар.', ru: 'Да. Каждый курс состоит из 20 уроков с практическими заданиями и тестами.', en: 'Yes. Every course contains 20 lessons with hands-on exercises and tests.' }
  },
  {
    q: { kg: 'AI ассистенті қандай мәселелерде көмектеседі?', ru: 'Чем помогает AI-ассистент?', en: 'How does the AI assistant help?' },
    a: { kg: 'AI темаларды түсіндіреді, қателерді талдайды, кодты саралайды және тапсырмаларға кеңес береді.', ru: 'AI объясняет темы, разбирает ошибки, анализирует код и помогает с упражнениями.', en: 'It explains topics, reviews code, analyzes mistakes, and helps with assignments and practice.' }
  },
  {
    q: { kg: 'Сертификат алу үшін не істеу керек?', ru: 'Что нужно для получения сертификата?', en: 'What is needed to receive a certificate?' },
    a: { kg: 'Барлық сабақтарды аяқтап, тесттерден өтсеңіз, сертификат аласыз.', ru: 'После завершения всех уроков и успешной сдачи тестов вы получите сертификат.', en: 'Complete the lessons and pass the tests to earn your certificate.' }
  }
]

const pricingPlans = [
  {
    id: 'free',
    name: 'FREE',
    price: 0,
    label: { kg: 'Акысыз', ru: 'Бесплатный', en: 'Free' },
    description: {
      kg: 'Алғашқы 3 сабақтан үйрөнүңүз жана бардык курс менен tanışа бериңиз.',
      ru: 'Начните с первых 3 уроков и ознакомьтесь со всеми курсами.',
      en: 'Explore the first 3 lessons and get familiar with all courses.'
    },
    features: {
      kg: ['Ар бир курсунун биринчи 3 сабагы', 'Бардык 6 курс менен таанышуу', 'Негизги тесттер', 'Окуу прогресси'],
      ru: ['Первые 3 урока каждого курса', 'Знакомство со всеми 6 курсами', 'Базовые тесты', 'Отслеживание прогресса'],
      en: ['First 3 lessons of every course', 'Explore all 6 courses', 'Base tests', 'Progress tracking']
    },
    featured: false
  },
  {
    id: 'pro',
    name: 'PRO',
    price: 499,
    label: { kg: 'Толук мүмкүнчүлүк', ru: 'Полный доступ', en: 'Full Access' },
    description: {
      kg: 'Толук курс, 20 сабақ, практикалык тапшырмалар жана сертификаттар.',
      ru: 'Полный доступ ко всем курсам, урокам, практике и сертификатам.',
      en: 'Unlock all courses, lessons, practice tasks, and certifications.'
    },
    features: {
      kg: ['Бардык 6 курс', 'Ар бир курсунун 20 сабагы', 'Видео жана теория', 'Практикалык тапшырмалар', 'Бардык тесттер', 'Сертификаттар'],
      ru: ['Все 6 курсов', 'Все 20 уроков каждого курса', 'Видеоуроки и теория', 'Практические задания', 'Все тесты', 'Сертификаты'],
      en: ['All 6 courses', 'All 20 lessons in each course', 'Videos and theory', 'Practice tasks', 'All tests', 'Certificates']
    },
    featured: true,
    popular: true
  },
  {
    id: 'aipro',
    name: 'AI PRO',
    price: 799,
    label: { kg: 'Жасалма интеллект менен окуу', ru: 'Обучение с ИИ', en: 'AI-Powered Learning' },
    description: {
      kg: 'AI жардамчы менен сложный темаларды жана кодду оңой түшүнүңүз.',
      ru: 'Поддержка AI для объяснения тем, исправления кода и персональных заданий.',
      en: 'Learn with an AI mentor to break down topics and improve code faster.'
    },
    features: {
      kg: ['PRO бардык мүмкүнчүлүктөрү', 'Жеке AI жардамчысы', 'Күрделі темаларды түшүндүрүү', 'Кодду оңдоо жана талдоо', 'Жеке практика тапшырмалары'],
      ru: ['Все возможности PRO', 'Персональный AI-помощник', 'Пояснение сложных тем', 'Исправление и анализ кода', 'Индивидуальные упражнения'],
      en: ['All PRO features', 'Personal AI assistant', 'Explain complex topics', 'Fix and analyze code', 'Custom practice tasks']
    },
    featured: false
  }
] as const

const translations = {
  kg: {
    nav: { home: 'Башкы бет', courses: 'Курстар', rating: 'Рейтинг', reviews: 'Пикирлер', pricing: 'Тарифтер', faq: 'Көп берилүүчү суроолор' },
    headerMenu: { language: 'Тил', theme: 'Тема', day: 'Күн режими', night: 'Түн режими', close: 'Менюну жабуу', open: 'Менюну ачуу' },
    buttons: { login: 'Кирүү', signup: 'Катталуу', start: 'Окууну баштоо', coursesBtn: 'Курстарды көрүү', learnMore: 'Кененирээк', continue: 'Окууну улантуу', nextLesson: 'Келеси сабақ', begin: 'Курс баштоо', choosePlan: 'Тариф тандоо', send: 'Жөнөтүү', startFree: 'Начать бесплатно', choosePro: 'Выбрать PRO', chooseAiPro: 'Выбрать AI PRO', confirmPayment: 'Подтвердить оплату', paymentUnavailable: 'Оплата временно недоступна' },
    heroTitle: 'IT дүйнөсүн LEVEL UP менен ач!',
    heroSubtitle: 'Программалоону үйрөн, жөндөмүңдү өнүктүр жана өз долбоорлоруңду түз.',
    benefitTitle: 'Эмне үчүн бизди тандашат?',
    popularTitle: 'Популярдуу курстар',
    startTitle: 'Кантип окууну баштоо керек?',
    leaderboardTitle: 'Студенттердин рейтинги',
    reviewsTitle: 'Студенттердин пикирлери',
    ratingsAvg: 'Платформанын орточо рейтинг',
    pricingTitle: 'Тарифтер',
    faqTitle: 'Көп берилүүчү суроолор',
    footer: { nav: 'Навигация', contacts: 'Байланыштар', social: 'Социалдык тармактар', privacy: 'Купуялык саясаты', terms: 'Колдонуу шарттары', rights: 'Бардык укуктар корголгон.', description: 'Окууну акылга сыярлык, билимди практикага айландыруу жана келечекти ишеним менен куруу.', address: 'Бишкек, Кыргызстан', emailLabel: 'Email', phoneLabel: 'Телефон', addressLabel: 'Адрес' },
    auth: { login: 'Кирүү', register: 'Катталуу', name: 'Атыңыз', email: 'Email', password: 'Пароль', confirm: 'Парольду ырастоо', forget: 'Парольду унуттум', show: 'Көрсөтүү', hide: 'Жашыруу', haveAccount: 'Аккаунтуңуз барбы?', noAccount: 'Аккаунтуңуз жокпу?', welcomeBack: 'Кайта кош келдіңиз' },
    dashboard: { title: 'Жеке кабинет', greeting: 'Салам,', courses: 'Менин курстарым', continueTitle: 'Окууну улантуу', progress: 'Прогресс', completed: 'Аякталган сабақтар', testResults: 'Тесттин жыйынтыктары', achievements: 'Жетишкендиктер', rating: 'Менин рейтингим', certificates: 'Сертификаттар', settings: 'Профиль тууралоолору', password: 'Парольду өзгөртүү', logout: 'Чыгуу', overview: 'Баяндамасы' },
    profilePhoto: { upload: 'Сүрөт жүктөө', change: 'Сүрөттү өзгөртүү', remove: 'Сүрөттү өчүрүү', save: 'Сүрөттү сактоо', uploading: 'Жүктөлүүдө...', saved: 'Сүрөт ийгиликтүү сакталды.', deleted: 'Сүрөт ийгиликтүү өчүрүлдү.', cancel: 'Жокко чыгаруу', choose: 'Сүрөт тандоо', zoom: 'Масштаб', uploadTitle: 'Профиль сүрөтү', invalidType: 'Только JPG, JPEG, PNG или WEBP форматы.', invalidSize: 'Файл 5 МБ-тан чоң болушу мүмкүн эмес.', confirmDelete: 'Сүрөттү өчүрүү керекпи?', cropHint: 'Масштабды тууралап, сүрөттү тегерек формада сактаңыз.', emptyState: 'Жүктөлгөн сүрөт жок' },
    subscription: { title: 'Менин жазылуум', free: 'Акысыз', pro: 'Толук мүмкүнчүлүк', aipro: 'Жасалма интеллект менен окуу', monthly: 'айына', statusActive: 'Иштеуде', statusExpired: 'Мөөнөтү бүттү', statusInactive: 'Активдүү эмес', freeWarning: 'Сизде акысыз тариф бар. Бардык мүмкүнчүлүктөрдү ачуу үчүн PRO-га өтүңүз.', renew: 'Жазылууну узартуу', changePlan: 'Тарифты өзгөртүү', paymentSuccess: 'Төлөм ийгиликтүү аяктады', paymentUnavailable: 'Оплата временно недоступна', expired: 'Жазылуу мөөнөтү бүттү', nextRenewal: 'Кийинки жаңыртуу', history: 'Төлөмдөрдүн тарыхы', duration: '30 күн', paymentMethods: 'MBank, O!Деньги, Элсом' },
    admin: { title: 'Администратор панели', users: 'Колдонуучулар', plans: 'Тарифтер', status: 'Статус', history: 'Тарых', stats: 'Статистика' },
    catalog: { search: 'Курстарды издөө', category: 'Категория', level: 'Деңгээл', sort: 'Сорттоо', all: 'Баары', filter: 'Фильтр' },
    ai: {
      title: 'AI Assistant',
      placeholder: 'Сурагыңызды жазыңыз...',
      offline: 'AI API бапталмаған. Реалдуу backend байланышты түзүңүз.',
      ready: 'AI жооп даяр',
      inputLabel: 'Сурак',
      blocked: 'AI Assistant колдонуу үчүн ылайыктуу тарифти кошуңуз',
      connectPlan: 'Тариф кошуу',
      newChat: 'Жаңы чат',
      generating: 'Жооп түзүлүүдө...',
      welcome: 'Салам! Сурооңузду жазыңыз, жардам берем.',
      history: 'Чат тарыхы',
      historyEmpty: 'Азырынча суроолор жок',
      accessLabel: 'AI Pro тарифи менен жеткиликтүү',
      inputHint: 'Shift + Enter — сапты түшүрүү, Enter — жөнөтүү'
    },
    generic: { search: 'Издөө', loading: 'Жүктөлүүдө...', success: 'Ийгилик', error: 'Ката', days: 'күн', members: 'окуучу', rating: 'Рейтинг', done: 'Аякталды', open: 'Ачуу', correct: 'Дурыс', tryAgain: 'Кайтадан аракет кыл', lesson: 'Сабак', lessons: 'Сабактар', student: 'Окуучу', students: 'Окуучулар' },
    sections: { whyUs: 'Эмне үчүн бизди тандашат?', howStart: 'Кантип окууну баштоо керек?', studentRankings: 'Студенттердин рейтинги', studentReviews: 'Студенттердин пикирлери', choosePlan: 'Өзүңө ылайыктуу тарифти тандоо', courseProgram: 'Курска программанын мазмуну', whatLearn: 'Эмне үйрөнөсүз', lessonNav: 'Сабактарды навигациялоо', open: 'Ачуу', done: 'Аякталды', doneShort: 'Аякталды', theory: 'Теория', codeExample: 'Код мисалы', practice: 'Практикалык тапшырма', checkAnswer: 'Жоопту текшерүү', next: 'Келеси', previous: 'Мурунку', choosePlanShort: 'Тариф тандоо', leaveReview: 'Пикир калтыруу', averageRating: 'Орточо рейтинг' },
    messages: { loginRequired: 'Пикир калтыруу үчүн кирүү керек', invalidAuth: 'Форманы туура толтуруңуз', demoCredentials: 'Demo аккаунт: aisha@levelup.kg / demo123', resetLinkSent: 'Парольду калыбына келтирүү үчүн электрондук почта жөнөтүлдү', subscriptionActivated: 'Подписка ийгиликтүү иштетилди', emptyLeaderboard: 'Рейтинг азырынча бош. Биринчи болуп рейтингке кириң!', emptyReviews: 'Пикирлер жок. Өз пикиріңізди биринчи болуп бөлүшүңүз!' },
    homeStats: { completion: 'Аякталышы', students: 'Окуучулар', rating: 'Рейтинг' }
  },
  ru: {
    nav: { home: 'Главная', courses: 'Курсы', rating: 'Рейтинг', reviews: 'Отзывы', pricing: 'Тарифы', faq: 'Часто задаваемые вопросы' },
    headerMenu: { language: 'Язык', theme: 'Тема', day: 'Дневной режим', night: 'Ночной режим', close: 'Закрыть меню', open: 'Открыть меню' },
    buttons: { login: 'Войти', signup: 'Регистрация', start: 'Начать обучение', coursesBtn: 'Посмотреть курсы', learnMore: 'Подробнее', continue: 'Продолжить обучение', nextLesson: 'Следующий урок', begin: 'Начать курс', choosePlan: 'Выбрать тариф', send: 'Отправить', startFree: 'Начать бесплатно', choosePro: 'Выбрать PRO', chooseAiPro: 'Выбрать AI PRO', confirmPayment: 'Подтвердить оплату', paymentUnavailable: 'Оплата временно недоступна' },
    heroTitle: 'Открой мир IT вместе с LEVEL UP!',
    heroSubtitle: 'Изучай программирование, развивай навыки и создавай собственные проекты.',
    benefitTitle: 'Почему выбирают нас?',
    popularTitle: 'Популярные курсы',
    startTitle: 'Как начать обучение?',
    leaderboardTitle: 'Рейтинг студентов',
    reviewsTitle: 'Отзывы студентов',
    ratingsAvg: 'Средний рейтинг платформы',
    pricingTitle: 'Тарифы',
    faqTitle: 'Часто задаваемые вопросы',
    footer: { nav: 'Навигация', contacts: 'Контакты', social: 'Социальные сети', privacy: 'Политика конфиденциальности', terms: 'Условия использования', rights: 'Все права защищены.', description: 'Учитесь smarter. Создавайте сильнее. Развивайтесь с уверенностью.', address: 'Бишкек, Кыргызстан', emailLabel: 'Email', phoneLabel: 'Телефон', addressLabel: 'Адрес' },
    auth: { login: 'Вход', register: 'Регистрация', name: 'Имя', email: 'Email', password: 'Пароль', confirm: 'Подтвердите пароль', forget: 'Забыли пароль', show: 'Показать', hide: 'Скрыть', haveAccount: 'Есть аккаунт?', noAccount: 'Нет аккаунта?', welcomeBack: 'С возвращением' },
    dashboard: { title: 'Личный кабинет', greeting: 'Здравствуйте,', courses: 'Мои курсы', continueTitle: 'Продолжить обучение', progress: 'Прогресс', completed: 'Завершённые уроки', testResults: 'Результаты тестов', achievements: 'Достижения', rating: 'Мой рейтинг', certificates: 'Сертификаты', settings: 'Настройки профиля', password: 'Изменить пароль', logout: 'Выйти', overview: 'Обзор' },
    profilePhoto: { upload: 'Загрузить фото', change: 'Изменить фото', remove: 'Удалить фото', save: 'Сохранить фотографию', uploading: 'Загрузка...', saved: 'Фотография успешно сохранена.', deleted: 'Фотография успешно удалена.', cancel: 'Отмена', choose: 'Выбрать фото', zoom: 'Масштаб', uploadTitle: 'Фото профиля', invalidType: 'Поддерживаются только JPG, JPEG, PNG и WEBP.', invalidSize: 'Файл не должен превышать 5 MB.', confirmDelete: 'Удалить фото?', cropHint: 'Отрегулируйте масштаб и положение, чтобы сохранить круглую фотографию.', emptyState: 'Фото ещё не загружено' },
    subscription: { title: 'Моя подписка', free: 'Бесплатный', pro: 'Полный доступ', aipro: 'Обучение с ИИ', monthly: 'в месяц', statusActive: 'Активна', statusExpired: 'Истекла', statusInactive: 'Не активна', freeWarning: 'У вас бесплатный тариф. Перейдите на PRO, чтобы открыть все возможности LEVEL UP.', renew: 'Продлить подписку', changePlan: 'Изменить тариф', paymentSuccess: 'Оплата успешно завершена', paymentUnavailable: 'Оплата временно недоступна', expired: 'Срок подписки истёк', nextRenewal: 'Следующее продление', history: 'История платежей', duration: '30 дней', paymentMethods: 'MBank, O!Деньги, Элсом' },
    admin: { title: 'Административная панель', users: 'Пользователи', plans: 'Тарифы', status: 'Статус', history: 'История', stats: 'Статистика' },
    catalog: { search: 'Поиск курсов', category: 'Категория', level: 'Уровень', sort: 'Сортировка', all: 'Все', filter: 'Фильтр' },
    ai: {
      title: 'AI Assistant',
      placeholder: 'Напишите ваш вопрос...',
      offline: 'AI API не настроен. Подключите реальный backend.',
      ready: 'Ответ AI готов',
      inputLabel: 'Вопрос',
      blocked: 'Для использования AI Assistant подключите соответствующий тариф',
      connectPlan: 'Подключить тариф',
      newChat: 'Новый чат',
      generating: 'Генерация ответа...',
      welcome: 'Здравствуйте! Напишите вопрос, и я помогу.',
      history: 'История чата',
      historyEmpty: 'Пока нет вопросов',
      accessLabel: 'Доступно только с тарифом AI Pro',
      inputHint: 'Shift + Enter — новая строка, Enter — отправка'
    },
    generic: { search: 'Поиск', loading: 'Загрузка...', success: 'Успешно', error: 'Ошибка', days: 'дней', members: 'учеников', rating: 'Рейтинг', done: 'Готово', open: 'Открыть', correct: 'Правильно', tryAgain: 'Попробуйте ещё раз', lesson: 'Урок', lessons: 'Уроки', student: 'Студент', students: 'Студенты' },
    sections: { whyUs: 'Почему выбирают нас?', howStart: 'Как начать обучение?', studentRankings: 'Рейтинг студентов', studentReviews: 'Отзывы студентов', choosePlan: 'Выбери подходящий тариф', courseProgram: 'Программа курса', whatLearn: 'Что вы узнаете', lessonNav: 'Навигация по урокам', open: 'Открыть', done: 'Готово', doneShort: 'Готово', theory: 'Теория', codeExample: 'Пример кода', practice: 'Практическое задание', checkAnswer: 'Проверить ответ', next: 'Следующий', previous: 'Предыдущий', choosePlanShort: 'Выбрать тариф', leaveReview: 'Оставить отзыв', averageRating: 'Средний рейтинг' },
    messages: { loginRequired: 'Нужно войти, чтобы оставить отзыв', invalidAuth: 'Заполните форму корректно', demoCredentials: 'Демо-аккаунт: aisha@levelup.kg / demo123', resetLinkSent: 'Ссылка для сброса пароля отправлена на вашу почту', subscriptionActivated: 'Подписка успешно активирована', emptyLeaderboard: 'Рейтинг пока пуст. Стань первым, кто попадёт в рейтинг!', emptyReviews: 'Отзывов пока нет. Будь первым, кто поделится своим мнением!' },
    homeStats: { completion: 'Прохождение', students: 'Студенты', rating: 'Рейтинг' }
  },
  en: {
    nav: { home: 'Home', courses: 'Courses', rating: 'Leaderboard', reviews: 'Reviews', pricing: 'Pricing', faq: 'FAQ' },
    headerMenu: { language: 'Language', theme: 'Theme', day: 'Day mode', night: 'Night mode', close: 'Close menu', open: 'Open menu' },
    buttons: { login: 'Log in', signup: 'Sign up', start: 'Start learning', coursesBtn: 'Explore courses', learnMore: 'Learn more', continue: 'Continue learning', nextLesson: 'Next lesson', begin: 'Start course', choosePlan: 'Choose plan', send: 'Send', startFree: 'Start free', choosePro: 'Choose PRO', chooseAiPro: 'Choose AI PRO', confirmPayment: 'Confirm payment', paymentUnavailable: 'Payment temporarily unavailable' },
    heroTitle: 'Discover the world of IT with LEVEL UP!',
    heroSubtitle: 'Learn programming, develop your skills, and create your own projects.',
    benefitTitle: 'Why choose us?',
    popularTitle: 'Popular courses',
    startTitle: 'How to start learning?',
    leaderboardTitle: 'Student leaderboard',
    reviewsTitle: 'Student reviews',
    ratingsAvg: 'Average platform rating',
    pricingTitle: 'Pricing',
    faqTitle: 'Frequently asked questions',
    footer: { nav: 'Navigation', contacts: 'Contacts', social: 'Social media', privacy: 'Privacy policy', terms: 'Terms of use', rights: 'All rights reserved.', description: 'Learn smarter. Build stronger. Grow with confidence.', address: 'Bishkek, Kyrgyzstan', emailLabel: 'Email', phoneLabel: 'Phone', addressLabel: 'Address' },
    auth: { login: 'Log in', register: 'Sign up', name: 'Name', email: 'Email', password: 'Password', confirm: 'Confirm password', forget: 'Forgot password', show: 'Show', hide: 'Hide', haveAccount: 'Already have an account?', noAccount: 'Need an account?', welcomeBack: 'Welcome back' },
    dashboard: { title: 'Dashboard', greeting: 'Hello,', courses: 'My courses', continueTitle: 'Continue learning', progress: 'Progress', completed: 'Completed lessons', testResults: 'Test results', achievements: 'Achievements', rating: 'My ranking', certificates: 'Certificates', settings: 'Profile settings', password: 'Change password', logout: 'Log out', overview: 'Overview' },
    profilePhoto: { upload: 'Upload photo', change: 'Change photo', remove: 'Delete photo', save: 'Save photo', uploading: 'Uploading...', saved: 'Photo saved successfully.', deleted: 'Photo deleted successfully.', cancel: 'Cancel', choose: 'Choose photo', zoom: 'Zoom', uploadTitle: 'Profile photo', invalidType: 'Only JPG, JPEG, PNG, and WEBP files are supported.', invalidSize: 'File size must be under 5 MB.', confirmDelete: 'Delete the photo?', cropHint: 'Adjust the zoom and position to save a circular profile photo.', emptyState: 'No photo uploaded yet' },
    subscription: { title: 'My Subscription', free: 'Free', pro: 'Full Access', aipro: 'AI-Powered Learning', monthly: 'per month', statusActive: 'Active', statusExpired: 'Expired', statusInactive: 'Inactive', freeWarning: 'You are on the free plan. Upgrade to PRO to unlock all LEVEL UP features.', renew: 'Renew subscription', changePlan: 'Change plan', paymentSuccess: 'Payment successful', paymentUnavailable: 'Payment temporarily unavailable', expired: 'Subscription expired', nextRenewal: 'Next renewal', history: 'Payment history', duration: '30 days', paymentMethods: 'MBank, O!Деньги, Элсом' },
    admin: { title: 'Admin panel', users: 'Users', plans: 'Plans', status: 'Status', history: 'History', stats: 'Statistics' },
    catalog: { search: 'Search courses', category: 'Category', level: 'Level', sort: 'Sort', all: 'All', filter: 'Filter' },
    ai: {
      title: 'AI Assistant',
      placeholder: 'Type your question...',
      offline: 'AI API is not configured. Connect a real backend.',
      ready: 'AI response ready',
      inputLabel: 'Question',
      blocked: 'To use AI Assistant, connect a compatible plan',
      connectPlan: 'Upgrade plan',
      newChat: 'New chat',
      generating: 'Generating response...',
      welcome: 'Hi! Send your question and I will help.',
      history: 'Chat history',
      historyEmpty: 'No questions yet',
      accessLabel: 'Available only with AI Pro plan',
      inputHint: 'Shift + Enter — new line, Enter — send'
    },
    generic: { search: 'Search', loading: 'Loading...', success: 'Success', error: 'Error', days: 'days', members: 'students', rating: 'Rating', done: 'Done', open: 'Open', correct: 'Correct', tryAgain: 'Try again', lesson: 'Lesson', lessons: 'Lessons', student: 'Student', students: 'Students' },
    sections: { whyUs: 'Why choose us?', howStart: 'How to start learning?', studentRankings: 'Student leaderboard', studentReviews: 'Student reviews', choosePlan: 'Choose the right plan for you', courseProgram: 'Course program', whatLearn: 'What you will learn', lessonNav: 'Lesson navigation', open: 'Open', done: 'Done', doneShort: 'Done', theory: 'Theory', codeExample: 'Code example', practice: 'Practice task', checkAnswer: 'Check answer', next: 'Next', previous: 'Previous', choosePlanShort: 'Choose plan', leaveReview: 'Leave a review', averageRating: 'Average rating' },
    messages: { loginRequired: 'You need to log in to leave a review', invalidAuth: 'Please complete the form correctly', demoCredentials: 'Demo account: aisha@levelup.kg / demo123', resetLinkSent: 'A password reset link has been sent to your email', subscriptionActivated: 'Subscription activated successfully', emptyLeaderboard: 'The leaderboard is empty. Be the first to reach the leaderboard!', emptyReviews: 'No reviews yet. Be the first to share your feedback!' },
    homeStats: { completion: 'Completion', students: 'Students', rating: 'Rating' }
  }
} as const

function getStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const value = window.localStorage.getItem(key)
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return value as unknown as T
  }
}

function setStoredValue<T>(key: string, value: T) {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value))
}

function getApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()
  const candidates = [configured || undefined, 'http://localhost:8787', 'http://127.0.0.1:8787']
  const normalized = candidates.filter(Boolean).map((value) => value!.replace(/\/+$/, ''))
  return normalized[0] ?? 'http://localhost:8787'
}

const API_BASE_URL = getApiBaseUrl()

function getStoredAuthToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem('levelup-auth-token') ?? ''
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {})
  const token = getStoredAuthToken()

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const savedUser = getStoredValue<UserProfile | null>('levelup-user', null)
  if (savedUser?.email && !headers.has('x-user-email')) {
    headers.set('x-user-email', savedUser.email)
  }

  const response = await fetch(url, { ...init, headers })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed')
  }
  return payload as T
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value)
}

function AnimatedMetric({ value, formatter, loading, fallback = '—' }: { value: number; formatter: (value: number) => string; loading: boolean; fallback?: string }) {
  const [display, setDisplay] = useState(0)
  const previousValueRef = useRef(0)

  useEffect(() => {
    if (loading) {
      setDisplay(0)
      previousValueRef.current = 0
      return
    }

    const from = previousValueRef.current
    previousValueRef.current = value
    const start = performance.now()
    const duration = 700

    let frameId = 0
    const tick = (currentTime: number) => {
      const progress = Math.min((currentTime - start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setDisplay(from + (value - from) * eased)
      if (progress < 1) frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [loading, value])

  if (loading) return <strong>{fallback}</strong>
  return <strong>{formatter(display)}</strong>
}

function SmartBackButton({ fallback, label, className = 'btn btn-secondary small' }: { fallback: string; label?: string; className?: string }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleBack = () => {
    if (typeof window === 'undefined') {
      navigate(fallback)
      return
    }

    const historyState = window.history.state as { idx?: number } | null
    const canGoBack = window.history.length > 1 && Boolean(historyState && (historyState.idx ?? 0) > 0)

    if (canGoBack && location.pathname !== fallback) {
      navigate(-1)
      return
    }

    navigate(fallback)
  }

  return (
    <button type="button" className={className} onClick={handleBack}>
      <ArrowLeft size={15} /> {label ?? 'Назад'}
    </button>
  )
}

function normalizeRole(value?: string | null): 'Admin' | 'User' | 'Student' {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'admin' || raw === 'administrator' || raw === 'superadmin') return 'Admin'
  if (raw === 'student' || raw === 'user') return raw === 'student' ? 'Student' : 'User'
  return 'User'
}

function isAdminRole(value?: string | null): boolean {
  return normalizeRole(value) === 'Admin' || String(value ?? '').trim().toLowerCase() === 'admin'
}

function sanitizeReviews(value: Review[]) {
  const legacyIds = new Set(['r1', 'r2', 'r3'])
  if (Array.isArray(value) && value.some((item) => legacyIds.has(item.id) && !item.userId)) return []
  return Array.isArray(value) ? value : []
}

const reviewLessonOptions = courses.flatMap((course) =>
  course.lessons.map((lesson) => ({
    id: lesson.id,
    label: `${course.title.ru} — ${lesson.title.ru}`
  }))
)

function createEmptyProgress(): UserProgress {
  return {
    lessonsCompleted: [],
    testsCompleted: 0,
    practiceCompleted: 0,
    coursesCompleted: [],
    totalScore: 0,
    achievements: [],
    lastUpdated: new Date().toISOString()
  }
}

function formatReviewDate(value: string | undefined, language: Lang): string {
  if (!value) return language === 'ru' ? 'только что' : language === 'kg' ? 'азыр' : 'just now'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(language === 'kg' ? 'ky-KG' : language === 'ru' ? 'ru-RU' : 'en-US')
}

function renderAvatarContent(value?: string, fallback = 'U') {
  if (!value || !value.trim()) return fallback

  const trimmed = value.trim()
  const isImageValue = trimmed.startsWith('data:image') || trimmed.startsWith('http') || trimmed.startsWith('/')
  if (isImageValue) {
    return <img src={trimmed} alt="User avatar" className="profile-avatar-image" />
  }

  return trimmed.charAt(0).toUpperCase() || fallback
}

function buildLeaderboard(users: UserProfile[], progressMap: Record<string, UserProgress>): LeaderboardEntry[] {
  return users
    .map((user) => {
      const stats = progressMap[user.email] ?? createEmptyProgress()

      return {
        id: user.email,
        name: user.name,
        avatar: user.avatar,
        score: stats.totalScore,
        courses: stats.coursesCompleted.length,
        achievements: stats.achievements,
        email: user.email
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
}

function getCurrentUserProgress(user: UserProfile | null) {
  if (!user) return createEmptyProgress()
  return getStoredValue<Record<string, UserProgress>>('levelup-progress', {})[user.email] ?? createEmptyProgress()
}

function hasActiveAiAccess(subscription?: UserSubscription | null) {
  if (!subscription) return false
  if (!canAccessAiAssistant(subscription.planId)) return false
  if (subscription.status !== 'active') return false
  return !isSubscriptionExpired(subscription)
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

function AppShell() {
  const navigate = useNavigate()
  const [language, setLanguage] = useState<Lang>(() => getStoredValue('levelup-language', 'ru'))
  const [theme, setTheme] = useState<Theme>(() => getStoredValue('levelup-theme', 'light'))
  const [authToken, setAuthToken] = useState<string>(() => getStoredAuthToken())
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => getStoredValue('levelup-auth', false))
  const [user, setUser] = useState<UserProfile | null>(() => getStoredValue('levelup-user', null as UserProfile | null))
  const [favorites, setFavorites] = useState<string[]>(() => getStoredValue('levelup-favorites', [] as string[]))
  const [completedLessons, setCompletedLessons] = useState<string[]>(() => getStoredValue('levelup-completed', [] as string[]))
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>(() => getStoredValue('levelup-progress', {} as Record<string, UserProgress>))
  const [subscriptions, setSubscriptions] = useState<Record<string, UserSubscription>>(() => getStoredValue('levelup-subscriptions', {} as Record<string, UserSubscription>))
  const [reviews, setReviews] = useState<Review[]>(() => sanitizeReviews(getStoredValue('levelup-reviews', defaultReviews)))
  const [notifications, setNotifications] = useState<NotificationSettings>(() => getStoredValue('levelup-notifications', defaultNotificationSettings))
  const [siteStats, setSiteStats] = useState<SiteStats>({
    students: 0,
    completion: 0,
    rating: 0,
    totalRatings: 0,
    startedCourses: 0,
    completedCourses: 0,
    loading: true
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const t = translations[language]
  const allUsers = useMemo(() => getStoredValue<UserProfile[]>('levelup-users', []), [user?.email, user?.name, isLoggedIn])
  const leaderboard = useMemo(() => buildLeaderboard(allUsers, userProgress), [allUsers, userProgress])
  const currentUserLessons = user ? (userProgress[user.email]?.lessonsCompleted ?? []) : completedLessons
  const currentUserSubscription = user ? (subscriptions[user.email] ?? getUserSubscription(user.email)) : getDefaultSubscription('free')
  const location = useLocation()
  const isDashboardRoute = location.pathname.startsWith('/dashboard')

  const refreshSiteStats = useCallback(async () => {
    try {
      setSiteStats((current) => ({ ...current, loading: true }))
      const payload = await fetchJson<{ students: number; completion: number; rating: number; totalRatings: number; startedCourses: number; completedCourses: number; updatedAt?: string }>(`${API_BASE_URL}/api/site-stats`)
      setSiteStats({
        students: Number(payload.students ?? 0),
        completion: Number(payload.completion ?? 0),
        rating: Number(payload.rating ?? 0),
        totalRatings: Number(payload.totalRatings ?? 0),
        startedCourses: Number(payload.startedCourses ?? 0),
        completedCourses: Number(payload.completedCourses ?? 0),
        updatedAt: payload.updatedAt,
        loading: false
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to sync site stats from backend: ${message}`)
      setSiteStats((current) => ({ ...current, loading: false }))
    }
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    setStoredValue('levelup-theme', theme)
  }, [theme])

  useEffect(() => {
    i18n.changeLanguage(language)
    setStoredValue('levelup-language', language)
  }, [language])

  useEffect(() => {
    setStoredValue('levelup-auth', isLoggedIn)
    if (isLoggedIn && user) {
      setStoredValue('levelup-user', user)
    } else if (typeof window !== 'undefined') {
      window.localStorage.removeItem('levelup-user')
    }
  }, [isLoggedIn, user])

  useEffect(() => {
    if (!authToken) {
      if (typeof window !== 'undefined') window.localStorage.removeItem('levelup-auth-token')
      return
    }
    setStoredValue('levelup-auth-token', authToken)
  }, [authToken])

  useEffect(() => {
    if (!authToken) {
      setIsLoggedIn(false)
      setUser(null)
      return
    }

    let active = true
    const restoreSession = async () => {
      try {
        const data = await fetchJson<{ ok: true; user?: { email: string; name: string; firstName?: string; lastName?: string; phone?: string; bio?: string; avatar?: string; role?: string; createdAt?: string; accountStatus?: string; isBlocked?: boolean } }>(`${API_BASE_URL}/api/auth/session`, {
          headers: { Authorization: `Bearer ${authToken}` }
        })

        if (!active || !data.user) return

        const nextUser: UserProfile = {
          name: data.user.name,
          email: data.user.email,
          password: '',
          avatar: data.user.avatar ? 'U' : (data.user.name?.charAt(0)?.toUpperCase() || 'U'),
          role: data.user.role ?? 'User',
          firstName: data.user.firstName ?? '',
          lastName: data.user.lastName ?? '',
          phone: data.user.phone ?? '',
          bio: data.user.bio ?? '',
          profileImage: data.user.avatar ?? '',
          createdAt: data.user.createdAt
        }

        setUser(nextUser)
        setIsLoggedIn(true)
      } catch (error) {
        if (!active) return
        console.error('Session restore failed:', error)
        setIsLoggedIn(false)
        setUser(null)
        if (typeof window !== 'undefined') window.localStorage.removeItem('levelup-auth-token')
        setAuthToken('')
      }
    }

    void restoreSession()
    return () => { active = false }
  }, [authToken])

  useEffect(() => { setStoredValue('levelup-favorites', favorites) }, [favorites])
  useEffect(() => { setStoredValue('levelup-completed', completedLessons) }, [completedLessons])
  useEffect(() => { setStoredValue('levelup-progress', userProgress) }, [userProgress])
  useEffect(() => { setStoredValue('levelup-subscriptions', subscriptions) }, [subscriptions])
  useEffect(() => { setStoredValue('levelup-reviews', reviews) }, [reviews])
  useEffect(() => { setStoredValue('levelup-notifications', notifications) }, [notifications])

  useEffect(() => {
    if (isLoggedIn && !user) {
      setIsLoggedIn(false)
    }
  }, [isLoggedIn, user])

  useEffect(() => {
    if (!user?.email) return
    const active = getUserSubscription(user.email)
    const normalized = archiveExpiredPlans(user.email) ?? active
    setSubscriptions((current) => {
      const next = { ...current, [user.email]: normalized }
      if (JSON.stringify(current[user.email] ?? null) === JSON.stringify(normalized)) return current
      return next
    })
  }, [user?.email])

  useEffect(() => {
    const syncReviews = async () => {
      try {
        const remoteReviews = await getReviewsFromServer()
        setReviews(remoteReviews)
        void refreshSiteStats()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // eslint-disable-next-line no-console
        console.error(`Failed to sync reviews from backend: ${message}`)
      }
    }

    void syncReviews()
  }, [refreshSiteStats])

  useEffect(() => {
    if (!user?.email) return
    void refreshSiteStats()
    const syncUserProfile = async () => {
      try {
        const data = await fetchJson<{ user?: { email: string; name: string; firstName?: string; lastName?: string; phone?: string; bio?: string; avatar?: string; role?: string; createdAt?: string }; notifications?: NotificationSettings }>(`${API_BASE_URL}/api/users/${encodeURIComponent(user.email)}`, {
          headers: { 'x-user-email': user.email }
        })

        if (data.user) {
          const nextUser: UserProfile = {
            ...user,
            name: data.user.name || user.name,
            firstName: data.user.firstName || user.firstName || data.user.name?.split(' ')[0] || user.name.split(' ')[0] || '',
            lastName: data.user.lastName || user.lastName || data.user.name?.split(' ').slice(1).join(' ') || user.name.split(' ').slice(1).join(' ') || '',
            phone: data.user.phone || user.phone || '',
            bio: data.user.bio || user.bio || '',
            profileImage: data.user.avatar || user.profileImage || '',
            avatar: data.user.avatar ? 'U' : user.avatar,
            role: data.user.role || user.role,
            createdAt: data.user.createdAt || user.createdAt
          }
          setUser(nextUser)
          setStoredValue('levelup-user', nextUser)
        }

        if (data.notifications) {
          setNotifications({
            emailNotifications: Boolean(data.notifications.emailNotifications),
            newCourses: Boolean(data.notifications.newCourses),
            newLessons: Boolean(data.notifications.newLessons),
            newsUpdates: Boolean(data.notifications.newsUpdates)
          })
        }
      } catch (error) {
        console.error('Failed to sync user profile from backend:', error)
      }
    }

    void syncUserProfile()
  }, [refreshSiteStats, user?.email])

  useEffect(() => {
    if (!user?.email) return

    const syncSubscription = async () => {
      try {
        const remoteSubscription = await getServerSubscription(user.email)
        setUserSubscription(user.email, remoteSubscription)
        setSubscriptions((current) => ({ ...current, [user.email]: remoteSubscription }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // eslint-disable-next-line no-console
        console.error(`Failed to sync subscription from backend: ${message}`)
      }
    }

    void syncSubscription()
  }, [user?.email])

  const isAdminUser = isAdminRole(user?.role) || user?.email === adminUser.email
  const navItems = [
    { to: '/', label: t.nav.home },
    { to: '/courses', label: t.nav.courses },
    { to: '/rating', label: t.nav.rating },
    { to: '/reviews', label: t.nav.reviews },
    { to: '/pricing', label: t.nav.pricing },
    ...(isAdminUser ? [{ to: '/admin', label: 'Admin Panel' }] : []),
    { to: '/faq', label: t.nav.faq }
  ]

  const syncCourseProgress = useCallback(async (courseId: string, completedLessonsInCourse: number, totalLessons: number) => {
    if (!user?.email || !courseId) return

    try {
      await fetchJson<{ ok: true }>(`${API_BASE_URL}/api/course-progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email
        },
        body: JSON.stringify({
          userEmail: user.email,
          courseId,
          totalLessons,
          completedLessons: completedLessonsInCourse,
          lessonsStarted: Math.max(1, completedLessonsInCourse)
        })
      })
      void refreshSiteStats()
    } catch (error) {
      console.error('Failed to persist course progress to backend:', error)
    }
  }, [refreshSiteStats, user?.email])

  const awardCourseCompletion = (courseId: string) => {
    if (!user || !user.email) return

    const totalLessons = courses.find((course) => course.id === courseId)?.lessons.length ?? 0
    setUserProgress((current) => {
      const existing = current[user.email] ?? createEmptyProgress()

      if (existing.coursesCompleted.includes(courseId)) return current

      const nextEntry: UserProgress = {
        ...existing,
        coursesCompleted: [...existing.coursesCompleted, courseId],
        totalScore: existing.totalScore + 250,
        achievements: existing.achievements.includes('Course Completed') ? existing.achievements : [...existing.achievements, 'Course Completed'],
        lastUpdated: new Date().toISOString()
      }

      return { ...current, [user.email]: nextEntry }
    })

    if (totalLessons > 0) {
      void syncCourseProgress(courseId, totalLessons, totalLessons)
    }
  }

  const handleLogout = async () => {
    const token = getStoredAuthToken()

    try {
      if (token) {
        await fetchJson<{ ok: true }>(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })
      }
    } catch (error) {
      console.error('Logout request failed:', error)
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('levelup-auth-token')
      window.localStorage.removeItem('levelup-user')
    }

    setAuthToken('')
    setIsLoggedIn(false)
    setUser(null)
    navigate('/auth')
  }

  const completeLessonForCurrentUser = (courseId: string, lessonId: string) => {
    if (!courseId || !lessonId) return

    setCompletedLessons((current) => (current.includes(lessonId) ? current : [...current, lessonId]))
    if (!user?.email) return

    const totalLessons = courses.find((course) => course.id === courseId)?.lessons.length ?? 0
    const nextCompletedCount = Math.min(totalLessons, (userProgress[user.email]?.lessonsCompleted.filter((id) => id.startsWith(`${courseId}-lesson-`)).length ?? 0) + 1)

    setUserProgress((current) => {
      const existing = current[user.email] ?? createEmptyProgress()
      if (existing.lessonsCompleted.includes(lessonId)) return current

      const completedForCourse = existing.lessonsCompleted.filter((id) => id.startsWith(`${courseId}-lesson-`)).length + 1
      const achievements = completedForCourse >= 20 && !existing.achievements.includes('Course Completed')
        ? [...existing.achievements, 'Course Completed']
        : existing.achievements

      const nextEntry: UserProgress = {
        ...existing,
        lessonsCompleted: [...existing.lessonsCompleted, lessonId],
        totalScore: existing.totalScore + 25,
        achievements,
        lastUpdated: new Date().toISOString()
      }

      return { ...current, [user.email]: nextEntry }
    })

    if (totalLessons > 0) {
      void syncCourseProgress(courseId, nextCompletedCount, totalLessons)
    }
  }

  const updateUserProfile = (profileInput: Partial<UserProfile>) => {
    if (!user?.email) return { ok: false as const, message: 'Auth required' }

    const nextName = `${profileInput.firstName ?? user.firstName ?? user.name.split(' ')[0] ?? ''}`.trim() + ` ${profileInput.lastName ?? user.lastName ?? user.name.split(' ').slice(1).join(' ') ?? ''}`.trim()
    const safeName = nextName.trim()
    if (!safeName || safeName.length < 2) return { ok: false as const, message: 'Введите корректное имя' }

    const normalizedUser: UserProfile = {
      ...user,
      name: safeName,
      firstName: profileInput.firstName ?? user.firstName ?? safeName.split(' ')[0] ?? '',
      lastName: profileInput.lastName ?? user.lastName ?? safeName.split(' ').slice(1).join(' ') ?? '',
      phone: profileInput.phone ?? user.phone ?? '',
      bio: profileInput.bio ?? user.bio ?? '',
      profileImage: profileInput.profileImage ?? user.profileImage ?? user.avatar,
      avatar: profileInput.profileImage ? 'U' : (profileInput.firstName ?? user.firstName ?? user.name).charAt(0).toUpperCase() || 'U'
    }

    const allUsers = getStoredValue<UserProfile[]>('levelup-users', [])
    const hasCurrentUser = allUsers.some((entry) => entry.email.toLowerCase() === user.email.toLowerCase())
    const normalizedUsers = hasCurrentUser ? allUsers : [...allUsers, user]
    const updatedUsers = normalizedUsers.map((entry) => (entry.email.toLowerCase() === user.email.toLowerCase() ? { ...entry, ...normalizedUser } : entry))
    setStoredValue('levelup-users', updatedUsers)
    setUser(normalizedUser)

    void fetchJson<{ ok: true }>(`${API_BASE_URL}/api/users/${encodeURIComponent(user.email)}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-email': user.email },
      body: JSON.stringify({
        name: safeName,
        firstName: normalizedUser.firstName,
        lastName: normalizedUser.lastName,
        phone: normalizedUser.phone,
        bio: normalizedUser.bio,
        avatarUrl: profileInput.profileImage ?? user.profileImage ?? '',
        role: normalizedUser.role,
        createdAt: user.createdAt
      })
    }).catch((error) => {
      console.error('Failed to persist profile to backend:', error)
    })

    return { ok: true as const, message: 'Профиль сохранён' }
  }

  const changeUserPassword = (currentPassword: string, nextPassword: string, confirmPassword: string) => {
    if (!user?.email) return { ok: false as const, message: 'Auth required' }
    if (!currentPassword || !nextPassword || !confirmPassword) return { ok: false as const, message: 'Заполните все поля пароля' }
    if (nextPassword.length < 6) return { ok: false as const, message: 'Минимум 6 символов' }
    if (nextPassword !== confirmPassword) return { ok: false as const, message: 'Новые пароли не совпадают' }
    if (currentPassword === nextPassword) return { ok: false as const, message: 'Новый пароль должен отличаться от текущего' }

    void fetchJson<{ ok: true }>(`${API_BASE_URL}/api/users/${encodeURIComponent(user.email)}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-email': user.email },
      body: JSON.stringify({ currentPassword, newPassword: nextPassword, confirmPassword })
    }).then(() => {
      return { ok: true as const, message: 'Пароль успешно изменён' }
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'Пароль не удалось изменить'
      return { ok: false as const, message }
    })

    return { ok: true as const, message: 'Пароль успешно изменён' }
  }

  const updateUserNotifications = (nextSettings: NotificationSettings) => {
    if (!user?.email) return { ok: false as const, message: 'Auth required' }

    setNotifications(nextSettings)
    setStoredValue('levelup-notifications', nextSettings)

    void fetchJson<{ ok: true }>(`${API_BASE_URL}/api/users/${encodeURIComponent(user.email)}/notifications`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-email': user.email },
      body: JSON.stringify({
        emailNotifications: nextSettings.emailNotifications,
        newCourses: nextSettings.newCourses,
        newLessons: nextSettings.newLessons,
        newsUpdates: nextSettings.newsUpdates
      })
    }).catch((error) => {
      console.error('Failed to persist notification settings to backend:', error)
    })

    return { ok: true as const, message: 'Настройки уведомлений сохранены' }
  }

  const handlePlanActivation = (planId: SubscriptionPlanId, method: PaymentMethod = 'MBank') => {
    if (!user?.email) return
    const next = activateUserSubscription(user.email, planId, method)
    if (!next) return
    setSubscriptions((current) => ({ ...current, [user.email]: next }))
  }

  return (
    <div className="app-shell">
      {!isDashboardRoute && (
        <header className="site-header">
          <div className="container nav-wrap">
            <Link className="brand" to="/" aria-label="LEVEL UP home">
              <img src={siteLogo} alt="LEVEL UP" className="brand-logo-image" />
            </Link>

            <nav className="nav">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')} onClick={() => setMobileOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="nav-actions">
              {isLoggedIn && user ? (
                <>
                  <Link to="/dashboard" className="btn btn-secondary btn-login">{user.name}</Link>
                  <button type="button" className="btn btn-primary" onClick={handleLogout}>{t.dashboard.logout}</button>
                </>
              ) : (
                <>
                  <Link to="/auth" className="btn btn-secondary btn-login">{t.buttons.login}</Link>
                  <Link to="/auth" className="btn btn-primary">{t.buttons.signup}</Link>
                </>
              )}

              <button
                type="button"
                className="burger"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? t.headerMenu.close : t.headerMenu.open}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

            <div className={`header-burger-menu ${mobileOpen ? 'open' : ''}`} role="menu" aria-hidden={!mobileOpen}>
              <div className="header-menu-block">
                <div className="header-menu-label">
                  <Languages size={16} />
                  <span>{t.headerMenu.language}</span>
                </div>
                <div className="lang-switch" aria-label={t.headerMenu.language}>
                  {(['kg', 'ru', 'en'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={language === item ? 'lang active' : 'lang'}
                      onClick={() => {
                        setLanguage(item)
                        setMobileOpen(false)
                      }}
                    >
                      {item.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="header-menu-block">
                <div className="header-menu-label">
                  {theme === 'light' ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{t.headerMenu.theme}</span>
                </div>
                <button
                  type="button"
                  className="header-theme-toggle"
                  onClick={() => {
                    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
                    setMobileOpen(false)
                  }}
                >
                  {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                  <span>{theme === 'light' ? t.headerMenu.night : t.headerMenu.day}</span>
                </button>
              </div>

              {isAdminUser && (
                <div className="header-menu-block">
                  <Link to="/admin" className="btn btn-primary full-width" onClick={() => setMobileOpen(false)}>Admin Panel</Link>
                </div>
              )}

              <div className="mobile-auth-actions">
                {isLoggedIn && user ? (
                  <>
                    <Link to="/dashboard" className="btn btn-secondary full-width" onClick={() => setMobileOpen(false)}>{user.name}</Link>
                    <button type="button" className="btn btn-primary full-width" onClick={() => { setMobileOpen(false); handleLogout() }}>{t.dashboard.logout}</button>
                  </>
                ) : (
                  <>
                    <Link to="/auth" className="btn btn-secondary full-width" onClick={() => setMobileOpen(false)}>{t.buttons.login}</Link>
                    <Link to="/auth" className="btn btn-primary full-width" onClick={() => setMobileOpen(false)}>{t.buttons.signup}</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="page-shell">
        <Routes>
          <Route path="/" element={<HomePage t={t} reviews={reviews} leaderboard={leaderboard} siteStats={siteStats} />} />
          <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonPage t={t} completedLessons={user ? currentUserLessons : completedLessons} subscription={currentUserSubscription} isLoggedIn={isLoggedIn} onCompleteLesson={completeLessonForCurrentUser} />} />
          <Route path="/courses/:courseId" element={<CourseDetailPage t={t} completedLessons={user ? currentUserLessons : completedLessons} onCourseComplete={awardCourseCompletion} subscription={currentUserSubscription} isLoggedIn={isLoggedIn} />} />
          <Route path="/courses" element={<CourseCatalogPage t={t} favorites={favorites} onToggleFavorite={setFavorites} />} />
          <Route path="/auth" element={<AuthPage t={t} isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} setUser={setUser} setAuthToken={setAuthToken} onUserRegistered={refreshSiteStats} />} />
          <Route path="/dashboard" element={<ProtectedRoute isLoggedIn={isLoggedIn}><DashboardPage t={t} user={user} completedLessons={user ? currentUserLessons : completedLessons} subscription={currentUserSubscription} onUpdateProfile={updateUserProfile} onChangePassword={changeUserPassword} reviews={reviews} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} onLogout={handleLogout} /></ProtectedRoute>} />
          <Route path="/dashboard/courses" element={<ProtectedRoute isLoggedIn={isLoggedIn}><CourseCatalogPage t={t} favorites={favorites} onToggleFavorite={setFavorites} /></ProtectedRoute>} />
          <Route path="/dashboard/my-lessons" element={<ProtectedRoute isLoggedIn={isLoggedIn}><DashboardLessonsPage completedLessons={user ? currentUserLessons : completedLessons} language={language} /></ProtectedRoute>} />
          <Route path="/dashboard/rating" element={<ProtectedRoute isLoggedIn={isLoggedIn}><RatingPage t={t} leaderboard={leaderboard} reviews={reviews} /></ProtectedRoute>} />
          <Route path="/dashboard/reviews" element={<ProtectedRoute isLoggedIn={isLoggedIn}><ReviewsPage t={t} reviews={reviews} setReviews={setReviews} isLoggedIn={isLoggedIn} user={user} onRefreshSiteStats={refreshSiteStats} /></ProtectedRoute>} />
          <Route path="/dashboard/pricing" element={<ProtectedRoute isLoggedIn={isLoggedIn}><PricingPage t={t} /></ProtectedRoute>} />
          <Route path="/dashboard/faq" element={<ProtectedRoute isLoggedIn={isLoggedIn}><FaqPage t={t} /></ProtectedRoute>} />
          <Route path="/dashboard/ai" element={<ProtectedRoute isLoggedIn={isLoggedIn}><DashboardAiPage language={language} subscription={currentUserSubscription} userEmail={user?.email} /></ProtectedRoute>} />
          <Route path="/dashboard/profile" element={<ProtectedRoute isLoggedIn={isLoggedIn}><ProfilePage t={t} user={user} completedLessons={user ? currentUserLessons : completedLessons} subscription={currentUserSubscription} onUpdateProfile={updateUserProfile} onChangePassword={changeUserPassword} onUpdateNotifications={updateUserNotifications} notifications={notifications} reviews={reviews} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} onLogout={handleLogout} /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedAdminRoute isLoggedIn={isLoggedIn} user={user}><AdminPage t={t} user={user} /></ProtectedAdminRoute>} />
          <Route path="/rating" element={<RatingPage t={t} leaderboard={leaderboard} reviews={reviews} />} />
          <Route path="/reviews" element={<ReviewsPage t={t} reviews={reviews} setReviews={setReviews} isLoggedIn={isLoggedIn} user={user} onRefreshSiteStats={refreshSiteStats} />} />
          <Route path="/pricing" element={<PricingPage t={t} />} />
          <Route path="/pricing/checkout/:planId" element={<CheckoutPage t={t} user={user} onActivatePlan={handlePlanActivation} />} />
          <Route path="/faq" element={<FaqPage t={t} />} />
          <Route path="/privacy" element={<LegalPage title={t.footer.privacy} kind="privacy" />} />
          <Route path="/terms" element={<LegalPage title={t.footer.terms} kind="terms" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer t={t} />
    </div>
  )
}

function ProtectedRoute({ isLoggedIn, children }: { isLoggedIn: boolean; children: React.ReactNode }) {
  if (!isLoggedIn) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function ProtectedAdminRoute({ isLoggedIn, user, children }: { isLoggedIn: boolean; user: UserProfile | null; children: React.ReactNode }) {
  const isAdmin = Boolean(user && (isAdminRole(user.role) || user.email === adminUser.email))
  if (!isLoggedIn || !isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function HomePage({ t, reviews, leaderboard, siteStats }: { t: (typeof translations)[Lang]; reviews: Review[]; leaderboard: LeaderboardEntry[]; siteStats: SiteStats }) {
  const language = getCurrentLanguage()
  const popularCourses = courses.slice(0, 3)
  const highlightedReviews = reviews.slice(0, 3)
  const featuredCourse = popularCourses[0]
  const steps = [
    { title: { kg: 'Катталуу', ru: 'Зарегистрируйся', en: 'Register' }, info: { kg: 'Аккаунт түзүңүз', ru: 'Создай аккаунт', en: 'Create an account' } },
    { title: { kg: 'Курс тандоо', ru: 'Выбери курс', en: 'Choose a course' }, info: { kg: 'Максатыңызга ылайыктуу курс', ru: 'Подбери курс под цель', en: 'Select a course' } },
    { title: { kg: 'Сабактар', ru: 'Изучай уроки', en: 'Learn lessons' }, info: { kg: 'Практика менен үйрөнүңүз', ru: 'Изучай материал', en: 'Study each lesson' } },
    { title: { kg: 'Тапшырмалар', ru: 'Выполняй задания', en: 'Complete tasks' }, info: { kg: 'Тесттер жана долбоорлор', ru: 'Решай задания и тесты', en: 'Complete exercises' } },
    { title: { kg: 'Сертификат', ru: 'Получи сертификат', en: 'Earn certificate' }, info: { kg: 'Натыйжаңызды көрсөтүңүз', ru: 'Зафиксируй результат', en: 'Celebrate success' } }
  ]

  const advantageItems = [
    { icon: GraduationCap, title: { kg: 'Нөлден оқыту', ru: 'Обучение с нуля', en: 'Learn from scratch' }, text: { kg: 'Нөлден баштан үйрөнүңүз', ru: 'Пошаговый старт с нуля', en: 'Start at the beginning' } },
    { icon: Target, title: { kg: 'Практикалык тапшырмалар', ru: 'Практические задания', en: 'Hands-on tasks' }, text: { kg: 'Реалдуу проекттер', ru: 'Реальные кейсы', en: 'Real-world practice' } },
    { icon: LayoutGrid, title: { kg: 'Интерактивтер', ru: 'Интерактивные уроки', en: 'Interactive lessons' }, text: { kg: 'Ижараштуу материал', ru: 'Динамичный контент', en: 'Engaging content' } },
    { icon: Clock3, title: { kg: 'Кез келген уақытта', ru: 'Доступ в любое время', en: 'Anytime access' }, text: { kg: 'Үйде да, жолда да', ru: 'Учитесь в любое время', en: 'Learn anywhere' } },
    { icon: Brain, title: { kg: 'AI жардам', ru: 'Поддержка искусственного интеллекта', en: 'AI support' }, text: { kg: 'Жылдам кеңес', ru: 'Быстрые подсказки', en: 'Fast guidance' } },
    { icon: BadgeCheck, title: { kg: 'Сертификат', ru: 'Сертификаты', en: 'Certificates' }, text: { kg: 'Тапшырудан соң', ru: 'После завершения', en: 'After completion' } }
  ]

  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">LEVEL UP</span>
            <h1>{t.heroTitle}</h1>
            <p>{t.heroSubtitle}</p>
            <div className="hero-actions">
              <Link to={`/courses/${featuredCourse.id}`} className="btn btn-primary btn-lg">{t.buttons.start}</Link>
              <button type="button" className="btn btn-secondary btn-lg hero-courses-button" onClick={() => { document.getElementById('popular-courses')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{t.buttons.coursesBtn}</button>
            </div>
            <div className="mini-metrics">
              <div>
                <AnimatedMetric value={siteStats.completion} formatter={(value) => `${Math.round(value)}%`} loading={siteStats.loading} fallback="—" />
                <span>{t.homeStats.completion}</span>
              </div>
              <div>
                <AnimatedMetric value={siteStats.students} formatter={formatCompactNumber} loading={siteStats.loading} fallback="—" />
                <span>{t.homeStats.students}</span>
              </div>
              <div>
                <AnimatedMetric value={siteStats.rating} formatter={(value) => `${Number(value).toFixed(1)}/5`} loading={siteStats.loading} fallback="—" />
                <span>{t.homeStats.rating}</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="tech-panel">
              <div className="code-badges"><span>HTML</span><span>CSS</span><span>JS</span><span>AI</span></div>
              <div className="code-window">
                <div className="window-bar"><span /><span /><span /></div>
                <pre>{`const course = {\n  stack: ['HTML','CSS','JS'],\n  goal: 'Build products',\n  result: 'LEVEL UP'\n};`}</pre>
              </div>
              <div className="floating-card floating-one"><Cpu size={18} /> AI mentor</div>
              <div className="floating-card floating-two"><Code2 size={18} /> 20 lessons</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading title={t.benefitTitle} />
          <div className="benefits-grid">
            {advantageItems.map(({ icon: Icon, title, text }) => (
              <div className="feature-card" key={title.ru}>
                <div className="feature-icon"><Icon size={18} /></div>
                <h3>{title[language]}</h3>
                <p>{text[language]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="popular-courses" className="section alt-bg">
        <div className="container">
          <SectionHeading title={t.popularTitle} />
          <div className="course-grid home-grid">
            {popularCourses.map((course) => (
              <CourseCard key={course.id} course={course} language={language} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading title={t.startTitle} />
          <div className="steps-grid">
            {steps.map((step, index) => (
              <div className="step-card" key={step.title.ru}>
                <span className="step-number">0{index + 1}</span>
                <h3>{step.title[language]}</h3>
                <p>{step.info[language]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt-bg">
        <div className="container">
          <SectionHeading title={t.leaderboardTitle} />
          {leaderboard.length === 0 ? (
            <div className="empty-state-box">{t.messages.emptyLeaderboard}</div>
          ) : (
            <div className="leaderboard-grid">
              {leaderboard.slice(0, 5).map((item, index) => (
                <div className="leaderboard-card" key={item.id}>
                  <div className="rank">#{index + 1}</div>
                  <div className="avatar small">{renderAvatarContent(item.avatar, 'U')}</div>
                  <div>
                    <h4>{item.name}</h4>
                    <p>{item.achievements[0] ?? 'Student'}</p>
                  </div>
                  <strong>{item.score}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading title={t.reviewsTitle} />
          {highlightedReviews.length === 0 ? (
            <div className="empty-state-box">{t.messages.emptyReviews}</div>
          ) : (
            <div className="reviews-grid">
              {highlightedReviews.map((review) => (
                <div className="review-card" key={review.id}>
                  <div className="review-head">
                    <div className="avatar">{renderAvatarContent(review.avatar, 'U')}</div>
                    <div>
                      <h4>{review.name}</h4>
                      <span>{formatReviewDate(review.date, language)}</span>
                    </div>
                  </div>
                  <div className="stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
                  <p>{review.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section alt-bg">
        <div className="container">
          <SectionHeading title={t.pricingTitle} />
          <div className="pricing-grid home-pricing">
            {pricingPlans.map((plan) => (
              <div key={plan.id} className={plan.featured ? 'pricing-card featured' : 'pricing-card'}>
                <span className="plan-tag">{plan.name}</span>
                <h3>{plan.name}</h3>
                <div className="price">{plan.price} сом<span> / {t.subscription.monthly}</span></div>
                <p>{plan.description[language]}</p>
                <ul>
                  {plan.features[language].map((feature) => (
                    <li key={feature}><Check size={14} /> {feature}</li>
                  ))}
                </ul>
                <Link to={plan.id === 'free' ? '/courses' : `/pricing/checkout/${plan.id}`} className="btn btn-primary full-width">{t.buttons.choosePlan}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section faq-section">
        <div className="container">
          <SectionHeading title={t.faqTitle} />
          <div className="faq-list">
            {faqData.map((item, index) => (
              <FaqItem key={item.q[language]} question={item.q[language]} answer={item.a[language]} defaultOpen={index === 0} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function CourseCatalogPage({ t, favorites, onToggleFavorite }: { t: (typeof translations)[Lang]; favorites: string[]; onToggleFavorite: React.Dispatch<React.SetStateAction<string[]>> }) {
  const language = getCurrentLanguage()
  const location = useLocation()
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/'
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [level, setLevel] = useState('all')
  const [sort, setSort] = useState('popular')
  const categoryOptions = useMemo(() => Array.from(new Set(courses.map((course) => course.category))), [])

  const filteredCourses = useMemo(() => {
    let result = [...courses]
    if (search) result = result.filter((course) => course.title[language].toLowerCase().includes(search.toLowerCase()))
    if (category !== 'all') result = result.filter((course) => course.category === category)
    if (level !== 'all') result = result.filter((course) => course.level === level)
    switch (sort) {
      case 'rating':
        result.sort((a, b) => b.rating - a.rating)
        break
      case 'popular':
        result.sort((a, b) => Number(b.students.replace(/[^\d]/g, '')) - Number(a.students.replace(/[^\d]/g, '')))
        break
      default:
        break
    }
    return result
  }, [category, language, level, search, sort])

  return (
    <div className="container section page-block">
      <div className="page-top-actions">
        <SmartBackButton fallback={fallbackPath} label={language === 'ru' ? 'Назад' : language === 'kg' ? 'Кайтуу' : 'Back'} />
      </div>
      <div className="catalog-intro">
        <div>
          <span className="eyebrow">LEVEL UP</span>
          <h1>{t.nav.courses}</h1>
        </div>
      </div>
      <div className="toolbar">
        <label className="search-box">
          <Search size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.catalog.search} />
        </label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">{t.catalog.category}</option>
          {categoryOptions.map((categoryItem) => <option key={categoryItem} value={categoryItem}>{categoryItem}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="all">{t.catalog.level}</option>
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="popular">Popular</option>
          <option value="rating">Rating</option>
        </select>
      </div>
      <div className="course-grid">
        {filteredCourses.map((course) => (
          <CourseCard key={course.id} course={course} language={language} favorites={favorites} onToggleFavorite={onToggleFavorite} />
        ))}
      </div>
    </div>
  )
}

function CourseDetailPage({ t, completedLessons, onCourseComplete, subscription: _subscription, isLoggedIn }: { t: (typeof translations)[Lang]; completedLessons: string[]; onCourseComplete?: (courseId: string) => void; subscription?: UserSubscription; isLoggedIn: boolean }) {
  const language = getCurrentLanguage()
  const { courseId } = useParams()
  const navigate = useNavigate()
  const course = courseIndex[courseId ?? '']
  const [lockedLesson, setLockedLesson] = useState<string | null>(null)
  const [lockedReason, setLockedReason] = useState<'auth' | 'sequence'>('auth')
  useEffect(() => {
    if (!course) return
    if (course.lessons.every((lesson) => completedLessons.includes(lesson.id))) {
      onCourseComplete?.(course.id)
    }
  }, [completedLessons, course, onCourseComplete])

  if (!course) return <Navigate to="/courses" replace />

  const completedCount = course.lessons.filter((lesson) => completedLessons.includes(lesson.id)).length
  const nextLesson = course.lessons[completedCount] ?? course.lessons[0]

  return (
    <div className="container section page-block">
      <div className="page-top-actions">
        <SmartBackButton fallback="/courses" label={language === 'ru' ? 'Назад к курсам' : language === 'kg' ? 'Курстарга кайтуу' : 'Back to courses'} />
      </div>
      {lockedLesson && (
        <div className="access-modal-backdrop">
          <div className="access-modal-card">
            <h3>{lockedReason === 'auth' ? t.auth.login : t.buttons.nextLesson}</h3>
            <p>{lockedReason === 'auth' ? (language === 'ru' ? 'Войдите, чтобы открыть этот урок.' : language === 'kg' ? 'Бул сабакты ачуу үчүн кириңиз.' : 'Log in to open this lesson.') : (language === 'ru' ? 'Сначала завершите предыдущий урок.' : language === 'kg' ? 'Адегенде мурунку сабакты бүтүрүңүз.' : 'Complete the previous lesson first.')}</p>
            <div className="subscription-actions">
              <button type="button" className="btn btn-secondary small" onClick={() => setLockedLesson(null)}>Close</button>
              {lockedReason === 'auth' ? <Link to="/auth" className="btn btn-primary small">{t.auth.login}</Link> : <button type="button" className="btn btn-primary small" onClick={() => navigate(`/courses/${course.id}/lessons/${course.lessons[Math.max(0, course.lessons.findIndex((item) => item.id === lockedLesson) - 1)]?.id ?? course.lessons[0].id}`)}>{t.sections.previous}</button>}
            </div>
          </div>
        </div>
      )}

      <div className="course-hero" style={{ background: `linear-gradient(135deg, ${course.color}, #ffffff)` }}>
        <div>
          <span className="eyebrow">{course.badge}</span>
          <h1>{course.title[language]}</h1>
          <p>{course.description[language]}</p>
          <div className="meta-row">
            <span>{course.level}</span>
            <span>{course.duration}</span>
            <span>{course.rating} ★</span>
            <span>{course.students}</span>
          </div>
          <div className="hero-actions course-actions">
            <button type="button" className="btn btn-primary" onClick={() => {
              navigate(`/courses/${course.id}/lessons/${course.lessons[0].id}`)
            }}>{t.buttons.begin}</button>
            <button type="button" className="btn btn-secondary" onClick={() => {
              const nextIndex = course.lessons.findIndex((item) => item.id === nextLesson.id)
              if (!isLoggedIn && nextIndex >= 1) {
                setLockedReason('auth')
                setLockedLesson(nextLesson.id)
                return
              }
              const previousLesson = course.lessons[nextIndex - 1]
              if (previousLesson && !completedLessons.includes(previousLesson.id)) {
                setLockedReason('sequence')
                setLockedLesson(nextLesson.id)
                return
              }
              navigate(`/courses/${course.id}/lessons/${nextLesson.id}`)
            }}>{t.buttons.continue}</button>
          </div>
        </div>
        <div className="course-summary">
          <h3>{t.dashboard.progress}</h3>
          <div className="progress-bar"><span style={{ width: `${Math.round((completedCount / course.lessons.length) * 100)}%` }} /></div>
          <strong>{Math.round((completedCount / course.lessons.length) * 100)}%</strong>
          <p>{completedCount} / {course.lessons.length} {t.dashboard.completed}</p>
        </div>
      </div>

      <div className="grid-detail">
        <div className="detail-card">
          <h3>{t.sections.courseProgram}</h3>
          <ul className="check-list">
            {course.outline.map((item) => <li key={item}><Check size={14} /> {item}</li>)}
          </ul>
        </div>
        <div className="detail-card">
          <h3>{t.sections.whatLearn}</h3>
          <ul className="check-list">
            {course.tags.map((tag) => <li key={tag}><Sparkles size={14} /> {tag}</li>)}
          </ul>
        </div>
      </div>

      <div className="lesson-list">
        <h3>{course.lessons.length} lessons</h3>
        {course.lessons.map((lesson, index) => {
          const isDone = completedLessons.includes(lesson.id)
          const isLocked = !isLoggedIn && index >= 1
          return (
            <button type="button" key={lesson.id} className={isDone ? 'lesson-row complete' : 'lesson-row'} onClick={() => {
              if (isLocked) {
                setLockedReason('auth')
                setLockedLesson(lesson.id)
                return
              }
              const previousLesson = course.lessons[index - 1]
              if (previousLesson && !completedLessons.includes(previousLesson.id)) {
                setLockedReason('sequence')
                setLockedLesson(lesson.id)
                return
              }
              navigate(`/courses/${course.id}/lessons/${lesson.id}`)
            }} disabled={false}>
              <span className="lesson-index">{index + 1}</span>
              <span className="lesson-meta"><strong>{lesson.title[language]}</strong><small>{lesson.duration} • {lesson.type}</small></span>
              <span className="lesson-status">{isLocked ? t.auth.login : isDone ? t.generic.done : t.generic.open}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LessonPage({ t, completedLessons, subscription: _subscription, isLoggedIn, onCompleteLesson }: { t: (typeof translations)[Lang]; completedLessons: string[]; subscription?: UserSubscription; isLoggedIn: boolean; onCompleteLesson?: (courseId: string, lessonId: string) => void }) {
  const language = getCurrentLanguage()
  const { courseId, lessonId } = useParams()
  const navigate = useNavigate()
  const course = courseIndex[courseId ?? '']
  const lessonIndex = course?.lessons.findIndex((lesson) => lesson.id === lessonId) ?? -1
  const lesson = course?.lessons[lessonIndex]
  const safeLessonId = lesson?.id ?? ''
  const safeDuration = lesson?.duration ?? '20'
  const [watchElapsedSec, setWatchElapsedSec] = useState(0)

  useEffect(() => {
    if (!safeLessonId) return
    setWatchElapsedSec(0)
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      setWatchElapsedSec(elapsed)
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [safeLessonId])

  if (!course || !lesson) return <Navigate to="/courses" replace />

  const accessBlocked = !isLoggedIn && lessonIndex >= 1
  const isCompleted = completedLessons.includes(lesson.id)
  const watchRequirementSec = Math.min(120, Math.max(20, Number(safeDuration.replace(/[^\d]/g, '')) * 2))
  const watchReady = watchElapsedSec >= watchRequirementSec

  if (accessBlocked) {
    return (
      <div className="container section page-block">
        <div className="access-modal-backdrop">
          <div className="access-modal-card">
            <h3>{t.auth.login}</h3>
            <p>{language === 'ru' ? 'Войдите, чтобы открыть уроки 2-20.' : language === 'kg' ? '2-20 сабактарды ачуу үчүн кириңиз.' : 'Log in to unlock lessons 2-20.'}</p>
            <div className="subscription-actions">
              <button type="button" className="btn btn-secondary small" onClick={() => navigate(`/courses/${courseId}`)}>Back</button>
              <Link to="/auth" className="btn btn-primary small">{t.auth.login}</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const progress = Math.round((completedLessons.filter((id) => id.startsWith(`${course.id}-lesson-`)).length / course.lessons.length) * 100)
  const nextLesson = course.lessons[lessonIndex + 1]
  const previousLesson = course.lessons[lessonIndex - 1]

  return (
    <div className="container section lesson-page">
      <div className="page-top-actions">
        <SmartBackButton fallback={`/courses/${course.id}`} label={language === 'ru' ? 'Назад к урокам' : language === 'kg' ? 'Сабактарга кайтуу' : 'Back to lessons'} />
      </div>
      <div className="lesson-header">
        <div>
          <span className="eyebrow">{course.title[language]}</span>
          <h1>{lesson.title[language]}</h1>
          <button type="button" className="btn btn-secondary small" onClick={() => navigate(`/courses/${course.id}`)}>{t.sections.previous}</button>
        </div>
        <div className="lesson-progress">
          <small>{progress}%</small>
          <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
        </div>
      </div>

      <div className="lesson-layout">
        <div className="lesson-main">
          <div className="video-box">
            <div className="video-badge">{lesson.type}</div>
            <div className="video-frame-wrap">
              <iframe
                key={lesson.videoUrl}
                src={lesson.videoUrl}
                title={lesson.title[language]}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="video-frame"
                onError={() => console.error(`Video load error for ${lesson.id}`)}
              />
            </div>
            {!isCompleted && (
              <div className="lesson-watch-controls">
                <small>
                  {language === 'ru'
                    ? `Просмотр: ${Math.min(watchElapsedSec, watchRequirementSec)} / ${watchRequirementSec} сек`
                    : language === 'kg'
                      ? `Көрүү: ${Math.min(watchElapsedSec, watchRequirementSec)} / ${watchRequirementSec} сек`
                      : `Watch time: ${Math.min(watchElapsedSec, watchRequirementSec)} / ${watchRequirementSec} sec`}
                </small>
                <button
                  type="button"
                  className="btn btn-primary small"
                  disabled={!watchReady}
                  onClick={() => onCompleteLesson?.(course.id, lesson.id)}
                >
                  {language === 'ru' ? 'Завершить урок' : language === 'kg' ? 'Сабакты аяктоо' : 'Mark lesson complete'}
                </button>
              </div>
            )}
          </div>
        </div>

        <aside className="lesson-sidebar">
          <div className="detail-card sidebar-box">
            <h3>{t.sections.lessonNav}</h3>
            <div className="nav-buttons">
              {previousLesson && <button type="button" className="btn btn-secondary" onClick={() => navigate(`/courses/${course.id}/lessons/${previousLesson.id}`)}>{t.sections.previous}</button>}
              {nextLesson ? (
               <button type="button" className="btn btn-primary" onClick={() => {
                 if (!completedLessons.includes(lesson.id)) {
                   return
                 }
                 navigate(`/courses/${course.id}/lessons/${nextLesson.id}`)
               }} disabled={!completedLessons.includes(lesson.id)}>{t.buttons.nextLesson}</button>
             ) : (
               <button type="button" className="btn btn-primary" onClick={() => navigate('/dashboard')}>{t.sections.done}</button>
             )}
            </div>
          </div>
          <div className="detail-card sidebar-box">
            <h3>{t.generic.lessons}</h3>
            <div className="sidebar-list">
               {course.lessons.map((item, index) => (
               <button type="button" key={item.id} className={item.id === lesson.id ? 'sidebar-item active' : 'sidebar-item'} onClick={() => {
                 if (!isLoggedIn && index >= 1) {
                   navigate('/auth')
                   return
                 }
                 const previousLessonId = course.lessons[index - 1]?.id
                 if (index > 0 && previousLessonId && !completedLessons.includes(previousLessonId)) {
                   return
                 }
                 navigate(`/courses/${course.id}/lessons/${item.id}`)
               }} disabled={index > 0 && !completedLessons.includes(course.lessons[index - 1]?.id ?? '')}>
                 <span>{index + 1}</span>
                 <small>{item.title[language]}</small>
               </button>
             ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function AuthPage({ t, isLoggedIn, setIsLoggedIn, setUser, setAuthToken, onUserRegistered }: { t: (typeof translations)[Lang]; isLoggedIn: boolean; setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>; setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>; setAuthToken: React.Dispatch<React.SetStateAction<string>>; onUserRegistered?: () => Promise<void> | void }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; confirm?: string }>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: defaultUser.email, password: defaultUser.password, confirm: '' })

  useEffect(() => {
    if (isLoggedIn) navigate('/dashboard')
  }, [isLoggedIn, navigate])

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setNotice(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors: { name?: string; email?: string; password?: string; confirm?: string } = {}

    if (mode === 'register') {
      if (!form.name.trim()) nextErrors.name = 'Введите имя'
      if (!form.email.trim()) nextErrors.email = 'Введите email'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Введите корректный email'
      if (!form.password) nextErrors.password = 'Введите пароль'
      else if (form.password.length < 6) nextErrors.password = 'Минимум 6 символов'
      if (!form.confirm) nextErrors.confirm = 'Подтвердите пароль'
      else if (form.confirm !== form.password) nextErrors.confirm = 'Пароли не совпадают'
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors)
        return
      }
    } else {
      if (!form.email.trim()) nextErrors.email = 'Введите email'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Введите корректный email'
      if (!form.password) nextErrors.password = 'Введите пароль'
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors)
        return
      }
    }

    setIsSubmitting(true)
    setNotice(null)

    try {
      if (mode === 'register') {
        const response = await fetchJson<{ ok: true; token?: string; user: { email: string; name: string; firstName?: string; lastName?: string; phone?: string; bio?: string; avatar?: string; role?: string; createdAt?: string; accountStatus?: string; isBlocked?: boolean } }>(`${API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password })
        })

        const nextUser: UserProfile = {
          name: response.user.name,
          email: response.user.email,
          password: '',
          avatar: response.user.avatar ? 'U' : (response.user.name?.charAt(0)?.toUpperCase() || 'U'),
          role: response.user.role ?? 'User',
          firstName: response.user.firstName ?? '',
          lastName: response.user.lastName ?? '',
          phone: response.user.phone ?? '',
          bio: response.user.bio ?? '',
          profileImage: response.user.avatar ?? '',
          createdAt: response.user.createdAt
        }

        if (response.token) setAuthToken(response.token)
        setUserSubscription(nextUser.email, getDefaultSubscription('free'))
        setUser(nextUser)
        setIsLoggedIn(true)
        setStoredValue('levelup-users', [...getStoredValue<UserProfile[]>('levelup-users', []), nextUser])
        void onUserRegistered?.()
        navigate('/dashboard')
        return
      }

      const response = await fetchJson<{ ok: true; token?: string; user: { email: string; name: string; firstName?: string; lastName?: string; phone?: string; bio?: string; avatar?: string; role?: string; createdAt?: string; accountStatus?: string; isBlocked?: boolean } }>(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password })
      })

      const nextUser: UserProfile = {
        name: response.user.name,
        email: response.user.email,
        password: '',
        avatar: response.user.avatar ? 'U' : (response.user.name?.charAt(0)?.toUpperCase() || 'U'),
        role: response.user.role ?? 'User',
        firstName: response.user.firstName ?? '',
        lastName: response.user.lastName ?? '',
        phone: response.user.phone ?? '',
        bio: response.user.bio ?? '',
        profileImage: response.user.avatar ?? '',
        createdAt: response.user.createdAt
      }

      if (response.token) setAuthToken(response.token)
      setUserSubscription(nextUser.email, getUserSubscription(nextUser.email) ?? getDefaultSubscription(nextUser.role === 'Admin' ? 'aipro' : 'free'))
      setUser(nextUser)
      setIsLoggedIn(true)
      navigate(nextUser.role === 'Admin' ? '/admin' : '/dashboard')
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Ошибка входа'
      const message = rawMessage === 'Failed to fetch'
        ? 'Сервер недоступен. Проверьте, что Backend запущен и URL API корректен.'
        : rawMessage
      setErrors({ email: message, password: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-visual">
          <div className="brand-mark large"><Sparkles size={24} /></div>
          <h2>{t.auth.welcomeBack}</h2>
          <p>Build skills. Grow faster. Create the future.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-tabs">
            <button type="button" className={mode === 'login' ? 'auth-tab active' : 'auth-tab'} onClick={() => setMode('login')}>{t.auth.login}</button>
            <button type="button" className={mode === 'register' ? 'auth-tab active' : 'auth-tab'} onClick={() => setMode('register')}>{t.auth.register}</button>
          </div>

          {mode === 'register' && (
            <label>
              <span>{t.auth.name}</span>
              <input value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="Jane Doe" />
              {errors.name && <small className="field-error">{errors.name}</small>}
            </label>
          )}

          <label>
            <span>{t.auth.email}</span>
            <input type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} placeholder="name@example.com" />
            {errors.email && <small className="field-error">{errors.email}</small>}
          </label>

          <label>
            <span>{t.auth.password}</span>
            <div className="password-field">
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => updateForm('password', e.target.value)} placeholder="••••••••" />
              <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? t.auth.hide : t.auth.show}</button>
            </div>
            {errors.password && <small className="field-error">{errors.password}</small>}
          </label>

          {mode === 'register' && (
            <label>
              <span>{t.auth.confirm}</span>
              <input type="password" value={form.confirm} onChange={(e) => updateForm('confirm', e.target.value)} />
              {errors.confirm && <small className="field-error">{errors.confirm}</small>}
            </label>
          )}

          {mode === 'login' && (
            <div className="options-row">
              <button type="button" className="text-button" onClick={() => setNotice(t.messages.resetLinkSent)}>{t.auth.forget}</button>
            </div>
          )}

          <button type="submit" className="btn btn-primary full-width" disabled={isSubmitting}>
            {isSubmitting ? t.generic.loading : mode === 'login' ? t.auth.login : t.auth.register}
          </button>
          {notice && <small className="field-note">{notice}</small>}
        </form>
      </div>
    </div>
  )
}

function DashboardPage({ t, user, completedLessons, subscription, onUpdateProfile: _onUpdateProfile, onChangePassword: _onChangePassword, reviews: _reviews, language, setLanguage, theme, setTheme, onLogout }: { t: (typeof translations)[Lang]; user: UserProfile | null; completedLessons: string[]; subscription?: UserSubscription; onUpdateProfile?: (profile: Partial<UserProfile>) => { ok: boolean; message: string }; onChangePassword?: (currentPassword: string, nextPassword: string, confirmPassword: string) => { ok: boolean; message: string }; reviews: Review[]; language: Lang; setLanguage: React.Dispatch<React.SetStateAction<Lang>>; theme: Theme; setTheme: React.Dispatch<React.SetStateAction<Theme>>; onLogout: () => void }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [aiGateOpen, setAiGateOpen] = useState(false)
  const userName = user?.name ?? 'Student'
  const resolvedSubscription = user ? (subscription ?? getUserSubscription(user.email)) : subscription ?? getDefaultSubscription('free')
  const userProgress = user ? getCurrentUserProgress(user) : createEmptyProgress()
  const completedCount = userProgress.lessonsCompleted.length || completedLessons.length
  const progress = courses.map((course) => {
    const count = course.lessons.filter((lesson) => (user ? userProgress.lessonsCompleted : completedLessons).includes(lesson.id)).length
    return { course, progress: Math.round((count / course.lessons.length) * 100) }
  })
  const overallProgress = progress.length ? Math.round(progress.reduce((sum, item) => sum + item.progress, 0) / progress.length) : 0
  const remainingDays = getRemainingDays(resolvedSubscription)
  const renewalTarget = resolvedSubscription.planId === 'free' ? '/pricing' : `/pricing/checkout/${resolvedSubscription.planId}`
  const subscriptionStatusLabel = resolvedSubscription.status === 'active' ? t.subscription.statusActive : resolvedSubscription.status === 'expired' ? t.subscription.statusExpired : t.subscription.statusInactive
  const subscriptionPlanName = resolvedSubscription.planId === 'free' ? t.subscription.free : resolvedSubscription.planId === 'pro' ? t.subscription.pro : t.subscription.aipro
  const planTag = PLAN_META[resolvedSubscription.planId].name
  const endDateLabel = resolvedSubscription.endsAt ? new Date(resolvedSubscription.endsAt).toLocaleDateString() : '—'
  const isAiUnlocked = hasActiveAiAccess(resolvedSubscription)
  const popularCourses = courses.slice(0, 3)
  const recentLessons = courses.slice(0, 3).map((course) => ({
    course,
    title: course.title[language],
    lessons: course.lessons.slice(0, 3).map((lesson) => lesson.title[language])
  }))

  const navItems = [
    { label: 'Главная', icon: LayoutDashboard, to: '/dashboard', kind: 'route' },
    { label: 'Курсы', icon: BookOpen, to: '/dashboard/courses', kind: 'route' },
    { label: 'Мои уроки', icon: GraduationCap, to: '/dashboard/my-lessons', kind: 'route' },
    { label: 'Мой рейтинг', icon: TrendingUp, to: '/dashboard/rating', kind: 'route' },
    { label: 'Отзывы', icon: MessageSquareText, to: '/dashboard/reviews', kind: 'route' },
    { label: 'Тарифы', icon: WalletCards, to: '/dashboard/pricing', kind: 'route' },
    { label: 'AI Assistant', icon: Brain, to: '/dashboard/ai', kind: 'action' },
    { label: 'FAQ', icon: HelpCircle, to: '/dashboard/faq', kind: 'route' },
    { label: 'Настройки профиля', icon: Settings, to: '/dashboard/profile', kind: 'route' },
    { label: t.dashboard.logout, icon: LogOut, to: '/auth', kind: 'logout' }
  ] as const

  useEffect(() => {
    setSidebarOpen(false)
  }, [navigate])

  const handleSidebarAction = (index: string) => {
    setSidebarOpen(false)
    if (index === 'AI Assistant') {
      if (!isAiUnlocked) {
        setAiGateOpen(true)
        return
      }
      navigate('/dashboard/ai')
      return
    }
    if (index === 'logout') {
      onLogout()
    }
  }

  return (
    <div className="dashboard-shell">
      <aside className={sidebarOpen ? 'dashboard-sidebar open' : 'dashboard-sidebar'}>
        <div className="dashboard-sidebar-header">
          <Link className="brand dashboard-brand" to="/dashboard" aria-label="LEVEL UP dashboard">
            <img src={siteLogo} alt="LEVEL UP" className="brand-logo-image" />
          </Link>
          <button type="button" className="dashboard-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="dashboard-nav">
          {navItems.map(({ label, icon: Icon, to, kind }) => {
            if (kind === 'logout') {
              return (
                <button key={label} type="button" className="dashboard-nav-item danger" onClick={() => handleSidebarAction('logout')}>
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              )
            }

            if (kind === 'action') {
              return (
                <button key={label} type="button" className="dashboard-nav-item" onClick={() => handleSidebarAction('AI Assistant')}>
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              )
            }

            return (
              <NavLink key={label} to={to} className={({ isActive }) => (isActive ? 'dashboard-nav-item active' : 'dashboard-nav-item')} onClick={() => setSidebarOpen(false)}>
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="dashboard-sidebar-card">
          <p>{language === 'ru' ? 'Текущий тариф' : language === 'kg' ? 'Учурдагы тариф' : 'Current plan'}</p>
          <strong>{planTag}</strong>
          <span>{subscriptionStatusLabel}</span>
        </div>
      </aside>

      <div className="dashboard-main-panel">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-left">
            <button type="button" className="dashboard-mobile-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle sidebar">
              <Menu size={18} />
            </button>
            <label className="dashboard-search">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.generic.search} />
            </label>
          </div>

          <div className="dashboard-topbar-actions">
            <Link to="/" className="dashboard-home-link">
              <Home size={16} />
              <span>{t.nav.home}</span>
            </Link>
            <button type="button" className="dashboard-icon-btn" aria-label="Notifications">
              <Bell size={17} />
            </button>
            <div className="dashboard-language-switch" aria-label="Language switcher">
              {(['kg', 'ru', 'en'] as const).map((item) => (
                <button key={item} type="button" className={language === item ? 'lang active' : 'lang'} onClick={() => setLanguage(item)}>
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
            <button type="button" className="dashboard-icon-btn" aria-label="Toggle theme" onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}>
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <Link to="/dashboard/profile" className="dashboard-profile-button">
              <div className="avatar small">{renderAvatarContent(user?.avatar, user?.name?.charAt(0)?.toUpperCase() ?? 'S')}</div>
              <div>
                <strong>{userName}</strong>
                <span>{user?.role ?? 'Student'}</span>
              </div>
            </Link>
          </div>
        </header>

        <main className="dashboard-content">
          <section className="dashboard-hero">
            <div className="dashboard-hero-copy">
              <span className="eyebrow">LEVEL UP</span>
              <h1>{t.dashboard.greeting} {userName}</h1>
              <p>{language === 'ru' ? 'Продолжайте учиться, отслеживайте прогресс и используйте AI-поддержку в одном месте.' : language === 'kg' ? 'Окууну улантыңыз, прогрессиңизди көзөмөлдөңүз жана AI жардамчыны бир жерде пайдаланыңыз.' : 'Keep learning, track your progress, and use AI support from one place.'}</p>
              <div className="dashboard-hero-actions">
                <Link to="/courses" className="btn btn-primary">{t.buttons.continue}</Link>
                <Link to="/pricing" className="btn btn-secondary">{t.subscription.changePlan}</Link>
              </div>
            </div>

            <div className="dashboard-plan-card">
              <div className="subscription-tier-pill">{planTag}</div>
              <h3>{subscriptionPlanName}</h3>
              <div className="dashboard-plan-details">
                <div>
                  <span>{language === 'ru' ? 'Окончание' : language === 'kg' ? 'Аяктоо' : 'Ends'}</span>
                  <strong>{endDateLabel}</strong>
                </div>
                <div>
                  <span>{language === 'ru' ? 'Осталось' : language === 'kg' ? 'Калды' : 'Left'}</span>
                  <strong>{remainingDays} {t.generic.days}</strong>
                </div>
              </div>
              <Link to={renewalTarget} className="btn btn-primary full-width">{t.subscription.renew}</Link>
            </div>
          </section>

          <section className="dashboard-metrics">
            <div className="stat-card"><BookOpen size={18} /><div><strong>{courses.length}</strong><span>{t.dashboard.courses}</span></div></div>
            <div className="stat-card"><TrendingUp size={18} /><div><strong>{completedCount}</strong><span>{t.dashboard.completed}</span></div></div>
            <div className="stat-card"><Target size={18} /><div><strong>{overallProgress}%</strong><span>{t.dashboard.progress}</span></div></div>
            <div className="stat-card"><Crown size={18} /><div><strong>{userProgress.totalScore}</strong><span>{t.dashboard.rating}</span></div></div>
          </section>

          <section className="dashboard-grid-two">
            <div className="detail-card dashboard-compact-card">
              <div className="card-header-row">
                <h3>{language === 'ru' ? 'Популярные курсы' : language === 'kg' ? 'Танымал курстар' : 'Popular courses'}</h3>
                <Link to="/courses" className="text-link">{t.buttons.learnMore}</Link>
              </div>
              <div className="popular-course-list">
                {popularCourses.map((course) => (
                  <Link key={course.id} to={`/courses/${course.id}`} className="popular-course-item">
                    <div className="course-pill" style={{ background: course.color }}>{course.badge}</div>
                    <div>
                      <strong>{course.title[language]}</strong>
                      <small>{course.duration}</small>
                    </div>
                    <span>{course.rating} ★</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="detail-card dashboard-compact-card">
              <div className="card-header-row">
                <h3>{language === 'ru' ? 'Последние уроки' : language === 'kg' ? 'Соңку сабактар' : 'Recent lessons'}</h3>
                <Link to="/courses" className="text-link">{t.buttons.continue}</Link>
              </div>
              <div className="recent-lessons-list">
                {recentLessons.map(({ course, title }) => (
                  <div key={course.id} className="recent-lesson-item">
                    <div className="mini-avatar">{course.badge.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <strong>{title}</strong>
                      <small>{course.duration}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="dashboard-grid-two">
            <div className="detail-card dashboard-compact-card">
              <div className="card-header-row">
                <h3>{language === 'ru' ? 'Прогресс обучения' : language === 'kg' ? 'Окуу прогресси' : 'Learning progress'}</h3>
              </div>
              <div className="progress-list">
                {progress.slice(0, 4).map(({ course, progress: percent }) => (
                  <div key={course.id} className="progress-row">
                    <div className="progress-meta">
                      <strong>{course.title[language]}</strong>
                      <small>{percent}%</small>
                    </div>
                    <div className="progress-bar"><span style={{ width: `${percent}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div id="dashboard-ai-assistant" className="detail-card dashboard-ai-card">
              <div className="card-header-row">
                <h3>{language === 'ru' ? 'AI Assistant' : language === 'kg' ? 'AI Assistant' : 'AI Assistant'}</h3>
                <span className={isAiUnlocked ? 'ai-status' : 'ai-status ai-status-locked'}>{isAiUnlocked ? 'online' : 'locked'}</span>
              </div>
              <p>{isAiUnlocked ? t.ai.ready : t.ai.blocked}</p>
              <Link to={isAiUnlocked ? '/dashboard/ai' : '/dashboard/pricing'} className="btn btn-primary small">{isAiUnlocked ? (language === 'ru' ? 'Открыть чат' : language === 'kg' ? 'Чатты ачуу' : 'Open chat') : t.ai.connectPlan}</Link>
            </div>
          </section>

          <section className="detail-card dashboard-profile-summary">
            <div className="card-header-row">
              <h3>{t.subscription.title}</h3>
              <Link to="/pricing" className="text-link">{t.subscription.changePlan}</Link>
            </div>
            <div className="subscription-summary-inline">
              <div className="subscription-summary-box">
                <span className="subscription-tier-pill">{planTag}</span>
                <h4>{subscriptionPlanName}</h4>
              </div>
              <div className="subscription-meta-inline">
                <div><span>{t.subscription.nextRenewal}</span><strong>{remainingDays} {t.subscription.monthly}</strong></div>
                <div><span>{t.subscription.history}</span><strong>{resolvedSubscription.history.length}</strong></div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {aiGateOpen && (
        <div className="access-modal-backdrop">
          <div className="access-modal-card">
            <h3>AI Assistant</h3>
            <p>{t.ai.blocked}</p>
            <div className="subscription-actions">
              <button type="button" className="btn btn-secondary small" onClick={() => setAiGateOpen(false)}>{language === 'ru' ? 'Позже' : language === 'kg' ? 'Кийинчерээк' : 'Later'}</button>
              <Link to="/dashboard/pricing" className="btn btn-primary small" onClick={() => setAiGateOpen(false)}>{t.ai.connectPlan}</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DashboardAiPage({ language, subscription, userEmail }: { language: Lang; subscription?: UserSubscription; userEmail?: string }) {
  return (
    <div className="container section page-block">
      <div className="page-top-actions">
        <SmartBackButton fallback="/dashboard" label={language === 'ru' ? 'Назад в Dashboard' : language === 'kg' ? 'Dashboard tagasi' : 'Back to Dashboard'} />
      </div>
      <AIChatPanel language={language} subscription={subscription} userEmail={userEmail} pricingPath="/dashboard/pricing" />
    </div>
  )
}

function DashboardLessonsPage({ completedLessons, language }: { completedLessons: string[]; language: Lang }) {
  const progressEntries = courses.map((course) => {
    const doneCount = course.lessons.filter((lesson) => completedLessons.includes(lesson.id)).length
    const percent = Math.round((doneCount / course.lessons.length) * 100)
    return { course, doneCount, percent }
  })

  return (
    <div className="container section page-block">
      <div className="page-top-actions">
        <SmartBackButton fallback="/dashboard" label={language === 'ru' ? 'Назад в Dashboard' : language === 'kg' ? 'Dashboard кайт' : 'Back to Dashboard'} />
      </div>

      <div className="catalog-intro">
        <div>
          <span className="eyebrow">LEVEL UP</span>
          <h1>{language === 'ru' ? 'Мои уроки' : language === 'kg' ? 'Менин сабактарым' : 'My lessons'}</h1>
        </div>
      </div>

      <div className="course-grid">
        {progressEntries.map(({ course, doneCount, percent }) => (
          <div key={course.id} className="course-card detail-card">
            <div className="course-card-top">
              <span className="plan-tag" style={{ background: course.color }}>{course.badge}</span>
              <span className="course-meta-tag">{doneCount}/{course.lessons.length}</span>
            </div>
            <h3>{course.title[language]}</h3>
            <p>{course.description[language]}</p>
            <div className="progress-row">
              <div className="progress-bar"><span style={{ width: `${percent}%` }} /></div>
              <small>{percent}%</small>
            </div>
            <Link to={`/courses/${course.id}`} className="btn btn-primary full-width">{language === 'ru' ? 'Продолжить' : language === 'kg' ? 'Улантуу' : 'Continue'}</Link>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProfilePage({ t, user, completedLessons: _completedLessons, subscription, onUpdateProfile, onChangePassword, onUpdateNotifications, notifications, reviews: _reviews, language, setLanguage, theme, setTheme, onLogout }: { t: (typeof translations)[Lang]; user: UserProfile | null; completedLessons: string[]; subscription?: UserSubscription; onUpdateProfile?: (profile: Partial<UserProfile>) => { ok: boolean; message: string }; onChangePassword?: (currentPassword: string, nextPassword: string, confirmPassword: string) => { ok: boolean; message: string }; onUpdateNotifications?: (settings: NotificationSettings) => { ok: boolean; message: string }; notifications: NotificationSettings; reviews: Review[]; language: Lang; setLanguage: React.Dispatch<React.SetStateAction<Lang>>; theme: Theme; setTheme: React.Dispatch<React.SetStateAction<Theme>>; onLogout: () => void }) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile')
  const [profileNotice, setProfileNotice] = useState<string | null>(null)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const [notificationNotice, setNotificationNotice] = useState<string | null>(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(notifications)
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null)
  const [avatarCrop, setAvatarCrop] = useState({ scale: 1.18, x: 0, y: 0 })
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? user?.name?.split(' ')[0] ?? '',
    lastName: user?.lastName ?? user?.name?.split(' ').slice(1).join(' ') ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    bio: user?.bio ?? '',
    avatar: user?.profileImage ?? user?.avatar ?? ''
  })

  useEffect(() => {
    setProfileForm({
      firstName: user?.firstName ?? user?.name?.split(' ')[0] ?? '',
      lastName: user?.lastName ?? user?.name?.split(' ').slice(1).join(' ') ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      bio: user?.bio ?? '',
      avatar: user?.profileImage ?? user?.avatar ?? ''
    })
  }, [user])

  useEffect(() => {
    setNotifSettings(notifications)
  }, [notifications])

  const resolvedSubscription = user ? getUserSubscription(user.email) : subscription ?? getDefaultSubscription('free')
  const userName = user?.name ?? 'Student'
  const joinedAt = user?.createdAt ? new Date(user.createdAt).toLocaleDateString(language === 'kg' ? 'ky-KG' : language === 'ru' ? 'ru-RU' : 'en-US') : '—'

  const navItems: Array<{ label: string; icon: typeof Home; to: string; action?: 'ai' | 'logout' }> = [
    { label: 'Главная', icon: Home, to: '/dashboard' },
    { label: 'Курсы', icon: BookOpen, to: '/dashboard/courses' },
    { label: 'Мои уроки', icon: GraduationCap, to: '/dashboard/my-lessons' },
    { label: 'Мой рейтинг', icon: TrendingUp, to: '/dashboard/rating' },
    { label: 'Отзывы', icon: MessageSquareText, to: '/dashboard/reviews' },
    { label: 'Тарифы', icon: WalletCards, to: '/dashboard/pricing' },
    { label: 'AI Assistant', icon: Brain, to: '/dashboard/ai', action: 'ai' },
    { label: 'FAQ', icon: HelpCircle, to: '/dashboard/faq' },
    { label: 'Настройки профиля', icon: Settings, to: '/dashboard/profile' },
    { label: t.dashboard.logout, icon: LogOut, to: '/auth', action: 'logout' }
  ]

  const handleSidebarAction = (action: 'ai' | 'logout') => {
    setSidebarOpen(false)
    if (action === 'ai') {
      if (!canAccessAiAssistant(resolvedSubscription.planId)) {
        navigate('/dashboard/ai')
        return
      }
      navigate('/dashboard/ai')
      return
    }
    onLogout()
  }

  const applyCroppedAvatar = async (source: string, crop: { scale: number; x: number; y: number }) => {
    const image = new Image()
    image.src = source

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Image load failed'))
    })

    const canvas = document.createElement('canvas')
    const size = 512
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Canvas is unavailable')
    }

    context.clearRect(0, 0, size, size)
    context.save()
    context.beginPath()
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    context.closePath()
    context.clip()

    const scaledWidth = image.width * crop.scale
    const scaledHeight = image.height * crop.scale
    const offsetX = (size - scaledWidth) / 2 + crop.x * 2.2
    const offsetY = (size - scaledHeight) / 2 + crop.y * 2.2

    context.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight)
    context.restore()

    return canvas.toDataURL('image/jpeg', 0.9)
  }

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setProfileNotice(t.profilePhoto.invalidType)
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileNotice(t.profilePhoto.invalidSize)
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const nextImage = typeof reader.result === 'string' ? reader.result : ''
      setAvatarDraft(nextImage)
      setAvatarCrop({ scale: 1.18, x: 0, y: 0 })
      setProfileNotice(null)
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const handleSaveAvatar = async () => {
    if (!avatarDraft) return

    try {
      setIsSavingAvatar(true)
      const nextImage = await applyCroppedAvatar(avatarDraft, avatarCrop)
      setProfileForm((current) => ({ ...current, avatar: nextImage }))

      const result = onUpdateProfile?.({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        phone: profileForm.phone,
        bio: profileForm.bio,
        profileImage: nextImage,
        name: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
        avatar: nextImage
      })

      if (result?.ok) {
        setProfileNotice(t.profilePhoto.saved)
        setAvatarDraft(null)
      } else {
        setProfileNotice(result?.message ?? t.generic.error)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t.generic.error
      setProfileNotice(message)
    } finally {
      setIsSavingAvatar(false)
    }
  }

  const handleDeleteAvatar = () => {
    if (!user || !window.confirm(t.profilePhoto.confirmDelete)) return

    const result = onUpdateProfile?.({
      firstName: profileForm.firstName,
      lastName: profileForm.lastName,
      phone: profileForm.phone,
      bio: profileForm.bio,
      profileImage: '',
      name: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
      avatar: ''
    })

    setProfileForm((current) => ({ ...current, avatar: '' }))
    setProfileNotice(result?.ok ? t.profilePhoto.deleted : result?.message ?? t.generic.error)
    setAvatarDraft(null)
  }

  const tabs = [
    { id: 'profile', label: language === 'ru' ? 'Личная информация' : language === 'kg' ? 'Жеке маалымат' : 'Personal details' },
    { id: 'security', label: language === 'ru' ? 'Безопасность' : language === 'kg' ? 'Коопсуздук' : 'Security' },
    { id: 'notifications', label: language === 'ru' ? 'Уведомления' : language === 'kg' ? 'Эскертүүлөр' : 'Notifications' }
  ] as const

  return (
    <div className="dashboard-shell">
      <div className="page-top-actions dashboard-inner-back">
        <SmartBackButton fallback="/dashboard" label={language === 'ru' ? 'Назад в Dashboard' : language === 'kg' ? 'Dashboard кайт' : 'Back to Dashboard'} />
      </div>
      <aside className={sidebarOpen ? 'dashboard-sidebar open' : 'dashboard-sidebar'}>
        <div className="dashboard-sidebar-header">
          <Link className="brand dashboard-brand" to="/dashboard" aria-label="LEVEL UP dashboard">
            <img src={siteLogo} alt="LEVEL UP" className="brand-logo-image" />
          </Link>
          <button type="button" className="dashboard-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="dashboard-nav">
          {navItems.map(({ label, icon: Icon, to, action }) => {
            if (action === 'logout') {
              return <button key={label} type="button" className="dashboard-nav-item danger" onClick={() => handleSidebarAction('logout')}><Icon size={18} /><span>{label}</span></button>
            }
            if (action === 'ai') {
              return <button key={label} type="button" className="dashboard-nav-item" onClick={() => handleSidebarAction('ai')}><Icon size={18} /><span>{label}</span></button>
            }
            return <NavLink key={label} to={to} className={({ isActive }) => (isActive ? 'dashboard-nav-item active' : 'dashboard-nav-item')} onClick={() => setSidebarOpen(false)}><Icon size={18} /><span>{label}</span></NavLink>
          })}
        </nav>
      </aside>

      <div className="dashboard-main-panel">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-left">
            <button type="button" className="dashboard-mobile-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle sidebar"><Menu size={18} /></button>
            <label className="dashboard-search"><Search size={16} /><input value={user?.name ?? 'Student'} readOnly placeholder={t.auth.name} /></label>
          </div>
          <div className="dashboard-topbar-actions">
            <Link to="/" className="dashboard-home-link">
              <Home size={16} />
              <span>{t.nav.home}</span>
            </Link>
            <button type="button" className="dashboard-icon-btn" aria-label="Notifications"><Bell size={17} /></button>
            <div className="dashboard-language-switch" aria-label="Language switcher">
              {(['kg', 'ru', 'en'] as const).map((item) => (
                <button key={item} type="button" className={language === item ? 'lang active' : 'lang'} onClick={() => setLanguage(item)}>{item.toUpperCase()}</button>
              ))}
            </div>
            <button type="button" className="dashboard-icon-btn" aria-label="Toggle theme" onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button>
            <Link to="/dashboard/profile" className="dashboard-profile-button"><div className="avatar small">{user?.profileImage ? <img src={user.profileImage} alt={userName} className="profile-avatar-image" /> : renderAvatarContent(user?.avatar, user?.name?.charAt(0)?.toUpperCase() ?? 'S')}</div><div><strong>{userName}</strong><span>{user?.role ?? 'Student'}</span></div></Link>
          </div>
        </header>

        <main className="dashboard-content profile-page-content">
          <section className="detail-card profile-card-wrap">
            <div className="profile-card-header">
              <div className="profile-user-meta">
                <div className="avatar large profile-avatar">{(profileForm.avatar || user?.profileImage ? <img src={profileForm.avatar || user?.profileImage || ''} alt={userName} className="profile-avatar-image" /> : renderAvatarContent(user?.avatar, user?.name?.charAt(0)?.toUpperCase() ?? 'S'))}</div>
                <div>
                  <p className="profile-kicker">{t.dashboard.title}</p>
                  <h2>{userName}</h2>
                  <small>{user?.role ?? 'Student'}</small>
                </div>
              </div>
              <Link to="/dashboard" className="btn btn-secondary small">{t.nav.home}</Link>
            </div>

            <div className="settings-tab-row">
              {tabs.map((tab) => (
                <button key={tab.id} type="button" className={activeTab === tab.id ? 'settings-tab active' : 'settings-tab'} onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'profile' && (
              <div className="profile-grid settings-main-grid">
                <div className="profile-info-block">
                  <h3>{language === 'ru' ? 'Личная информация' : language === 'kg' ? 'Жеке маалымат' : 'Personal details'}</h3>
                  <form className="settings-form" onSubmit={(event) => {
                    event.preventDefault()
                    const result = onUpdateProfile?.({
                      firstName: profileForm.firstName,
                      lastName: profileForm.lastName,
                      phone: profileForm.phone,
                      bio: profileForm.bio,
                      profileImage: profileForm.avatar,
                      email: profileForm.email,
                      name: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
                    })
                    setProfileNotice(result?.message ?? null)
                  }}>
                    <div className="profile-photo-box">
                      <button type="button" className="profile-photo-trigger" onClick={() => fileInputRef.current?.click()} aria-label={t.profilePhoto.uploadTitle}>
                        <div className="profile-photo-preview">{profileForm.avatar ? <img src={profileForm.avatar} alt="Profile avatar" className="profile-avatar-image" /> : <UserRound size={28} />}</div>
                      </button>
                      <div className="profile-photo-actions">
                        <strong>{t.profilePhoto.uploadTitle}</strong>
                        <small>{t.profilePhoto.cropHint}</small>
                        <div className="profile-photo-buttons">
                          <button type="button" className="btn btn-secondary small" onClick={() => fileInputRef.current?.click()}>{t.profilePhoto.upload}</button>
                          {profileForm.avatar && <button type="button" className="btn btn-secondary small" onClick={() => fileInputRef.current?.click()}>{t.profilePhoto.change}</button>}
                          {profileForm.avatar && <button type="button" className="btn btn-danger small" onClick={handleDeleteAvatar}>{t.profilePhoto.remove}</button>}
                        </div>
                        <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden onChange={handleAvatarUpload} />
                      </div>
                    </div>

                    <div className="two-column-fields">
                      <label><span>{language === 'ru' ? 'Имя' : language === 'kg' ? 'Аты' : 'First name'}</span><input value={profileForm.firstName} onChange={(event) => setProfileForm((current) => ({ ...current, firstName: event.target.value }))} /></label>
                      <label><span>{language === 'ru' ? 'Фамилия' : language === 'kg' ? 'Фамилия' : 'Last name'}</span><input value={profileForm.lastName} onChange={(event) => setProfileForm((current) => ({ ...current, lastName: event.target.value }))} /></label>
                    </div>

                    <label><span>{t.auth.email}</span><input value={profileForm.email} readOnly /></label>
                    <label><span>{language === 'ru' ? 'Номер телефона' : language === 'kg' ? 'Телефон номери' : 'Phone number'}</span><input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} placeholder={language === 'ru' ? '+996 555 123 456' : language === 'kg' ? '+996 555 123 456' : '+996 555 123 456'} /></label>
                    <label><span>{language === 'ru' ? 'Информация о пользователе' : language === 'kg' ? 'Колдонуучу тууралуу' : 'About you'}</span><textarea rows={5} value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} placeholder={language === 'ru' ? 'Расскажите немного о себе...' : language === 'kg' ? 'Өзүңүз жөнүндө кыскача айтып бериңиз...' : 'Tell us a bit about yourself...'} /></label>
                    <button type="submit" className="btn btn-primary small full-width">{language === 'ru' ? 'Сохранить данные' : language === 'kg' ? 'Маалыматты сактоо' : 'Save information'}</button>
                    {profileNotice && <small className="field-note">{profileNotice}</small>}
                  </form>

                  {avatarDraft && (
                    <div className="photo-editor-backdrop" role="dialog" aria-modal="true">
                      <div className="photo-editor-card">
                        <div className="photo-editor-header">
                          <h4>{t.profilePhoto.uploadTitle}</h4>
                          <button type="button" className="photo-editor-close" onClick={() => setAvatarDraft(null)} aria-label={t.profilePhoto.cancel}><X size={16} /></button>
                        </div>

                        <div className="photo-editor-crop">
                          <img src={avatarDraft} alt="Upload preview" style={{ transform: `translate(${avatarCrop.x}px, ${avatarCrop.y}px) scale(${avatarCrop.scale})` }} />
                        </div>

                        <div className="photo-editor-controls">
                          <label>
                            <span>{t.profilePhoto.zoom}</span>
                            <input type="range" min="1" max="2.3" step="0.05" value={avatarCrop.scale} onChange={(event) => setAvatarCrop((current) => ({ ...current, scale: Number(event.target.value) }))} />
                          </label>
                          <div className="photo-editor-move">
                            <button type="button" onClick={() => setAvatarCrop((current) => ({ ...current, x: current.x - 12 }))}>◀</button>
                            <button type="button" onClick={() => setAvatarCrop((current) => ({ ...current, y: current.y - 12 }))}>▲</button>
                            <button type="button" onClick={() => setAvatarCrop((current) => ({ ...current, y: current.y + 12 }))}>▼</button>
                            <button type="button" onClick={() => setAvatarCrop((current) => ({ ...current, x: current.x + 12 }))}>▶</button>
                          </div>
                        </div>

                        <div className="photo-editor-actions">
                          <button type="button" className="btn btn-secondary small" onClick={() => setAvatarDraft(null)}>{t.profilePhoto.cancel}</button>
                          <button type="button" className="btn btn-primary small" onClick={() => void handleSaveAvatar()} disabled={isSavingAvatar}>{isSavingAvatar ? t.profilePhoto.uploading : t.profilePhoto.save}</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="profile-info-block">
                  <h3>{resolvedSubscription.planId === 'free' ? t.subscription.free : resolvedSubscription.planId === 'pro' ? t.subscription.pro : t.subscription.aipro}</h3>
                  <div className="profile-plan-box">
                    <span className="subscription-tier-pill">{PLAN_META[resolvedSubscription.planId].name}</span>
                    <strong>{resolvedSubscription.endsAt ? new Date(resolvedSubscription.endsAt).toLocaleDateString() : '—'}</strong>
                    <small>{language === 'ru' ? 'Дата окончания подписки' : language === 'kg' ? 'Жазылуунун аякталуучу күнү' : 'Subscription end date'}</small>
                  </div>
                  <Link to="/pricing" className="btn btn-secondary full-width">{t.subscription.changePlan}</Link>
                  <div className="profile-meta-card">
                    <span>{language === 'ru' ? 'Дата регистрации' : language === 'kg' ? 'Катталуу күнү' : 'Joined'}</span>
                    <strong>{joinedAt}</strong>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="profile-grid settings-main-grid">
                <div className="profile-info-block security-panel">
                  <h3>{language === 'ru' ? 'Безопасность' : language === 'kg' ? 'Коопсуздук' : 'Security'}</h3>
                  <form className="settings-form" onSubmit={(event) => {
                    event.preventDefault()
                    const result = onChangePassword?.(currentPassword, newPassword, confirmPassword)
                    setPasswordNotice(result?.message ?? null)
                    if (result?.ok) {
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }
                  }}>
                    <label>
                      <span>{language === 'ru' ? 'Текущий пароль' : language === 'kg' ? 'Учурдагы сырсөз' : 'Current password'}</span>
                      <div className="password-field compact-password-field">
                        <input type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                        <button type="button" onClick={() => setShowCurrentPassword((value) => !value)}>{showCurrentPassword ? t.auth.hide : t.auth.show}</button>
                      </div>
                    </label>
                    <label>
                      <span>{language === 'ru' ? 'Новый пароль' : language === 'kg' ? 'Жаңы сырсөз' : 'New password'}</span>
                      <div className="password-field compact-password-field">
                        <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                        <button type="button" onClick={() => setShowNewPassword((value) => !value)}>{showNewPassword ? t.auth.hide : t.auth.show}</button>
                      </div>
                    </label>
                    <label>
                      <span>{language === 'ru' ? 'Подтвердите новый пароль' : language === 'kg' ? 'Жаңы сырсөздү ыргектеңиз' : 'Confirm new password'}</span>
                      <div className="password-field compact-password-field">
                        <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                        <button type="button" onClick={() => setShowConfirmPassword((value) => !value)}>{showConfirmPassword ? t.auth.hide : t.auth.show}</button>
                      </div>
                    </label>
                    <div className="field-hint">
                      <span>{language === 'ru' ? 'Минимум 6 символов' : language === 'kg' ? 'Минимум 6 белги' : 'Minimum 6 characters'}</span>
                    </div>
                    <button type="submit" className="btn btn-primary small full-width">{language === 'ru' ? 'Изменить пароль' : language === 'kg' ? 'Сырсөздү өзгөртүү' : 'Change password'}</button>
                    {passwordNotice && <small className="field-note">{passwordNotice}</small>}
                  </form>
                </div>
                <div className="profile-info-block">
                  <h3>{language === 'ru' ? 'Советы по безопасности' : language === 'kg' ? 'Коопсуздуктун кеңештери' : 'Security tips'}</h3>
                  <ul className="check-list compact-list">
                    <li><Check size={14} /> {language === 'ru' ? 'Используйте уникальный пароль для LEVEL UP' : language === 'kg' ? 'LEVEL UP үчүн уникалдуу сырсөз колдонуу' : 'Use a unique password for LEVEL UP'}</li>
                    <li><Check size={14} /> {language === 'ru' ? 'Не делитесь данными входа' : language === 'kg' ? 'Кирүү маалыматын бөлүшпеңиз' : 'Do not share your login details'}</li>
                    <li><Check size={14} /> {language === 'ru' ? 'Обновляйте пароль при необходимости' : language === 'kg' ? 'Сырсөздү талап болгондо жаңыртыңыз' : 'Update your password regularly'}</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="profile-grid settings-main-grid">
                <div className="profile-info-block">
                  <h3>{language === 'ru' ? 'Электронные уведомления' : language === 'kg' ? 'Электрондук эскертүүлөр' : 'Notifications'}</h3>
                  <form className="settings-form" onSubmit={(event) => {
                    event.preventDefault()
                    const result = onUpdateNotifications?.(notifSettings)
                    setNotificationNotice(result?.message ?? null)
                  }}>
                    <div className="toggle-list">
                      <div className="toggle-row">
                        <div>
                          <strong>{language === 'ru' ? 'Email-уведомления' : language === 'kg' ? 'Email эскертүүлөр' : 'Email notifications'}</strong>
                          <small>{language === 'ru' ? 'Получать новости и важные уведомления на почту' : language === 'kg' ? 'Электрондук поштасына актуалдуу жаңылыктарды алуу' : 'Receive updates and important notifications by email'}</small>
                        </div>
                        <button type="button" className={notifSettings.emailNotifications ? 'toggle active' : 'toggle'} onClick={() => setNotifSettings((current) => ({ ...current, emailNotifications: !current.emailNotifications }))} aria-label="Toggle email notifications">
                          <span />
                        </button>
                      </div>

                      <div className="toggle-row">
                        <div>
                          <strong>{language === 'ru' ? 'Уведомления о новых курсах' : language === 'kg' ? 'Жаңы курстар жөнүндө эскертүүлөр' : 'New course notifications'}</strong>
                          <small>{language === 'ru' ? 'Получать уведомления о новых курсах' : language === 'kg' ? 'Жаңы курстар жөнүндө эскертүүлөрдү алуу' : 'Get alerts when new courses are added'}</small>
                        </div>
                        <button type="button" className={notifSettings.newCourses ? 'toggle active' : 'toggle'} onClick={() => setNotifSettings((current) => ({ ...current, newCourses: !current.newCourses }))} aria-label="Toggle new courses notifications">
                          <span />
                        </button>
                      </div>

                      <div className="toggle-row">
                        <div>
                          <strong>{language === 'ru' ? 'Уведомления о новых уроках' : language === 'kg' ? 'Жаңы сабактар жөнүндө эскертүүлөр' : 'New lessons notifications'}</strong>
                          <small>{language === 'ru' ? 'Напоминания о новых доступных уроках' : language === 'kg' ? 'Жаңы сабактар жөнүндө эскертүүлөр' : 'Receive updates when new lessons are available'}</small>
                        </div>
                        <button type="button" className={notifSettings.newLessons ? 'toggle active' : 'toggle'} onClick={() => setNotifSettings((current) => ({ ...current, newLessons: !current.newLessons }))} aria-label="Toggle new lessons notifications">
                          <span />
                        </button>
                      </div>

                      <div className="toggle-row">
                        <div>
                          <strong>{language === 'ru' ? 'Новости и обновления LevelUp' : language === 'kg' ? 'LevelUp жаңылыктары жана жаңартуулары' : 'LevelUp news and updates'}</strong>
                          <small>{language === 'ru' ? 'Будьте в курсе новостей платформы' : language === 'kg' ? 'Платформанын жаңылыктары менен танысыңыз' : 'Stay informed about product updates and news'}</small>
                        </div>
                        <button type="button" className={notifSettings.newsUpdates ? 'toggle active' : 'toggle'} onClick={() => setNotifSettings((current) => ({ ...current, newsUpdates: !current.newsUpdates }))} aria-label="Toggle LevelUp news notifications">
                          <span />
                        </button>
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary small full-width">{language === 'ru' ? 'Сохранить настройки' : language === 'kg' ? 'Параметрлерди сактоо' : 'Save preferences'}</button>
                    {notificationNotice && <small className="field-note">{notificationNotice}</small>}
                  </form>
                </div>
                <div className="profile-info-block">
                  <h3>{language === 'ru' ? 'План уведомлений' : language === 'kg' ? 'Эскертүүлөрдүн жоспары' : 'Notification plan'}</h3>
                  <ul className="check-list compact-list">
                    <li><Check size={14} /> {language === 'ru' ? 'Срочные обновления' : language === 'kg' ? 'Шайкеш келүүчү жаңартуулары' : 'Important updates'}</li>
                    <li><Check size={14} /> {language === 'ru' ? 'Новые уроки и курсы' : language === 'kg' ? 'Жаңы сабактар жана курс' : 'New lessons and courses'}</li>
                    <li><Check size={14} /> {language === 'ru' ? 'Персональные рекомендации' : language === 'kg' ? 'Жеке сунуштар' : 'Personalized suggestions'}</li>
                  </ul>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

type AdminOverview = {
  totalUsers: number
  newRegistrations: number
  activeStudents: number
  completedCourses: number
  averageRating: number
  reviews: number
  planPurchases: number
  revenue: number
}

type AdminUserRecord = {
  email: string
  name: string
  firstName: string
  lastName: string
  role: string
  accountStatus: string
  isBlocked: boolean
  createdAt?: string
}

function buildDailyRegistrationChart(users: AdminUserRecord[]) {
  const pastDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    return {
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      key: date.toISOString().slice(0, 10),
      value: 0
    }
  })

  for (const user of users) {
    if (!user.createdAt) continue
    const created = new Date(user.createdAt)
    if (Number.isNaN(created.getTime())) continue
    const key = created.toISOString().slice(0, 10)
    const record = pastDays.find((item) => item.key === key)
    if (record) record.value += 1
  }

  return pastDays
}

function buildMonthlyRegistrationChart(users: AdminUserRecord[]) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setMonth(date.getMonth() - (5 - index), 1)
    return {
      label: date.toLocaleDateString('en-US', { month: 'short' }),
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      value: 0
    }
  })

  for (const user of users) {
    if (!user.createdAt) continue
    const created = new Date(user.createdAt)
    if (Number.isNaN(created.getTime())) continue
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`
    const record = months.find((item) => item.key === key)
    if (record) record.value += 1
  }

  return months
}

function AdminPage({ t, user }: { t: (typeof translations)[Lang]; user: UserProfile | null }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)

  const loadOverview = useCallback(async () => {
    if (!user?.email) return

    try {
      const payload = await fetchJson<AdminOverview>(`${API_BASE_URL}/api/admin/overview`, {
        headers: { 'x-user-email': user.email, 'x-user-role': user.role }
      })
      setOverview(payload)
      setError(null)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Failed to load admin overview'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [user?.email, user?.role])

  const loadUsers = useCallback(async () => {
    if (!user?.email) return

    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (roleFilter !== 'all') params.set('role', roleFilter)

      const payload = await fetchJson<{ users: AdminUserRecord[] }>(`${API_BASE_URL}/api/admin/users?${params.toString()}`, {
        headers: { 'x-user-email': user.email, 'x-user-role': user.role }
      })
      setUsers(payload.users ?? [])
      setError(null)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Failed to load user list'
      setError(message)
    } finally {
      setUsersLoading(false)
    }
  }, [roleFilter, search, statusFilter, user?.email, user?.role])

  useEffect(() => {
    if (!user?.email) return
    void loadOverview()
    void loadUsers()
  }, [loadOverview, loadUsers, user?.email])

  const updateUserRecord = async (targetEmail: string, update: Partial<AdminUserRecord>) => {
    if (!user?.email) return

    try {
      await fetchJson<{ ok: true }>(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(targetEmail)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': user.email, 'x-user-role': user.role },
        body: JSON.stringify(update)
      })
      setUsers((current) => current.map((item) => item.email === targetEmail ? { ...item, ...update } : item))
      void loadOverview()
      void loadUsers()
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'User update failed'
      setError(message)
    }
  }

  const deleteUserRecord = async (targetEmail: string) => {
    if (!user?.email) return
    if (!window.confirm('Удалить аккаунт пользователя?')) return

    try {
      await fetchJson<{ ok: true }>(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(targetEmail)}`, {
        method: 'DELETE',
        headers: { 'x-user-email': user.email, 'x-user-role': user.role }
      })
      setUsers((current) => current.filter((item) => item.email !== targetEmail))
      void loadOverview()
      void loadUsers()
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'User deletion failed'
      setError(message)
    }
  }

  const chartDaily = buildDailyRegistrationChart(users)
  const chartMonthly = buildMonthlyRegistrationChart(users)
  const maxDaily = Math.max(1, ...chartDaily.map((item) => item.value))
  const maxMonthly = Math.max(1, ...chartMonthly.map((item) => item.value))

  const stats = [
    { label: 'Всего пользователей', value: overview?.totalUsers ?? 0, icon: Crown, accent: 'emerald' },
    { label: 'Новые регистрации', value: overview?.newRegistrations ?? 0, icon: UserRound, accent: 'slate' },
    { label: 'Активные студенты', value: overview?.activeStudents ?? 0, icon: ShieldCheck, accent: 'cyan' },
    { label: 'Завершённые курсы', value: overview?.completedCourses ?? 0, icon: BookOpen, accent: 'amber' },
    { label: 'Средний рейтинг', value: overview ? `${Number(overview.averageRating || 0).toFixed(1)}/5` : '0.0/5', icon: TrendingUp, accent: 'green' },
    { label: 'Отзывы', value: overview?.reviews ?? 0, icon: MessageSquareText, accent: 'violet' },
    { label: 'Покупки тарифов', value: overview?.planPurchases ?? 0, icon: WalletCards, accent: 'rose' },
    { label: 'Доход', value: overview ? `${Number(overview.revenue ?? 0).toLocaleString('ru-RU')} ₸` : '0 ₸', icon: BookOpen, accent: 'orange' }
  ]

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand-wrap">
          <div className="admin-brand-mark">L</div>
          <div>
            <span className="eyebrow">LEVEL UP</span>
            <strong>Admin</strong>
          </div>
        </div>

        <nav className="admin-nav">
          {[
            { label: 'Главная', icon: LayoutDashboard, active: true },
            { label: 'Пользователи', icon: UserRound },
            { label: 'Курсы', icon: BookOpen },
            { label: 'Уроки', icon: Sparkles },
            { label: 'Отзывы', icon: MessageSquareText },
            { label: 'Тарифы', icon: WalletCards },
            { label: 'Платежи', icon: TrendingUp },
            { label: 'AI Assistant', icon: ShieldCheck },
            { label: 'Настройки', icon: Settings }
          ].map(({ label, icon: Icon, active }) => (
            <button key={label} type="button" className={active ? 'admin-nav-item active' : 'admin-nav-item'}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-panel-profile">
          <div className="mini-avatar">{user?.name?.charAt(0)?.toUpperCase() ?? 'A'}</div>
          <div>
            <strong>{user?.name ?? 'Admin'}</strong>
            <span>{user?.email ?? 'admin@levelup.kg'}</span>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-header">
          <div>
            <span className="eyebrow">Dashboard</span>
            <h1>{t.admin.title}</h1>
          </div>
          <button type="button" className="btn btn-primary small">+ Новый курс</button>
        </div>

        {error && <div className="admin-alert">{error}</div>}

        <section className="admin-stats-grid">
          {stats.map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className={`admin-stat-card ${accent}`}>
              <div className="admin-stat-icon"><Icon size={18} /></div>
              <div>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="admin-chart-grid">
          <div className="admin-card chart-card">
            <div className="admin-card-header">
              <h3>Регистрации за 7 дней</h3>
              <span>Live</span>
            </div>
            <div className="mini-chart">
              {chartDaily.map((item) => (
                <div key={item.key} className="chart-column">
                  <div className="chart-bar" style={{ height: `${(item.value / maxDaily) * 100}%` }} />
                  <small>{item.label.split(' ')[0]}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card chart-card">
            <div className="admin-card-header">
              <h3>Активность по месяцам</h3>
              <span>Users</span>
            </div>
            <div className="mini-chart month-chart">
              {chartMonthly.map((item) => (
                <div key={item.key} className="chart-column">
                  <div className="chart-bar" style={{ height: `${(item.value / maxMonthly) * 100}%` }} />
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-card table-card">
          <div className="admin-card-header">
            <h3>Пользователи</h3>
            <div className="table-tools">
              <label className="search-field">
                <Search size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по имени или email" />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Статус: все</option>
                <option value="active">Активен</option>
                <option value="blocked">Заблокирован</option>
                <option value="inactive">Неактивен</option>
              </select>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="all">Роль: все</option>
                <option value="Admin">Admin</option>
                <option value="User">User</option>
                <option value="Student">Student</option>
              </select>
            </div>
          </div>

          {usersLoading ? (
            <div className="admin-empty-state">Загрузка пользователей...</div>
          ) : users.length === 0 ? (
            <div className="admin-empty-state">Пользователи не найдены</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Роль</th>
                    <th>Статус</th>
                    <th>Дата регистрации</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => (
                    <tr key={row.email}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="mini-avatar tiny">{row.name?.charAt(0)?.toUpperCase() ?? 'U'}</div>
                          <div>
                            <strong>{row.name}</strong>
                            <small>{row.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select value={row.role} onChange={(event) => void updateUserRecord(row.email, { role: event.target.value })}>
                          <option value="User">User</option>
                          <option value="Student">Student</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <span className={row.isBlocked ? 'admin-pill danger' : row.accountStatus === 'active' ? 'admin-pill success' : 'admin-pill neutral'}>
                          {row.isBlocked ? 'Blocked' : row.accountStatus}
                        </span>
                      </td>
                      <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString('ru-RU') : '—'}</td>
                      <td>
                        <div className="admin-actions">
                          <button type="button" className="btn btn-secondary small" onClick={() => void updateUserRecord(row.email, { accountStatus: row.isBlocked ? 'active' : 'blocked', isBlocked: !row.isBlocked })}>
                            {row.isBlocked ? 'Разблокировать' : 'Блокировать'}
                          </button>
                          <button type="button" className="btn btn-danger small" onClick={() => void deleteUserRecord(row.email)}>
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function RatingPage({ t, leaderboard, reviews }: { t: (typeof translations)[Lang]; leaderboard: LeaderboardEntry[]; reviews: Review[] }) {
  const language = getCurrentLanguage()
  const average = reviews.length ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1) : '0.0'
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const limit = period === 'week' ? 3 : period === 'month' ? 5 : 10
  const visibleRows = leaderboard.slice(0, limit)

  return (
    <div className="container section page-block">
      <div className="page-top-actions">
        <SmartBackButton fallback="/dashboard" label={language === 'ru' ? 'Назад в Dashboard' : language === 'kg' ? 'Dashboard кайт' : 'Back to Dashboard'} />
      </div>
      <div className="catalog-intro">
        <div>
          <span className="eyebrow">LEVEL UP</span>
          <h1>{t.nav.rating}</h1>
        </div>
      </div>
      <div className="rating-grid">
        <div className="stat-banner">
          <p>{t.ratingsAvg}</p>
          <h2>{average}</h2>
          <div className="stars big">{'★'.repeat(Math.round(Number(average) || 0))}{'☆'.repeat(5 - Math.round(Number(average) || 0))}</div>
        </div>
        <div className="detail-card">
          <h3>Top 10</h3>
          {leaderboard.length === 0 ? (
            <div className="empty-state-box">{t.messages.emptyLeaderboard}</div>
          ) : (
            <div className="leaderboard-list">
              {visibleRows.map((person, index) => (
                <div className="leader-row" key={person.id}>
                  <div className="avatar small">{renderAvatarContent(person.avatar, 'U')}</div>
                  <div><strong>{person.name}</strong><span>{person.courses} courses</span></div>
                  <div className="score-block"><strong>#{index + 1}</strong><span>{person.score} pts</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="detail-card full-width">
        <h3>Period filter</h3>
        <div className="toolbar compact">
          <select value={period} onChange={(event) => setPeriod(event.target.value as 'week' | 'month' | 'year')}>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
          </select>
        </div>
      </div>
    </div>
  )
}

function ReviewsPage({ t, reviews, setReviews, isLoggedIn, user, onRefreshSiteStats }: { t: (typeof translations)[Lang]; reviews: Review[]; setReviews: React.Dispatch<React.SetStateAction<Review[]>>; isLoggedIn: boolean; user: UserProfile | null; onRefreshSiteStats?: () => Promise<void> | void }) {
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [lessonId, setLessonId] = useState(reviewLessonOptions[0]?.id ?? '')
  const [notice, setNotice] = useState<string | null>(null)
  const userReview = user ? reviews.find((item) => item.userId === user.email) : undefined
  const average = reviews.length ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1) : '0.0'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isLoggedIn || !user) {
      setNotice(t.messages.loginRequired)
      return
    }
    if (!text.trim()) {
      setNotice(language === 'ru' ? 'Введите текст отзыва' : language === 'kg' ? 'Пикир жазыңыз' : 'Enter review text')
      return
    }
    if (!lessonId) {
      setNotice(language === 'ru' ? 'Выберите урок' : language === 'kg' ? 'Сабак тандаңыз' : 'Select lesson')
      return
    }

    const selectedLesson = reviewLessonOptions.find((item) => item.id === lessonId)
    if (!selectedLesson) return

    try {
      await saveReviewToServer({
        userEmail: user.email,
        userName: user.name,
        userAvatar: user.avatar,
        lessonId: selectedLesson.id,
        lessonLabel: selectedLesson.label,
        rating,
        text: text.trim()
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setNotice(message)
      return
    }

    if (userReview) {
      setReviews((current) => current.map((item) => item.id === userReview.id ? { ...item, rating, lessonId: selectedLesson.id, lessonLabel: selectedLesson.label, text: text.trim(), date: new Date().toISOString(), updatedAt: Date.now() } : item))
      void onRefreshSiteStats?.()
      setText('')
      setRating(5)
      setNotice(language === 'ru' ? 'Отзыв обновлён' : language === 'kg' ? 'Пикир жаңыртылды' : 'Review updated')
      return
    }

    const nextReview: Review = {
      id: `review-${Date.now()}`,
      name: user.name,
      avatar: user.avatar,
      lessonId: selectedLesson.id,
      lessonLabel: selectedLesson.label,
      rating,
      text: text.trim(),
      date: new Date().toISOString(),
      userId: user.email,
      createdAt: Date.now()
    }
    setReviews((current) => [nextReview, ...current])
    void onRefreshSiteStats?.()
    setText('')
    setRating(5)
    setNotice(language === 'ru' ? 'Отзыв сохранён' : language === 'kg' ? 'Пикир сакталды' : 'Review saved')
  }

  const language = getCurrentLanguage()

  return (
    <div className="container section page-block">
      <div className="page-top-actions">
        <SmartBackButton fallback="/dashboard" label={language === 'ru' ? 'Назад в Dashboard' : language === 'kg' ? 'Dashboard кайт' : 'Back to Dashboard'} />
      </div>
      <div className="catalog-intro"><div><span className="eyebrow">LEVEL UP</span><h1>{t.nav.reviews}</h1></div></div>
      <div className="rating-grid">
        <div className="stat-banner review-banner">
          <p>{t.ratingsAvg}</p>
          <h2>{average}</h2>
          <div className="stars big">{'★'.repeat(Math.round(Number(average) || 0))}{'☆'.repeat(5 - Math.round(Number(average) || 0))}</div>
        </div>
        <form className="review-form" onSubmit={handleSubmit}>
          <h3>{userReview ? 'Edit your review' : t.sections.leaveReview}</h3>
          <div className="stars-select">
            {[1, 2, 3, 4, 5].map((value) => (
              <button type="button" key={value} className={rating >= value ? 'star-button active' : 'star-button'} onClick={() => setRating(value)}>★</button>
            ))}
          </div>
          <label>
            <span>{language === 'ru' ? 'Урок' : language === 'kg' ? 'Сабак' : 'Lesson'}</span>
            <select value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
              {reviewLessonOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.sections.leaveReview} />
          <button type="submit" className="btn btn-primary full-width">{userReview ? 'Update review' : t.buttons.send}</button>
          {notice && <small className="field-note">{notice}</small>}
        </form>
      </div>
      {reviews.length === 0 ? (
        <div className="empty-state-box">{t.messages.emptyReviews}</div>
      ) : (
        <div className="reviews-grid">
          {reviews.map((review) => (
            <div className="review-card" key={review.id}>
              <div className="review-head">
                <div className="avatar">{renderAvatarContent(review.avatar, 'U')}</div>
                <div><h4>{review.name}</h4><span>{formatReviewDate(review.date, language)}</span></div>
              </div>
              {review.lessonLabel && <small>{review.lessonLabel}</small>}
              <div className="stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
              <p>{review.text}</p>
              {user && review.userId === user.email && (
                <button type="button" className="btn btn-secondary small" onClick={() => { setText(review.text); setRating(review.rating) }}>Edit</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PricingPage({ t }: { t: (typeof translations)[Lang] }) {
  const language = getCurrentLanguage()
  const location = useLocation()
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/'

  return (
    <div className="container section page-block">
      <div className="page-top-actions">
        <SmartBackButton fallback={fallbackPath} label={language === 'ru' ? 'Назад' : language === 'kg' ? 'Кайтуу' : 'Back'} />
      </div>
      <div className="catalog-intro"><div><span className="eyebrow">LEVEL UP</span><h1>{t.pricingTitle}</h1></div></div>
      <div className="pricing-grid big-grid">
        {pricingPlans.map((plan) => (
          <div key={plan.id} className={plan.featured ? 'pricing-card featured' : 'pricing-card'}>
            {plan.featured && <span className="popular-badge">Popular</span>}
            <span className="plan-tag">{plan.name}</span>
            <h3>{plan.label[language]}</h3>
            <div className="price">{plan.price} сом<span> / {t.subscription.monthly}</span></div>
            <p>{plan.description[language]}</p>
            <ul>
              {plan.features[language].map((feature) => <li key={feature}><Check size={14} /> {feature}</li>)}
            </ul>
            <Link to={plan.id === 'free' ? '/courses' : `/pricing/checkout/${plan.id}`} className="btn btn-primary full-width">
              {plan.id === 'free' ? t.buttons.startFree : plan.id === 'pro' ? t.buttons.choosePro : t.buttons.chooseAiPro}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

function CheckoutPage({ t, user, onActivatePlan }: { t: (typeof translations)[Lang]; user: UserProfile | null; onActivatePlan?: (planId: SubscriptionPlanId, paymentMethod?: PaymentMethod) => void }) {
  const { planId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const selectedPlan = pricingPlans.find((plan) => plan.id === planId) ?? pricingPlans[1]
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('MBank')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [pendingNotice, setPendingNotice] = useState<string | null>(null)
  const [cancelNotice, setCancelNotice] = useState<string | null>(null)
  const currentLanguage = getCurrentLanguage()
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard/pricing' : '/pricing'
  const checkoutText = {
    kg: {
      buy: `${selectedPlan.name} сатып алуу — ${selectedPlan.price} сом`,
      buyLoading: 'Заказ түзүлүүдө...',
      checkStatus: 'Төлөм статусун текшерүү',
      checkingStatus: 'Статус текшерилип жатат...',
      waitingForPayment: 'Заказ түзүлдү. Төлөм баракчасына өтүү...',
      paymentSuccess: 'Төлөм ырасталды. PRO 30 күнгө активдештирилди.',
      paymentPending: 'Төлөм күтүлүүдө. Төлөмдү бүтүрүп, статусун текшериңиз.',
      paymentCancelled: 'Төлөм жокко чыгарылды.',
      methodTitle: 'Төлөм ыкмасын тандаңыз',
      titlePlan: 'Тариф',
      titleAmount: 'Сумма',
      titlePeriod: 'Мөөнөт',
      periodValue: '30 күн'
    },
    ru: {
      buy: `Купить ${selectedPlan.name} — ${selectedPlan.price} сом`,
      buyLoading: 'Создаём заказ...',
      checkStatus: 'Проверить статус оплаты',
      checkingStatus: 'Проверяем статус...',
      waitingForPayment: 'Заказ создан. Переходим на страницу оплаты...',
      paymentSuccess: 'Оплата подтверждена. PRO активирован на 30 дней.',
      paymentPending: 'Платёж ожидается. Завершите оплату и проверьте статус.',
      paymentCancelled: 'Платёж отменён.',
      methodTitle: 'Выберите способ оплаты',
      titlePlan: 'Тариф',
      titleAmount: 'Сумма',
      titlePeriod: 'Срок',
      periodValue: '30 дней'
    },
    en: {
      buy: `Buy ${selectedPlan.name} — ${selectedPlan.price} KGS`,
      buyLoading: 'Creating order...',
      checkStatus: 'Check payment status',
      checkingStatus: 'Checking status...',
      waitingForPayment: 'Order created. Redirecting to payment page...',
      paymentSuccess: 'Payment confirmed. PRO is active for 30 days.',
      paymentPending: 'Payment is pending. Complete the payment and check status.',
      paymentCancelled: 'Payment was cancelled.',
      methodTitle: 'Choose payment method',
      titlePlan: 'Plan',
      titleAmount: 'Amount',
      titlePeriod: 'Period',
      periodValue: '30 days'
    }
  }[currentLanguage]

  useEffect(() => {
    if (!user) navigate('/auth')
  }, [navigate, user])

  const checkOrderStatus = useCallback(async (targetOrderId?: string) => {
    if (!user?.email) {
      navigate('/auth')
      return
    }

    const resolvedOrderId = targetOrderId ?? orderId
    if (!resolvedOrderId) return

    setIsCheckingStatus(true)
    setErrorNotice(null)
    try {
      const order = await getPaymentOrderStatus(resolvedOrderId, user.email)
      setOrderId(order.orderId)

      if (order.status === 'paid' && order.activated) {
        onActivatePlan?.(order.planId, order.paymentMethod)
        setSuccessNotice(checkoutText.paymentSuccess)
        setPendingNotice(null)
        setCancelNotice(null)
      } else if (order.status === 'cancelled') {
        setCancelNotice(checkoutText.paymentCancelled)
        setSuccessNotice(null)
        setPendingNotice(null)
      } else {
        setPendingNotice(checkoutText.paymentPending)
        setSuccessNotice(null)
        setCancelNotice(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setErrorNotice(message)
    } finally {
      setIsCheckingStatus(false)
    }
  }, [checkoutText.paymentCancelled, checkoutText.paymentPending, checkoutText.paymentSuccess, navigate, onActivatePlan, orderId, user?.email])

  useEffect(() => {
    const orderIdFromUrl = searchParams.get('orderId')
    const statusFromUrl = searchParams.get('paymentStatus') ?? searchParams.get('status')
    if (orderIdFromUrl) setOrderId(orderIdFromUrl)

    if (!statusFromUrl) return
    const normalized = statusFromUrl.toLowerCase()
    if (normalized === 'cancel' || normalized === 'cancelled' || normalized === 'canceled') {
      setCancelNotice(checkoutText.paymentCancelled)
      setSuccessNotice(null)
      setPendingNotice(null)
    } else if ((normalized === 'success' || normalized === 'paid' || normalized === 'succeeded') && orderIdFromUrl) {
      void checkOrderStatus(orderIdFromUrl)
    }
  }, [checkOrderStatus, checkoutText.paymentCancelled, searchParams])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) {
      navigate('/auth')
      return
    }

    setErrorNotice(null)
    setSuccessNotice(null)
    setPendingNotice(null)
    setCancelNotice(null)
    setIsSubmitting(true)

    try {
      const createdOrder = await createPaymentOrder({
        userEmail: user.email,
        userName: user.name,
        planId: selectedPlan.id as SubscriptionPlanId,
        paymentMethod: selectedMethod
      })
      setOrderId(createdOrder.orderId)
      setPendingNotice(checkoutText.waitingForPayment)
      window.location.assign(createdOrder.paymentUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setErrorNotice(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container section page-block checkout-page">
      <div className="page-top-actions checkout-top-actions">
        <SmartBackButton fallback={fallbackPath} label={currentLanguage === 'ru' ? 'Назад' : currentLanguage === 'kg' ? 'Кайтуу' : 'Back'} />
      </div>
      <div className="checkout-card dark-checkout-card">
        <div className="checkout-brand">LEVEL UP</div>
        <span className="checkout-plan-chip">{selectedPlan.name}</span>
        <h1 className="checkout-title">{selectedPlan.label[currentLanguage]}</h1>

        <p className="checkout-price-line">
          {t.subscription.duration}: <strong>{selectedPlan.price} сом</strong>
        </p>

        <div className="checkout-plan-meta">
          <div className="checkout-meta-row">
            <span>{checkoutText.titlePlan}</span>
            <strong>{selectedPlan.name}</strong>
          </div>
          <div className="checkout-meta-row">
            <span>{checkoutText.titleAmount}</span>
            <strong>{selectedPlan.price} сом</strong>
          </div>
          <div className="checkout-meta-row">
            <span>{checkoutText.titlePeriod}</span>
            <strong>{checkoutText.periodValue}</strong>
          </div>
        </div>

        <form className="checkout-form dark-checkout-form" onSubmit={handleSubmit}>
          <label className="checkout-select-label">
            <span>{checkoutText.methodTitle}</span>
            <select value={selectedMethod} onChange={(event) => setSelectedMethod(event.target.value as PaymentMethod)}>
              <option value="MBank">MBank</option>
              <option value="O!Деньги">O!Деньги</option>
              <option value="Элсом">Элсом</option>
            </select>
          </label>

          <button type="submit" className="btn btn-primary full-width checkout-submit-btn" disabled={isSubmitting}>
            {isSubmitting ? checkoutText.buyLoading : checkoutText.buy}
          </button>

          {orderId && (
            <button
              type="button"
              className="btn btn-secondary full-width checkout-status-btn"
              onClick={() => { void checkOrderStatus() }}
              disabled={isCheckingStatus}
            >
              {isCheckingStatus ? checkoutText.checkingStatus : checkoutText.checkStatus}
            </button>
          )}

          <button type="button" className="btn btn-secondary full-width checkout-back-btn" onClick={() => navigate(fallbackPath)}>
            {t.sections.choosePlanShort}
          </button>

          {pendingNotice && <p className="success-message">{pendingNotice}</p>}
          {successNotice && <p className="success-message">{successNotice}</p>}
          {cancelNotice && <p className="cancel-message">{cancelNotice}</p>}
          {errorNotice && <p className="error-message">{errorNotice}</p>}
        </form>
      </div>
    </div>
  )
}

function FaqPage({ t }: { t: (typeof translations)[Lang] }) {
  const language = getCurrentLanguage()
  return (
    <div className="container section page-block">
      <div className="catalog-intro"><div><span className="eyebrow">LEVEL UP</span><h1>{t.faqTitle}</h1></div></div>
      <div className="faq-list faq-page-list">
        {faqData.map((item) => <FaqItem key={item.q[language]} question={item.q[language]} answer={item.a[language]} defaultOpen={false} />)}
      </div>
    </div>
  )
}

function FaqItem({ question, answer, defaultOpen }: { question: string; answer: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className={open ? 'faq-item open' : 'faq-item'}>
      <button type="button" className="faq-question" onClick={() => setOpen((value) => !value)}>
        <span>{question}</span>
        <ChevronDown size={16} />
      </button>
      {open && <div className="faq-answer"><p>{answer}</p></div>}
    </div>
  )
}

function CourseCard({ course, language, favorites, onToggleFavorite }: { course: Course; language?: Lang; favorites?: string[]; onToggleFavorite?: React.Dispatch<React.SetStateAction<string[]>> }) {
  const activeLanguage = language && translations[language] ? language : 'ru'
  const isFavorite = favorites?.includes(course.id)

  return (
    <article className="course-card" key={course.id} style={{ background: `linear-gradient(160deg, ${course.color}, #fff)` }}>
      <div className="course-head">
        <span className="course-badge" style={{ background: course.accent }}>{course.badge}</span>
        <button type="button" className={isFavorite ? 'favorite-button active' : 'favorite-button'} onClick={() => { if (!onToggleFavorite) return; onToggleFavorite((current) => current.includes(course.id) ? current.filter((item) => item !== course.id) : [...current, course.id]) }} aria-label="Favorite course">
          {isFavorite ? '★' : '☆'}
        </button>
      </div>
      <div className="course-icon" style={{ background: `${course.accent}22`, color: course.accent }}>
        {course.id === 'html' ? <Code2 size={24} /> : course.id === 'css' ? <Sparkles size={24} /> : course.id === 'javascript' ? <Cpu size={24} /> : course.id === 'ai' ? <Brain size={24} /> : course.id === 'math' ? <Target size={24} /> : <BookOpen size={24} />}
      </div>
      <h3>{course.title[activeLanguage]}</h3>
      <p>{course.description[activeLanguage]}</p>
      <div className="meta-row compact-row">
        <span>{course.level}</span>
        <span>{course.lessonsCount} lessons</span>
        <span>{course.rating} ★</span>
      </div>
      <div className="course-footer">
        <span>{course.students} students</span>
        <Link to={`/courses/${course.id}`} className="btn btn-secondary small">{translations[activeLanguage].buttons.learnMore}</Link>
      </div>
    </article>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M21.5 4.5c.4 1.2-1.8 3.2-5.4 5.8l-1.2 8.7c-.1.8-.7 1-1.4.5l-3.9-2.9-1.9 1.8c-.2.2-.4.4-.7.4l.2-4.3 8.1-7.3c.4-.3-.1-.5-.8-.2l-9.9 6.3-4.3-1.4c-.9-.3-.9-.9.2-1.4L20.5 3.2c.7-.3 1.3.1 1 1.3Z" fill="currentColor" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M7 2.5h10A4.5 4.5 0 0 1 21.5 7v10a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 17V7A4.5 4.5 0 0 1 7 2.5Zm0 1.8A2.7 2.7 0 0 0 4.3 7v10a2.7 2.7 0 0 0 2.7 2.7h10a2.7 2.7 0 0 0 2.7-2.7V7a2.7 2.7 0 0 0-2.7-2.7H7Zm10.4 1.8h.5v.5h-.5v-.5ZM12 6.2A5.8 5.8 0 1 1 12 17.8 5.8 5.8 0 0 1 12 6.2Zm0 1.8A4 4 0 1 0 12 16.2 4 4 0 0 0 12 8Z" fill="currentColor" />
    </svg>
  )
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M21.6 7.38a2.9 2.9 0 0 0-2.04-2.05C17.8 5 12 5 12 5s-5.8 0-7.56.33A2.9 2.9 0 0 0 2.4 7.38 30.7 30.7 0 0 0 2 12a30.7 30.7 0 0 0 .4 4.62 2.9 2.9 0 0 0 2.04 2.05C6.2 19 12 19 12 19s5.8 0 7.56-.33a2.9 2.9 0 0 0 2.04-2.05A30.7 30.7 0 0 0 22 12a30.7 30.7 0 0 0-.4-4.62ZM10 15.5v-7l6 3.5-6 3.5Z" fill="currentColor" />
    </svg>
  )
}

function Footer({ t }: { t: (typeof translations)[Lang] }) {
  const contactLinks = [
    { href: 'mailto:support@levelup.kg', label: 'support@levelup.kg', icon: <Mail size={16} /> },
    { href: 'tel:+996555123456', label: '+996 555 123 456', icon: <Phone size={16} /> },
    { href: 'https://maps.google.com/?q=Bishkek,Kyrgyzstan', label: t.footer.address, icon: <MapPin size={16} /> }
  ]

  const socialLinks = [
    { href: 'https://t.me/levelupkg', label: 'Telegram', icon: <TelegramIcon className="footer-social-svg" /> },
    { href: 'https://www.instagram.com/levelup.kg/', label: 'Instagram', icon: <InstagramIcon className="footer-social-svg" /> },
    { href: 'https://www.youtube.com/@levelupkg', label: 'YouTube', icon: <YouTubeIcon className="footer-social-svg" /> }
  ]

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand-column">
          <div className="brand footer-brand"><img src={siteLogo} alt="LEVEL UP" className="footer-logo-image" /></div>
          <p className="footer-copy">{t.footer.description}</p>
        </div>

        <div className="footer-column">
          <h4>{t.footer.contacts}</h4>
          <ul className="footer-list">
            {contactLinks.map((item) => (
              <li key={item.href}>
                <a href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel={item.href.startsWith('http') ? 'noreferrer' : undefined} className="footer-contact-item">
                  <span className="footer-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-column">
          <h4>{t.footer.social}</h4>
          <ul className="footer-list footer-social-list">
            {socialLinks.map((item) => (
              <li key={item.label}>
                <a href={item.href} target="_blank" rel="noreferrer" className="footer-contact-item footer-social-link">
                  <span className="footer-icon footer-social-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container footer-divider" />

      <div className="container footer-bottom">
        <Link to="/privacy" className="footer-link">{t.footer.privacy}</Link>
        <Link to="/terms" className="footer-link">{t.footer.terms}</Link>
        <span className="footer-rights">{t.footer.rights}</span>
      </div>
    </footer>
  )
}

function AIChatPanel({ language, subscription, userEmail, pricingPath }: { language: Lang; subscription?: UserSubscription; userEmail?: string; pricingPath: string }) {
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
      const answer = await callAiAssistant({ question: trimmed, language, topic: 'general' })
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
            <div key={message.id} className={message.role === 'assistant' ? 'ai-chat-message assistant' : 'ai-chat-message user'}>
              <div className="ai-chat-message-head">
                {message.role === 'assistant' ? <Brain size={14} /> : <UserRound size={14} />}
                <span>{message.role === 'assistant' ? 'LevelUp AI' : userInitial}</span>
              </div>
              <p>{message.text}</p>
            </div>
          ))}
          {isLoading && <div className="ai-chat-message assistant loading">{t.ai.generating}</div>}
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

function LegalPage({ title, kind }: { title: string; kind: 'privacy' | 'terms' }) {
  const content = kind === 'privacy'
    ? (getCurrentLanguage() === 'ru'
      ? 'Мы защищаем ваши данные и используем их только для работы платформы: авторизация, прогресс обучения и подписка.'
      : getCurrentLanguage() === 'kg'
        ? 'Биз сиздин маалыматтарды коргойбуз жана платформанын иши үчүн гана колдонобуз: авторизация, окуу прогресси жана жазылуу.'
        : 'We protect your data and use it only for platform operations: authentication, learning progress, and subscriptions.')
    : (getCurrentLanguage() === 'ru'
      ? 'Используя LevelUp, вы соглашаетесь соблюдать правила платформы и использовать контент только в рамках обучения.'
      : getCurrentLanguage() === 'kg'
        ? 'LevelUp колдонгондо, платформа эрежелерин сактоого жана контентти окуу максатында гана колдонууга макул болосуз.'
        : 'By using LevelUp, you agree to follow platform rules and use content for learning purposes only.')

  return (
    <div className="container section page-block">
      <div className="catalog-intro"><div><span className="eyebrow">LEVEL UP</span><h1>{title}</h1></div></div>
      <div className="detail-card">
        <p>{content}</p>
      </div>
    </div>
  )
}

function SectionHeading({ title }: { title: string }) {
  return <div className="section-heading"><h2>{title}</h2></div>
}

export default App
