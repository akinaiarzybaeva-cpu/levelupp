// Shared types, translations, contexts and helpers used by App.tsx and the components in ./components.
// Moved here unchanged from App.tsx so components can be split into separate files without duplication.
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Lock, Rocket } from 'lucide-react'
import { Button, ButtonLink, Modal } from './components/ui'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchWithWakeRetry, withAuthHeaders } from './api'
import { courses as bundledCourses, toEmbedUrl, type Course } from './data'
import { canAccessAiAssistant, getDefaultSubscription, isSubscriptionExpired, type SubscriptionPlanId, type UserSubscription } from './subscriptionService'

export type Lang = 'kg' | 'ru' | 'en'
export type Theme = 'light' | 'dark'

export type UserProfile = {
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

export type NotificationSettings = {
  emailNotifications: boolean
  newCourses: boolean
  newLessons: boolean
  newsUpdates: boolean
}

export type UserProgress = {
  lessonsCompleted: string[]
  testsCompleted: number
  practiceCompleted: number
  coursesCompleted: string[]
  totalScore: number
  achievements: string[]
  lastUpdated: string
}

export type SiteStats = {
  students: number
  completion: number
  rating: number
  totalRatings: number
  startedCourses: number
  completedCourses: number
  loading: boolean
  updatedAt?: string
}

export type LeaderboardEntry = {
  id: string
  name: string
  avatar: string
  score: number
  courses: number
  achievements: string[]
  email: string
}

export type Review = { id: string; name: string; avatar: string; rating: number; text: string; date: string; isOwn?: boolean; userId?: string; lessonId?: string; lessonLabel?: string; createdAt?: number; updatedAt?: number }
export type Message = { id: string; role: 'assistant' | 'user'; text: string }

export const defaultNotificationSettings: NotificationSettings = {
  emailNotifications: true,
  newCourses: true,
  newLessons: true,
  newsUpdates: true
}

export const defaultReviews: Review[] = []

export const faqData = [
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

export const pricingPlans = [
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

export const translations = {
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

export function getStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const value = window.localStorage.getItem(key)
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return value as unknown as T
  }
}

export function setStoredValue<T>(key: string, value: T) {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value))
}

export const LAST_AUTH_EMAIL_KEY = 'levelup-last-auth-email'

export function getStoredLastAuthEmail() {
  if (typeof window === 'undefined') return ''
  return String(window.localStorage.getItem(LAST_AUTH_EMAIL_KEY) ?? '').trim().toLowerCase()
}

export function setStoredLastAuthEmail(value?: string | null) {
  if (typeof window === 'undefined') return
  const email = String(value ?? '').trim().toLowerCase()
  if (!email) return
  window.localStorage.setItem(LAST_AUTH_EMAIL_KEY, email)
}

export function resolveSafeNextPath(value?: string | null, fallback = '/courses') {
  const normalized = String(value ?? '').trim()
  if (!normalized || !normalized.startsWith('/') || normalized.startsWith('//')) return fallback
  return normalized
}

export function appendFromParam(targetPath: string, fromPath: string) {
  const safeTarget = resolveSafeNextPath(targetPath, '/courses')
  const safeFrom = resolveSafeNextPath(fromPath, '/courses')
  const [pathOnly, query = ''] = safeTarget.split('?')
  const params = new URLSearchParams(query)
  params.set('from', safeFrom)
  const nextQuery = params.toString()
  return nextQuery ? `${pathOnly}?${nextQuery}` : pathOnly
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  // Identity is proven only by the bearer session token.
  const response = await fetchWithWakeRetry(url, { ...init, headers: withAuthHeaders(init?.headers) })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed')
  }

  return payload as T
}
export function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value)
}

