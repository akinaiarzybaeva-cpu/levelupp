import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  Lock,
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
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  UserRound,
  WalletCards,
  Trash2,
  X,
  ArrowRight,
  Atom,
  Bot,
  Calculator,
  ChevronRight,
  Globe,
  Palette,
  Play,
  Star,
  Trophy,
  Users,
  Award,
  ChevronLeft,
  CheckCircle2,
  Flame,
  Lightbulb,
  ListChecks,
  PlayCircle,
  Rocket,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
  Building2,
  CreditCard
} from 'lucide-react'
import { Badge, Button, ButtonLink, Card, EmptyState, Modal, PageHero, PasswordInput, ProgressBar, StarRating, StatTile } from './components/ui'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router-dom'
import { callAiAssistant } from './aiService'
import { API_BASE_URL, AUTH_TOKEN_KEY, fetchWithWakeRetry, getStoredAuthToken, isNetworkError, withAuthHeaders } from './api'
import { courses as bundledCourses, toEmbedUrl, type Course } from './data'
// Optimised 384px WebP of assets/лого.png (826 KB -> ~21 KB); displayed at <=170px wide.
import siteLogo from './assets/logo.webp'
import { ApiError, cancelServerSubscription, createPaymentOrder, getDemoPaymentConfig, getManualTransferConfig, getPaymentOrderStatus, submitDemoCardPayment, submitManualTransfer, type ManualTransferConfig, getPlans, getReviewsFromServer, getServerSubscription, getSubscriptionHistory, saveReviewToServer, type SubscriptionHistory } from './paymentApi'
import {
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
import AdminLogin from './components/AdminLogin'
import AdminResetPassword from './components/AdminResetPassword'
import './components/AdminPanel.css'

// The admin panel is large and only used by the administrator, so it is loaded on demand.
const AdminPanel = lazy(() => import('./components/AdminPanel'))

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

type Review = { id: string; name: string; avatar: string; rating: number; text: string; date: string; isOwn?: boolean; userId?: string; lessonId?: string; lessonLabel?: string; createdAt?: number; updatedAt?: number }
type Message = { id: string; role: 'assistant' | 'user'; text: string }

const defaultNotificationSettings: NotificationSettings = {
  emailNotifications: true,
  newCourses: true,
  newLessons: true,
  newsUpdates: true
}

const defaultReviews: Review[] = []

const faqData = [
  {
    q: { kg: 'Окууну канчалык тез баштаса болот?', ru: 'Как быстро можно начать обучение?', en: 'How quickly can I start learning?' },
    a: { kg: 'Катталгандан кийин дароо: курс тандап, киришүү сабагын өтүп, окууну баштаңыз.', ru: 'Сразу после регистрации: выберите курс, пройдите вводный урок и начните обучение.', en: 'Right after registration: choose a course, complete the onboarding lesson, and start learning.' }
  },
  {
    q: { kg: 'Практикалык тапшырмалар барбы?', ru: 'Есть ли практические задания?', en: 'Are there practical tasks?' },
    a: { kg: 'Ооба. Ар бир курс 20 сабактан турат, анда практикалык тапшырмалар жана тесттер бар.', ru: 'Да. Каждый курс состоит из 20 уроков с практическими заданиями и тестами.', en: 'Yes. Every course contains 20 lessons with hands-on exercises and tests.' }
  },
  {
    q: { kg: 'AI жардамчы эмнеге жардам берет?', ru: 'Чем помогает AI-ассистент?', en: 'How does the AI assistant help?' },
    a: { kg: 'AI темаларды түшүндүрөт, каталарды талдайт, кодду текшерет жана тапшырмалар боюнча кеңеш берет.', ru: 'AI объясняет темы, разбирает ошибки, анализирует код и помогает с упражнениями.', en: 'It explains topics, reviews code, analyzes mistakes, and helps with assignments and practice.' }
  },
  {
    q: { kg: 'Сертификат алуу үчүн эмне кылуу керек?', ru: 'Что нужно для получения сертификата?', en: 'What is needed to receive a certificate?' },
    a: { kg: 'Бардык сабактарды бүтүрүп, тесттерден ийгиликтүү өтсөңүз, сертификат аласыз.', ru: 'После завершения всех уроков и успешной сдачи тестов вы получите сертификат.', en: 'Complete the lessons and pass the tests to earn your certificate.' }
  }
]

const pricingPlans = [
  {
    id: 'free',
    name: 'FREE',
    price: 0,
    label: { kg: 'Акысыз', ru: 'Бесплатный', en: 'Free' },
    description: {
      kg: 'Ар бир курстун алгачкы 3 сабагынан баштап, бардык курстар менен таанышыңыз.',
      ru: 'Начните с первых 3 уроков и ознакомьтесь со всеми курсами.',
      en: 'Explore the first 3 lessons and get familiar with all courses.'
    },
    features: {
      kg: ['Ар бир курстун алгачкы 3 сабагы', 'Бардык 6 курс менен таанышуу', 'Негизги тесттер', 'Окуу прогресси'],
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
      kg: 'Бардык курстарга, сабактарга, практикага жана сертификаттарга толук жеткиликтүүлүк.',
      ru: 'Полный доступ ко всем курсам, урокам, практике и сертификатам.',
      en: 'Unlock all courses, lessons, practice tasks, and certifications.'
    },
    features: {
      kg: ['Бардык 6 курс', 'Ар бир курстун 20 сабагы', 'Видео жана теория', 'Практикалык тапшырмалар', 'Бардык тесттер', 'Сертификаттар'],
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
      kg: 'AI жардамчы менен татаал темаларды жана кодду оңой түшүнүңүз.',
      ru: 'Поддержка AI для объяснения тем, исправления кода и персональных заданий.',
      en: 'Learn with an AI mentor to break down topics and improve code faster.'
    },
    features: {
      kg: ['PRO тарифинин бардык мүмкүнчүлүктөрү', 'Жеке AI жардамчы', 'Татаал темаларды түшүндүрүү', 'Кодду оңдоо жана талдоо', 'Жеке практика тапшырмалары'],
      ru: ['Все возможности PRO', 'Персональный AI-помощник', 'Пояснение сложных тем', 'Исправление и анализ кода', 'Индивидуальные упражнения'],
      en: ['All PRO features', 'Personal AI assistant', 'Explain complex topics', 'Fix and analyze code', 'Custom practice tasks']
    },
    featured: false
  }
] as const

const translations = {
  kg: {
    nav: { home: 'Башкы бет', courses: 'Курстар', rating: 'Рейтинг', reviews: 'Пикирлер', pricing: 'Тарифтер', faq: 'Көп берилүүчү суроолор', profile: 'Профиль' },
    headerMenu: { language: 'Тил', theme: 'Тема', day: 'Күн режими', night: 'Түн режими', close: 'Менюну жабуу', open: 'Менюну ачуу' },
    buttons: { login: 'Кирүү', signup: 'Катталуу', start: 'Окууну баштоо', coursesBtn: 'Курстарды көрүү', learnMore: 'Кененирээк', continue: 'Окууну улантуу', nextLesson: 'Кийинки сабак', begin: 'Курс баштоо', choosePlan: 'Тариф тандоо', send: 'Жөнөтүү', startFree: 'Акысыз баштоо', choosePro: 'PRO тандоо', chooseAiPro: 'AI PRO тандоо', confirmPayment: 'Төлөмдү ырастоо', paymentUnavailable: 'Төлөм убактылуу жеткиликсиз' },
    heroTitle: 'IT дүйнөсүн LEVEL UP менен ач!',
    home: { titleLines: ['Үйрөн.', 'Өнүк.', 'Көбүрөөккө жет.'], subtitle: 'Программалоону жана IT көндүмдөрүн үйрөнүү үчүн онлайн-платформа', categories: 'Категориялар', directions: 'Популярдуу багыттар', allCourses: 'Бардык курстар', popular: 'Популярдуу курстар', chooseCourse: 'Курсуңду танда', viewAll: 'Баарын көрүү', hit: 'Хит', lessons: 'сабак', students: 'окуучу', statStudents: 'Окуучулар', statCourses: 'Курстар', statRating: 'Рейтинг', statSuccess: 'Ийгилик' },
    heroSubtitle: 'Программалоону үйрөн, көндүмдөрүңдү өнүктүр жана өз долбоорлоруңду түз.',
    benefitTitle: 'Эмне үчүн бизди тандашат?',
    popularTitle: 'Популярдуу курстар',
    startTitle: 'Кантип окууну баштоо керек?',
    leaderboardTitle: 'Студенттердин рейтинги',
    reviewsTitle: 'Студенттердин пикирлери',
    ratingsAvg: 'Платформанын орточо рейтинги',
    pricingTitle: 'Тарифтер',
    faqTitle: 'Көп берилүүчү суроолор',
    footer: { nav: 'Навигация', contacts: 'Байланыштар', social: 'Социалдык тармактар', privacy: 'Купуялык саясаты', terms: 'Колдонуу шарттары', rights: 'Бардык укуктар корголгон.', description: 'Акылдуу окуңуз. Күчтүү түзүңүз. Ишеним менен өсүңүз.', address: 'Бишкек, Кыргызстан', emailLabel: 'Email', phoneLabel: 'Телефон', addressLabel: 'Адрес' },
    auth: { login: 'Кирүү', register: 'Катталуу', name: 'Атыңыз', email: 'Email', password: 'Сырсөз', confirm: 'Сырсөздү ырастаңыз', forget: 'Сырсөздү унуттуңузбу?', show: 'Көрсөтүү', hide: 'Жашыруу', haveAccount: 'Аккаунтуңуз барбы?', noAccount: 'Аккаунтуңуз жокпу?', welcomeBack: 'Кайра кош келиңиз' },
    dashboard: { title: 'Жеке кабинет', greeting: 'Салам,', courses: 'Менин курстарым', continueTitle: 'Окууну улантуу', progress: 'Прогресс', completed: 'Аяктаган сабактар', testResults: 'Тесттин жыйынтыктары', achievements: 'Жетишкендиктер', rating: 'Менин рейтингим', certificates: 'Сертификаттар', settings: 'Профиль жөндөөлөрү', password: 'Сырсөздү өзгөртүү', logout: 'Чыгуу', overview: 'Сереп' },
    profilePhoto: { upload: 'Сүрөт жүктөө', change: 'Сүрөттү өзгөртүү', remove: 'Сүрөттү өчүрүү', save: 'Сүрөттү сактоо', uploading: 'Жүктөлүүдө...', saved: 'Сүрөт ийгиликтүү сакталды.', deleted: 'Сүрөт ийгиликтүү өчүрүлдү.', cancel: 'Жокко чыгаруу', choose: 'Сүрөт тандоо', zoom: 'Масштаб', uploadTitle: 'Профиль сүрөтү', invalidType: 'JPG, JPEG, PNG же WEBP форматындагы файлдар гана.', invalidSize: 'Файлдын көлөмү 5 МБдан ашпашы керек.', confirmDelete: 'Сүрөттү өчүрүү керекпи?', cropHint: 'Масштабды тууралап, сүрөттү тегерек формада сактаңыз.', emptyState: 'Жүктөлгөн сүрөт жок' },
    subscription: { title: 'Менин жазылуум', free: 'Акысыз', pro: 'Толук мүмкүнчүлүк', aipro: 'Жасалма интеллект менен окуу', monthly: 'айына', statusActive: 'Активдүү', statusExpired: 'Мөөнөтү бүттү', statusInactive: 'Активдүү эмес', freeWarning: 'Сизде акысыз тариф бар. Бардык мүмкүнчүлүктөрдү ачуу үчүн PRO-га өтүңүз.', renew: 'Жазылууну узартуу', changePlan: 'Тарифти өзгөртүү', paymentSuccess: 'Төлөм ийгиликтүү аяктады', paymentUnavailable: 'Төлөм убактылуу жеткиликсиз', expired: 'Жазылуу мөөнөтү бүттү', nextRenewal: 'Кийинки жаңыртуу', history: 'Төлөмдөрдүн тарыхы', duration: '30 күн', paymentMethods: 'MBank, O!Деньги, Элсом' },
    admin: { title: 'Администратор панели', users: 'Колдонуучулар', plans: 'Тарифтер', status: 'Статус', history: 'Тарых', stats: 'Статистика' },
    catalog: { search: 'Курстарды издөө', category: 'Категория', level: 'Деңгээл', sort: 'Иреттөө', all: 'Баары', filter: 'Фильтр' },
    ai: {
      title: 'AI Assistant',
      placeholder: 'Сурооңузду жазыңыз...',
      offline: 'AI API туташтырылган эмес. Backend менен байланышты текшериңиз.',
      ready: 'AI жооп даяр',
      inputLabel: 'Суроо',
      blocked: "AI Assistant'ти колдонуу үчүн ылайыктуу тарифти туташтырыңыз",
      connectPlan: 'Тарифти туташтыруу',
      newChat: 'Жаңы чат',
      generating: 'Жооп түзүлүүдө...',
      welcome: 'Салам! Сурооңузду жазыңыз, жардам берем.',
      history: 'Чат тарыхы',
      historyEmpty: 'Азырынча суроолор жок',
      accessLabel: 'AI Pro тарифи менен жеткиликтүү',
      inputHint: 'Shift + Enter — жаңы сап, Enter — жөнөтүү'
    },
    generic: { search: 'Издөө', loading: 'Жүктөлүүдө...', success: 'Ийгилик', error: 'Ката', days: 'күн', members: 'окуучу', rating: 'Рейтинг', done: 'Аякталды', open: 'Ачуу', correct: 'Туура', tryAgain: 'Кайра аракет кылыңыз', lesson: 'Сабак', lessons: 'Сабактар', student: 'Окуучу', students: 'Окуучулар' },
    sections: { whyUs: 'Эмне үчүн бизди тандашат?', howStart: 'Кантип окууну баштоо керек?', studentRankings: 'Студенттердин рейтинги', studentReviews: 'Студенттердин пикирлери', choosePlan: 'Өзүңүзгө ылайыктуу тарифти тандаңыз', courseProgram: 'Курстун программасы', whatLearn: 'Эмне үйрөнөсүз', lessonNav: 'Сабактар боюнча навигация', open: 'Ачуу', done: 'Аякталды', doneShort: 'Аякталды', theory: 'Теория', codeExample: 'Код мисалы', practice: 'Практикалык тапшырма', checkAnswer: 'Жоопту текшерүү', next: 'Кийинки', previous: 'Мурунку', choosePlanShort: 'Тариф тандоо', leaveReview: 'Пикир калтыруу', averageRating: 'Орточо рейтинг' },
    messages: { loginRequired: 'Пикир калтыруу үчүн кирүү керек', invalidAuth: 'Форманы туура толтуруңуз', resetLinkSent: 'Эгер бул email менен аккаунт болсо, сырсөздү калыбына келтирүү шилтемеси жөнөтүлдү', subscriptionActivated: 'Жазылуу ийгиликтүү активдештирилди', emptyLeaderboard: 'Рейтинг азырынча бош. Биринчи болуп рейтингге кириңиз!', emptyReviews: 'Азырынча пикирлер жок. Биринчи болуп пикириңизди калтырыңыз!' },
    homeStats: { completion: 'Аякталышы', students: 'Окуучулар', rating: 'Рейтинг' }
  },
  ru: {
    nav: { home: 'Главная', courses: 'Курсы', rating: 'Рейтинг', reviews: 'Отзывы', pricing: 'Тарифы', faq: 'Часто задаваемые вопросы', profile: 'Профиль' },
    headerMenu: { language: 'Язык', theme: 'Тема', day: 'Дневной режим', night: 'Ночной режим', close: 'Закрыть меню', open: 'Открыть меню' },
    buttons: { login: 'Войти', signup: 'Регистрация', start: 'Начать обучение', coursesBtn: 'Посмотреть курсы', learnMore: 'Подробнее', continue: 'Продолжить обучение', nextLesson: 'Следующий урок', begin: 'Начать курс', choosePlan: 'Выбрать тариф', send: 'Отправить', startFree: 'Акысыз баштоо', choosePro: 'PRO тандоо', chooseAiPro: 'AI PRO тандоо', confirmPayment: 'Төлөмдү ырастоо', paymentUnavailable: 'Төлөм убактылуу жеткиликсиз' },
    heroTitle: 'Открой мир IT вместе с LEVEL UP!',
    home: { titleLines: ['Учись.', 'Развивайся.', 'Достигай большего.'], subtitle: 'Онлайн-платформа для изучения программирования и IT-навыков', categories: 'Категории', directions: 'Популярные направления', allCourses: 'Все курсы', popular: 'Популярные курсы', chooseCourse: 'Выбери свой курс', viewAll: 'Смотреть все', hit: 'Хит', lessons: 'уроков', students: 'студентов', statStudents: 'Студентов', statCourses: 'Курсов', statRating: 'Рейтинг', statSuccess: 'Успех' },
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
    dashboard: { title: 'Жеке кабинет', greeting: 'Здравствуйте,', courses: 'Мои курсы', continueTitle: 'Продолжить обучение', progress: 'Прогресс', completed: 'Завершённые уроки', testResults: 'Результаты тестов', achievements: 'Достижения', rating: 'Мой рейтинг', certificates: 'Сертификаты', settings: 'Настройки профиля', password: 'Изменить пароль', logout: 'Выйти', overview: 'Обзор' },
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
    messages: { loginRequired: 'Нужно войти, чтобы оставить отзыв', invalidAuth: 'Заполните форму корректно', resetLinkSent: 'Если аккаунт с этим email существует, мы отправили ссылку для сброса пароля', subscriptionActivated: 'Подписка успешно активирована', emptyLeaderboard: 'Рейтинг пока пуст. Стань первым, кто попадёт в рейтинг!', emptyReviews: 'Отзывов пока нет. Будь первым, кто поделится своим мнением!' },
    homeStats: { completion: 'Прохождение', students: 'Студенты', rating: 'Рейтинг' }
  },
  en: {
    nav: { home: 'Home', courses: 'Courses', rating: 'Leaderboard', reviews: 'Reviews', pricing: 'Pricing', faq: 'FAQ', profile: 'Profile' },
    headerMenu: { language: 'Language', theme: 'Theme', day: 'Day mode', night: 'Night mode', close: 'Close menu', open: 'Open menu' },
    buttons: { login: 'Log in', signup: 'Sign up', start: 'Start learning', coursesBtn: 'Explore courses', learnMore: 'Learn more', continue: 'Continue learning', nextLesson: 'Next lesson', begin: 'Start course', choosePlan: 'Choose plan', send: 'Send', startFree: 'Start free', choosePro: 'Choose PRO', chooseAiPro: 'Choose AI PRO', confirmPayment: 'Confirm payment', paymentUnavailable: 'Payment temporarily unavailable' },
    heroTitle: 'Discover the world of IT with LEVEL UP!',
    home: { titleLines: ['Learn.', 'Grow.', 'Achieve more.'], subtitle: 'An online platform for learning programming and IT skills', categories: 'Categories', directions: 'Popular directions', allCourses: 'All courses', popular: 'Popular courses', chooseCourse: 'Choose your course', viewAll: 'View all', hit: 'Top', lessons: 'lessons', students: 'students', statStudents: 'Students', statCourses: 'Courses', statRating: 'Rating', statSuccess: 'Success' },
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
    messages: { loginRequired: 'You need to log in to leave a review', invalidAuth: 'Please complete the form correctly', resetLinkSent: 'If an account exists for this email, a password reset link has been sent', subscriptionActivated: 'Subscription activated successfully', emptyLeaderboard: 'The leaderboard is empty. Be the first to reach the leaderboard!', emptyReviews: 'No reviews yet. Be the first to share your feedback!' },
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

const LAST_AUTH_EMAIL_KEY = 'levelup-last-auth-email'

function getStoredLastAuthEmail() {
  if (typeof window === 'undefined') return ''
  return String(window.localStorage.getItem(LAST_AUTH_EMAIL_KEY) ?? '').trim().toLowerCase()
}

function setStoredLastAuthEmail(value?: string | null) {
  if (typeof window === 'undefined') return
  const email = String(value ?? '').trim().toLowerCase()
  if (!email) return
  window.localStorage.setItem(LAST_AUTH_EMAIL_KEY, email)
}

function resolveSafeNextPath(value?: string | null, fallback = '/courses') {
  const normalized = String(value ?? '').trim()
  if (!normalized || !normalized.startsWith('/') || normalized.startsWith('//')) return fallback
  return normalized
}

function appendFromParam(targetPath: string, fromPath: string) {
  const safeTarget = resolveSafeNextPath(targetPath, '/courses')
  const safeFrom = resolveSafeNextPath(fromPath, '/courses')
  const [pathOnly, query = ''] = safeTarget.split('?')
  const params = new URLSearchParams(query)
  params.set('from', safeFrom)
  const nextQuery = params.toString()
  return nextQuery ? `${pathOnly}?${nextQuery}` : pathOnly
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  // Identity is proven only by the bearer session token.
  const response = await fetchWithWakeRetry(url, { ...init, headers: withAuthHeaders(init?.headers) })
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
  const language = useLanguage()
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
      <ArrowLeft size={15} /> {label ?? pick(language, 'Кайтуу', 'Назад', 'Back')}
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

function buildReviewLessonOptions(courses: Course[]) {
  return courses.flatMap((course) =>
    course.lessons.map((lesson) => ({
      id: lesson.id,
      label: `${course.title.ru} — ${lesson.title.ru}`
    }))
  )
}

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

// ─── Language context ─────────────────────────────────────────────────────────
// Components read the active language from React state (via context) so that every
// page re-renders in the new language immediately when it is switched.
const LanguageContext = createContext<Lang>('ru')

function useLanguage(): Lang {
  return useContext(LanguageContext)
}

/** Picks the KG/RU/EN variant of a short UI string. */
function pick(language: Lang, kg: string, ru: string, en: string): string {
  return language === 'kg' ? kg : language === 'ru' ? ru : en
}

function levelLabel(level: string, language: Lang): string {
  if (level === 'Beginner') return pick(language, 'Башталгыч', 'Начальный', 'Beginner')
  if (level === 'Intermediate') return pick(language, 'Орто', 'Средний', 'Intermediate')
  if (level === 'Advanced') return pick(language, 'Жогорку', 'Продвинутый', 'Advanced')
  return level
}

function normalizeLanguage(value: unknown): Lang {
  return value === 'kg' || value === 'ru' || value === 'en' ? value : 'ru'
}

function normalizeTheme(value: unknown): Theme {
  return value === 'dark' ? 'dark' : 'light'
}

// ─── Course catalog context ──────────────────────────────────────────────────
// The catalog starts from the bundled course data (instant first paint / offline
// fallback) and is replaced by the published courses from the backend database, so
// changes made in the admin panel appear on the site.
type CourseCatalog = { courses: Course[]; courseIndex: Record<string, Course> }

function buildCourseCatalog(list: Course[]): CourseCatalog {
  return { courses: list, courseIndex: Object.fromEntries(list.map((course) => [course.id, course])) as Record<string, Course> }
}

const CourseCatalogContext = createContext<CourseCatalog>(buildCourseCatalog(bundledCourses))

function useCourseCatalog(): CourseCatalog {
  return useContext(CourseCatalogContext)
}

type ApiLangText = { kg?: string | null; ru?: string | null; en?: string | null }
type ApiCourseLesson = { id: string; title: ApiLangText; duration?: string; type?: string; theory?: string; code?: string; task?: string; videoUrl?: string; quiz?: { prompt?: ApiLangText; options?: string[]; answer?: number }; locked?: boolean }
type ApiCourse = Omit<Course, 'title' | 'description' | 'lessons' | 'level'> & { title: ApiLangText; description: ApiLangText; level: string; lessons: ApiCourseLesson[] }

// ─── Plans & subscription (shared by pricing, checkout, dashboard, lessons) ────

type PlanView = {
  id: SubscriptionPlanId
  name: string
  price: number
  currency: string
  durationDays: number
  featured: boolean
  label: Record<Lang, string>
  description: Record<Lang, string>
  features: Record<Lang, string[]>
}

/** Used only until the server answers (or if it is unreachable). Same prices as the backend seed. */
const bundledPlans: PlanView[] = pricingPlans.map((plan) => ({
  id: plan.id as SubscriptionPlanId,
  name: plan.name,
  price: plan.price,
  currency: 'KGS',
  durationDays: 30,
  featured: Boolean(plan.featured),
  label: { ...plan.label },
  description: { ...plan.description },
  features: { kg: [...plan.features.kg], ru: [...plan.features.ru], en: [...plan.features.en] }
}))

const PLAN_RANK: Record<SubscriptionPlanId, number> = { free: 0, pro: 1, aipro: 2 }
/** Lessons per course without a paid plan (the backend applies the same limits). */
const GUEST_LESSON_LIMIT = 1
const FREE_LESSON_LIMIT = 3

type BillingState = {
  plans: PlanView[]
  subscription: UserSubscription
  isLoggedIn: boolean
  isAdmin: boolean
  userEmail: string | null
  refreshSubscription: () => Promise<UserSubscription | null>
}

const BillingContext = createContext<BillingState>({
  plans: bundledPlans,
  subscription: getDefaultSubscription('free'),
  isLoggedIn: false,
  isAdmin: false,
  userEmail: null,
  refreshSubscription: async () => null
})

function useBilling(): BillingState {
  return useContext(BillingContext)
}

/** The plan whose features can be used now. Only data confirmed by the server unlocks paid features. */
function accessPlanOf(subscription?: UserSubscription | null): SubscriptionPlanId {
  if (!subscription?.synced) return 'free'
  return subscription.accessPlan ?? 'free'
}

/** How many lessons of each course the viewer may open (Infinity = all). */
function useLessonLimit(): number {
  const { isLoggedIn, isAdmin, subscription } = useBilling()
  if (isAdmin) return Infinity
  if (!isLoggedIn) return GUEST_LESSON_LIMIT
  return PLAN_RANK[accessPlanOf(subscription)] >= PLAN_RANK.pro ? Infinity : FREE_LESSON_LIMIT
}

function planPeriodLabel(plan: PlanView, language: Lang, t: (typeof translations)[Lang]) {
  return plan.durationDays === 30 ? t.subscription.monthly : pick(language, `${plan.durationDays} күн`, `${plan.durationDays} дней`, `${plan.durationDays} days`)
}

function formatDateTime(value: string | null | undefined, language: Lang, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const locale = language === 'kg' ? 'ky-KG' : language === 'ru' ? 'ru-RU' : 'en-US'
  return withTime ? date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : date.toLocaleDateString(locale, { dateStyle: 'medium' })
}

function subscriptionStatusText(subscription: UserSubscription, language: Lang) {
  const raw = subscription.rawStatus ?? 'free'
  if (raw === 'free') return pick(language, 'Акысыз тариф', 'Бесплатный тариф', 'Free plan')
  if (raw === 'cancelled') return pick(language, 'Жокко чыгарылды — мөөнөтү бүткөнчө иштейт', 'Отменена — действует до конца срока', 'Cancelled — active until the end date')
  if (raw === 'expired') return pick(language, 'Мөөнөтү бүттү', 'Истекла', 'Expired')
  return pick(language, 'Активдүү', 'Активна', 'Active')
}

function paymentStatusText(status: string, language: Lang) {
  switch (status) {
    case 'paid': return pick(language, 'Төлөндү', 'Оплачен', 'Paid')
    case 'pending': return pick(language, 'Күтүлүүдө', 'Ожидает оплаты', 'Pending')
    case 'failed': return pick(language, 'Ийгиликсиз', 'Ошибка оплаты', 'Failed')
    case 'cancelled': return pick(language, 'Жокко чыгарылды', 'Отменён', 'Cancelled')
    default: return status
  }
}

function historyEventText(event: string, language: Lang) {
  switch (event) {
    case 'activated': return pick(language, 'Сатып алынды', 'Покупка', 'Purchased')
    case 'renewed': return pick(language, 'Узартылды', 'Продление', 'Renewed')
    case 'upgraded': return pick(language, 'Тариф жогорулатылды', 'Повышение тарифа', 'Upgraded')
    case 'changed': return pick(language, 'Тариф өзгөртүлдү', 'Смена тарифа', 'Plan changed')
    case 'cancelled': return pick(language, 'Жокко чыгарылды', 'Отмена', 'Cancelled')
    case 'expired': return pick(language, 'Мөөнөтү бүттү', 'Истекла', 'Expired')
    case 'admin_grant': return pick(language, 'Администратор активдештирди', 'Активировано администратором', 'Granted by administrator')
    case 'admin_revoke': return pick(language, 'Администратор токтотту', 'Отключено администратором', 'Revoked by administrator')
    case 'payment_failed': return pick(language, 'Төлөм ийгиликсиз', 'Ошибка оплаты', 'Payment failed')
    case 'payment_cancelled': return pick(language, 'Төлөм жокко чыгарылды', 'Оплата отменена', 'Payment cancelled')
    case 'manual_submitted': return pick(language, 'Которуу текшерүүгө жөнөтүлдү', 'Перевод отправлен на проверку', 'Transfer sent for review')
    default: return event
  }
}

/** Accessible "this lesson needs PRO" dialog used by the course and lesson pages. */
function UpgradeRequiredModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const language = useLanguage()
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Lock}
      title={pick(language, 'Бул сабак PRO тарифинде', 'Этот урок доступен в PRO', 'This lesson is part of PRO')}
      actions={(
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>{pick(language, 'Жабуу', 'Закрыть', 'Close')}</Button>
          <ButtonLink size="sm" to="/pricing" icon={Rocket}>{pick(language, 'Тарифтерди көрүү', 'Посмотреть тарифы', 'See plans')}</ButtonLink>
        </>
      )}
    >
      <p>{pick(language, `Акысыз тарифте ар бир курстун алгачкы ${FREE_LESSON_LIMIT} сабагы ачык. Калган сабактар PRO жана AI PRO тарифтеринде.`, `В бесплатном тарифе открыты первые ${FREE_LESSON_LIMIT} урока каждого курса. Остальные уроки — в тарифах PRO и AI PRO.`, `The free plan opens the first ${FREE_LESSON_LIMIT} lessons of every course. The rest are in PRO and AI PRO.`)}</p>
    </Modal>
  )
}

function toLangText(value: ApiLangText | undefined): { kg: string; ru: string; en: string } {
  const ru = String(value?.ru ?? '').trim()
  const en = String(value?.en ?? '').trim() || ru
  const kg = String(value?.kg ?? '').trim() || ru
  return { kg, ru: ru || en, en }
}

function mapApiCourse(apiCourse: ApiCourse): Course {
  const level = apiCourse.level === 'Intermediate' || apiCourse.level === 'Advanced' ? apiCourse.level : 'Beginner'
  const lessons = apiCourse.lessons.map((lesson) => ({
    id: lesson.id,
    title: toLangText(lesson.title),
    duration: lesson.duration ?? '',
    type: lesson.type ?? '',
    theory: lesson.theory ?? '',
    code: lesson.code ?? '',
    task: lesson.task ?? '',
    videoUrl: toEmbedUrl(lesson.videoUrl ?? ''),
    quiz: {
      prompt: toLangText(lesson.quiz?.prompt),
      options: Array.isArray(lesson.quiz?.options) ? lesson.quiz.options : [],
      answer: Number(lesson.quiz?.answer ?? 0)
    },
    locked: Boolean(lesson.locked)
  }))

  return {
    ...apiCourse,
    title: toLangText(apiCourse.title),
    description: toLangText(apiCourse.description),
    level,
    tags: Array.isArray(apiCourse.tags) ? apiCourse.tags : [],
    outline: Array.isArray(apiCourse.outline) ? apiCourse.outline : [],
    students: String(apiCourse.students ?? '0'),
    lessonsCount: lessons.length,
    lessons
  }
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
  const [language, setLanguage] = useState<Lang>(() => normalizeLanguage(getStoredValue('levelup-language', 'ru')))
  const [theme, setTheme] = useState<Theme>(() => normalizeTheme(getStoredValue('levelup-theme', 'light')))
  const [catalog, setCatalog] = useState<CourseCatalog>(() => buildCourseCatalog(bundledCourses))
  const courses = catalog.courses
  const [authToken, setAuthToken] = useState<string>(() => getStoredAuthToken())
  // True while a stored token is being verified, so protected pages wait instead of
  // redirecting a logged-in user away on a deep link / page reload.
  const [sessionPending, setSessionPending] = useState<boolean>(() => Boolean(getStoredAuthToken()))
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
  const burgerMenuRef = useRef<HTMLDivElement | null>(null)
  const burgerButtonRef = useRef<HTMLButtonElement | null>(null)
  const t = translations[language]
  const allUsers = useMemo(() => getStoredValue<UserProfile[]>('levelup-users', []), [user?.email, user?.name, isLoggedIn])
  const leaderboard = useMemo(() => buildLeaderboard(allUsers, userProgress), [allUsers, userProgress])
  const currentUserLessons = user ? (userProgress[user.email]?.lessonsCompleted ?? []) : completedLessons
  const currentUserSubscription = user ? (subscriptions[user.email] ?? getUserSubscription(user.email)) : getDefaultSubscription('free')
  const catalogAccessKey = `${accessPlanOf(currentUserSubscription)}:${isAdminRole(user?.role) ? 'admin' : ''}`
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
    let active = true
    const loadCourses = async () => {
      try {
        const payload = await fetchJson<{ courses?: ApiCourse[] }>(`${API_BASE_URL}/api/courses`)
        // Courses without lessons cannot be opened, so they are not listed publicly.
        const mapped = (payload.courses ?? []).map(mapApiCourse).filter((course) => course.lessons.length > 0)
        if (active && mapped.length > 0) setCatalog(buildCourseCatalog(mapped))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`Using bundled course data; backend course list unavailable: ${message}`)
      }
    }
    void loadCourses()
    return () => { active = false }
  }, [authToken, catalogAccessKey])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) {
      document.documentElement.style.overflow = ''
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    const handleOutsidePress = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (burgerMenuRef.current?.contains(target)) return
      if (burgerButtonRef.current?.contains(target)) return
      setMobileOpen(false)
    }

    // Lock page scroll on <html>: locking <body> would make it a scroll container
    // and un-pin the sticky header while the menu is open.
    document.documentElement.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleOutsidePress)
    document.addEventListener('touchstart', handleOutsidePress)

    return () => {
      document.documentElement.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleOutsidePress)
      document.removeEventListener('touchstart', handleOutsidePress)
    }
  }, [mobileOpen])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    setStoredValue('levelup-theme', theme)
  }, [theme])

  useEffect(() => {
    setStoredValue('levelup-language', language)
    document.documentElement.lang = language === 'kg' ? 'ky' : language
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
      if (typeof window !== 'undefined') window.localStorage.removeItem(AUTH_TOKEN_KEY)
      return
    }
    // Store the raw token. (It used to go through setStoredValue, which JSON-encodes,
    // so the stored value had quotes and every request reading it got a 401.)
    window.localStorage.setItem(AUTH_TOKEN_KEY, authToken)
  }, [authToken])

  useEffect(() => {
    if (!authToken) {
      setIsLoggedIn(false)
      setUser(null)
      setSessionPending(false)
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
        setStoredLastAuthEmail(nextUser.email)
        setIsLoggedIn(true)
        setSessionPending(false)
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : String(error)
        const isAuthRejection = /401|403|Session expired|invalid|unauthorized|suspended|not found/i.test(message)
        setSessionPending(false)
        if (!isAuthRejection) {
          // Network error / backend waking up: keep the session and cached profile
          // instead of logging the user out.
          console.error('Session restore failed (keeping local session):', error)
          return
        }
        setIsLoggedIn(false)
        setUser(null)
        if (typeof window !== 'undefined') window.localStorage.removeItem(AUTH_TOKEN_KEY)
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
    if (isLoggedIn && !user && !sessionPending) {
      setIsLoggedIn(false)
    }
  }, [isLoggedIn, user, sessionPending])

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
    // Re-sync when the session changes so `isOwn` reflects the logged-in user.
  }, [refreshSiteStats, authToken])

  useEffect(() => {
    if (!user?.email) return
    void refreshSiteStats()
    const syncUserProfile = async () => {
      try {
        const data = await fetchJson<{ user?: { email: string; name: string; firstName?: string; lastName?: string; phone?: string; bio?: string; avatar?: string; role?: string; createdAt?: string }; notifications?: NotificationSettings }>(`${API_BASE_URL}/api/users/${encodeURIComponent(user.email)}`)

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

  const refreshSubscription = useCallback(async (): Promise<UserSubscription | null> => {
    if (!user?.email) return null
    try {
      const remote = await getServerSubscription(user.email)
      setUserSubscription(user.email, remote)
      setSubscriptions((current) => ({ ...current, [user.email]: remote }))
      return remote
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // eslint-disable-next-line no-console
      console.error(`Failed to sync subscription from backend: ${message}`)
      return null
    }
  }, [user?.email])

  useEffect(() => {
    if (!user?.email) return
    void refreshSubscription()
    const onFocus = () => { void refreshSubscription() }
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(() => { void refreshSubscription() }, 5 * 60 * 1000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [refreshSubscription, user?.email])

  // Plans (prices, texts, availability) come from the server; bundled ones are only a fallback.
  const [plans, setPlans] = useState<PlanView[]>(bundledPlans)
  useEffect(() => {
    let active = true
    getPlans()
      .then((list) => {
        if (!active || list.length === 0) return
        setPlans(list.map((plan) => ({
          id: plan.id,
          name: plan.name,
          price: plan.price,
          currency: plan.currency,
          durationDays: plan.durationDays,
          featured: plan.isFeatured,
          label: plan.label,
          description: plan.description,
          features: plan.features
        })))
      })
      .catch((error) => console.warn('Using bundled plans; backend plans unavailable:', error instanceof Error ? error.message : error))
    return () => { active = false }
  }, [])

  // Role comes from the server session; the backend enforces admin rights on every API call.
  const isAdminUser = isAdminRole(user?.role)
  const navItems = [
    { to: '/home', label: t.nav.home },
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
        headers: { 'Content-Type': 'application/json' },
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

  const handleLogout = async (redirectTo = '/auth') => {
    const token = getStoredAuthToken() || authToken

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
      window.localStorage.removeItem(AUTH_TOKEN_KEY)
      window.localStorage.removeItem('levelup-user')
    }

    setAuthToken('')
    setIsLoggedIn(false)
    setUser(null)
    navigate(redirectTo, { replace: true })
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

  const updateUserProfile = async (profileInput: Partial<UserProfile>): Promise<{ ok: boolean; message: string }> => {
    if (!user?.email) return { ok: false, message: 'Auth required' }

    const nextName = `${profileInput.firstName ?? user.firstName ?? user.name.split(' ')[0] ?? ''}`.trim() + ` ${profileInput.lastName ?? user.lastName ?? user.name.split(' ').slice(1).join(' ') ?? ''}`.trim()
    const safeName = nextName.trim()
    if (!safeName || safeName.length < 2) return { ok: false, message: pick(language, 'Атыңызды туура жазыңыз', 'Введите корректное имя', 'Enter a valid name') }

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

    // Persist first; only update the UI once the server has accepted the change,
    // so the user is never told "saved" when the save actually failed.
    try {
      await fetchJson<{ ok: true }>(`${API_BASE_URL}/api/users/${encodeURIComponent(user.email)}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: normalizedUser.firstName,
          lastName: normalizedUser.lastName,
          phone: normalizedUser.phone,
          bio: normalizedUser.bio,
          avatarUrl: profileInput.profileImage ?? user.profileImage ?? ''
        })
      })
    } catch (error) {
      console.error('Failed to persist profile to backend:', error)
      return { ok: false, message: error instanceof Error ? error.message : pick(language, 'Профилди сактоо мүмкүн болгон жок', 'Не удалось сохранить профиль', 'Could not save the profile') }
    }

    const allUsers = getStoredValue<UserProfile[]>('levelup-users', [])
    const hasCurrentUser = allUsers.some((entry) => entry.email.toLowerCase() === user.email.toLowerCase())
    const normalizedUsers = hasCurrentUser ? allUsers : [...allUsers, user]
    const updatedUsers = normalizedUsers.map((entry) => (entry.email.toLowerCase() === user.email.toLowerCase() ? { ...entry, ...normalizedUser } : entry))
    setStoredValue('levelup-users', updatedUsers)
    setUser(normalizedUser)

    return { ok: true, message: pick(language, 'Профиль сакталды', 'Профиль сохранён', 'Profile saved') }
  }

  const changeUserPassword = async (currentPassword: string, nextPassword: string, confirmPassword: string): Promise<{ ok: boolean; message: string }> => {
    if (!user?.email) return { ok: false, message: 'Auth required' }
    if (!currentPassword || !nextPassword || !confirmPassword) return { ok: false, message: pick(language, 'Сырсөздүн бардык талааларын толтуруңуз', 'Заполните все поля пароля', 'Fill in all password fields') }
    if (nextPassword.length < 8) return { ok: false, message: pick(language, 'Минимум 8 белги', 'Минимум 8 символов', 'At least 8 characters') }
    if (nextPassword !== confirmPassword) return { ok: false, message: pick(language, 'Жаңы сырсөздөр дал келбейт', 'Новые пароли не совпадают', 'New passwords do not match') }
    if (currentPassword === nextPassword) return { ok: false, message: pick(language, 'Жаңы сырсөз учурдагысынан башка болушу керек', 'Новый пароль должен отличаться от текущего', 'The new password must differ from the current one') }

    try {
      const result = await fetchJson<{ ok: true; sessionsRevoked?: boolean }>(`${API_BASE_URL}/api/users/${encodeURIComponent(user.email)}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword: nextPassword, confirmPassword })
      })

      if (result.sessionsRevoked) {
        // Force logout since all sessions were revoked
        setTimeout(() => {
          void handleLogout('/auth?mode=login')
        }, 1500)
      }

      return { ok: true, message: pick(language, 'Сырсөз ийгиликтүү өзгөртүлдү. Аккаунттан чыгууда...', 'Пароль успешно изменён. Выполняется выход...', 'Password changed. Signing you out...') }
    } catch (error) {
      const message = error instanceof Error ? error.message : pick(language, 'Сырсөздү өзгөртүү мүмкүн болгон жок', 'Пароль не удалось изменить', 'Could not change the password')
      return { ok: false, message }
    }
  }

  const updateUserNotifications = (nextSettings: NotificationSettings) => {
    if (!user?.email) return { ok: false as const, message: 'Auth required' }

    setNotifications(nextSettings)
    setStoredValue('levelup-notifications', nextSettings)

    void fetchJson<{ ok: true }>(`${API_BASE_URL}/api/users/${encodeURIComponent(user.email)}/notifications`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailNotifications: nextSettings.emailNotifications,
        newCourses: nextSettings.newCourses,
        newLessons: nextSettings.newLessons,
        newsUpdates: nextSettings.newsUpdates
      })
    }).catch((error) => {
      console.error('Failed to persist notification settings to backend:', error)
    })

    return { ok: true as const, message: pick(language, 'Эскертүү жөндөөлөрү сакталды', 'Настройки уведомлений сохранены', 'Notification settings saved') }
  }

  const billing = useMemo<BillingState>(() => ({
    plans,
    subscription: currentUserSubscription,
    isLoggedIn,
    isAdmin: isAdminUser,
    userEmail: user?.email ?? null,
    refreshSubscription
  }), [plans, currentUserSubscription, isLoggedIn, isAdminUser, user?.email, refreshSubscription])

  return (
    <LanguageContext.Provider value={language}>
    <CourseCatalogContext.Provider value={catalog}>
    <BillingContext.Provider value={billing}>
    <div className="app-shell">
      {!isDashboardRoute && (
        <header className="site-header">
          <div className="container nav-wrap">
            <Link className="brand" to="/home" aria-label="LEVEL UP home">
              <img src={siteLogo} alt="LEVEL UP" className="brand-logo-image" />
            </Link>

            <nav className="nav">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')} onClick={() => setMobileOpen(false)} title={item.label}>
                  {(() => { const NavIcon = headerNavIcons[item.to] ?? LayoutGrid; return <NavIcon size={17} className="nav-item-icon" aria-hidden="true" /> })()}
                  <span>{item.to === '/faq' ? 'FAQ' : item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="nav-actions">
              {isLoggedIn && user ? (
                <>
                  <Link to="/dashboard" className="btn btn-secondary btn-login header-profile-chip" title={t.nav.profile}>
                    <span className="avatar tiny">{user.profileImage ? <img src={user.profileImage} alt="" className="profile-avatar-image" /> : renderAvatarContent(user.avatar, user.name?.charAt(0)?.toUpperCase() || 'U')}</span>
                    <span className="header-profile-name">{user.name}</span>
                  </Link>
                  <button type="button" className="btn btn-ghost header-logout" onClick={() => { void handleLogout() }} aria-label={t.dashboard.logout} title={t.dashboard.logout}><LogOut size={18} /></button>
                </>
              ) : (
                <>
                  <Link to="/auth" className="btn btn-secondary btn-login">{t.buttons.login}</Link>
                  <Link to="/auth" className="btn btn-primary">{t.buttons.signup}</Link>
                </>
              )}

              <HeaderQuickControls t={t} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} />

              <button
                ref={burgerButtonRef}
                type="button"
                className="burger"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? t.headerMenu.close : t.headerMenu.open}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

            <div ref={burgerMenuRef} className={`header-burger-menu ${mobileOpen ? 'open' : ''}`} role="menu" aria-hidden={!mobileOpen}>
              <div className="header-menu-block">
                <div className="header-menu-label">
                 <span>{t.footer.nav}</span>
               </div>
               <nav className="header-mobile-nav" aria-label="Mobile navigation">
                 {navItems.map((item) => (
                   <NavLink
                     key={item.to}
                     to={item.to}
                     className={({ isActive }) => (isActive ? 'header-mobile-nav-item active' : 'header-mobile-nav-item')}
                     onClick={() => setMobileOpen(false)}
                   >
                     {item.label}
                   </NavLink>
                 ))}
               </nav>
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
                   <button type="button" className="btn btn-primary full-width" onClick={() => { setMobileOpen(false); void handleLogout() }}>{t.dashboard.logout}</button>
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
        <ScrollToTopOnNavigate />
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/start-learning" element={<StartLearningRedirect />} />
          <Route path="/home" element={<HomePage t={t} reviews={reviews} leaderboard={leaderboard} siteStats={siteStats} />} />
          <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonPage t={t} completedLessons={user ? currentUserLessons : completedLessons} subscription={currentUserSubscription} isLoggedIn={isLoggedIn} onCompleteLesson={completeLessonForCurrentUser} />} />
          <Route path="/courses/:courseId" element={<CourseDetailPage t={t} completedLessons={user ? currentUserLessons : completedLessons} onCourseComplete={awardCourseCompletion} subscription={currentUserSubscription} isLoggedIn={isLoggedIn} />} />
          <Route path="/courses" element={<CourseCatalogPage t={t} favorites={favorites} onToggleFavorite={setFavorites} completedLessons={user ? currentUserLessons : completedLessons} />} />
          <Route path="/auth" element={<AuthPage t={t} user={user} isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} setUser={setUser} setAuthToken={setAuthToken} onUserRegistered={refreshSiteStats} />} />
          <Route path="/dashboard" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><DashboardPage t={t} user={user} completedLessons={user ? currentUserLessons : completedLessons} subscription={currentUserSubscription} onUpdateProfile={updateUserProfile} onChangePassword={changeUserPassword} reviews={reviews} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} onLogout={() => { void handleLogout() }} /></ProtectedRoute>} />
          <Route path="/dashboard/courses" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><CourseCatalogPage t={t} favorites={favorites} onToggleFavorite={setFavorites} completedLessons={user ? currentUserLessons : completedLessons} /></ProtectedRoute>} />
          <Route path="/dashboard/my-lessons" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><DashboardLessonsPage completedLessons={user ? currentUserLessons : completedLessons} language={language} /></ProtectedRoute>} />
          <Route path="/dashboard/rating" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><RatingPage t={t} leaderboard={leaderboard} reviews={reviews} currentEmail={user?.email} /></ProtectedRoute>} />
          <Route path="/dashboard/reviews" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><ReviewsPage t={t} reviews={reviews} setReviews={setReviews} isLoggedIn={isLoggedIn} user={user} onRefreshSiteStats={refreshSiteStats} /></ProtectedRoute>} />
          <Route path="/dashboard/pricing" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><PricingPage t={t} /></ProtectedRoute>} />
          <Route path="/dashboard/faq" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><FaqPage t={t} /></ProtectedRoute>} />
          <Route path="/dashboard/ai" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><DashboardAiPage language={language} subscription={currentUserSubscription} userEmail={user?.email} /></ProtectedRoute>} />
          <Route path="/dashboard/profile" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><ProfilePage t={t} user={user} completedLessons={user ? currentUserLessons : completedLessons} subscription={currentUserSubscription} onUpdateProfile={updateUserProfile} onChangePassword={changeUserPassword} onUpdateNotifications={updateUserNotifications} notifications={notifications} reviews={reviews} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} onLogout={() => { void handleLogout() }} /></ProtectedRoute>} />
          {/* Admin routes — dedicated login and panel */}
          <Route path="/admin/login" element={<AdminLogin isLoggedIn={isLoggedIn} userRole={user?.role} onLogin={(token, adminUser) => {
            setAuthToken(token)
            if (typeof window !== 'undefined') window.localStorage.setItem(AUTH_TOKEN_KEY, token)
            const nextUser: UserProfile = {
              name: adminUser.name,
              email: adminUser.email,
              password: '',
              avatar: adminUser.avatar,
              role: adminUser.role,
              firstName: adminUser.firstName ?? '',
              lastName: adminUser.lastName ?? ''
            }
            setUser(nextUser)
            setIsLoggedIn(true)
            if (typeof window !== 'undefined') window.localStorage.setItem('levelup-user', JSON.stringify(nextUser))
          }} />} />
          <Route path="/admin/reset-password" element={<AdminResetPassword audience="admin" />} />
          <Route path="/reset-password" element={<AdminResetPassword audience="user" />} />
          <Route path="/admin" element={
            <ProtectedAdminRoute isLoggedIn={isLoggedIn} user={user} pending={sessionPending}>
              <Suspense fallback={<div className="container section page-block"><div className="empty-state-box">{t.generic.loading}</div></div>}>
                <AdminPanel user={user ? { name: user.name, email: user.email, avatar: user.avatar, role: user.role } : null} onLogout={() => { void handleLogout('/admin/login') }} />
              </Suspense>
            </ProtectedAdminRoute>
          } />
          <Route path="/rating" element={<RatingPage t={t} leaderboard={leaderboard} reviews={reviews} currentEmail={user?.email} />} />
          <Route path="/reviews" element={<ReviewsPage t={t} reviews={reviews} setReviews={setReviews} isLoggedIn={isLoggedIn} user={user} onRefreshSiteStats={refreshSiteStats} />} />
          <Route path="/pricing" element={<PricingPage t={t} />} />
          <Route path="/pricing/checkout/:planId" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><CheckoutPage t={t} user={user} /></ProtectedRoute>} />
          <Route path="/faq" element={<FaqPage t={t} />} />
          <Route path="/privacy" element={<LegalPage title={t.footer.privacy} kind="privacy" />} />
          <Route path="/terms" element={<LegalPage title={t.footer.terms} kind="terms" />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>

      <Footer t={t} />
      <MobileBottomNav t={t} isLoggedIn={isLoggedIn} />
    </div>
    </BillingContext.Provider>
    </CourseCatalogContext.Provider>
    </LanguageContext.Provider>
  )
}