export function AnimatedMetric({ value, formatter, loading, fallback = '—' }: { value: number; formatter: (value: number) => string; loading: boolean; fallback?: string }) {
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

export function SmartBackButton({ fallback, label, className = 'btn btn-secondary small' }: { fallback: string; label?: string; className?: string }) {
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

export function normalizeRole(value?: string | null): 'Admin' | 'User' | 'Student' {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'admin' || raw === 'administrator' || raw === 'superadmin') return 'Admin'
  if (raw === 'student' || raw === 'user') return raw === 'student' ? 'Student' : 'User'
  return 'User'
}

export function isAdminRole(value?: string | null): boolean {
  return normalizeRole(value) === 'Admin' || String(value ?? '').trim().toLowerCase() === 'admin'
}

export function sanitizeReviews(value: Review[]) {
  const legacyIds = new Set(['r1', 'r2', 'r3'])
  if (Array.isArray(value) && value.some((item) => legacyIds.has(item.id) && !item.userId)) return []
  return Array.isArray(value) ? value : []
}

export function buildReviewLessonOptions(courses: Course[]) {
  return courses.flatMap((course) =>
    course.lessons.map((lesson) => ({
      id: lesson.id,
      label: `${course.title.ru} — ${lesson.title.ru}`
    }))
  )
}

export function createEmptyProgress(): UserProgress {
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

export function formatReviewDate(value: string | undefined, language: Lang): string {
  if (!value) return language === 'ru' ? 'только что' : language === 'kg' ? 'азыр' : 'just now'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(language === 'kg' ? 'ky-KG' : language === 'ru' ? 'ru-RU' : 'en-US')
}

export function renderAvatarContent(value?: string, fallback = 'U') {
  if (!value || !value.trim()) return fallback

  const trimmed = value.trim()
  const isImageValue = trimmed.startsWith('data:image') || trimmed.startsWith('http') || trimmed.startsWith('/')
  if (isImageValue) {
    return <img src={trimmed} alt="User avatar" className="profile-avatar-image" />
  }

  return trimmed.charAt(0).toUpperCase() || fallback
}

export function buildLeaderboard(users: UserProfile[], progressMap: Record<string, UserProgress>): LeaderboardEntry[] {
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

export function getCurrentUserProgress(user: UserProfile | null) {
  if (!user) return createEmptyProgress()
  return getStoredValue<Record<string, UserProgress>>('levelup-progress', {})[user.email] ?? createEmptyProgress()
}

// ─── Language context ─────────────────────────────────────────────────────────
// Components read the active language from React state (via context) so that every
// page re-renders in the new language immediately when it is switched.
export const LanguageContext = createContext<Lang>('ru')
/** Lets deep components (admin panel, admin login) change the site language without prop drilling. */
export const LanguageSetterContext = createContext<(language: Lang) => void>(() => {})

export function useLanguage(): Lang {
  return useContext(LanguageContext)
}

/** Picks the KG/RU/EN variant of a short UI string. */
export function pick(language: Lang, kg: string, ru: string, en: string): string {
  return language === 'kg' ? kg : language === 'ru' ? ru : en
}

export function levelLabel(level: string, language: Lang): string {
  if (level === 'Beginner') return pick(language, 'Башталгыч', 'Начальный', 'Beginner')
  if (level === 'Intermediate') return pick(language, 'Орто', 'Средний', 'Intermediate')
  if (level === 'Advanced') return pick(language, 'Жогорку', 'Продвинутый', 'Advanced')
  return level
}

export function normalizeLanguage(value: unknown): Lang {
  return value === 'kg' || value === 'ru' || value === 'en' ? value : 'ru'
}

export function normalizeTheme(value: unknown): Theme {
  return value === 'dark' ? 'dark' : 'light'
}

// ─── Course catalog context ──────────────────────────────────────────────────
// The catalog starts from the bundled course data (instant first paint / offline
// fallback) and is replaced by the published courses from the backend database, so
// changes made in the admin panel appear on the site.
export type CourseCatalog = { courses: Course[]; courseIndex: Record<string, Course> }

export function buildCourseCatalog(list: Course[]): CourseCatalog {
  return { courses: list, courseIndex: Object.fromEntries(list.map((course) => [course.id, course])) as Record<string, Course> }
}

export const CourseCatalogContext = createContext<CourseCatalog>(buildCourseCatalog(bundledCourses))

export function useCourseCatalog(): CourseCatalog {
  return useContext(CourseCatalogContext)
}

export type ApiLangText = { kg?: string | null; ru?: string | null; en?: string | null }
export type ApiCourseLesson = { id: string; title: ApiLangText; duration?: string; type?: string; theory?: string; code?: string; task?: string; videoUrl?: string; quiz?: { prompt?: ApiLangText; options?: string[]; answer?: number }; locked?: boolean }
export type ApiCourse = Omit<Course, 'title' | 'description' | 'lessons' | 'level'> & { title: ApiLangText; description: ApiLangText; level: string; lessons: ApiCourseLesson[] }

// ─── Plans & subscription (shared by pricing, checkout, dashboard, lessons) ────

export type PlanView = {
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
export const bundledPlans: PlanView[] = pricingPlans.map((plan) => ({
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

export const PLAN_RANK: Record<SubscriptionPlanId, number> = { free: 0, pro: 1, aipro: 2 }
/** Lessons per course without a paid plan (the backend applies the same limits). */
export const GUEST_LESSON_LIMIT = 1
export const FREE_LESSON_LIMIT = 3

export type BillingState = {
  plans: PlanView[]
  subscription: UserSubscription
  isLoggedIn: boolean
  isAdmin: boolean
  userEmail: string | null
  userName?: string | null
  refreshSubscription: () => Promise<UserSubscription | null>
}

export const BillingContext = createContext<BillingState>({
  plans: bundledPlans,
  subscription: getDefaultSubscription('free'),
  isLoggedIn: false,
  isAdmin: false,
  userEmail: null,
  userName: null,
  refreshSubscription: async () => null
})

export function useBilling(): BillingState {
  return useContext(BillingContext)
}

/** The plan whose features can be used now. Only data confirmed by the server unlocks paid features. */
export function accessPlanOf(subscription?: UserSubscription | null): SubscriptionPlanId {
  if (!subscription?.synced) return 'free'
  return subscription.accessPlan ?? 'free'
}

/** How many lessons of each course the viewer may open (Infinity = all). */
export function useLessonLimit(): number {
  const { isLoggedIn, isAdmin, subscription } = useBilling()
  if (isAdmin) return Infinity
  if (!isLoggedIn) return GUEST_LESSON_LIMIT
  return PLAN_RANK[accessPlanOf(subscription)] >= PLAN_RANK.pro ? Infinity : FREE_LESSON_LIMIT
}

export function planPeriodLabel(plan: PlanView, language: Lang, t: (typeof translations)[Lang]) {
  return plan.durationDays === 30 ? t.subscription.monthly : pick(language, `${plan.durationDays} күн`, `${plan.durationDays} дней`, `${plan.durationDays} days`)
}

export function formatDateTime(value: string | null | undefined, language: Lang, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const locale = language === 'kg' ? 'ky-KG' : language === 'ru' ? 'ru-RU' : 'en-US'
  return withTime ? date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : date.toLocaleDateString(locale, { dateStyle: 'medium' })
}

export function subscriptionStatusText(subscription: UserSubscription, language: Lang) {
  const raw = subscription.rawStatus ?? 'free'
  if (raw === 'free') return pick(language, 'Акысыз тариф', 'Бесплатный тариф', 'Free plan')
  if (raw === 'cancelled') return pick(language, 'Жокко чыгарылды — мөөнөтү бүткөнчө иштейт', 'Отменена — действует до конца срока', 'Cancelled — active until the end date')
  if (raw === 'expired') return pick(language, 'Мөөнөтү бүттү', 'Истекла', 'Expired')
  return pick(language, 'Активдүү', 'Активна', 'Active')
}

export function paymentStatusText(status: string, language: Lang) {
  switch (status) {
    case 'paid': return pick(language, 'Төлөндү', 'Оплачен', 'Paid')
    case 'pending': return pick(language, 'Күтүлүүдө', 'Ожидает оплаты', 'Pending')
    case 'failed': return pick(language, 'Ийгиликсиз', 'Ошибка оплаты', 'Failed')
    case 'cancelled': return pick(language, 'Жокко чыгарылды', 'Отменён', 'Cancelled')
    default: return status
  }
}

export function historyEventText(event: string, language: Lang) {
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
export function UpgradeRequiredModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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

export function toLangText(value: ApiLangText | undefined): { kg: string; ru: string; en: string } {
  const ru = String(value?.ru ?? '').trim()
  const en = String(value?.en ?? '').trim() || ru
  const kg = String(value?.kg ?? '').trim() || ru
  return { kg, ru: ru || en, en }
}

export function mapApiCourse(apiCourse: ApiCourse): Course {
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

export function hasActiveAiAccess(subscription?: UserSubscription | null) {
  if (!subscription) return false
  if (!canAccessAiAssistant(subscription.planId)) return false
  if (subscription.status !== 'active') return false
  return !isSubscriptionExpired(subscription)
}