/** Icons for the desktop header links (shown in Light Mode). */
const headerNavIcons: Record<string, typeof Home> = {
  '/home': Home,
  '/courses': LayoutGrid,
  '/rating': Trophy,
  '/reviews': MessageSquareText,
  '/pricing': WalletCards,
  '/faq': HelpCircle,
  '/admin': ShieldCheck
}

function SessionCheckPlaceholder() {
  const language = useLanguage()
  return <div className="container section page-block"><div className="empty-state-box">{translations[language].generic.loading}</div></div>
}

function ProtectedRoute({ isLoggedIn, pending = false, children }: { isLoggedIn: boolean; pending?: boolean; children: React.ReactNode }) {
  const location = useLocation()
  if (pending) return <SessionCheckPlaceholder />
  // Remember where the user was going so login brings them back there.
  if (!isLoggedIn) return <Navigate to={`/auth?mode=login&next=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />
  return <>{children}</>
}

function ProtectedAdminRoute({ isLoggedIn, user, pending = false, children }: { isLoggedIn: boolean; user: UserProfile | null; pending?: boolean; children: React.ReactNode }) {
  if (pending) return <SessionCheckPlaceholder />
  const isAdmin = Boolean(user && isAdminRole(user.role))

  if (!isLoggedIn) {
    return <Navigate to={`/admin/login?next=${encodeURIComponent('/admin')}`} replace />
  }

  if (!isAdmin) {
    // Regular accounts are sent to the administrator login (the backend also answers 403
    // on every admin API call, so this is only the UI side of the protection).
    return <Navigate to={`/admin/login?next=${encodeURIComponent('/admin')}&reason=forbidden`} replace />
  }

  return <>{children}</>
}
function StartLearningRedirect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = resolveSafeNextPath(searchParams.get('next'), '/courses')

  useEffect(() => {
    let active = true

    const resolveStartFlow = async () => {
      const token = getStoredAuthToken()

      if (token) {
        try {
          await fetchJson<{ ok: true; user: { email: string } }>(`${API_BASE_URL}/api/auth/session`)
          if (active) navigate(nextPath, { replace: true })
          return
        } catch {
          // No active session, continue auth flow selection.
        }
      }

      const lastAuthEmail = getStoredLastAuthEmail()
      const encodedNext = encodeURIComponent(nextPath)
      const authBase = `/auth?next=${encodedNext}`
      const encodedEmail = lastAuthEmail ? `&email=${encodeURIComponent(lastAuthEmail)}` : ''

      if (!lastAuthEmail) {
        if (active) navigate(`${authBase}&mode=register`, { replace: true })
        return
      }

      try {
        const status = await fetchJson<{ exists: boolean }>(`${API_BASE_URL}/api/auth/account-status?email=${encodeURIComponent(lastAuthEmail)}`)
        if (!active) return
        if (status.exists) {
          navigate(`${authBase}&mode=login${encodedEmail}`, { replace: true })
          return
        }
      } catch (error) {
        console.error('Failed to resolve account status:', error)
      }

      if (active) navigate(`${authBase}&mode=register${encodedEmail}`, { replace: true })
    }

    void resolveStartFlow()
    return () => { active = false }
  }, [navigate, nextPath, searchParams])

  return (
    <div className="container section page-block">
      <div className="empty-state-box">Loading...</div>
    </div>
  )
}

function HomePage({ t, reviews, leaderboard, siteStats }: { t: (typeof translations)[Lang]; reviews: Review[]; leaderboard: LeaderboardEntry[]; siteStats: SiteStats }) {
  const { courses } = useCourseCatalog()
  const language = useLanguage()
  const popularCourses = courses.slice(0, 3)
  const { plans: homePlans } = useBilling()
  const highlightedReviews = reviews.slice(0, 3)
  const featuredCourse = popularCourses[0]
  const startLearningLink = `/start-learning?next=${encodeURIComponent(`/courses/${featuredCourse.id}`)}`
  const steps = [
    { title: { kg: 'Катталуу', ru: 'Зарегистрируйся', en: 'Register' }, info: { kg: 'Аккаунт түзүңүз', ru: 'Создай аккаунт', en: 'Create an account' } },
    { title: { kg: 'Курс танда', ru: 'Выбери курс', en: 'Choose a course' }, info: { kg: 'Максатыңызга ылайык курс тандаңыз', ru: 'Подбери курс под цель', en: 'Select a course' } },
    { title: { kg: 'Сабактарды үйрөн', ru: 'Изучай уроки', en: 'Learn lessons' }, info: { kg: 'Практика менен үйрөнүңүз', ru: 'Изучай материал', en: 'Study each lesson' } },
    { title: { kg: 'Тапшырмаларды аткар', ru: 'Выполняй задания', en: 'Complete tasks' }, info: { kg: 'Тесттер жана долбоорлор', ru: 'Решай задания и тесты', en: 'Complete exercises' } },
    { title: { kg: 'Сертификат ал', ru: 'Получи сертификат', en: 'Earn certificate' }, info: { kg: 'Натыйжаңызды бекемдеңиз', ru: 'Зафиксируй результат', en: 'Celebrate success' } }
  ]

  const advantageItems = [
    { icon: GraduationCap, title: { kg: 'Нөлдөн окутуу', ru: 'Обучение с нуля', en: 'Learn from scratch' }, text: { kg: 'Нөлдөн баштап, кадам-кадам', ru: 'Пошаговый старт с нуля', en: 'Start at the beginning' } },
    { icon: Target, title: { kg: 'Практикалык тапшырмалар', ru: 'Практические задания', en: 'Hands-on tasks' }, text: { kg: 'Реалдуу кейстер', ru: 'Реальные кейсы', en: 'Real-world practice' } },
    { icon: LayoutGrid, title: { kg: 'Интерактивдүү сабактар', ru: 'Интерактивные уроки', en: 'Interactive lessons' }, text: { kg: 'Кызыктуу материал', ru: 'Динамичный контент', en: 'Engaging content' } },
    { icon: Clock3, title: { kg: 'Каалаган убакта жеткиликтүү', ru: 'Доступ в любое время', en: 'Anytime access' }, text: { kg: 'Үйде да, жолда да', ru: 'Учитесь в любое время', en: 'Learn anywhere' } },
    { icon: Brain, title: { kg: 'Жасалма интеллекттин жардамы', ru: 'Поддержка искусственного интеллекта', en: 'AI support' }, text: { kg: 'Тез кеңештер', ru: 'Быстрые подсказки', en: 'Fast guidance' } },
    { icon: BadgeCheck, title: { kg: 'Сертификат', ru: 'Сертификаты', en: 'Certificates' }, text: { kg: 'Курсту бүтүргөндөн кийин', ru: 'После завершения', en: 'After completion' } }
  ]

  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">LEVEL UP</span>
            <h1>
              <span className="hero-title-desktop">{t.heroTitle}</span>
              <span className="hero-title-mobile">
                {t.home.titleLines.map((line, index) => (
                  <span key={line} className={index === t.home.titleLines.length - 1 ? 'hero-title-line accent' : 'hero-title-line'}>{line}</span>
                ))}
              </span>
            </h1>
            <p><span className="hero-title-desktop">{t.heroSubtitle}</span><span className="hero-title-mobile">{t.home.subtitle}</span></p>
            <div className="hero-actions">
              <Link to={startLearningLink} className="btn btn-primary btn-lg hero-start-button">
                <Play size={16} className="hero-start-icon" fill="currentColor" />
                <span>{t.buttons.start}</span>
                <ArrowRight size={18} className="hero-start-icon" />
              </Link>
              <button type="button" className="btn btn-secondary btn-lg hero-courses-button" onClick={() => { document.getElementById('popular-courses')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{t.buttons.coursesBtn}</button>
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
            <HeroIllustration />
          </div>
        </div>
      </section>

      <HomeStatsCard t={t} siteStats={siteStats} courseCount={courses.length} />

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow={pick(language, 'Артыкчылыктар', 'Преимущества', 'Benefits')} title={t.benefitTitle} />
          <div className="benefits-grid">
            {advantageItems.map(({ icon: Icon, title, text }) => (
              <div className="feature-card" key={title.ru}>
                <div className="feature-icon"><Icon size={22} /></div>
                <div className="feature-text">
                  <h3>{title[language]}</h3>
                  <p>{text[language]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section categories-section">
        <div className="container">
          <HomeSectionHeader eyebrow={t.home.categories} title={t.home.directions} linkTo="/courses" linkLabel={t.home.allCourses} />
          <CourseDirectionGrid />
        </div>
      </section>

      <section id="popular-courses" className="section alt-bg">
        <div className="container">
          <div className="home-desktop-only"><HomeSectionHeader eyebrow={t.home.popular} title={t.home.chooseCourse} linkTo="/courses" linkLabel={t.home.viewAll} /></div>
          <div className="home-mobile-only">
            <HomeSectionHeader eyebrow={t.home.popular} title={t.home.chooseCourse} linkTo="/courses" linkLabel={t.home.viewAll} />
            <div className="home-course-list">
              {popularCourses.map((course, index) => (
                <HomeCourseRow key={course.id} course={course} t={t} isTop={index === 0} />
              ))}
            </div>
          </div>
          <div className="course-grid home-grid home-desktop-only">
            {popularCourses.map((course) => (
              <CourseCard key={course.id} course={course} language={language} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow={pick(language, 'Кадамдар', 'Шаги', 'Steps')} title={t.startTitle} />
          <div className="steps-grid">
            {steps.map((step, index) => (
              <div className="step-card" key={step.title.ru}>
                <span className="step-number">0{index + 1}</span>
                <div className="step-text">
                  <h3>{step.title[language]}</h3>
                  <p>{step.info[language]}</p>
                </div>
                <ChevronRight size={20} className="step-go" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt-bg">
        <div className="container">
          <HomeSectionHeader eyebrow={t.nav.rating} title={t.leaderboardTitle} linkTo="/rating" linkLabel={t.home.viewAll} />
          {leaderboard.length === 0 ? (
            <EmptyState icon={Trophy}>{t.messages.emptyLeaderboard}</EmptyState>
          ) : (
            <div className="leaderboard-grid">
              {leaderboard.slice(0, 5).map((item, index) => (
                <div className={index < 3 ? 'leaderboard-card top' : 'leaderboard-card'} key={item.id}>
                  <div className="rank">{index === 0 ? <Crown size={16} /> : null}#{index + 1}</div>
                  <div className="avatar small">{renderAvatarContent(item.avatar, item.name?.charAt(0)?.toUpperCase() || 'U')}</div>
                  <div>
                    <h4>{item.name}</h4>
                    <p>{item.courses} {pick(language, 'курс', 'курсов', 'courses')}</p>
                  </div>
                  <strong>{item.score}<small> {pick(language, 'упай', 'баллов', 'pts')}</small></strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <HomeSectionHeader eyebrow={t.nav.reviews} title={t.reviewsTitle} linkTo="/reviews" linkLabel={t.home.viewAll} />
          {highlightedReviews.length === 0 ? (
            <EmptyState icon={MessageSquareText}>{t.messages.emptyReviews}</EmptyState>
          ) : (
            <div className="reviews-grid">
              {highlightedReviews.map((review) => <ReviewCard key={review.id} review={review} language={language} />)}
            </div>
          )}
        </div>
      </section>

      <section className="section alt-bg">
        <div className="container">
          <HomeSectionHeader eyebrow={pick(language, 'Тарифтер', 'Тарифы', 'Plans')} title={t.pricingTitle} linkTo="/pricing" linkLabel={t.home.viewAll} />
          <div className="pricing-grid home-pricing">
            {homePlans.map((plan) => <PricingCard key={plan.id} plan={plan} t={t} language={language} />)}
          </div>
        </div>
      </section>

      <section className="section faq-section">
        <div className="container">
          <SectionHeading eyebrow="FAQ" title={t.faqTitle} />
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

function CourseCatalogPage({ t, favorites, onToggleFavorite, completedLessons = [] }: { t: (typeof translations)[Lang]; favorites: string[]; onToggleFavorite: React.Dispatch<React.SetStateAction<string[]>>; completedLessons?: string[] }) {
  const { courses } = useCourseCatalog()
  const language = useLanguage()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/'
  const [search, setSearch] = useState(() => String(searchParams.get('search') ?? ''))
  const [category, setCategory] = useState(() => String(searchParams.get('category') ?? 'all'))
  const [level, setLevel] = useState(() => String(searchParams.get('level') ?? 'all'))
  const [sort, setSort] = useState(() => String(searchParams.get('sort') ?? 'popular'))
  const categoryOptions = useMemo(() => Array.from(new Set(courses.map((course) => course.category))), [courses])
  const coursesListPath = `${location.pathname}${location.search}`
  const coursesScrollKey = `levelup-scroll:${coursesListPath}`
  const navigationType = useNavigationType()

  useEffect(() => {
    const next = new URLSearchParams()
    if (search.trim()) next.set('search', search.trim())
    if (category !== 'all') next.set('category', category)
    if (level !== 'all') next.set('level', level)
    if (sort !== 'popular') next.set('sort', sort)
    setSearchParams(next, { replace: true })
  }, [category, level, search, setSearchParams, sort])

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Restore the list position only when coming back (Back/Forward), not when the
    // catalog is opened fresh from a menu or tab, which should start at the top.
    if (navigationType !== 'POP') return
    const stored = window.sessionStorage.getItem(coursesScrollKey)
    if (!stored) return
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: Number(stored) || 0, behavior: 'instant' })
    })
  }, [coursesScrollKey, navigationType])

  useEffect(() => {
    if (typeof window === 'undefined') return
    return () => {
      window.sessionStorage.setItem(coursesScrollKey, String(window.scrollY))
    }
  }, [coursesScrollKey])

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
  }, [category, courses, language, level, search, sort])

  const totalLessons = courses.reduce((sum, course) => sum + course.lessons.length, 0)

  return (
    <div className="container section page-block catalog-page">
      <PageHero
        back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />}
        eyebrow={pick(language, 'Каталог', 'Каталог', 'Catalog')}
        title={t.nav.courses}
        subtitle={pick(language, 'Программалоо, дизайн, AI жана башка багыттар — өз темпиңизде үйрөнүңүз.', 'Программирование, дизайн, AI и другие направления — учитесь в своём темпе.', 'Programming, design, AI and more — learn at your own pace.')}
        aside={(
          <div className="ui-hero-chips">
            <span><BookOpen size={16} /> {courses.length} {pick(language, 'курс', 'курсов', 'courses')}</span>
            <span><PlayCircle size={16} /> {totalLessons} {t.home.lessons}</span>
          </div>
        )}
      />
      <div className="toolbar catalog-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.catalog.search} aria-label={t.catalog.search} />
        </label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t.catalog.category}>
          <option value="all">{t.catalog.category}</option>
          {categoryOptions.map((categoryItem) => <option key={categoryItem} value={categoryItem}>{categoryItem}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label={t.catalog.level}>
          <option value="all">{t.catalog.level}</option>
          {(['Beginner', 'Intermediate', 'Advanced'] as const).map((item) => <option key={item} value={item}>{levelLabel(item, language)}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={pick(language, 'Иреттөө', 'Сортировка', 'Sort')}>
          <option value="popular">{pick(language, 'Популярдуу', 'Популярные', 'Popular')}</option>
          <option value="rating">{pick(language, 'Рейтинг боюнча', 'По рейтингу', 'By rating')}</option>
        </select>
      </div>
      <div className="category-chips" role="group" aria-label={t.catalog.category}>
        <SlidersHorizontal size={16} aria-hidden="true" />
        {['all', ...categoryOptions].map((item) => (
          <button key={item} type="button" className={category === item ? 'category-chip active' : 'category-chip'} aria-pressed={category === item} onClick={() => setCategory(item)}>
            {item === 'all' ? pick(language, 'Баары', 'Все', 'All') : item}
          </button>
        ))}
      </div>
      <p className="catalog-count">{pick(language, 'Табылды', 'Найдено', 'Found')}: <strong>{filteredCourses.length}</strong></p>
      {filteredCourses.length === 0 ? (
        <EmptyState icon={Search}>{pick(language, 'Эч нерсе табылган жок. Фильтрлерди өзгөртүп көрүңүз.', 'Ничего не найдено. Попробуйте изменить фильтры.', 'Nothing found. Try changing the filters.')}</EmptyState>
      ) : (
        <div className="course-grid">
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} language={language} favorites={favorites} onToggleFavorite={onToggleFavorite} backTo={coursesListPath} completedLessons={completedLessons} />
          ))}
        </div>
      )}
    </div>
  )
}

function CourseDetailPage({ t, completedLessons, onCourseComplete, subscription: _subscription, isLoggedIn }: { t: (typeof translations)[Lang]; completedLessons: string[]; onCourseComplete?: (courseId: string) => void; subscription?: UserSubscription; isLoggedIn: boolean }) {
  const { courseIndex } = useCourseCatalog()
  const language = useLanguage()
  const { courseId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const course = courseIndex[courseId ?? '']
  const fallbackCourseList = location.pathname.startsWith('/dashboard') ? '/dashboard/courses' : '/courses'
  const courseListPath = resolveSafeNextPath(searchParams.get('from'), fallbackCourseList)
  const courseDetailPath = `${location.pathname}${location.search}`
  const lessonPath = (targetLessonId: string) => appendFromParam(`/courses/${courseId}/lessons/${targetLessonId}`, courseDetailPath)
  const [lockedLesson, setLockedLesson] = useState<string | null>(null)
  const [lockedReason, setLockedReason] = useState<'auth' | 'sequence' | 'plan'>('auth')
  const lessonLimit = useLessonLimit()
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
        <SmartBackButton fallback={courseListPath} label={language === 'ru' ? 'Назад к курсам' : language === 'kg' ? 'Курстарга кайтуу' : 'Back to courses'} />
      </div>
      <div className="breadcrumbs" aria-label="Breadcrumb">
        <Link to={courseListPath}>{t.nav.courses}</Link>
        <span>/</span>
        <span>{course.title[language]}</span>
      </div>
      <UpgradeRequiredModal open={lockedReason === 'plan' && !!lockedLesson} onClose={() => setLockedLesson(null)} />
      <Modal
        open={!!lockedLesson && lockedReason !== 'plan'}
        onClose={() => setLockedLesson(null)}
        icon={Lock}
        title={lockedReason === 'auth' ? t.auth.login : t.buttons.nextLesson}
        actions={(
          <>
            <Button variant="secondary" size="sm" onClick={() => setLockedLesson(null)}>{pick(language, 'Жабуу', 'Закрыть', 'Close')}</Button>
            {lockedReason === 'auth'
              ? <ButtonLink size="sm" to={`/auth?mode=login&next=${encodeURIComponent(lessonPath(lockedLesson ?? course.lessons[0].id))}`}>{t.auth.login}</ButtonLink>
              : <Button size="sm" onClick={() => navigate(lessonPath(course.lessons[Math.max(0, course.lessons.findIndex((item) => item.id === lockedLesson) - 1)]?.id ?? course.lessons[0].id))}>{t.sections.previous}</Button>}
          </>
        )}
      >
        <p>{lockedReason === 'auth' ? pick(language, 'Бул сабакты ачуу үчүн кириңиз.', 'Войдите, чтобы открыть этот урок.', 'Log in to open this lesson.') : pick(language, 'Адегенде мурунку сабакты бүтүрүңүз.', 'Сначала завершите предыдущий урок.', 'Complete the previous lesson first.')}</p>
      </Modal>

      <div className="course-hero" style={{ ['--course-accent' as string]: course.accent }}>
        <div className="course-hero-copy">
          <span className="ui-eyebrow">{course.badge}</span>
          <h1>{course.title[language]}</h1>
          <p>{course.description[language]}</p>
          <div className="meta-row">
            <span><SlidersHorizontal size={15} /> {levelLabel(course.level, language)}</span>
            <span><Clock3 size={15} /> {course.duration}</span>
            <span><Star size={15} fill="currentColor" /> {course.rating}</span>
            <span><Users size={15} /> {course.students}</span>
            <span><PlayCircle size={15} /> {course.lessons.length} {t.home.lessons}</span>
          </div>
          <div className="hero-actions course-actions">
            <button type="button" className="btn btn-primary" onClick={() => {
              navigate(lessonPath(course.lessons[0].id))
            }}><Play size={16} fill="currentColor" /> {t.buttons.begin}</button>
            <button type="button" className="btn btn-secondary" onClick={() => {
              const nextIndex = course.lessons.findIndex((item) => item.id === nextLesson.id)
              if (nextIndex >= lessonLimit || nextLesson.locked) {
                setLockedReason(isLoggedIn ? 'plan' : 'auth')
                setLockedLesson(nextLesson.id)
                return
              }
              const previousLesson = course.lessons[nextIndex - 1]
              if (previousLesson && !completedLessons.includes(previousLesson.id)) {
                setLockedReason('sequence')
                setLockedLesson(nextLesson.id)
                return
              }
              navigate(lessonPath(nextLesson.id))
            }}>{t.buttons.continue}</button>
            <Link to={courseListPath} className="btn btn-ghost"><ArrowLeft size={16} /> {pick(language, 'Курстарга кайтуу', 'Вернуться к курсам', 'Back to courses')}</Link>
          </div>
        </div>
        <div className="course-summary">
          <span className="course-summary-icon"><CourseDirectionIcon courseId={course.id} size={30} /></span>
          <h3>{t.dashboard.progress}</h3>
          <strong>{Math.round((completedCount / course.lessons.length) * 100)}%</strong>
          <ProgressBar value={(completedCount / course.lessons.length) * 100} />
          <p>{completedCount} / {course.lessons.length} {t.dashboard.completed}</p>
        </div>
      </div>

      <div className="grid-detail">
        <div className="detail-card">
          <h3><ListChecks size={20} /> {t.sections.courseProgram}</h3>
          <ul className="check-list">
            {course.outline.map((item) => <li key={item}><CheckCircle2 size={16} /> {item}</li>)}
          </ul>
        </div>
        <div className="detail-card">
          <h3><Lightbulb size={20} /> {t.sections.whatLearn}</h3>
          <div className="tag-cloud">
            {course.tags.map((tag) => <Badge key={tag} tone="neutral" icon={Sparkles}>{tag}</Badge>)}
          </div>
        </div>
      </div>

      <div className="lesson-list">
        <h3><PlayCircle size={20} /> {pick(language, 'Сабактар', 'Уроки курса', 'Course lessons')} <small>{course.lessons.length}</small></h3>
        {course.lessons.map((lesson, index) => {
          const isDone = completedLessons.includes(lesson.id)
          const isLocked = index >= lessonLimit || Boolean(lesson.locked)
          const needsPlan = isLocked && isLoggedIn
          return (
            <button type="button" key={lesson.id} className={isDone ? 'lesson-row complete' : 'lesson-row'} onClick={() => {
              if (isLocked) {
                setLockedReason(isLoggedIn ? 'plan' : 'auth')
                setLockedLesson(lesson.id)
                return
              }
              const previousLesson = course.lessons[index - 1]
              if (previousLesson && !completedLessons.includes(previousLesson.id)) {
                setLockedReason('sequence')
                setLockedLesson(lesson.id)
                return
              }
              navigate(lessonPath(lesson.id))
            }} disabled={false}>
              <span className="lesson-index">{isDone ? <Check size={16} /> : index + 1}</span>
              <span className="lesson-meta"><strong>{lesson.title[language]}</strong><small><Clock3 size={13} /> {lesson.duration} • {lesson.type}</small></span>
              <span className={isLocked ? 'lesson-status locked' : isDone ? 'lesson-status done' : 'lesson-status'}>{isLocked ? <Lock size={14} /> : isDone ? <CheckCircle2 size={14} /> : <Play size={13} fill="currentColor" />} {needsPlan ? 'PRO' : isLocked ? t.auth.login : isDone ? t.generic.done : t.generic.open}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LessonPage({ t, completedLessons, subscription: _subscription, isLoggedIn, onCompleteLesson }: { t: (typeof translations)[Lang]; completedLessons: string[]; subscription?: UserSubscription; isLoggedIn: boolean; onCompleteLesson?: (courseId: string, lessonId: string) => void }) {
  const { courseIndex } = useCourseCatalog()
  const language = useLanguage()
  const { courseId, lessonId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const course = courseIndex[courseId ?? '']
  const lessonIndex = course?.lessons.findIndex((lesson) => lesson.id === lessonId) ?? -1
  const lesson = course?.lessons[lessonIndex]
  const safeLessonId = lesson?.id ?? ''
  const safeDuration = lesson?.duration ?? '20'
  const courseReturnPath = resolveSafeNextPath(searchParams.get('from'), `/courses/${courseId}`)
  const lessonPath = (targetLessonId: string) => appendFromParam(`/courses/${courseId}/lessons/${targetLessonId}`, courseReturnPath)
  const currentLessonPath = `${location.pathname}${location.search}`
  const [watchElapsedSec, setWatchElapsedSec] = useState(0)
  const lessonLimit = useLessonLimit()

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

  const accessBlocked = !isLoggedIn && lessonIndex >= GUEST_LESSON_LIMIT
  const planBlocked = isLoggedIn && (lessonIndex >= lessonLimit || Boolean(lesson.locked))
  const isCompleted = completedLessons.includes(lesson.id)
  const watchRequirementSec = Math.min(120, Math.max(20, Number(safeDuration.replace(/[^\d]/g, '')) * 2))
  const watchReady = watchElapsedSec >= watchRequirementSec

  if (planBlocked) {
    return (
      <div className="container section page-block">
        <UpgradeRequiredModal open onClose={() => navigate(courseReturnPath)} />
      </div>
    )
  }

  if (accessBlocked) {
    return (
      <div className="container section page-block">
        <Modal
          open
          onClose={() => navigate(courseReturnPath)}
          icon={Lock}
          title={t.auth.login}
          actions={(
            <>
              <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => navigate(courseReturnPath)}>{pick(language, 'Кайтуу', 'Назад', 'Back')}</Button>
              <ButtonLink size="sm" to={`/auth?mode=login&next=${encodeURIComponent(currentLessonPath)}`}>{t.auth.login}</ButtonLink>
            </>
          )}
        >
          <p>{pick(language, '2-20 сабактарды ачуу үчүн кириңиз.', 'Войдите, чтобы открыть уроки 2-20.', 'Log in to unlock lessons 2-20.')}</p>
        </Modal>
      </div>
    )
  }

  const progress = Math.round((completedLessons.filter((id) => id.startsWith(`${course.id}-lesson-`)).length / course.lessons.length) * 100)
  const nextLesson = course.lessons[lessonIndex + 1]
  const previousLesson = course.lessons[lessonIndex - 1]

  return (
    <div className="container section lesson-page">
      <div className="lesson-topbar">
        <SmartBackButton fallback={courseReturnPath} label={language === 'ru' ? 'Назад к урокам' : language === 'kg' ? 'Сабактарга кайтуу' : 'Back to lessons'} />
        <div className="lesson-course-meta">
          <span>{course.title[language]}</span>
          <span className="dot-divider" />
          <span>
            {language === 'ru'
             ? `Урок ${lessonIndex + 1} из ${course.lessons.length}`
             : language === 'kg'
               ? `Сабак ${lessonIndex + 1} / ${course.lessons.length}`
               : `Lesson ${lessonIndex + 1} of ${course.lessons.length}`}
          </span>
        </div>
      </div>
      <div className="breadcrumbs" aria-label="Breadcrumb">
        <Link to={courseReturnPath}>{course.title[language]}</Link>
        <span>/</span>
        <span>{lesson.title[language]}</span>
      </div>

      <div className="lesson-header">
        <div className="lesson-header-copy">
          <span className="eyebrow lesson-eyebrow">{course.title[language]}</span>
          <h1>{lesson.title[language]}</h1>
          <div className="lesson-header-meta">
            <span><PlayCircle size={14} /> {lesson.type}</span>
            <span className="dot-divider" />
            <span><Clock3 size={14} /> {lesson.duration}</span>
            {isCompleted
              ? <Badge tone="green" icon={CheckCircle2}>{pick(language, 'Аякталды', 'Урок завершён', 'Completed')}</Badge>
              : <Badge tone="neutral">{pick(language, 'Аткарылууда', 'В процессе', 'In progress')}</Badge>}
          </div>
        </div>

        <div className="lesson-progress">
          <ProgressBar value={progress} label={pick(language, 'Курстун прогресси', 'Прогресс курса', 'Course progress')} showValue />
        </div>
      </div>

      <div className="lesson-layout">
        <div className="lesson-main">
          <div className="video-box">
            <div className="video-header-row">
             <span className="video-badge">{lesson.type}</span>
             <span className="video-timer-badge">
               {language === 'ru'
                 ? `Просмотр ${Math.min(watchElapsedSec, watchRequirementSec)} / ${watchRequirementSec} сек`
                 : language === 'kg'
                   ? `Көрүү ${Math.min(watchElapsedSec, watchRequirementSec)} / ${watchRequirementSec} сек`
                   : `Watch ${Math.min(watchElapsedSec, watchRequirementSec)} / ${watchRequirementSec}s`}
             </span>
            </div>

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

          <nav className="lesson-step-nav" aria-label={pick(language, 'Сабактар боюнча навигация', 'Навигация по урокам', 'Lesson navigation')}>
            <button type="button" className="lesson-step prev" disabled={!previousLesson} onClick={() => { if (previousLesson) navigate(lessonPath(previousLesson.id)) }}>
              <ChevronLeft size={20} />
              <span><small>{pick(language, 'Мурунку сабак', 'Предыдущий урок', 'Previous lesson')}</small><strong>{previousLesson ? previousLesson.title[language] : '—'}</strong></span>
            </button>
            <button type="button" className="lesson-step next" disabled={!nextLesson || !isCompleted} onClick={() => { if (nextLesson && isCompleted) navigate(lessonPath(nextLesson.id)) }}>
              <span><small>{pick(language, 'Кийинки сабак', 'Следующий урок', 'Next lesson')}</small><strong>{nextLesson ? nextLesson.title[language] : '—'}</strong></span>
              {nextLesson && !isCompleted ? <Lock size={18} /> : <ChevronRight size={20} />}
            </button>
          </nav>

          <LessonMaterials key={lesson.id} t={t} lesson={lesson} />
        </div>

        <aside className="lesson-sidebar">
          <div className="detail-card sidebar-box">
            <div className="sidebar-box-header">
             <h3>{language === 'ru' ? 'Содержание курса' : language === 'kg' ? 'Курс мазмуну' : 'Course content'}</h3>
             <span>{course.lessons.length} {language === 'ru' ? 'уроков' : language === 'kg' ? 'сабак' : 'lessons'}</span>
            </div>

            <div className="nav-buttons">
             {previousLesson && (
               <button type="button" className="btn btn-secondary small" onClick={() => navigate(lessonPath(previousLesson.id))}>
                 {t.sections.previous}
               </button>
             )}

             {nextLesson ? (
               <>
                 <button
                   type="button"
                   className="btn btn-primary small"
                   onClick={() => {
                     if (!completedLessons.includes(lesson.id)) {
                       return
                     }
                     navigate(lessonPath(nextLesson.id))
                   }}
                   disabled={!completedLessons.includes(lesson.id)}
                 >
                   {t.buttons.nextLesson}
                 </button>
                 {!completedLessons.includes(lesson.id) && (
                   <p className="lesson-nav-note">
                     {language === 'ru'
                       ? 'Досмотрите видео, чтобы разблокировать следующий урок.'
                       : language === 'kg'
                         ? 'Кийинки сабакты ачуу үчүн видеону аягына чейин көрүңүз.'
                         : 'Finish the video to unlock the next lesson.'}
                   </p>
                 )}
               </>
             ) : (
               <button type="button" className="btn btn-primary small" onClick={() => navigate('/dashboard')}>{t.sections.done}</button>
             )}
            </div>
          </div>

          <div className="detail-card sidebar-box lesson-content-box">
            <div className="sidebar-box-header compact-header">
             <h3>{t.generic.lessons}</h3>
            </div>
            <div className="sidebar-list">
             {course.lessons.map((item, index) => {
               const isCurrent = item.id === lesson.id
               const isDone = completedLessons.includes(item.id)
               const isLocked = index > 0 && !completedLessons.includes(course.lessons[index - 1]?.id ?? '')

               return (
                 <button
                   type="button"
                   key={item.id}
                   className={[
                     'sidebar-item',
                     isCurrent ? 'active' : '',
                     isDone ? 'done' : '',
                     isLocked ? 'locked' : ''
                   ].filter(Boolean).join(' ')}
                   onClick={() => {
                     if (!isLoggedIn && index >= GUEST_LESSON_LIMIT) {
                       navigate(`/auth?mode=login&next=${encodeURIComponent(currentLessonPath)}`)
                       return
                     }
                     if (index >= lessonLimit || item.locked) {
                       navigate('/pricing')
                       return
                     }
                     const previousLessonId = course.lessons[index - 1]?.id
                     if (index > 0 && previousLessonId && !completedLessons.includes(previousLessonId)) {
                       return
                     }
                     navigate(lessonPath(item.id))
                   }}
                   disabled={index > 0 && !completedLessons.includes(course.lessons[index - 1]?.id ?? '')}
                 >
                   <span className="sidebar-index">{index + 1}</span>
                   <div className="sidebar-item-copy">
                     <strong>{item.title[language]}</strong>
                     <small>{item.duration}</small>
                   </div>
                   <span className="sidebar-state">
                     {isLocked ? <Lock size={14} /> : isDone ? <Check size={14} /> : isCurrent ? <span className="live-dot" /> : null}
                   </span>
                 </button>
               )
             })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function AuthPage({ t, user, isLoggedIn, setIsLoggedIn, setUser, setAuthToken, onUserRegistered }: { t: (typeof translations)[Lang]; user: UserProfile | null; isLoggedIn: boolean; setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>; setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>; setAuthToken: React.Dispatch<React.SetStateAction<string>>; onUserRegistered?: () => Promise<void> | void }) {
  const language = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const requestedNext = resolveSafeNextPath(searchParams.get('next'), '')
  const requestedMode = searchParams.get('mode')
  const requestedEmail = String(searchParams.get('email') ?? '').trim().toLowerCase()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; confirm?: string }>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const authBackFallback = requestedNext || (location.pathname.startsWith('/dashboard') ? '/dashboard' : '/home')

  useEffect(() => {
    if (requestedMode !== 'login' && requestedMode !== 'register') return
    setMode(requestedMode)
  }, [requestedMode])

  useEffect(() => {
    if (!requestedEmail) return
    setForm((current) => ({ ...current, email: requestedEmail }))
  }, [requestedEmail])

  useEffect(() => {
    if (!isLoggedIn) return
    if (requestedNext) {
      navigate(requestedNext, { replace: true })
      return
    }
    const targetPath = user && isAdminRole(user.role) ? '/admin' : '/dashboard'
    navigate(targetPath, { replace: true })
  }, [isLoggedIn, navigate, requestedNext, user])

  // Sends a real reset link (the server answers identically whether or not the
  // account exists, so this does not reveal which emails are registered).
  const handleForgotPassword = async () => {
    const email = form.email.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: language === 'ru' ? 'Введите email, чтобы восстановить пароль' : language === 'kg' ? 'Сырсөздү калыбына келтирүү үчүн email жазыңыз' : 'Enter your email to reset the password' })
      return
    }

    setIsSubmitting(true)
    setNotice(null)
    try {
      await fetchJson<{ ok: true }>(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      setNotice(t.messages.resetLinkSent)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.generic.error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setNotice(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors: { name?: string; email?: string; password?: string; confirm?: string } = {}

    if (mode === 'register') {
      if (!form.name.trim()) nextErrors.name = pick(language, 'Атыңызды жазыңыз', 'Введите имя', 'Enter your name')
      if (!form.email.trim()) nextErrors.email = pick(language, 'Email жазыңыз', 'Введите email', 'Enter your email')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = pick(language, 'Туура email жазыңыз', 'Введите корректный email', 'Enter a valid email')
      if (!form.password) nextErrors.password = pick(language, 'Сырсөздү жазыңыз', 'Введите пароль', 'Enter your password')
      else if (form.password.length < 8) nextErrors.password = pick(language, 'Минимум 8 белги', 'Минимум 8 символов', 'At least 8 characters')
      if (!form.confirm) nextErrors.confirm = pick(language, 'Сырсөздү ырастаңыз', 'Подтвердите пароль', 'Confirm your password')
      else if (form.confirm !== form.password) nextErrors.confirm = pick(language, 'Сырсөздөр дал келбейт', 'Пароли не совпадают', 'Passwords do not match')
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors)
        return
      }
    } else {
      if (!form.email.trim()) nextErrors.email = pick(language, 'Email жазыңыз', 'Введите email', 'Enter your email')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = pick(language, 'Туура email жазыңыз', 'Введите корректный email', 'Enter a valid email')
      if (!form.password) nextErrors.password = pick(language, 'Сырсөздү жазыңыз', 'Введите пароль', 'Enter your password')
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
        setStoredLastAuthEmail(nextUser.email)
        setIsLoggedIn(true)
        setStoredValue('levelup-users', [...getStoredValue<UserProfile[]>('levelup-users', []), nextUser])
        void onUserRegistered?.()
        navigate(requestedNext || '/dashboard', { replace: true })
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
      setUserSubscription(nextUser.email, getDefaultSubscription('free'))
      setUser(nextUser)
      setStoredLastAuthEmail(nextUser.email)
      setIsLoggedIn(true)
      navigate(requestedNext || (nextUser.role === 'Admin' ? '/admin' : '/dashboard'), { replace: true })
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : pick(language, 'Кирүүдө ката кетти', 'Ошибка входа', 'Sign-in error')
      const message = isNetworkError(error)
        ? pick(language, 'Сервер азыр жооп бербей жатат (ойгонуп же жаңыланып жатышы мүмкүн). Бир мүнөттөн кийин кайра аракет кылыңыз.', 'Сервер сейчас не отвечает (возможно, он запускается или обновляется). Подождите минуту и попробуйте снова.', 'The server is not responding right now (it may be starting up or updating). Please wait a minute and try again.')
        : rawMessage
      if (mode === 'register' && /already exists/i.test(rawMessage)) {
        setMode('login')
        setNotice(pick(language, 'Мындай аккаунт бар. Кириңиз.', 'Аккаунт уже существует. Войдите в систему.', 'This account already exists. Please log in.'))
      }
      setErrors({ email: message, password: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="page-top-actions auth-top-actions">
        <SmartBackButton fallback={authBackFallback} label={language === 'ru' ? 'Назад' : language === 'kg' ? 'Кайтуу' : 'Back'} />
      </div>
      <div className="auth-card">
        <div className="auth-visual">
          <img src={siteLogo} alt="LEVEL UP" className="auth-logo" />
          <h2>{mode === 'login' ? t.auth.welcomeBack : pick(language, 'LevelUp\'ка кошулуңуз', 'Присоединяйтесь к LevelUp', 'Join LevelUp')}</h2>
          <p>{t.home.subtitle}</p>
          <ul className="auth-benefits">
            <li><CheckCircle2 size={18} /> {pick(language, 'Видео сабактар жана тапшырмалар', 'Видеоуроки и практические задания', 'Video lessons and practice tasks')}</li>
            <li><TrendingUp size={18} /> {pick(language, 'Прогрессти көзөмөлдөө жана рейтинг', 'Прогресс обучения и рейтинг', 'Progress tracking and leaderboard')}</li>
            <li><Bot size={18} /> {pick(language, 'AI жардамчы (AI Pro)', 'AI-ассистент (AI Pro)', 'AI assistant (AI Pro)')}</li>
          </ul>
          <HeroIllustration />
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
            <input type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} placeholder="name@example.com" autoComplete="email" aria-invalid={!!errors.email} />
            {errors.email && <small className="field-error">{errors.email}</small>}
          </label>

          <label>
            <span>{t.auth.password}</span>
            <PasswordInput value={form.password} onChange={(value) => updateForm('password', value)} placeholder="••••••••" showLabel={t.auth.show} hideLabel={t.auth.hide} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {mode === 'register' && !errors.password && <small className="field-hint-inline">{pick(language, 'Минимум 8 белги', 'Минимум 8 символов', 'At least 8 characters')}</small>}
            {errors.password && <small className="field-error">{errors.password}</small>}
          </label>

          {mode === 'register' && (
            <label>
              <span>{t.auth.confirm}</span>
              <PasswordInput value={form.confirm} onChange={(value) => updateForm('confirm', value)} placeholder="••••••••" showLabel={t.auth.show} hideLabel={t.auth.hide} autoComplete="new-password" />
              {errors.confirm && <small className="field-error">{errors.confirm}</small>}
            </label>
          )}

          {mode === 'login' && (
            <div className="options-row">
              <button type="button" className="text-button" onClick={() => { void handleForgotPassword() }} disabled={isSubmitting}>{t.auth.forget}</button>
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

function DashboardPage({ t, user, completedLessons, subscription, onUpdateProfile: _onUpdateProfile, onChangePassword: _onChangePassword, reviews: _reviews, language, setLanguage, theme, setTheme, onLogout }: { t: (typeof translations)[Lang]; user: UserProfile | null; completedLessons: string[]; subscription?: UserSubscription; onUpdateProfile?: (profile: Partial<UserProfile>) => Promise<{ ok: boolean; message: string }>; onChangePassword?: (currentPassword: string, nextPassword: string, confirmPassword: string) => Promise<{ ok: boolean; message: string }>; reviews: Review[]; language: Lang; setLanguage: React.Dispatch<React.SetStateAction<Lang>>; theme: Theme; setTheme: React.Dispatch<React.SetStateAction<Theme>>; onLogout: () => void }) {
  const { courses } = useCourseCatalog()
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
  const doneIds = user ? userProgress.lessonsCompleted : completedLessons
  // Real data: the most recently completed lessons; before any progress, the first lesson to start.
  const lessonLookup = courses.flatMap((course) => course.lessons.map((lesson, index) => ({ course, lesson, index })))
  const completedEntries = doneIds.map((id) => lessonLookup.find((entry) => entry.lesson.id === id)).filter((entry): entry is (typeof lessonLookup)[number] => Boolean(entry))
  const recentLessons = (completedEntries.length ? completedEntries.slice(-3).reverse() : courses.slice(0, 3).map((course) => ({ course, lesson: course.lessons[0], index: 0 })))
    .filter((entry) => entry.lesson)
    .map(({ course, lesson, index }) => ({ course, lesson, index, done: doneIds.includes(lesson.id) }))
  const finishedCourses = progress.filter((item) => item.progress === 100).length
  const achievements = [
    { icon: Rocket, unlocked: completedCount >= 1, title: pick(language, 'Биринчи кадам', 'Первый шаг', 'First step'), text: pick(language, '1 сабак бүттү', 'Завершён 1 урок', '1 lesson completed') },
    { icon: Flame, unlocked: completedCount >= 10, title: pick(language, 'Ритмде', 'В ритме', 'On a roll'), text: pick(language, '10 сабак бүттү', 'Завершено 10 уроков', '10 lessons completed') },
    { icon: Award, unlocked: finishedCourses >= 1, title: pick(language, 'Курс бүттү', 'Курс пройден', 'Course finished'), text: pick(language, 'Толук курсту бүтүрүү', 'Пройти курс полностью', 'Finish a full course') },
    { icon: Zap, unlocked: isAiUnlocked, title: 'AI Pro', text: pick(language, 'AI жардамчы активдүү', 'AI-ассистент подключён', 'AI assistant active') }
  ]
  const quickActions = [
    { icon: BookOpen, label: pick(language, 'Курстар', 'Каталог курсов', 'Course catalog'), to: '/dashboard/courses' },
    { icon: GraduationCap, label: pick(language, 'Менин сабактарым', 'Мои уроки', 'My lessons'), to: '/dashboard/my-lessons' },
    { icon: Trophy, label: t.nav.rating, to: '/dashboard/rating' },
    { icon: MessageSquareText, label: pick(language, 'Пикир калтыруу', 'Оставить отзыв', 'Leave a review'), to: '/dashboard/reviews' }
  ]

  const navItems = [
    { label: pick(language, 'Башкы бет', 'Главная', 'Home'), icon: LayoutDashboard, to: '/dashboard', kind: 'route' },
    { label: pick(language, 'Курстар', 'Курсы', 'Courses'), icon: BookOpen, to: '/dashboard/courses', kind: 'route' },
    { label: pick(language, 'Менин сабактарым', 'Мои уроки', 'My lessons'), icon: GraduationCap, to: '/dashboard/my-lessons', kind: 'route' },
    { label: pick(language, 'Менин рейтингим', 'Мой рейтинг', 'My rating'), icon: TrendingUp, to: '/dashboard/rating', kind: 'route' },
    { label: pick(language, 'Пикирлер', 'Отзывы', 'Reviews'), icon: MessageSquareText, to: '/dashboard/reviews', kind: 'route' },
    { label: pick(language, 'Тарифтер', 'Тарифы', 'Pricing'), icon: WalletCards, to: '/dashboard/pricing', kind: 'route' },
    { label: 'AI Assistant', icon: Brain, to: '/dashboard/ai', kind: 'action' },
    { label: 'FAQ', icon: HelpCircle, to: '/dashboard/faq', kind: 'route' },
    { label: pick(language, 'Профиль жөндөөлөрү', 'Настройки профиля', 'Profile settings'), icon: Settings, to: '/dashboard/profile', kind: 'route' },
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
            <Link to="/home" className="dashboard-home-link">
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
              <p>{language === 'ru' ? 'Продолжайте учиться, отслеживайте прогресс и используйте AI-поддержку в одном месте.' : language === 'kg' ? 'Окууну улантыңыз, прогрессиңизди көзөмөлдөңүз жана AI жардамчыны бир жерден колдонуңуз.' : 'Keep learning, track your progress, and use AI support from one place.'}</p>
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
            <StatTile icon={BookOpen} value={courses.length} label={t.dashboard.courses} />
            <StatTile icon={TrendingUp} value={completedCount} label={t.dashboard.completed} tone="blue" />
            <StatTile icon={Target} value={`${overallProgress}%`} label={t.dashboard.progress} tone="violet" />
            <StatTile icon={Crown} value={userProgress.totalScore} label={t.dashboard.rating} tone="gold" />
          </section>

          <section className="quick-actions" aria-label={pick(language, 'Тез аракеттер', 'Быстрые действия', 'Quick actions')}>
            {quickActions.map(({ icon: Icon, label, to }) => (
              <Link key={to} to={to} className="quick-action"><span><Icon size={20} /></span><strong>{label}</strong><ChevronRight size={18} /></Link>
            ))}
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
                    <div className="course-pill" style={{ background: course.color, color: course.accent }}>{course.badge}</div>
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
                {recentLessons.map(({ course, lesson, index, done }) => (
                  <Link key={lesson.id} to={`/courses/${course.id}/lessons/${lesson.id}`} className="recent-lesson-item">
                    <div className="mini-avatar" style={{ background: course.accent }}><CourseDirectionIcon courseId={course.id} size={18} /></div>
                    <div>
                      <strong>{lesson.title[language]}</strong>
                      <small>{course.title[language]} · {pick(language, 'Сабак', 'Урок', 'Lesson')} {index + 1}</small>
                    </div>
                    {done ? <CheckCircle2 size={18} className="recent-lesson-done" /> : <PlayCircle size={18} />}
                  </Link>
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

          <section className="detail-card achievements-card">
            <div className="card-header-row">
              <h3><Award size={20} /> {pick(language, 'Жетишкендиктер', 'Достижения', 'Achievements')}</h3>
              <span className="achievements-count">{achievements.filter((item) => item.unlocked).length}/{achievements.length}</span>
            </div>
            <div className="achievements-grid">
              {achievements.map(({ icon: Icon, unlocked, title, text }) => (
                <div key={title} className={unlocked ? 'achievement unlocked' : 'achievement'}>
                  <span className="achievement-icon">{unlocked ? <Icon size={22} /> : <Lock size={18} />}</span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>
              ))}
            </div>
          </section>

          <SubscriptionPanel />
        </main>
      </div>

      <Modal
        open={aiGateOpen}
        onClose={() => setAiGateOpen(false)}
        icon={Bot}
        title="AI Assistant"
        actions={(
          <>
            <Button variant="secondary" size="sm" onClick={() => setAiGateOpen(false)}>{pick(language, 'Кийинчерээк', 'Позже', 'Later')}</Button>
            <ButtonLink size="sm" to="/dashboard/pricing" onClick={() => setAiGateOpen(false)}>{t.ai.connectPlan}</ButtonLink>
          </>
        )}
      >
        <p>{t.ai.blocked}</p>
      </Modal>
    </div>
  )
}

function DashboardAiPage({ language, subscription, userEmail }: { language: Lang; subscription?: UserSubscription; userEmail?: string }) {
  return (
    <div className="container section page-block">
      <div className="page-top-actions">
        <SmartBackButton fallback="/dashboard" label={language === 'ru' ? 'Назад в Dashboard' : language === 'kg' ? "Dashboard'ка кайтуу" : 'Back to Dashboard'} />
      </div>
      <AIChatPanel language={language} subscription={subscription} userEmail={userEmail} pricingPath="/dashboard/pricing" />
    </div>
  )
}

function DashboardLessonsPage({ completedLessons, language }: { completedLessons: string[]; language: Lang }) {
  const { courses } = useCourseCatalog()
  const progressEntries = courses.map((course) => {
    const doneCount = course.lessons.filter((lesson) => completedLessons.includes(lesson.id)).length
    const percent = Math.round((doneCount / course.lessons.length) * 100)
    return { course, doneCount, percent }
  })

  return (
    <div className="container section page-block">
      <PageHero
        back={<SmartBackButton fallback="/dashboard" label={pick(language, "Dashboard'ка кайтуу", 'Назад в Dashboard', 'Back to Dashboard')} />}
        eyebrow={pick(language, 'Окуу', 'Обучение', 'Learning')}
        title={pick(language, 'Менин сабактарым', 'Мои уроки', 'My lessons')}
        subtitle={pick(language, 'Ар бир курс боюнча прогрессиңиз.', 'Ваш прогресс по каждому курсу.', 'Your progress in every course.')}
      />

      <div className="course-grid my-lessons-grid">
        {progressEntries.map(({ course, doneCount, percent }) => (
          <Card as="article" key={course.id} className="my-course-card">
            <div className="my-course-head">
              <span className="home-course-thumb-icon" style={{ background: course.accent }}><CourseDirectionIcon courseId={course.id} size={24} /></span>
              <div>
                <h3>{course.title[language]}</h3>
                <small>{doneCount}/{course.lessons.length} {pick(language, 'сабак', 'уроков', 'lessons')}</small>
              </div>
              {percent === 100 && <Badge tone="green" icon={CheckCircle2}>{pick(language, 'Бүттү', 'Пройден', 'Done')}</Badge>}
            </div>
            <ProgressBar value={percent} showValue label={pick(language, 'Прогресс', 'Прогресс', 'Progress')} />
            <Link to={`/courses/${course.id}`} className={doneCount > 0 ? 'btn btn-primary full-width' : 'btn btn-secondary full-width'}>{doneCount > 0 ? pick(language, 'Улантуу', 'Продолжить', 'Continue') : pick(language, 'Баштоо', 'Начать', 'Start')} <ArrowRight size={16} /></Link>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ProfilePage({ t, user, completedLessons: _completedLessons, subscription, onUpdateProfile, onChangePassword, onUpdateNotifications, notifications, reviews: _reviews, language, setLanguage, theme, setTheme, onLogout }: { t: (typeof translations)[Lang]; user: UserProfile | null; completedLessons: string[]; subscription?: UserSubscription; onUpdateProfile?: (profile: Partial<UserProfile>) => Promise<{ ok: boolean; message: string }>; onChangePassword?: (currentPassword: string, nextPassword: string, confirmPassword: string) => Promise<{ ok: boolean; message: string }>; onUpdateNotifications?: (settings: NotificationSettings) => { ok: boolean; message: string }; notifications: NotificationSettings; reviews: Review[]; language: Lang; setLanguage: React.Dispatch<React.SetStateAction<Lang>>; theme: Theme; setTheme: React.Dispatch<React.SetStateAction<Theme>>; onLogout: () => void }) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'preferences'>('profile')
  const [profileNotice, setProfileNotice] = useState<string | null>(null)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const [notificationNotice, setNotificationNotice] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(notifications)
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null)
  const [avatarCrop, setAvatarCrop] = useState({ scale: 1.18, x: 0, y: 0 })
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
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
    { label: pick(language, 'Башкы бет', 'Главная', 'Home'), icon: Home, to: '/dashboard' },
    { label: pick(language, 'Курстар', 'Курсы', 'Courses'), icon: BookOpen, to: '/dashboard/courses' },
    { label: pick(language, 'Менин сабактарым', 'Мои уроки', 'My lessons'), icon: GraduationCap, to: '/dashboard/my-lessons' },
    { label: pick(language, 'Менин рейтингим', 'Мой рейтинг', 'My rating'), icon: TrendingUp, to: '/dashboard/rating' },
    { label: pick(language, 'Пикирлер', 'Отзывы', 'Reviews'), icon: MessageSquareText, to: '/dashboard/reviews' },
    { label: pick(language, 'Тарифтер', 'Тарифы', 'Pricing'), icon: WalletCards, to: '/dashboard/pricing' },
    { label: 'AI Assistant', icon: Brain, to: '/dashboard/ai', action: 'ai' },
    { label: 'FAQ', icon: HelpCircle, to: '/dashboard/faq' },
    { label: pick(language, 'Профиль жөндөөлөрү', 'Настройки профиля', 'Profile settings'), icon: Settings, to: '/dashboard/profile' },
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

      const result = await onUpdateProfile?.({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        phone: profileForm.phone,
        bio: profileForm.bio,
        profileImage: nextImage,
        name: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
        avatar: nextImage
      })

      if (result?.ok) {
        setProfileForm((current) => ({ ...current, avatar: nextImage }))
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

  const handleDeleteAvatar = async () => {
    if (!user || !window.confirm(t.profilePhoto.confirmDelete)) return

    const result = await onUpdateProfile?.({
      firstName: profileForm.firstName,
      lastName: profileForm.lastName,
      phone: profileForm.phone,
      bio: profileForm.bio,
      profileImage: '',
      name: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
      avatar: ''
    })

    if (result?.ok) setProfileForm((current) => ({ ...current, avatar: '' }))
    setProfileNotice(result?.ok ? t.profilePhoto.deleted : result?.message ?? t.generic.error)
    setAvatarDraft(null)
  }

  const tabs = [
    { id: 'profile', label: language === 'ru' ? 'Личная информация' : language === 'kg' ? 'Жеке маалымат' : 'Personal details' },
    { id: 'security', label: language === 'ru' ? 'Безопасность' : language === 'kg' ? 'Коопсуздук' : 'Security' },
    { id: 'notifications', label: language === 'ru' ? 'Уведомления' : language === 'kg' ? 'Эскертүүлөр' : 'Notifications' },
    { id: 'preferences', label: pick(language, 'Интерфейс', 'Интерфейс', 'Interface') }
  ] as const

  return (
    <div className="dashboard-shell">
      <div className="page-top-actions dashboard-inner-back">
        <SmartBackButton fallback="/dashboard" label={language === 'ru' ? 'Назад в Dashboard' : language === 'kg' ? "Dashboard'ка кайтуу" : 'Back to Dashboard'} />
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
            <Link to="/home" className="dashboard-home-link">
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
                  <form className="settings-form" onSubmit={async (event) => {
                    event.preventDefault()
                    if (isSavingProfile) return
                    setIsSavingProfile(true)
                    setProfileNotice(null)
                    const result = await onUpdateProfile?.({
                      firstName: profileForm.firstName,
                      lastName: profileForm.lastName,
                      phone: profileForm.phone,
                      bio: profileForm.bio,
                      profileImage: profileForm.avatar,
                      name: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
                    })
                    setIsSavingProfile(false)
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
                          {profileForm.avatar && <button type="button" className="btn btn-danger small" onClick={() => { void handleDeleteAvatar() }}>{t.profilePhoto.remove}</button>}
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
                    <label><span>{language === 'ru' ? 'Информация о пользователе' : language === 'kg' ? 'Өзүңүз жөнүндө' : 'About you'}</span><textarea rows={5} value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} placeholder={language === 'ru' ? 'Расскажите немного о себе...' : language === 'kg' ? 'Өзүңүз жөнүндө кыскача айтып бериңиз...' : 'Tell us a bit about yourself...'} /></label>
                    <button type="submit" className="btn btn-primary small full-width" disabled={isSavingProfile}>{isSavingProfile ? t.generic.loading : language === 'ru' ? 'Сохранить данные' : language === 'kg' ? 'Маалыматты сактоо' : 'Save information'}</button>
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
                            <button type="button" onClick={() => setAvatarCrop((current) => ({ ...current, x: current.x - 12 }))} aria-label="Move left">◀</button>
                            <button type="button" onClick={() => setAvatarCrop((current) => ({ ...current, y: current.y - 12 }))} aria-label="Move up">▲</button>
                            <button type="button" onClick={() => setAvatarCrop((current) => ({ ...current, y: current.y + 12 }))} aria-label="Move down">▼</button>
                            <button type="button" onClick={() => setAvatarCrop((current) => ({ ...current, x: current.x + 12 }))} aria-label="Move right">▶</button>
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
                  <form className="settings-form" onSubmit={async (event) => {
                    event.preventDefault()
                    if (isChangingPassword) return
                    setIsChangingPassword(true)
                    setPasswordNotice(null)
                    const result = await onChangePassword?.(currentPassword, newPassword, confirmPassword)
                    setIsChangingPassword(false)
                    setPasswordNotice(result?.message ?? null)
                    if (result?.ok) {
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }
                  }}>
                    <label>
                      <span>{language === 'ru' ? 'Текущий пароль' : language === 'kg' ? 'Учурдагы сырсөз' : 'Current password'}</span>
                      <PasswordInput compact value={currentPassword} onChange={setCurrentPassword} showLabel={t.auth.show} hideLabel={t.auth.hide} autoComplete="current-password" />
                    </label>
                    <label>
                      <span>{language === 'ru' ? 'Новый пароль' : language === 'kg' ? 'Жаңы сырсөз' : 'New password'}</span>
                      <PasswordInput compact value={newPassword} onChange={setNewPassword} showLabel={t.auth.show} hideLabel={t.auth.hide} autoComplete="new-password" />
                    </label>
                    <label>
                      <span>{language === 'ru' ? 'Подтвердите новый пароль' : language === 'kg' ? 'Жаңы сырсөздү ырастаңыз' : 'Confirm new password'}</span>
                      <PasswordInput compact value={confirmPassword} onChange={setConfirmPassword} showLabel={t.auth.show} hideLabel={t.auth.hide} autoComplete="new-password" />
                    </label>
                    <div className="field-hint">
                      <span>{language === 'ru' ? 'Минимум 8 символов' : language === 'kg' ? 'Минимум 8 белги' : 'Minimum 8 characters'}</span>
                    </div>
                    <button type="submit" className="btn btn-primary small full-width" disabled={isChangingPassword}>{isChangingPassword ? t.generic.loading : language === 'ru' ? 'Изменить пароль' : language === 'kg' ? 'Сырсөздү өзгөртүү' : 'Change password'}</button>
                    {passwordNotice && <small className="field-note">{passwordNotice}</small>}
                  </form>
                </div>
                <div className="profile-info-block">
                  <h3>{language === 'ru' ? 'Советы по безопасности' : language === 'kg' ? 'Коопсуздуктун кеңештери' : 'Security tips'}</h3>
                  <ul className="check-list compact-list">
                    <li><Check size={14} /> {language === 'ru' ? 'Используйте уникальный пароль для LEVEL UP' : language === 'kg' ? 'LEVEL UP үчүн өзүнчө сырсөз колдонуңуз' : 'Use a unique password for LEVEL UP'}</li>
                    <li><Check size={14} /> {language === 'ru' ? 'Не делитесь данными входа' : language === 'kg' ? 'Кирүү маалыматын бөлүшпеңиз' : 'Do not share your login details'}</li>
                    <li><Check size={14} /> {language === 'ru' ? 'Обновляйте пароль при необходимости' : language === 'kg' ? 'Сырсөздү мезгил-мезгили менен жаңыртып туруңуз' : 'Update your password regularly'}</li>
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
                          <small>{language === 'ru' ? 'Получать новости и важные уведомления на почту' : language === 'kg' ? 'Жаңылыктарды жана маанилүү билдирүүлөрдү электрондук почтага алуу' : 'Receive updates and important notifications by email'}</small>
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
                          <small>{language === 'ru' ? 'Напоминания о новых доступных уроках' : language === 'kg' ? 'Жаңы сабактар чыкканда эскертме алуу' : 'Receive updates when new lessons are available'}</small>
                        </div>
                        <button type="button" className={notifSettings.newLessons ? 'toggle active' : 'toggle'} onClick={() => setNotifSettings((current) => ({ ...current, newLessons: !current.newLessons }))} aria-label="Toggle new lessons notifications">
                          <span />
                        </button>
                      </div>

                      <div className="toggle-row">
                        <div>
                          <strong>{language === 'ru' ? 'Новости и обновления LevelUp' : language === 'kg' ? 'LevelUp жаңылыктары жана жаңартуулары' : 'LevelUp news and updates'}</strong>
                          <small>{language === 'ru' ? 'Будьте в курсе новостей платформы' : language === 'kg' ? 'Платформанын жаңылыктарынан кабардар болуңуз' : 'Stay informed about product updates and news'}</small>
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
                  <h3>{language === 'ru' ? 'План уведомлений' : language === 'kg' ? 'Эскертүүлөр планы' : 'Notification plan'}</h3>
                  <ul className="check-list compact-list">
                    <li><Check size={14} /> {language === 'ru' ? 'Срочные обновления' : language === 'kg' ? 'Маанилүү жаңыртуулар' : 'Important updates'}</li>
                    <li><Check size={14} /> {language === 'ru' ? 'Новые уроки и курсы' : language === 'kg' ? 'Жаңы сабактар жана курстар' : 'New lessons and courses'}</li>
                    <li><Check size={14} /> {language === 'ru' ? 'Персональные рекомендации' : language === 'kg' ? 'Жеке сунуштар' : 'Personalized suggestions'}</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="profile-grid settings-main-grid">
                <div className="profile-info-block">
                  <h3><Languages size={20} /> {pick(language, 'Интерфейстин тили', 'Язык интерфейса', 'Interface language')}</h3>
                  <div className="choice-group" role="radiogroup" aria-label={pick(language, 'Интерфейстин тили', 'Язык интерфейса', 'Interface language')}>
                    {([['kg', 'Кыргызча'], ['ru', 'Русский'], ['en', 'English']] as const).map(([code, name]) => (
                      <button key={code} type="button" role="radio" aria-checked={language === code} className={language === code ? 'choice-option active' : 'choice-option'} onClick={() => setLanguage(code)}>
                        <strong>{code.toUpperCase()}</strong><span>{name}</span>{language === code && <CheckCircle2 size={18} />}
                      </button>
                    ))}
                  </div>
                  <h3>{theme === 'light' ? <Sun size={20} /> : <Moon size={20} />} {pick(language, 'Тема', 'Тема оформления', 'Theme')}</h3>
                  <div className="choice-group two" role="radiogroup" aria-label={pick(language, 'Тема', 'Тема оформления', 'Theme')}>
                    {(['light', 'dark'] as const).map((mode) => (
                      <button key={mode} type="button" role="radio" aria-checked={theme === mode} className={theme === mode ? 'choice-option active' : 'choice-option'} onClick={() => setTheme(mode)}>
                        {mode === 'light' ? <Sun size={18} /> : <Moon size={18} />}
                        <span>{mode === 'light' ? pick(language, 'Күндүзгү', 'Дневной', 'Day') : pick(language, 'Түнкү', 'Ночной', 'Night')}</span>
                        {theme === mode && <CheckCircle2 size={18} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="profile-info-block">
                  <h3><ShieldCheck size={20} /> {pick(language, 'Аккаунт', 'Настройки аккаунта', 'Account settings')}</h3>
                  <div className="profile-meta-card"><span>{t.auth.email}</span><strong>{user?.email ?? '—'}</strong></div>
                  <div className="profile-meta-card"><span>{pick(language, 'Ролу', 'Роль', 'Role')}</span><strong>{user?.role ?? 'Student'}</strong></div>
                  <div className="profile-meta-card"><span>{pick(language, 'Катталуу күнү', 'Дата регистрации', 'Joined')}</span><strong>{joinedAt}</strong></div>
                  <Button variant="secondary" block icon={ShieldCheck} onClick={() => setActiveTab('security')}>{pick(language, 'Сырсөздү өзгөртүү', 'Изменить пароль', 'Change password')}</Button>
                  <Button variant="danger" block icon={LogOut} onClick={onLogout}>{t.dashboard.logout}</Button>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

function RatingPage({ t, leaderboard, reviews, currentEmail }: { t: (typeof translations)[Lang]; leaderboard: LeaderboardEntry[]; reviews: Review[]; currentEmail?: string }) {
  const language = useLanguage()
  const location = useLocation()
  const average = reviews.length ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1) : '0.0'
  const [limit, setLimit] = useState<3 | 5 | 10>(10)
  const visibleRows = leaderboard.slice(0, limit)
  const podium = leaderboard.slice(0, 3)
  const myIndex = currentEmail ? leaderboard.findIndex((entry) => entry.email === currentEmail) : -1
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/home'

  return (
    <div className="container section page-block rating-page">
      <PageHero
        back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />}
        eyebrow={pick(language, 'Лидерлер', 'Таблица лидеров', 'Leaderboard')}
        title={t.nav.rating}
        subtitle={pick(language, 'Сабактарды бүтүрүп, упай топтоп, лидерлердин катарына кириңиз.', 'Проходите уроки, набирайте баллы и попадайте в число лидеров.', 'Complete lessons, earn points and climb the leaderboard.')}
        aside={(
          <div className="rating-hero-stats">
            <div><span>{t.ratingsAvg}</span><strong>{average}</strong><StarRating value={Number(average)} size={16} /></div>
            <div><span>{pick(language, 'Катышуучулар', 'Участников', 'Participants')}</span><strong>{leaderboard.length}</strong></div>
            {myIndex >= 0 && <div className="mine"><span>{pick(language, 'Сиздин орун', 'Ваше место', 'Your place')}</span><strong>#{myIndex + 1}</strong></div>}
          </div>
        )}
      />

      {leaderboard.length === 0 ? (
        <EmptyState icon={Trophy}>{t.messages.emptyLeaderboard}</EmptyState>
      ) : (
        <>
          <div className="podium" aria-label="Top 3">
            {podium.map((person, index) => (
              <div key={person.id} className={['podium-place', `place-${index + 1}`, person.email === currentEmail ? 'is-me' : ''].filter(Boolean).join(' ')}>
                <span className="podium-medal">{index === 0 ? <Crown size={18} /> : <Award size={18} />} {index + 1}</span>
                <div className="avatar">{renderAvatarContent(person.avatar, person.name?.charAt(0)?.toUpperCase() || 'U')}</div>
                <strong>{person.name}</strong>
                <span className="podium-score">{person.score} {pick(language, 'упай', 'баллов', 'pts')}</span>
              </div>
            ))}
          </div>

          <div className="detail-card leaderboard-table-card">
            <div className="card-header-row">
              <h3><Trophy size={20} /> {pick(language, 'Лидерлер таблицасы', 'Таблица лидеров', 'Leaderboard')}</h3>
              <div className="segmented" role="group" aria-label={pick(language, 'Көрсөтүү', 'Показать', 'Show')}>
                {([3, 5, 10] as const).map((value) => (
                  <button key={value} type="button" className={limit === value ? 'active' : ''} aria-pressed={limit === value} onClick={() => setLimit(value)}>Top {value}</button>
                ))}
              </div>
            </div>
            <div className="leaderboard-list">
              {visibleRows.map((person, index) => {
                const isMe = person.email === currentEmail
                return (
                  <div className={isMe ? 'leader-row is-me' : 'leader-row'} key={person.id}>
                    <span className={index < 3 ? 'leader-rank top' : 'leader-rank'}>#{index + 1}</span>
                    <div className="avatar small">{renderAvatarContent(person.avatar, person.name?.charAt(0)?.toUpperCase() || 'U')}</div>
                    <div className="leader-info">
                      <strong>{person.name} {isMe && <Badge tone="green">{pick(language, 'Сиз', 'Вы', 'You')}</Badge>}</strong>
                      <span><GraduationCap size={14} /> {person.courses} {pick(language, 'курс бүттү', 'курсов пройдено', 'courses completed')}{person.achievements.length > 0 ? ` · ${person.achievements.length} ${pick(language, 'жетишкендик', 'достижений', 'achievements')}` : ''}</span>
                    </div>
                    <div className="score-block"><strong>{person.score}</strong><span>{pick(language, 'упай', 'баллов', 'pts')}</span></div>
                  </div>
                )
              })}
            </div>
            {myIndex >= limit && (
              <p className="leader-me-note">{pick(language, 'Сиздин орун', 'Ваше место', 'Your place')}: <strong>#{myIndex + 1}</strong> · {leaderboard[myIndex].score} {pick(language, 'упай', 'баллов', 'pts')}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ReviewsPage({ t, reviews, setReviews, isLoggedIn, user, onRefreshSiteStats }: { t: (typeof translations)[Lang]; reviews: Review[]; setReviews: React.Dispatch<React.SetStateAction<Review[]>>; isLoggedIn: boolean; user: UserProfile | null; onRefreshSiteStats?: () => Promise<void> | void }) {
  const { courses } = useCourseCatalog()
  const reviewLessonOptions = useMemo(() => buildReviewLessonOptions(courses), [courses])
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [lessonId, setLessonId] = useState(reviewLessonOptions[0]?.id ?? '')
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // The server marks the logged-in viewer's own review with `isOwn` (emails are not public).
  const userReview = user ? reviews.find((item) => item.isOwn) : undefined
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

    // The selected id can be stale if the course catalog was refreshed from the server.
    const selectedLesson = reviewLessonOptions.find((item) => item.id === lessonId) ?? reviewLessonOptions[0]
    if (!selectedLesson) return

    setIsSubmitting(true)
    let result: { created?: boolean; updated?: boolean }
    try {
      result = await saveReviewToServer({
        lessonId: selectedLesson.id,
        lessonLabel: selectedLesson.label,
        rating,
        text: text.trim()
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setNotice(message)
      setIsSubmitting(false)
      return
    }

    // Reload from the server (source of truth) so the list, the user's own review
    // and the average rating are always consistent, even across devices.
    try {
      setReviews(await getReviewsFromServer())
    } catch (error) {
      console.error('Failed to refresh reviews after saving:', error)
    }
    void onRefreshSiteStats?.()
    setText('')
    setRating(5)
    setIsSubmitting(false)
    setNotice(result.updated
      ? (language === 'ru' ? 'Отзыв обновлён' : language === 'kg' ? 'Пикир жаңыртылды' : 'Review updated')
      : (language === 'ru' ? 'Отзыв сохранён' : language === 'kg' ? 'Пикир сакталды' : 'Review saved'))
  }

  const language = useLanguage()

  const location = useLocation()
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/home'
  const selectedCourse = courses.find((course) => course.lessons.some((lesson) => lesson.id === lessonId)) ?? courses[0]
  const ratingCounts = [5, 4, 3, 2, 1].map((value) => ({ value, count: reviews.filter((item) => item.rating === value).length }))

  return (
    <div className="container section page-block reviews-page">
      <PageHero
        back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />}
        eyebrow={pick(language, 'Студенттердин пикирлери', 'Отзывы студентов', 'Student reviews')}
        title={t.nav.reviews}
        subtitle={pick(language, 'Окуучулар LevelUp курстары жөнүндө эмне дешет.', 'Что говорят ученики о курсах LevelUp.', 'What learners say about LevelUp courses.')}
        aside={(
          <div className="ui-hero-chips">
            <span><MessageSquareText size={16} /> {reviews.length} {pick(language, 'пикир', 'отзывов', 'reviews')}</span>
          </div>
        )}
      />
      <div className="rating-grid">
        <div className="stat-banner review-banner">
          <p>{t.ratingsAvg}</p>
          <h2>{average}</h2>
          <StarRating value={Number(average)} size={22} />
          <div className="rating-breakdown">
            {ratingCounts.map(({ value, count }) => (
              <div key={value} className="rating-breakdown-row">
                <span>{value} <Star size={12} fill="currentColor" /></span>
                <div className="progress-bar"><span style={{ width: `${reviews.length ? Math.round((count / reviews.length) * 100) : 0}%` }} /></div>
                <small>{count}</small>
              </div>
            ))}
          </div>
        </div>
        <form className="review-form" onSubmit={handleSubmit}>
          <h3>{userReview ? pick(language, 'Пикириңизди өзгөртүү', 'Изменить ваш отзыв', 'Edit your review') : t.sections.leaveReview}</h3>
          {!isLoggedIn && (
            <p className="review-login-note"><Lock size={15} /> {t.messages.loginRequired} <Link to={`/auth?mode=login&next=${encodeURIComponent(location.pathname)}`}>{t.auth.login}</Link></p>
          )}
          <StarRating value={rating} onChange={setRating} size={26} label={pick(language, 'Баа', 'Оценка', 'Rating')} />
          <div className="two-column-fields">
            <label>
              <span>{pick(language, 'Курс', 'Курс', 'Course')}</span>
              <select value={selectedCourse?.id ?? ''} onChange={(event) => {
                const nextCourse = courses.find((course) => course.id === event.target.value)
                if (nextCourse?.lessons[0]) setLessonId(nextCourse.lessons[0].id)
              }}>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title[language]}</option>)}
              </select>
            </label>
            <label>
              <span>{pick(language, 'Сабак', 'Урок', 'Lesson')}</span>
              <select value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
                {(selectedCourse?.lessons ?? []).map((lesson, index) => (
                  <option key={lesson.id} value={lesson.id}>{index + 1}. {lesson.title[language]}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>{pick(language, 'Пикир', 'Ваш отзыв', 'Your review')}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.sections.leaveReview} maxLength={2000} />
          </label>
          <button type="submit" className="btn btn-primary full-width" disabled={isSubmitting}>
            <SendHorizonal size={16} /> {isSubmitting ? t.generic.loading : userReview ? pick(language, 'Пикирди жаңыртуу', 'Обновить отзыв', 'Update review') : t.buttons.send}
          </button>
          <small className="field-hint-inline">{pick(language, 'Пикирлер жарыяланганга чейин модерациядан өтөт.', 'Отзывы проходят модерацию перед публикацией.', 'Reviews are moderated before publishing.')}</small>
          {notice && <small className="field-note">{notice}</small>}
        </form>
      </div>
      {reviews.length === 0 ? (
        <EmptyState icon={MessageSquareText}>{t.messages.emptyReviews}</EmptyState>
      ) : (
        <div className="reviews-grid">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} language={language} onEdit={user && review.isOwn ? () => { setText(review.text); setRating(review.rating); if (review.lessonId) setLessonId(review.lessonId) } : undefined} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Shared review card (home page and reviews page). */
function ReviewCard({ review, language, onEdit }: { review: Review; language: Lang; onEdit?: () => void }) {
  return (
    <article className="review-card">
      <div className="review-head">
        <div className="avatar">{renderAvatarContent(review.avatar, review.name?.charAt(0)?.toUpperCase() || 'U')}</div>
        <div><h4>{review.name}</h4><span>{formatReviewDate(review.date, language)}</span></div>
        {review.isOwn && <Badge tone="green">{pick(language, 'Сиздин', 'Ваш', 'Yours')}</Badge>}
      </div>
      <StarRating value={review.rating} size={16} />
      {review.lessonLabel && <small className="review-lesson"><BookOpen size={13} /> {review.lessonLabel}</small>}
      <p>{review.text}</p>
      {onEdit && <Button variant="secondary" size="sm" onClick={onEdit}>{pick(language, 'Өзгөртүү', 'Редактировать', 'Edit')}</Button>}
    </article>
  )
}

function PricingPage({ t }: { t: (typeof translations)[Lang] }) {
  const language = useLanguage()
  const location = useLocation()
  const { plans, subscription, isLoggedIn } = useBilling()
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/'
  const current = accessPlanOf(subscription)

  return (
    <div className="container section page-block pricing-page">
      <PageHero
        back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />}
        eyebrow={pick(language, 'Тарифтер', 'Тарифы', 'Plans')}
        title={t.pricingTitle}
        subtitle={pick(language, 'Акысыз баштаңыз жана каалаган убакта PRO же AI Pro тарифине өтүңүз.', 'Начните бесплатно и переходите на PRO или AI Pro в любой момент.', 'Start free and upgrade to PRO or AI Pro at any time.')}
      />
      {isLoggedIn && subscription.synced && (
        <div className="current-plan-banner" role="status">
          <BadgeCheck size={20} />
          <span>
            {pick(language, 'Сиздин тариф', 'Ваш тариф', 'Your plan')}: <strong>{PLAN_META[current].name}</strong>
            {current !== 'free' && subscription.endsAt ? <> · {pick(language, 'чейин', 'до', 'until')} {formatDateTime(subscription.endsAt, language)}</> : null}
            {subscription.rawStatus === 'cancelled' ? <> · {subscriptionStatusText(subscription, language)}</> : null}
          </span>
          <Link to="/dashboard" className="text-link">{pick(language, 'Тарифимди көрүү', 'Мой тариф', 'View my plan')}</Link>
        </div>
      )}
      <div className="pricing-grid big-grid">
        {plans.map((plan) => <PricingCard key={plan.id} plan={plan} t={t} language={language} />)}
      </div>
      <PlanComparison plans={plans} />
      <p className="pricing-note"><ShieldCheck size={16} /> {pick(language, 'Төлөм MBank, O!Деньги же Элсом аркылуу. Тариф төлөм ырасталгандан кийин гана активдешет.', 'Оплата через MBank, O!Деньги или Элсом. Тариф активируется только после подтверждения оплаты.', 'Pay with MBank, O!Dengi or Elsom. A plan is activated only after the payment is confirmed.')}</p>
    </div>
  )
}

/** Side-by-side view of what each plan actually unlocks (the same rules the backend enforces). */
function PlanComparison({ plans }: { plans: PlanView[] }) {
  const language = useLanguage()
  const yes = <CheckCircle2 size={18} className="cmp-yes" aria-label={pick(language, 'Бар', 'Есть', 'Included')} />
  const no = <X size={18} className="cmp-no" aria-label={pick(language, 'Жок', 'Нет', 'Not included')} />
  const ids = plans.map((plan) => plan.id)
  const rows: Array<{ label: string; values: Record<SubscriptionPlanId, React.ReactNode> }> = [
    { label: pick(language, 'Ар бир курстагы сабактар', 'Уроки в каждом курсе', 'Lessons in every course'), values: { free: pick(language, `Алгачкы ${FREE_LESSON_LIMIT}`, `Первые ${FREE_LESSON_LIMIT}`, `First ${FREE_LESSON_LIMIT}`), pro: pick(language, 'Баары', 'Все', 'All'), aipro: pick(language, 'Баары', 'Все', 'All') } },
    { label: pick(language, 'Окуу прогресси', 'Прогресс обучения', 'Learning progress'), values: { free: yes, pro: yes, aipro: yes } },
    { label: pick(language, 'Курсту толук бүтүрүү', 'Полное прохождение курса', 'Complete full courses'), values: { free: no, pro: yes, aipro: yes } },
    { label: pick(language, 'AI жардамчы', 'AI-ассистент', 'AI assistant'), values: { free: no, pro: no, aipro: yes } },
    { label: pick(language, 'Баасы', 'Цена', 'Price'), values: Object.fromEntries(plans.map((plan) => [plan.id, `${plan.price} ${plan.currency === 'KGS' ? 'сом' : plan.currency}`])) as Record<SubscriptionPlanId, React.ReactNode> }
  ]
  return (
    <section className="plan-comparison" aria-label={pick(language, 'Тарифтерди салыштыруу', 'Сравнение тарифов', 'Plan comparison')}>
      <h2>{pick(language, 'Тарифтерди салыштыруу', 'Сравнение тарифов', 'Compare plans')}</h2>
      <div className="plan-comparison-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">{pick(language, 'Мүмкүнчүлүк', 'Возможность', 'Feature')}</span></th>
              {plans.map((plan) => <th key={plan.id} scope="col" className={plan.featured ? 'featured' : ''}>{plan.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {ids.map((id) => <td key={id}>{row.values[id]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const planIcons: Record<string, typeof BookOpen> = { free: BookOpen, pro: Rocket, aipro: Bot }

/**
 * One pricing plan card (home page and pricing page). The button depends on who is looking:
 * guest → register / choose; current plan → renew; higher plan → upgrade; lower plan → included.
 */
function PricingCard({ plan, t, language }: { plan: PlanView; t: (typeof translations)[Lang]; language: Lang }) {
  const { subscription, isLoggedIn } = useBilling()
  const Icon = planIcons[plan.id] ?? Sparkles
  const current = isLoggedIn ? accessPlanOf(subscription) : null
  const isCurrent = current === plan.id
  const checkoutPath = `/pricing/checkout/${plan.id}`

  let action: React.ReactNode
  if (plan.id === 'free') {
    action = !isLoggedIn
      ? <Link to="/auth?mode=register" className="btn btn-secondary full-width">{t.buttons.startFree} <ArrowRight size={16} /></Link>
      : <span className="btn btn-secondary full-width is-static" aria-disabled="true"><CheckCircle2 size={16} /> {isCurrent ? pick(language, 'Учурдагы тариф', 'Ваш текущий тариф', 'Your current plan') : pick(language, 'Тарифиңизге кирет', 'Входит в ваш тариф', 'Included in your plan')}</span>
  } else if (isCurrent) {
    action = <Link to={checkoutPath} className="btn btn-primary full-width"><RefreshCw size={16} /> {pick(language, 'Узартуу', 'Продлить', 'Renew')}</Link>
  } else if (current && PLAN_RANK[plan.id] < PLAN_RANK[current]) {
    action = <span className="btn btn-secondary full-width is-static" aria-disabled="true"><CheckCircle2 size={16} /> {pick(language, 'Тарифиңизге кирет', 'Входит в ваш тариф', 'Included in your plan')}</span>
  } else {
    const upgrading = current !== null && current !== 'free'
    const label = upgrading
      ? pick(language, `${plan.name} тарифине өтүү`, `Перейти на ${plan.name}`, `Upgrade to ${plan.name}`)
      : pick(language, 'Тарифти сатып алуу', 'Купить тариф', 'Buy plan')
    action = <Link to={checkoutPath} className={plan.featured || plan.id === 'aipro' ? 'btn btn-primary full-width' : 'btn btn-secondary full-width'}>{label} <ArrowRight size={16} /></Link>
  }

  return (
    <div className={['pricing-card', plan.featured ? 'featured' : '', `plan-${plan.id}`, isCurrent ? 'is-current' : ''].filter(Boolean).join(' ')}>
      {isCurrent
        ? <span className="popular-badge current"><CheckCircle2 size={13} /> {pick(language, 'Сиздин тариф', 'Ваш тариф', 'Your plan')}</span>
        : plan.featured && <span className="popular-badge"><Star size={13} fill="currentColor" /> {pick(language, 'Популярдуу', 'Популярный', 'Popular')}</span>}
      <span className="plan-icon"><Icon size={22} /></span>
      <span className="plan-tag">{plan.name}</span>
      <h3>{plan.label[language]}</h3>
      <div className="price">{plan.price} {plan.currency === 'KGS' ? 'сом' : plan.currency}<span> / {planPeriodLabel(plan, language, t)}</span></div>
      <p>{plan.description[language]}</p>
      <ul>
        {plan.features[language].map((feature) => <li key={feature}><CheckCircle2 size={16} /> {feature}</li>)}
      </ul>
      {isCurrent && plan.id !== 'free' && subscription.endsAt && (
        <p className="plan-current-until">{pick(language, 'Чейин активдүү', 'Активен до', 'Active until')} <strong>{formatDateTime(subscription.endsAt, language)}</strong></p>
      )}
      {action}
    </div>
  )
}

/** Card helpers for the demo checkout (validation happens in the browser; only the last 4 digits are sent). */
function luhnValid(digits: string) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
    sum += d
  }
  return sum % 10 === 0
}
function formatCardNumber(value: string) {
  return value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
}
function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}
function expiryValid(value: string) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value)
  if (!match) return false
  const now = new Date()
  return Number(`20${match[2]}`) * 12 + Number(match[1]) >= now.getFullYear() * 12 + now.getMonth() + 1
}
function cardBrandOf(digits: string) {
  if (digits.startsWith('4')) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
  if (digits.startsWith('9417')) return 'Elcart'
  return 'Card'
}

type CheckoutPhase ='review' | 'creating' | 'redirecting' | 'checking' | 'pending' | 'paid' | 'failed' | 'cancelled'

function CheckoutPage({ t, user }: { t: (typeof translations)[Lang]; user: UserProfile | null }) {
  const { planId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const language = useLanguage()
  const { plans, subscription, refreshSubscription } = useBilling()
  const plan = plans.find((item) => item.id === planId) ?? null
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard/pricing' : '/pricing'
  const [method, setMethod] = useState<PaymentMethod>('MBank')
  const [confirmed, setConfirmed] = useState(false)
  const [phase, setPhase] = useState<CheckoutPhase>('review')
  const [orderId, setOrderId] = useState<string | null>(() => searchParams.get('orderId'))
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef(0)
  // Purchase form. Demo card checkout: the card number is validated here and only its last 4 digits
  // (+ expiry) are sent to the server; CVV is not asked. A bank transfer needs only payer name + reference.
  const [payMode, setPayMode] = useState<'card' | 'online' | 'bank'>('card')
  const [demoEnabled, setDemoEnabled] = useState<boolean | null>(null)
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [fullName, setFullName] = useState(user?.name ?? '')
  const [payerName, setPayerName] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [receiptNote, setReceiptNote] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [manualConfig, setManualConfig] = useState<ManualTransferConfig | null>(null)
  const [orderProvider, setOrderProvider] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getManualTransferConfig().then((cfg) => { if (active) setManualConfig(cfg) }).catch(() => { if (active) setManualConfig({ enabled: false }) })
    getDemoPaymentConfig().then((cfg) => {
      if (!active) return
      setDemoEnabled(cfg.enabled)
      if (!cfg.enabled) setPayMode('online')
    }).catch(() => { if (active) { setDemoEnabled(false); setPayMode('online') } })
    return () => { active = false }
  }, [])

  const current = accessPlanOf(subscription)
  const kind: 'new' | 'renewal' | 'upgrade' | 'included' = !plan || plan.id === 'free'
    ? 'included'
    : current === plan.id ? 'renewal' : PLAN_RANK[plan.id] < PLAN_RANK[current] ? 'included' : current === 'free' ? 'new' : 'upgrade'
  const currency = plan?.currency === 'KGS' ? 'сом' : plan?.currency ?? ''
  const newEndDate = plan
    ? new Date((kind === 'renewal' && subscription.endsAt ? new Date(subscription.endsAt).getTime() : Date.now()) + plan.durationDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const errorText = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.code === 'PAYMENT_NOT_CONFIGURED') return pick(language, 'Онлайн-төлөм азырынча туташтырыла элек. Кийинчерээк кайра аракет кылыңыз же колдоо кызматына жазыңыз.', 'Онлайн-оплата пока не подключена. Попробуйте позже или напишите в поддержку.', 'Online payment is not connected yet. Please try again later or contact support.')
      if (err.code === 'PLAN_INCLUDED') return pick(language, 'Бул тариф учурдагы тарифиңизге кирет.', 'Этот тариф уже входит в ваш текущий тариф.', 'This plan is already included in your current plan.')
      if (err.code === 'PLAN_DISABLED') return pick(language, 'Бул тариф азыр жеткиликсиз.', 'Этот тариф сейчас недоступен.', 'This plan is not available right now.')
      if (err.code === 'PROVIDER_ERROR') return pick(language, 'Төлөм системасы жооп бербей жатат. Бир аздан кийин кайра аракет кылыңыз.', 'Платёжная система не отвечает. Попробуйте чуть позже.', 'The payment system is not responding. Please try again shortly.')
      if (err.code === 'MISSING_FIELDS') return pick(language, 'Бардык милдеттүү талааларды толтуруңуз.', 'Заполните все обязательные поля.', 'Please fill in all required fields.')
      if (err.code === 'INVALID_EMAIL' || err.code === 'EMAIL_MISMATCH') return pick(language, 'Email туура эмес же аккаунтуңузга дал келбейт.', 'Неверный email или он не совпадает с вашим аккаунтом.', 'The email is invalid or does not match your account.')
      if (err.code === 'INVALID_REFERENCE') return pick(language, 'Төлөмдүн номери туура эмес (4–64 белги: тамгалар, сандар, «-»).', 'Неверный номер платежа (4–64 символа: буквы, цифры, «-»).', 'Invalid payment reference (4–64 characters: letters, digits, "-").')
      if (err.code === 'CARD_DATA_REJECTED') return pick(language, 'Карта номерин жазбаңыз — банктагы төлөмдүн номерин гана көрсөтүңүз.', 'Не вводите номер карты — укажите только номер платежа из банка.', 'Do not enter a card number — use the bank transaction reference only.')
      if (err.code === 'DUPLICATE_REFERENCE') return pick(language, 'Бул төлөм номери мурун эле жөнөтүлгөн.', 'Этот номер платежа уже был отправлен.', 'This payment reference has already been submitted.')
      if (err.code === 'MANUAL_PENDING_EXISTS') return pick(language, 'Сизде текшерүүнү күтүп жаткан которуу бар. Администратордун жообун күтүңүз.', 'У вас уже есть перевод, ожидающий проверки. Дождитесь решения администратора.', 'You already have a transfer awaiting review. Please wait for the administrator.')
      if (err.code === 'INVALID_EXPIRY') return pick(language, 'Картанын мөөнөтү туура эмес же өтүп кеткен.', 'Неверный или истёкший срок действия карты.', 'The card expiry date is invalid or in the past.')
      if (err.code === 'DUPLICATE_SUBMIT') return pick(language, 'Төлөм жаңы эле жөнөтүлдү. Жеке кабинетти текшериңиз.', 'Оплата только что отправлена. Проверьте личный кабинет.', 'The payment was just submitted. Please check your dashboard.')
      if (err.code === 'DEMO_DISABLED') return pick(language, 'Карта менен төлөө азыр өчүрүлгөн.', 'Оплата картой сейчас отключена.', 'Card payment is turned off right now.')
      if (err.code === 'MANUAL_NOT_CONFIGURED') return pick(language, 'Банктык которуу азыр жеткиликсиз.', 'Банковский перевод сейчас недоступен.', 'Bank transfer is not available right now.')
      if (err.status === 401) return pick(language, 'Сессия бүттү. Кайра кириңиз.', 'Сессия истекла. Войдите снова.', 'Your session has expired. Please log in again.')
      return err.message
    }
    if (isNetworkError(err)) return pick(language, 'Сервер азыр жооп бербей жатат. Бир мүнөттөн кийин кайра аракет кылыңыз.', 'Сервер сейчас не отвечает. Попробуйте через минуту.', 'The server is not responding. Please try again in a minute.')
    return err instanceof Error ? err.message : String(err)
  }

  const checkStatus = useCallback(async (id: string) => {
    setPhase('checking')
    setError(null)
    try {
      const order = await getPaymentOrderStatus(id)
      setOrderProvider(order.provider ?? null)
      setReviewNote(order.reviewNote ?? null)
      if (order.status === 'paid' && order.activated) {
        await refreshSubscription()
        setPhase('paid')
        return 'done'
      }
      if (order.status === 'failed') { setPhase('failed'); return 'done' }
      if (order.status === 'cancelled') { setPhase('cancelled'); return 'done' }
      setPhase('pending')
      return 'pending'
    } catch (err) {
      setError(errorText(err))
      setPhase('pending')
      return 'pending'
    }
    // errorText only depends on the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSubscription, language])

  // Returning from the payment page: poll the server (the provider's webhook activates the plan).
  useEffect(() => {
    if (!orderId || !user) return
    let stopped = false
    pollRef.current = 0
    const tick = async () => {
      if (stopped) return
      const result = await checkStatus(orderId)
      pollRef.current += 1
      // Online payments confirm within minutes; a bank transfer waits for the administrator, so poll slower.
      if (result === 'pending' && pollRef.current < 40 && !stopped) window.setTimeout(() => { void tick() }, pollRef.current > 10 ? 15000 : 3000)
    }
    void tick()
    return () => { stopped = true }
  }, [orderId, user, checkStatus])

  const validateForm = () => {
    const errors: Record<string, string> = {}
    const required = pick(language, 'Милдеттүү талаа', 'Обязательное поле', 'Required field')
    if (fullName.trim().length < 2) errors.fullName = required
    if (!user?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) errors.email = pick(language, 'Email туура эмес', 'Неверный email', 'Invalid email')
    if (payMode === 'card') {
      const digits = cardNumber.replace(/\D/g, '')
      if (!digits) errors.cardNumber = required
      else if (digits.length < 13 || digits.length > 19 || !luhnValid(digits)) errors.cardNumber = pick(language, 'Карта номери туура эмес', 'Неверный номер карты', 'Invalid card number')
      if (!cardExpiry) errors.expiry = required
      else if (!expiryValid(cardExpiry)) errors.expiry = pick(language, 'Мөөнөтү туура эмес же өтүп кеткен (АА/ЖЖ)', 'Неверный или истёкший срок (ММ/ГГ)', 'Invalid or expired date (MM/YY)')
    }
    if (payMode === 'bank') {
      if (payerName.trim().length < 2) errors.payerName = required
      if (!paymentReference.trim()) errors.paymentReference = required
      else if (!/^[A-Za-z0-9][A-Za-z0-9\-_/.# ]{3,63}$/.test(paymentReference.trim())) errors.paymentReference = pick(language, '4–64 белги: тамгалар, сандар, «-»', '4–64 символа: буквы, цифры, «-»', '4–64 characters: letters, digits, "-"')
      else if (/(?:\d[ -]?){13,19}/.test(paymentReference)) errors.paymentReference = pick(language, 'Карта номерин жазбаңыз', 'Не вводите номер карты', 'Do not enter a card number')
    }
    if (!confirmed) errors.confirm = pick(language, 'Сатып алууну ырастаңыз', 'Подтвердите покупку', 'Please confirm the purchase')
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submitPurchase = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!user || !plan || kind === 'included') return
    setError(null)
    if (!validateForm()) {
      setError(pick(language, 'Маалымат толук эмес — белгиленген талааларды текшериңиз.', 'Не хватает данных — проверьте отмеченные поля.', 'Some information is missing — check the highlighted fields.'))
      return
    }
    setPhase('creating')
    try {
      if (payMode === 'card') {
        const digits = cardNumber.replace(/\D/g, '')
        await submitDemoCardPayment({ planId: plan.id, fullName: fullName.trim(), email: user.email, cardLast4: digits.slice(-4), cardBrand: cardBrandOf(digits), expiry: cardExpiry })
        // The full number is not kept anywhere once the payment is done.
        setCardNumber('')
        setCardExpiry('')
        await refreshSubscription()
        setPhase('paid')
        return
      }
      if (payMode === 'bank') {
        const created = await submitManualTransfer({ planId: plan.id, fullName: fullName.trim(), email: user.email, payerName: payerName.trim(), paymentReference: paymentReference.trim(), receiptNote: receiptNote.trim() || undefined })
        setOrderProvider('manual')
        setOrderId(created.orderId)
        setPhase('pending')
        void refreshSubscription()
        return
      }
      const created = await createPaymentOrder({ userEmail: user.email, userName: fullName.trim() || user.name, planId: plan.id, paymentMethod: method })
      setOrderId(created.orderId)
      setPhase('redirecting')
      window.location.assign(created.paymentUrl)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_REFERENCE') setFieldErrors({ paymentReference: errorText(err) })
      setError(errorText(err))
      setPhase('review')
    }
  }

  if (!plan || plan.id === 'free') {
    return (
      <div className="container section page-block checkout-page">
        <PageHero back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />} eyebrow={pick(language, 'Төлөм', 'Оплата', 'Checkout')} title={pick(language, 'Тариф табылган жок', 'Тариф не найден', 'Plan not found')} subtitle={pick(language, 'Бул тариф жок же азыр жеткиликсиз.', 'Такого тарифа нет или он сейчас недоступен.', 'This plan does not exist or is not available right now.')} actions={<ButtonLink to={fallbackPath} icon={ArrowLeft}>{pick(language, 'Тарифтерге', 'К тарифам', 'To plans')}</ButtonLink>} />
      </div>
    )
  }

  const methods: Array<{ id: PaymentMethod; label: string }> = [
    { id: 'MBank', label: 'MBank' },
    { id: 'O!Деньги', label: 'O!Деньги' },
    { id: 'Элсом', label: 'Элсом' }
  ]
  const pendingForThisPlan = subscription.pendingOrder && subscription.pendingOrder.planId === plan.id && !orderId ? subscription.pendingOrder : null

  return (
    <div className="container section page-block checkout-page">
      <PageHero
        back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />}
        eyebrow={pick(language, 'Төлөм', 'Оформление', 'Checkout')}
        title={`${plan.name} — ${plan.label[language]}`}
        subtitle={plan.description[language]}
      />

      <div className="checkout-layout">
        <section className="ui-card checkout-summary" aria-label={pick(language, 'Буйрутма', 'Заказ', 'Order')}>
          <h2>{pick(language, 'Буйрутма', 'Ваш заказ', 'Your order')}</h2>
          <dl className="checkout-lines">
            <div><dt>{pick(language, 'Тариф', 'Тариф', 'Plan')}</dt><dd>{plan.name}</dd></div>
            <div><dt>{pick(language, 'Мөөнөт', 'Срок', 'Period')}</dt><dd>{pick(language, `${plan.durationDays} күн`, `${plan.durationDays} дней`, `${plan.durationDays} days`)}</dd></div>
            <div><dt>{pick(language, 'Учурдагы тариф', 'Текущий тариф', 'Current plan')}</dt><dd>{PLAN_META[current].name}</dd></div>
            <div><dt>{pick(language, 'Жаңы бүтүү күнү', 'Новая дата окончания', 'New end date')}</dt><dd>{kind === 'included' ? '—' : formatDateTime(newEndDate, language)}</dd></div>
            <div className="checkout-total"><dt>{pick(language, 'Төлөөгө', 'К оплате', 'Total')}</dt><dd>{plan.price} {currency}</dd></div>
          </dl>
          <p className="checkout-kind">
            {kind === 'renewal' && pick(language, `Учурдагы ${plan.name} тарифиңизге ${plan.durationDays} күн кошулат.`, `К текущему тарифу ${plan.name} добавятся ${plan.durationDays} дней.`, `${plan.durationDays} days will be added to your current ${plan.name} plan.`)}
            {kind === 'upgrade' && pick(language, `${plan.name} төлөм ырасталгандан кийин дароо башталат жана учурдагы ${PLAN_META[current].name} тарифин алмаштырат.`, `${plan.name} начнёт действовать сразу после подтверждения оплаты и заменит текущий ${PLAN_META[current].name}.`, `${plan.name} starts as soon as the payment is confirmed and replaces your current ${PLAN_META[current].name}.`)}
            {kind === 'new' && pick(language, 'Тариф төлөм ырасталгандан кийин гана активдешет.', 'Тариф активируется только после подтверждения оплаты.', 'The plan is activated only after the payment is confirmed.')}
            {kind === 'included' && pick(language, 'Бул тариф учурдагы тарифиңизге кирет — сатып алуунун кереги жок.', 'Этот тариф уже входит в ваш текущий — покупать не нужно.', 'This plan is already included in your current plan — no need to buy it.')}
          </p>
        </section>

        <section className="ui-card checkout-pay" aria-label={pick(language, 'Төлөм', 'Оплата', 'Payment')}>
          {phase === 'paid' ? (
            <div className="checkout-result success" role="status">
              <CheckCircle2 size={36} />
              <h2>{pick(language, 'Төлөм ырасталды', 'Оплата подтверждена', 'Payment confirmed')}</h2>
              <p>{pick(language, `${plan.name} тарифи активдүү`, `Тариф ${plan.name} активен`, `${plan.name} is active`)} · {pick(language, 'чейин', 'до', 'until')} {formatDateTime(subscription.endsAt, language)}</p>
              <div className="checkout-result-actions">
                <ButtonLink to="/dashboard" icon={LayoutDashboard}>{pick(language, 'Жеке кабинет', 'Личный кабинет', 'Dashboard')}</ButtonLink>
                {plan.id === 'aipro' && <ButtonLink to="/dashboard/ai" variant="secondary" icon={Bot}>AI Assistant</ButtonLink>}
              </div>
            </div>
          ) : phase === 'failed' || phase === 'cancelled' ? (
            <div className="checkout-result error" role="alert">
              <X size={36} />
              <h2>{phase === 'failed' ? pick(language, 'Төлөм өтпөй калды', 'Оплата не прошла', 'Payment failed') : pick(language, 'Төлөм жокко чыгарылды', 'Оплата отменена', 'Payment cancelled')}</h2>
              {orderProvider === 'manual'
                ? <p>{pick(language, 'Администратор которууну ырастаган жок, тариф өзгөргөн жок.', 'Администратор не подтвердил перевод, тариф не изменился.', 'The administrator did not confirm the transfer; your plan did not change.')}{reviewNote ? ` ${pick(language, 'Себеби', 'Причина', 'Reason')}: ${reviewNote}` : ''}</p>
                : <p>{pick(language, 'Акча алынган жок, тариф өзгөргөн жок. Кайра аракет кылсаңыз болот.', 'Деньги не списаны, тариф не изменился. Можно попробовать ещё раз.', 'No money was taken and your plan did not change. You can try again.')}</p>}
              <Button icon={RefreshCw} onClick={() => { setOrderId(null); setPhase('review'); navigate(location.pathname, { replace: true }) }}>{pick(language, 'Кайра аракет кылуу', 'Попробовать снова', 'Try again')}</Button>
            </div>
          ) : orderId && (phase === 'pending' || phase === 'checking') ? (
            <div className="checkout-result pending" role="status" aria-live="polite">
              <Clock3 size={36} />
              {orderProvider === 'manual' ? (
                <>
                  <h2>{pick(language, 'Өтүнмө жөнөтүлдү — текшерүү күтүлүүдө', 'Заявка отправлена — ожидает проверки', 'Request sent — awaiting review')}</h2>
                  <p>{pick(language, 'Статус: PENDING. Администратор которууну текшергенден кийин тариф активдешет. Бул баракты жаап, кийинчерээк жеке кабинеттен текшерсеңиз болот.', 'Статус: PENDING. Тариф активируется после того, как администратор проверит перевод. Можно закрыть страницу и проверить позже в личном кабинете.', 'Status: PENDING. The plan activates after the administrator verifies the transfer. You can close this page and check later in your dashboard.')}</p>
                </>
              ) : (
                <>
                  <h2>{pick(language, 'Төлөм күтүлүүдө', 'Ожидаем подтверждение оплаты', 'Waiting for payment confirmation')}</h2>
                  <p>{pick(language, 'Төлөм системасы төлөмдү ырастаганда тариф өзү активдешет. Бул баракта статус автоматтык түрдө жаңыланат.', 'Тариф активируется автоматически, когда платёжная система подтвердит оплату. Статус на этой странице обновляется сам.', 'The plan activates automatically once the payment system confirms the payment. This page updates by itself.')}</p>
                </>
              )}
              <Button variant="secondary" icon={RefreshCw} disabled={phase === 'checking'} onClick={() => { void checkStatus(orderId) }}>{phase === 'checking' ? pick(language, 'Текшерилүүдө...', 'Проверяем...', 'Checking...') : pick(language, 'Статусту текшерүү', 'Проверить статус', 'Check status')}</Button>
              {error && <p className="error-message">{error}</p>}
            </div>
          ) : (
            <form className="checkout-form" noValidate onSubmit={(event) => { void submitPurchase(event) }}>
              <h2>{pick(language, 'Сатып алуучунун маалыматы', 'Данные покупателя', 'Customer information')}</h2>
              <div className="checkout-fields">
                <label className={fieldErrors.fullName ? 'checkout-field has-error' : 'checkout-field'}>
                  <span>{pick(language, 'Толук аты-жөнү', 'ФИО', 'Full name')} *</span>
                  <input type="text" autoComplete="name" maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} aria-invalid={!!fieldErrors.fullName} />
                  {fieldErrors.fullName && <small className="field-error">{fieldErrors.fullName}</small>}
                </label>
                <label className={fieldErrors.email ? 'checkout-field has-error' : 'checkout-field'}>
                  <span>Email</span>
                  <input type="email" value={user?.email ?? ''} readOnly aria-readonly="true" aria-invalid={!!fieldErrors.email} />
                  {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
                </label>
              </div>

              <h2>{pick(language, 'Төлөм ыкмасы', 'Способ оплаты', 'Payment method')}</h2>
              <div className="payment-mode-switch" role="radiogroup" aria-label={pick(language, 'Төлөм түрү', 'Тип оплаты', 'Payment type')}>
                {demoEnabled ? (
                  <button type="button" role="radio" aria-checked={payMode === 'card'} className={payMode === 'card' ? 'payment-method active' : 'payment-method'} onClick={() => setPayMode('card')} disabled={kind === 'included'}>
                    <CreditCard size={20} /><span>{pick(language, 'Банк картасы', 'Банковская карта', 'Bank card')}</span>
                  </button>
                ) : (
                  <button type="button" role="radio" aria-checked={payMode === 'online'} className={payMode === 'online' ? 'payment-method active' : 'payment-method'} onClick={() => setPayMode('online')} disabled={kind === 'included'}>
                    <WalletCards size={20} /><span>{pick(language, 'Онлайн-төлөм', 'Онлайн-оплата', 'Online payment')}</span>
                  </button>
                )}
                {manualConfig?.enabled && (
                  <button type="button" role="radio" aria-checked={payMode === 'bank'} className={payMode === 'bank' ? 'payment-method active' : 'payment-method'} onClick={() => setPayMode('bank')} disabled={kind === 'included'}>
                    <Building2 size={20} /><span>{pick(language, 'Банктык которуу', 'Банковский перевод', 'Bank transfer')}</span>
                  </button>
                )}
              </div>
              {pendingForThisPlan && (
                <div className="checkout-pending-note" role="status">
                  <Clock3 size={18} />
                  <span>{pendingForThisPlan.provider === 'manual'
                    ? pick(language, 'Бул тариф үчүн которууңуз текшерүүдө.', 'Ваш перевод за этот тариф ожидает проверки.', 'Your transfer for this plan is awaiting review.')
                    : pick(language, 'Бул тариф үчүн бүтпөгөн төлөм бар.', 'У вас есть незавершённая оплата этого тарифа.', 'You have an unfinished payment for this plan.')}</span>
                  <button type="button" className="text-button" onClick={() => setOrderId(pendingForThisPlan.orderId)}>{pick(language, 'Статусту текшерүү', 'Проверить статус', 'Check status')}</button>
                </div>
              )}
              {payMode === 'card' ? (
                <>
                  <div className="checkout-fields">
                    <label className={fieldErrors.cardNumber ? 'checkout-field wide has-error' : 'checkout-field wide'}>
                      <span>{pick(language, 'Карта номери', 'Номер карты', 'Card number')} *</span>
                      <input type="text" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" maxLength={23} value={cardNumber} onChange={(event) => setCardNumber(formatCardNumber(event.target.value))} aria-invalid={!!fieldErrors.cardNumber} />
                      {fieldErrors.cardNumber && <small className="field-error">{fieldErrors.cardNumber}</small>}
                    </label>
                    <label className={fieldErrors.expiry ? 'checkout-field has-error' : 'checkout-field'}>
                      <span>{pick(language, 'Жарактуулук мөөнөтү', 'Срок действия', 'Expiry date')} *</span>
                      <input type="text" inputMode="numeric" autoComplete="cc-exp" placeholder={pick(language, 'АА/ЖЖ', 'ММ/ГГ', 'MM/YY')} maxLength={5} value={cardExpiry} onChange={(event) => setCardExpiry(formatExpiry(event.target.value))} aria-invalid={!!fieldErrors.expiry} />
                      {fieldErrors.expiry && <small className="field-error">{fieldErrors.expiry}</small>}
                    </label>
                  </div>
                  <p className="checkout-demo-note">{pick(language, 'Демо-төлөм: акча алынбайт, тариф дароо активдешет.', 'Демо-оплата: деньги не списываются, тариф активируется сразу.', 'Demo payment: no money is charged, the plan activates immediately.')}</p>
                </>
              ) : payMode === 'online' ? (
                <>
                  <p className="checkout-subtitle">{pick(language, 'Төлөм системасын тандаңыз', 'Выберите платёжную систему', 'Choose a payment provider')}</p>
                  <div className="payment-methods" role="radiogroup" aria-label={pick(language, 'Төлөм системасы', 'Платёжная система', 'Payment provider')}>
                    {methods.map((item) => (
                      <button key={item.id} type="button" role="radio" aria-checked={method === item.id} className={method === item.id ? 'payment-method active' : 'payment-method'} onClick={() => setMethod(item.id)} disabled={kind === 'included'}>
                        <WalletCards size={20} /><span>{item.label}</span>{method === item.id && <CheckCircle2 size={18} />}
                      </button>
                    ))}
                  </div>
                </>
              ) : manualConfig?.enabled && (
                <>
                  <div className="bank-details" aria-label={pick(language, 'Которуу үчүн реквизиттер', 'Реквизиты для перевода', 'Transfer details')}>
                    {manualConfig.bankName && <div><span>{pick(language, 'Банк', 'Банк', 'Bank')}</span><strong>{manualConfig.bankName}</strong></div>}
                    {manualConfig.recipient && <div><span>{pick(language, 'Алуучу', 'Получатель', 'Recipient')}</span><strong>{manualConfig.recipient}</strong></div>}
                    <div><span>{pick(language, 'Эсеп / номер', 'Счёт / номер', 'Account / number')}</span><strong>{manualConfig.account}</strong></div>
                    <div><span>{pick(language, 'Сумма', 'Сумма', 'Amount')}</span><strong>{plan.price} {currency}</strong></div>
                    {subscription.accountId && <div><span>{pick(language, 'Төлөмдүн комментарийи', 'Комментарий к платежу', 'Payment comment')}</span><strong>LevelUp {subscription.accountId} {plan.name}</strong></div>}
                    {manualConfig.instructions && <p>{manualConfig.instructions}</p>}
                  </div>
                  <div className="checkout-fields">
                    <label className={fieldErrors.payerName ? 'checkout-field has-error' : 'checkout-field'}>
                      <span>{pick(language, 'Төлөөчүнүн аты-жөнү', 'ФИО плательщика', 'Payer name')} *</span>
                      <input type="text" maxLength={120} value={payerName} onChange={(event) => setPayerName(event.target.value)} aria-invalid={!!fieldErrors.payerName} />
                      {fieldErrors.payerName && <small className="field-error">{fieldErrors.payerName}</small>}
                    </label>
                    <label className={fieldErrors.paymentReference ? 'checkout-field has-error' : 'checkout-field'}>
                      <span>{pick(language, 'Төлөмдүн номери (чектен)', 'Номер платежа (из чека)', 'Payment reference (from receipt)')} *</span>
                      <input type="text" maxLength={64} autoComplete="off" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} aria-invalid={!!fieldErrors.paymentReference} />
                      {fieldErrors.paymentReference && <small className="field-error">{fieldErrors.paymentReference}</small>}
                    </label>
                    <label className="checkout-field wide">
                      <span>{pick(language, 'Чек боюнча комментарий (милдеттүү эмес)', 'Комментарий к чеку (необязательно)', 'Receipt note (optional)')}</span>
                      <input type="text" maxLength={300} value={receiptNote} onChange={(event) => setReceiptNote(event.target.value)} />
                    </label>
                  </div>
                </>
              )}
              <label className={fieldErrors.confirm ? 'checkout-confirm has-error' : 'checkout-confirm'}>
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={kind === 'included'} />
                <span>{pick(language, `${plan.name} тарифин ${plan.price} ${currency} суммасына сатып алууну ырастайм.`, `Подтверждаю покупку тарифа ${plan.name} на сумму ${plan.price} ${currency}.`, `I confirm the purchase of ${plan.name} for ${plan.price} ${currency}.`)}</span>
              </label>
              <Button type="submit" block size="lg" icon={ShieldCheck} disabled={kind === 'included' || phase === 'creating' || phase === 'redirecting'}>
                {phase === 'creating' ? pick(language, 'Жөнөтүлүүдө...', 'Отправляем...', 'Sending...') : phase === 'redirecting' ? pick(language, 'Төлөм барагына өтүүдө...', 'Переходим к оплате...', 'Redirecting to payment...') : `${payMode === 'card' ? pick(language, 'Төлөө', 'Оплатить', 'Pay') : pick(language, 'Жөнөтүү', 'Отправить', 'Submit')} — ${plan.price} ${currency}`}
              </Button>
              {error && <p className="error-message" role="alert">{error}</p>}
              <p className="checkout-secure"><Lock size={14} /> {payMode === 'card'
                ? pick(language, 'Карта номери сакталбайт жана серверге жөнөтүлбөйт — акыркы 4 сан гана колдонулат. CVV суралбайт.', 'Номер карты не сохраняется и не отправляется на сервер — используются только последние 4 цифры. CVV не запрашивается.', 'The card number is not stored or sent to the server — only the last 4 digits are used. CVV is not requested.')
                : payMode === 'bank'
                ? pick(language, 'Карта номерин, CVV же мөөнөтүн эч качан жазбаңыз. Тариф администратор которууну ырастагандан кийин гана активдешет.', 'Никогда не вводите номер карты, CVV или срок действия. Тариф активируется только после того, как администратор подтвердит перевод.', 'Never enter a card number, CVV or expiry date. The plan activates only after the administrator confirms the transfer.')
                : pick(language, 'Төлөм төлөм системасынын барагында өтөт. LevelUp карта маалыматтарын сактабайт.', 'Оплата проходит на странице платёжной системы. LevelUp не хранит данные карт.', 'Payment happens on the payment system’s page. LevelUp does not store card details.')}</p>
              <Link to={fallbackPath} className="text-link">{t.sections.choosePlanShort}</Link>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}

function FaqPage({ t }: { t: (typeof translations)[Lang] }) {
  const language = useLanguage()
  const location = useLocation()
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/home'
  return (
    <div className="container section page-block faq-page">
      <PageHero
        back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />}
        eyebrow="FAQ"
        title={t.faqTitle}
        subtitle={pick(language, 'Окуу, тарифтер жана аккаунт боюнча негизги жооптор.', 'Ответы на главные вопросы об обучении, тарифах и аккаунте.', 'Answers about learning, plans and your account.')}
      />
      <div className="faq-layout">
        <div className="faq-list faq-page-list">
          {faqData.map((item) => <FaqItem key={item.q[language]} question={item.q[language]} answer={item.a[language]} defaultOpen={false} />)}
        </div>
        <Card as="aside" className="faq-help-card">
          <span className="ui-modal-icon"><HelpCircle size={22} /></span>
          <h3>{pick(language, 'Жооп таппадыңызбы?', 'Не нашли ответ?', 'Still have questions?')}</h3>
          <p>{pick(language, 'Колдоо кызматына жазыңыз — жардам беребиз.', 'Напишите в поддержку — мы поможем.', 'Write to support and we will help.')}</p>
          <a className="btn btn-primary full-width" href="mailto:support@levelup.kg"><Mail size={16} /> support@levelup.kg</a>
        </Card>
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

function CourseCard({ course, language, favorites, onToggleFavorite, backTo = '/courses', completedLessons }: { course: Course; language?: Lang; favorites?: string[]; onToggleFavorite?: React.Dispatch<React.SetStateAction<string[]>>; backTo?: string; completedLessons?: string[] }) {
  const activeLanguage = language && translations[language] ? language : 'ru'
  const tt = translations[activeLanguage]
  const isFavorite = favorites?.includes(course.id)
  const lessonTotal = course.lessons.length || course.lessonsCount
  const doneCount = completedLessons ? course.lessons.filter((lesson) => completedLessons.includes(lesson.id)).length : 0
  const percent = lessonTotal ? Math.round((doneCount / lessonTotal) * 100) : 0
  const coursePath = appendFromParam(`/courses/${course.id}`, backTo)

  return (
    <article className="course-card" key={course.id}>
      <div className="course-card-thumb" style={{ ['--course-accent' as string]: course.accent, ['--course-tint' as string]: course.color }}>
        <span className="course-badge">{course.badge}</span>
        {onToggleFavorite && (
          <button type="button" className={isFavorite ? 'favorite-button active' : 'favorite-button'} aria-pressed={!!isFavorite} onClick={() => { onToggleFavorite((current) => current.includes(course.id) ? current.filter((item) => item !== course.id) : [...current, course.id]) }} aria-label={pick(activeLanguage, 'Тандалмаларга', 'В избранное', 'Favorite course')}>
            <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
        <span className="course-card-icon"><CourseDirectionIcon courseId={course.id} size={34} /></span>
      </div>
      <div className="course-card-body">
        <div className="course-card-tags">
          <Badge tone="green">{levelLabel(course.level, activeLanguage)}</Badge>
          <span className="course-card-rating"><Star size={14} fill="currentColor" /> {course.rating}</span>
        </div>
        <h3><Link to={coursePath}>{course.title[activeLanguage]}</Link></h3>
        <p>{course.description[activeLanguage]}</p>
        <div className="course-card-meta">
          <span><PlayCircle size={15} /> {lessonTotal} {tt.home.lessons}</span>
          <span><Clock3 size={15} /> {course.duration}</span>
          <span><Users size={15} /> {course.students}</span>
        </div>
        {completedLessons && doneCount > 0 && <ProgressBar value={percent} label={`${doneCount}/${lessonTotal}`} showValue />}
        <div className="course-footer">
          <Link to={coursePath} className="btn btn-primary small full-width">
            {doneCount > 0 ? tt.buttons.continue : pick(activeLanguage, 'Курсту ачуу', 'Открыть курс', 'Open course')}
            <ArrowRight size={16} />
          </Link>
        </div>
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
  const year = new Date().getFullYear()
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

  const navLinks = [
    { to: '/home', label: t.nav.home },
    { to: '/courses', label: t.nav.courses },
    { to: '/rating', label: t.nav.rating },
    { to: '/reviews', label: t.nav.reviews },
    { to: '/pricing', label: t.nav.pricing },
    { to: '/faq', label: t.nav.faq }
  ]

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand-column">
          <div className="brand footer-brand"><img src={siteLogo} alt="LEVEL UP" className="footer-logo-image" /></div>
          <p className="footer-copy">{t.footer.description}</p>
        </div>

        <nav className="footer-column footer-nav-column" aria-label={t.footer.nav}>
          <h4>{t.footer.nav}</h4>
          <ul className="footer-list footer-nav-list">
            {navLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="footer-contact-item footer-nav-link">{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-column">
          <h4>{t.footer.contacts}</h4>
          <ul className="footer-list">
            {contactLinks.map((item) => (
              <li key={item.href}>
                <a href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel={item.href.startsWith('http') ? 'noreferrer' : undefined} className="footer-contact-item" aria-label={item.label} title={item.label}>
                  <span className="footer-icon">{item.icon}</span>
                  <span className="footer-contact-text">{item.label}</span>
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
                <a href={item.href} target="_blank" rel="noreferrer" className="footer-contact-item footer-social-link" aria-label={item.label} title={item.label}>
                  <span className="footer-icon footer-social-icon">{item.icon}</span>
                  <span className="footer-social-label">{item.label}</span>
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
        <span className="footer-rights">© {year} LEVEL UP. {t.footer.rights}</span>
      </div>
    </footer>
  )
}

const aiSuggestions: Record<Lang, string[]> = {
  kg: ['HTML деген эмне жана эмнеден баштоо керек?', "JavaScript'те функция кантип жазылат?", "CSS Flexbox менен Grid'дин айырмасы", 'Программалоону үйрөнүү үчүн план түзүп бер'],
  ru: ['Что такое HTML и с чего начать?', 'Как написать функцию в JavaScript?', 'Чем отличается Flexbox от Grid в CSS?', 'Составь план изучения программирования'],
  en: ['What is HTML and where do I start?', 'How do I write a function in JavaScript?', 'Flexbox vs Grid in CSS — what is the difference?', 'Make me a plan to learn programming']
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
            <div key={message.id} className={message.role === 'assistant' ? 'ai-chat-message assistant' : 'ai-chat-message user'}>
              <div className="ai-chat-message-head">
                {message.role === 'assistant' ? <Brain size={14} /> : <UserRound size={14} />}
                <span>{message.role === 'assistant' ? 'LevelUp AI' : userInitial}</span>
              </div>
              <p>{message.text}</p>
            </div>
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
          {isLoading && <div className="ai-chat-message assistant loading" aria-live="polite"><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>{t.ai.generating}</div>}
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
  const language = useLanguage()
  const content = kind === 'privacy'
    ? (language === 'ru'
      ? 'Мы защищаем ваши данные и используем их только для работы платформы: авторизация, прогресс обучения и подписка.'
      : language === 'kg'
        ? 'Биз сиздин маалыматтарды коргойбуз жана платформанын иши үчүн гана колдонобуз: авторизация, окуу прогресси жана жазылуу.'
        : 'We protect your data and use it only for platform operations: authentication, learning progress, and subscriptions.')
    : (language === 'ru'
      ? 'Используя LevelUp, вы соглашаетесь соблюдать правила платформы и использовать контент только в рамках обучения.'
      : language === 'kg'
        ? 'LevelUp колдонгондо, платформа эрежелерин сактоого жана контентти окуу максатында гана колдонууга макул болосуз.'
        : 'By using LevelUp, you agree to follow platform rules and use content for learning purposes only.')

  return (
    <div className="container section page-block legal-page">
      <PageHero back={<SmartBackButton fallback="/home" label={pick(language, 'Кайтуу', 'Назад', 'Back')} />} eyebrow="LEVEL UP" title={title} />
      <Card className="legal-card">
        <ShieldCheck size={22} />
        <p>{content}</p>
      </Card>
    </div>
  )
}

// ─── Mobile-first building blocks ────────────────────────────────────────────

/** Start each newly opened page at the top (pages that restore their own scroll, like the catalog, do so afterwards). */
function ScrollToTopOnNavigate() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) return
    // 'instant' overrides the site-wide `scroll-behavior: smooth` so pages don't visibly scroll up.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash])
  return null
}


/** Language dropdown (globe + RU + chevron) and Day/Night toggle, shown in the site header at every width. */
function HeaderQuickControls({ t, language, setLanguage, theme, setTheme }: { t: (typeof translations)[Lang]; language: Lang; setLanguage: React.Dispatch<React.SetStateAction<Lang>>; theme: Theme; setTheme: React.Dispatch<React.SetStateAction<Theme>> }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('touchstart', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('touchstart', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="header-quick-controls">
      <div className="header-lang" ref={wrapRef}>
        <button
          type="button"
          className="header-lang-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={t.headerMenu.language}
          onClick={() => setOpen((value) => !value)}
        >
          <Globe size={18} />
          <span>{language.toUpperCase()}</span>
          <ChevronDown size={15} className={open ? 'header-lang-chevron open' : 'header-lang-chevron'} />
        </button>
        <div className={open ? 'header-lang-menu open' : 'header-lang-menu'} role="listbox" aria-label={t.headerMenu.language}>
          {(['kg', 'ru', 'en'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected={language === item}
              className={language === item ? 'header-lang-option active' : 'header-lang-option'}
              tabIndex={open ? 0 : -1}
              onClick={() => { setLanguage(item); setOpen(false) }}
            >
              {item.toUpperCase()}
              {language === item && <Check size={14} />}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="theme-toggle"
        onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
        aria-label={theme === 'light' ? t.headerMenu.night : t.headerMenu.day}
        title={theme === 'light' ? t.headerMenu.night : t.headerMenu.day}
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>
    </div>
  )
}

/** Fixed bottom tab bar for phones/tablets (hidden on desktop via CSS). */
function MobileBottomNav({ t, isLoggedIn }: { t: (typeof translations)[Lang]; isLoggedIn: boolean }) {
  const location = useLocation()
  if (location.pathname.startsWith('/admin')) return null

  const path = location.pathname
  const items = [
    { to: '/home', label: t.nav.home, icon: Home, active: path === '/home' || path === '/' },
    { to: '/courses', label: t.nav.courses, icon: BookOpen, active: path.startsWith('/courses') || path === '/dashboard/courses' },
    { to: '/rating', label: t.nav.rating, icon: TrendingUp, active: path === '/rating' || path === '/dashboard/rating' },
    { to: '/reviews', label: t.nav.reviews, icon: MessageSquareText, active: path === '/reviews' || path === '/dashboard/reviews' },
    {
      to: isLoggedIn ? '/dashboard/profile' : '/auth?mode=login',
      label: t.nav.profile,
      icon: UserRound,
      active: path === '/dashboard/profile' || path === '/dashboard' || path === '/auth'
    }
  ]

  return (
    <nav className="mobile-bottom-nav" aria-label={t.footer.nav}>
      {items.map(({ to, label, icon: Icon, active }) => (
        <Link key={label} to={to} className={active ? 'mobile-bottom-nav-item active' : 'mobile-bottom-nav-item'} aria-current={active ? 'page' : undefined} onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })}>
          <Icon size={20} strokeWidth={active ? 2.4 : 2} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}

const courseDirectionIcons: Record<string, typeof BookOpen> = {
  html: Code2,
  css: Palette,
  ai: Bot,
  math: Calculator,
  physics: Atom,
  english: Languages,
  webdesign: Palette
}

function CourseDirectionIcon({ courseId, size }: { courseId: string; size: number }) {
  if (courseId === 'javascript') return <span className="direction-js">JS</span>
  const Icon = courseDirectionIcons[courseId] ?? BookOpen
  return <Icon size={size} />
}

/** "Popular directions": one pastel tile per course, opening that course. */
function CourseDirectionGrid() {
  const { courses } = useCourseCatalog()
  const language = useLanguage()

  return (
    <div className="direction-grid">
      {courses.slice(0, 6).map((course) => (
        <Link key={course.id} to={`/courses/${course.id}`} className="direction-tile" style={{ background: course.color }}>
          <span className="direction-tile-icon" style={{ color: course.accent }}>
            <CourseDirectionIcon courseId={course.id} size={26} />
          </span>
          <strong>{course.title[language]}</strong>
        </Link>
      ))}
    </div>
  )
}

/** Eyebrow pill + title + "see all" link, as in the mobile design. */
function HomeSectionHeader({ eyebrow, title, linkTo, linkLabel }: { eyebrow: string; title: string; linkTo: string; linkLabel: string }) {
  return (
    <div className="home-section-header">
      <div>
        <span className="eyebrow home-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <Link to={linkTo} className="home-section-link">
        {linkLabel} <ArrowRight size={16} />
      </Link>
    </div>
  )
}

/** Four platform statistics from the backend (no invented numbers). */
function HomeStatsCard({ t, siteStats, courseCount }: { t: (typeof translations)[Lang]; siteStats: SiteStats; courseCount: number }) {
  const items = [
    { icon: Users, value: siteStats.students, format: formatCompactNumber, label: t.home.statStudents, loading: siteStats.loading },
    { icon: GraduationCap, value: courseCount, format: (value: number) => String(Math.round(value)), label: t.home.statCourses, loading: false },
    { icon: Star, value: siteStats.rating, format: (value: number) => Number(value).toFixed(1), label: t.home.statRating, loading: siteStats.loading },
    { icon: Trophy, value: siteStats.completion, format: (value: number) => `${Math.round(value)}%`, label: t.home.statSuccess, loading: siteStats.loading }
  ]

  return (
    <section className="home-stats-wrap">
      <div className="container">
        <div className="home-stats-card">
          {items.map(({ icon: Icon, value, format, label, loading }) => (
            <div key={label} className="home-stat">
              <Icon size={24} className="home-stat-icon" />
              <AnimatedMetric value={value} formatter={format} loading={loading} fallback="—" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Horizontal course card used in the mobile "Choose your course" list. */
function HomeCourseRow({ course, t, isTop }: { course: Course; t: (typeof translations)[Lang]; isTop: boolean }) {
  const language = useLanguage()
  return (
    <Link to={`/courses/${course.id}`} className="home-course-row">
      <span className="home-course-thumb">
        {isTop && <span className="home-course-badge">{t.home.hit}</span>}
        <span className="home-course-thumb-icon" style={{ background: course.accent }}>
          <CourseDirectionIcon courseId={course.id} size={28} />
        </span>
      </span>
      <span className="home-course-body">
        <strong>{course.title[language]}</strong>
        <span className="home-course-desc">{course.description[language]}</span>
        <span className="home-course-meta">
          <span><Star size={14} className="home-course-star" fill="currentColor" /> {course.rating} <small>({course.students} {t.home.students})</small></span>
          <span><Clock3 size={14} /> {course.lessons.length} {t.home.lessons}</span>
        </span>
      </span>
      <span className="home-course-go" aria-hidden="true"><ChevronRight size={20} /></span>
    </Link>
  )
}

/** IT illustration for the mobile hero: laptop with code, graduation cap, React and Python tiles. */
function HeroIllustration() {
  return (
    <svg className="hero-illustration" viewBox="0 0 320 260" role="img" aria-label="Laptop with code and a graduation cap">
      <defs>
        <linearGradient id="hi-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#163c33" /><stop offset="1" stopColor="#0b221c" /></linearGradient>
        <linearGradient id="hi-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9c9c4" /><stop offset="1" stopColor="#6f8580" /></linearGradient>
        <linearGradient id="hi-cap" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b4a52" /><stop offset="1" stopColor="#151d22" /></linearGradient>
        <radialGradient id="hi-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#3ee08f" stopOpacity="0.55" /><stop offset="1" stopColor="#3ee08f" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="170" cy="200" rx="140" ry="46" fill="url(#hi-glow)" />
      <ellipse cx="170" cy="204" rx="122" ry="30" fill="none" stroke="#3ee08f" strokeOpacity="0.7" strokeWidth="2" />
      <g transform="rotate(-14 170 140)">
        <rect x="92" y="62" width="150" height="104" rx="12" fill="url(#hi-body)" />
        <rect x="100" y="70" width="134" height="88" rx="7" fill="url(#hi-screen)" />
        <text x="167" y="125" textAnchor="middle" fontFamily="Consolas, monospace" fontWeight="700" fontSize="34" fill="#3ee08f">&lt;/&gt;</text>
        <path d="M78 168 h178 l14 20 H64 Z" fill="url(#hi-body)" />
        <rect x="142" y="172" width="50" height="6" rx="3" fill="#56696a" />
      </g>
      <g transform="translate(176 6) rotate(18)">
        <path d="M0 30 L62 0 L124 30 L62 60 Z" fill="url(#hi-cap)" />
        <path d="M30 44 v22 c0 10 64 10 64 0 v-22 l-32 16 Z" fill="#202a30" />
        <path d="M112 36 v38" stroke="#f2b632" strokeWidth="3" />
        <path d="M105 74 h14 l-3 18 h-8 Z" fill="#f2b632" />
      </g>
      <g transform="translate(20 34) rotate(-10)">
        <rect width="58" height="58" rx="14" fill="#152a33" stroke="#2c4b57" />
        <g transform="translate(29 29)" fill="none" stroke="#61dafb" strokeWidth="2.4">
          <ellipse rx="19" ry="7.5" />
          <ellipse rx="19" ry="7.5" transform="rotate(60)" />
          <ellipse rx="19" ry="7.5" transform="rotate(120)" />
          <circle r="3.2" fill="#61dafb" stroke="none" />
        </g>
      </g>
      <g transform="translate(250 160) rotate(8)">
        <rect width="56" height="56" rx="14" fill="#1c2a3a" stroke="#2f4560" />
        <path d="M27 11c-8 0-8 4-8 6v5h9v2H15c-5 0-7 4-7 9s2 9 6 9h3v-6c0-4 3-7 7-7h9c4 0 6-3 6-6v-6c0-4-4-6-12-6z" fill="#3c78aa" />
        <path d="M29 45c8 0 8-4 8-6v-5h-9v-2h13c5 0 7-4 7-9s-2-9-6-9h-3v6c0 4-3 7-7 7h-9c-4 0-6 3-6 6v6c0 4 4 6 12 6z" fill="#f7cc3c" />
      </g>
      <path d="M150 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#3ee08f" opacity="0.8" />
      <path d="M232 236 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="#3ee08f" opacity="0.7" />
    </svg>
  )
}

/** Theory, code example, practice task and quiz for a lesson. */
function LessonMaterials({ t, lesson }: { t: (typeof translations)[Lang]; lesson: Course['lessons'][number] }) {
  const language = useLanguage()
  const [selected, setSelected] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const quiz = lesson.quiz
  const hasQuiz = Boolean(quiz && quiz.options.length > 0)
  const isCorrect = checked && selected === quiz?.answer

  return (
    <div className="lesson-materials">
      {lesson.theory && (
        <section className="detail-card lesson-material-card">
          <h3>{t.sections.theory}</h3>
          <p>{lesson.theory}</p>
        </section>
      )}
      {lesson.code && (
        <section className="detail-card lesson-material-card">
          <h3>{t.sections.codeExample}</h3>
          <pre className="lesson-code"><code>{lesson.code}</code></pre>
        </section>
      )}
      {lesson.task && (
        <section className="detail-card lesson-material-card">
          <h3>{t.sections.practice}</h3>
          <p>{lesson.task}</p>
        </section>
      )}
      {hasQuiz && (
        <section className="detail-card lesson-material-card">
          <h3>{language === 'ru' ? 'Тест' : language === 'kg' ? 'Тест' : 'Quiz'}</h3>
          <p className="lesson-quiz-prompt">{quiz.prompt[language] || quiz.prompt.ru}</p>
          <div className="lesson-quiz-options" role="radiogroup">
            {quiz.options.map((option, index) => (
              <button
                key={`${option}-${index}`}
                type="button"
                role="radio"
                aria-checked={selected === index}
                className={[
                  'lesson-quiz-option',
                  selected === index ? 'selected' : '',
                  checked && index === quiz.answer ? 'correct' : '',
                  checked && selected === index && index !== quiz.answer ? 'wrong' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => { setSelected(index); setChecked(false) }}
              >
                {option}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary small lesson-quiz-check" disabled={selected === null} onClick={() => setChecked(true)}>
            {t.sections.checkAnswer}
          </button>
          {checked && (
            <p className={isCorrect ? 'success-message' : 'error-message'} role="status">
              {isCorrect ? t.generic.correct : t.generic.tryAgain}
            </p>
          )}
        </section>
      )}
    </div>
  )
}

/** "My subscription" card on the dashboard — all values come from the backend. */
function SubscriptionPanel() {
  const language = useLanguage()
  const { plans, subscription, userEmail, refreshSubscription } = useBilling()
  const [history, setHistory] = useState<SubscriptionHistory | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const current = accessPlanOf(subscription)
  const plan = plans.find((item) => item.id === current) ?? bundledPlans[0]
  const raw = subscription.rawStatus ?? 'free'

  const loadHistory = useCallback(async () => {
    if (!userEmail) return
    try {
      setHistory(await getSubscriptionHistory(userEmail))
      setHistoryError(null)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : String(error))
    }
  }, [userEmail])

  useEffect(() => { void loadHistory() }, [loadHistory, subscription.endsAt, subscription.rawStatus])

  const cancel = async () => {
    if (!userEmail) return
    setBusy(true)
    try {
      await cancelServerSubscription(userEmail)
      await refreshSubscription()
      setNotice(pick(language, 'Жазылуу жокко чыгарылды. Мөөнөтү бүткөнчө колдоно бересиз.', 'Подписка отменена. Доступ сохранится до конца оплаченного срока.', 'Subscription cancelled. Access stays until the end of the paid period.'))
      setConfirmCancel(false)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const statusTone = raw === 'active' ? 'green' : raw === 'cancelled' ? 'gold' : raw === 'expired' ? 'danger' : 'neutral'

  return (
    <section className="detail-card subscription-panel" id="subscription" aria-label={pick(language, 'Менин жазылуум', 'Моя подписка', 'My subscription')}>
      <div className="card-header-row">
        <h3><Crown size={20} /> {pick(language, 'Менин жазылуум', 'Моя подписка', 'My subscription')}</h3>
        <Badge tone={statusTone}>{subscriptionStatusText(subscription, language)}</Badge>
      </div>

      <div className="subscription-panel-grid">
        <div className="subscription-panel-plan">
          <span className="plan-tag">{PLAN_META[current].name}</span>
          <strong>{plan.label[language]}</strong>
          {current !== 'free' && <span className="subscription-days"><b>{subscription.remainingDays ?? 0}</b> {pick(language, 'күн калды', 'дн. осталось', 'days left')}</span>}
        </div>
        <dl className="subscription-panel-dates">
          <div><dt>{pick(language, 'Сатып алынган күнү', 'Дата покупки', 'Purchased')}</dt><dd>{formatDateTime(subscription.purchasedAt, language, true)}</dd></div>
          <div><dt>{pick(language, 'Башталышы', 'Начало', 'Started')}</dt><dd>{current === 'free' ? '—' : formatDateTime(subscription.startedAt, language)}</dd></div>
          <div><dt>{pick(language, 'Бүтүшү', 'Действует до', 'Ends')}</dt><dd>{current === 'free' ? '—' : formatDateTime(subscription.endsAt, language)}</dd></div>
          {subscription.grantedByAdmin && <div><dt>{pick(language, 'Булак', 'Источник', 'Source')}</dt><dd>{pick(language, 'Администратор берген', 'Выдано администратором', 'Granted by administrator')}</dd></div>}
        </dl>
      </div>

      {subscription.pendingOrder && (
        <div className="checkout-pending-note" role="status">
          <Clock3 size={18} />
          <span>{pick(language, 'Бүтпөгөн төлөм бар', 'Есть незавершённая оплата', 'There is an unfinished payment')}: {PLAN_META[subscription.pendingOrder.planId]?.name} · {subscription.pendingOrder.amount} сом</span>
          <Link className="text-link" to={`/pricing/checkout/${subscription.pendingOrder.planId}?orderId=${encodeURIComponent(subscription.pendingOrder.orderId)}`}>{pick(language, 'Статусту көрүү', 'Посмотреть статус', 'View status')}</Link>
        </div>
      )}

      <div className="subscription-panel-features">
        <span>{pick(language, 'Сизге жеткиликтүү', 'Вам доступно', 'Available to you')}:</span>
        <ul>{plan.features[language].map((feature) => <li key={feature}><CheckCircle2 size={15} /> {feature}</li>)}</ul>
      </div>

      <div className="subscription-panel-actions">
        {current === 'free' && <ButtonLink to="/pricing" icon={Rocket}>{pick(language, 'Тариф тандоо', 'Выбрать тариф', 'Choose a plan')}</ButtonLink>}
        {current !== 'free' && <ButtonLink to={`/pricing/checkout/${current}`} icon={RefreshCw}>{pick(language, 'Узартуу', 'Продлить подписку', 'Renew')}</ButtonLink>}
        {current === 'pro' && <ButtonLink to="/pricing/checkout/aipro" variant="secondary" icon={Bot}>{pick(language, 'AI PRO тарифине өтүү', 'Перейти на AI PRO', 'Upgrade to AI PRO')}</ButtonLink>}
        {raw === 'active' && current !== 'free' && <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>{pick(language, 'Жазылууну жокко чыгаруу', 'Отменить подписку', 'Cancel subscription')}</Button>}
      </div>
      {notice && <p className="field-note" role="status">{notice}</p>}

      <details className="subscription-history">
        <summary>{pick(language, 'Жазылуу жана төлөм тарыхы', 'История подписки и платежей', 'Subscription & payment history')}</summary>
        {historyError && <p className="error-message">{historyError}</p>}
        {history && history.history.length === 0 && history.orders.length === 0 && <p className="field-note">{pick(language, 'Азырынча эч нерсе жок.', 'Пока ничего нет.', 'Nothing yet.')}</p>}
        {history && history.history.length > 0 && (
          <ul className="history-list">
            {history.history.map((item) => (
              <li key={item.id}>
                <span>{historyEventText(item.event, language)} · <b>{PLAN_META[item.planId]?.name ?? item.planId}</b>{item.amount ? ` · ${item.amount} сом` : ''}</span>
                <small>{formatDateTime(item.createdAt, language, true)}{item.endsAt ? ` → ${formatDateTime(item.endsAt, language)}` : ''}</small>
              </li>
            ))}
          </ul>
        )}
        {history && history.orders.length > 0 && (
          <>
            <h4>{pick(language, 'Төлөмдөр', 'Платежи', 'Payments')}</h4>
            <ul className="history-list">
              {history.orders.map((order) => (
                <li key={order.orderId}>
                  <span><b>{PLAN_META[order.planId]?.name ?? order.planId}</b> · {order.amount} сом · {order.paymentMethod} · {paymentStatusText(order.status, language)}</span>
                  <small>{formatDateTime(order.createdAt, language, true)}{order.transactionId ? ` · ID ${order.transactionId}` : ''}</small>
                </li>
              ))}
            </ul>
          </>
        )}
      </details>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        icon={X}
        title={pick(language, 'Жазылууну жокко чыгаруу керекпи?', 'Отменить подписку?', 'Cancel the subscription?')}
        actions={(
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(false)}>{pick(language, 'Жок', 'Нет', 'No')}</Button>
            <Button variant="danger" size="sm" disabled={busy} onClick={() => { void cancel() }}>{busy ? loadingLabel(language) : pick(language, 'Ооба, жокко чыгаруу', 'Да, отменить', 'Yes, cancel')}</Button>
          </>
        )}
      >
        <p>{pick(language, `Тариф ${formatDateTime(subscription.endsAt, language)} чейин иштей берет, андан кийин акысыз тарифке өтөсүз. Акча автоматтык түрдө кайтарылбайт.`, `Тариф продолжит работать до ${formatDateTime(subscription.endsAt, language)}, затем вы перейдёте на бесплатный. Деньги автоматически не возвращаются.`, `Your plan keeps working until ${formatDateTime(subscription.endsAt, language)}, then you move to the free plan. No automatic refund is made.`)}</p>
      </Modal>
    </section>
  )
}

function loadingLabel(language: Lang) {
  return translations[language].generic.loading
}

function SectionHeading({ title, eyebrow, subtitle }: { title: string; eyebrow?: string; subtitle?: string }) {
  return (
    <div className="section-heading">
      {eyebrow && <span className="eyebrow home-eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  )
}

export default App
