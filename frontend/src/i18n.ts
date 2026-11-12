import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

const getStoredLanguage = () => {
  if (typeof window === 'undefined') return 'ru'

  const raw = window.localStorage.getItem('levelup-language') ?? 'ru'
  try {
    const parsed = JSON.parse(raw)
    if (parsed === 'kg' || parsed === 'ru' || parsed === 'en') return parsed
  } catch {
    // fall through to raw validation
  }

  if (raw === 'kg' || raw === 'ru' || raw === 'en') return raw
  return 'ru'
}

export const translations = {
  kg: {
    nav: { home: 'Башкы бет', courses: 'Курстар', rating: 'Рейтинг', reviews: 'Пикирлер', pricing: 'Тарифтер', faq: 'Көп берилүүчү суроолор' },
    buttons: { login: 'Кирүү', signup: 'Катталуу', start: 'Окууну баштоо', coursesBtn: 'Курстарды көрүү', learnMore: 'Кененирээк', continue: 'Окууну улантуу', nextLesson: 'Келеси сабақ', begin: 'Курс баштоо', choosePlan: 'Тариф тандоо', send: 'Жөнөтүү', save: 'Сактоо', buy: 'Сатып алуу' },
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
    catalog: { search: 'Курстарды издөө', category: 'Категория', level: 'Деңгээл', sort: 'Сорттоо', all: 'Баары', filter: 'Фильтр' },
    ai: { title: 'AI Assistant', placeholder: 'Сурагыңызды жазыңыз...', offline: 'AI API бапталмаған. Реалдуу backend байланышты түзүңүз.', ready: 'AI жооп даяр', inputLabel: 'Сурак', blocked: 'AI Assistant колдонуу үчүн ылайыктуу тарифти кошуңуз', connectPlan: 'Тариф кошуу', newChat: 'Жаңы чат', generating: 'Жооп түзүлүүдө...', welcome: 'Салам! Сурооңузду жазыңыз, жардам берем.' },
    generic: { search: 'Издөө', loading: 'Жүктөлүүдө...', success: 'Ийгилик', error: 'Ката', days: 'күн', members: 'окуучу', rating: 'Рейтинг', continue: 'Улантуу', open: 'Ачуу', done: 'Аякталды', lesson: 'Сабак', lessons: 'Сабактар', student: 'Окуучу', students: 'Окуучулар' },
    homeStats: { completion: 'Аякталышы', students: 'Окуучулар', rating: 'Рейтинг' },
    sections: { whyUs: 'Эмне үчүн бизди тандашат?', howStart: 'Кантип окууну баштоо керек?', studentRankings: 'Студенттердин рейтинги', studentReviews: 'Студенттердин пикирлери', choosePlan: 'Өзүңө ылайыктуу тарифти тандоо', courseProgram: 'Курска программанын мазмуну', whatLearn: 'Эмне үйрөнөсүз', lessonNav: 'Сабактарды навигациялоо', open: 'Ачуу', done: 'Аякталды', doneShort: 'Аякталды', theory: 'Теория', codeExample: 'Код мисалы', practice: 'Практикалык тапшырма', checkAnswer: 'Жоопту текшерүү', next: 'Келеси', previous: 'Мурунку', choosePlanShort: 'Тариф тандоо', leaveReview: 'Пикир калтыруу', averageRating: 'Орточо рейтинг' },
    forms: { fullName: 'Толук аты', cardholder: 'Картаны ээсинин аты', cardNumber: 'Карточка номери', expiry: 'Жарамдуулук мөөнөтү', cvc: 'CVC', selectedPlan: 'Тандалган тариф', passwordReset: 'Парольду калыбына келтирүү' },
    messages: { loginRequired: 'Пикир калтыруу үчүн кирүү керек', invalidAuth: 'Форманы туура толтуруңуз', demoCredentials: 'Demo аккаунт: aisha@levelup.kg / demo123', resetLinkSent: 'Парольду калыбына келтирүү үчүн электрондук почта жөнөтүлдү', subscriptionActivated: 'Подписка ийгиликтүү иштетилди' },
    pricing: { free: 'Бесплатно', pro: 'PRO', aiPro: 'AI PRO', monthly: '/ай', checkout: 'Төлөм', addToCart: 'Тариф тандоо' },
    languageNames: { kg: 'Кыргызча', ru: 'Русский', en: 'English' }
  },
  ru: {
    nav: { home: 'Главная', courses: 'Курсы', rating: 'Рейтинг', reviews: 'Отзывы', pricing: 'Тарифы', faq: 'Часто задаваемые вопросы' },
    buttons: { login: 'Войти', signup: 'Регистрация', start: 'Начать обучение', coursesBtn: 'Посмотреть курсы', learnMore: 'Подробнее', continue: 'Продолжить обучение', nextLesson: 'Следующий урок', begin: 'Начать курс', choosePlan: 'Выбрать тариф', send: 'Отправить', save: 'Сохранить', buy: 'Купить' },
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
    catalog: { search: 'Поиск курсов', category: 'Категория', level: 'Уровень', sort: 'Сортировка', all: 'Все', filter: 'Фильтр' },
    ai: { title: 'AI Assistant', placeholder: 'Напишите ваш вопрос...', offline: 'AI API не настроен. Подключите реальный backend.', ready: 'Ответ AI готов', inputLabel: 'Вопрос', blocked: 'Для использования AI Assistant подключите соответствующий тариф', connectPlan: 'Подключить тариф', newChat: 'Новый чат', generating: 'Генерация ответа...', welcome: 'Здравствуйте! Напишите вопрос, и я помогу.' },
    generic: { search: 'Поиск', loading: 'Загрузка...', success: 'Успешно', error: 'Ошибка', days: 'дней', members: 'учеников', rating: 'Рейтинг', continue: 'Продолжить', open: 'Открыть', done: 'Готово', lesson: 'Урок', lessons: 'Уроки', student: 'Студент', students: 'Студенты' },
    homeStats: { completion: 'Прохождение', students: 'Студенты', rating: 'Рейтинг' },
    sections: { whyUs: 'Почему выбирают нас?', howStart: 'Как начать обучение?', studentRankings: 'Рейтинг студентов', studentReviews: 'Отзывы студентов', choosePlan: 'Выбери подходящий тариф', courseProgram: 'Программа курса', whatLearn: 'Что вы узнаете', lessonNav: 'Навигация по урокам', open: 'Открыть', done: 'Готово', doneShort: 'Готово', theory: 'Теория', codeExample: 'Пример кода', practice: 'Практическое задание', checkAnswer: 'Проверить ответ', next: 'Следующий', previous: 'Предыдущий', choosePlanShort: 'Выбрать тариф', leaveReview: 'Оставить отзыв', averageRating: 'Средний рейтинг' },
    forms: { fullName: 'Полное имя', cardholder: 'Владелец карты', cardNumber: 'Номер карты', expiry: 'Срок действия', cvc: 'CVC', selectedPlan: 'Выбранный тариф', passwordReset: 'Сброс пароля' },
    messages: { loginRequired: 'Нужно войти, чтобы оставить отзыв', invalidAuth: 'Заполните форму корректно', demoCredentials: 'Демо-аккаунт: aisha@levelup.kg / demo123', resetLinkSent: 'Ссылка для сброса пароля отправлена на вашу почту', subscriptionActivated: 'Подписка успешно активирована' },
    pricing: { free: 'Бесплатно', pro: 'PRO', aiPro: 'AI PRO', monthly: '/мес', checkout: 'Оплата', addToCart: 'Выбрать тариф' },
    languageNames: { kg: 'Кыргызча', ru: 'Русский', en: 'English' }
  },
  en: {
    nav: { home: 'Home', courses: 'Courses', rating: 'Leaderboard', reviews: 'Reviews', pricing: 'Pricing', faq: 'FAQ' },
    buttons: { login: 'Log in', signup: 'Sign up', start: 'Start learning', coursesBtn: 'Explore courses', learnMore: 'Learn more', continue: 'Continue learning', nextLesson: 'Next lesson', begin: 'Start course', choosePlan: 'Choose plan', send: 'Send', save: 'Save', buy: 'Purchase' },
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
    catalog: { search: 'Search courses', category: 'Category', level: 'Level', sort: 'Sort', all: 'All', filter: 'Filter' },
    ai: { title: 'AI Assistant', placeholder: 'Type your question...', offline: 'AI API is not configured. Connect a real backend.', ready: 'AI response ready', inputLabel: 'Question', blocked: 'To use AI Assistant, connect a compatible plan', connectPlan: 'Upgrade plan', newChat: 'New chat', generating: 'Generating response...', welcome: 'Hi! Send your question and I will help.' },
    generic: { search: 'Search', loading: 'Loading...', success: 'Success', error: 'Error', days: 'days', members: 'students', rating: 'Rating', continue: 'Continue', open: 'Open', done: 'Done', lesson: 'Lesson', lessons: 'Lessons', student: 'Student', students: 'Students' },
    homeStats: { completion: 'Completion', students: 'Students', rating: 'Rating' },
    sections: { whyUs: 'Why choose us?', howStart: 'How to start learning?', studentRankings: 'Student leaderboard', studentReviews: 'Student reviews', choosePlan: 'Choose the right plan for you', courseProgram: 'Course program', whatLearn: 'What you will learn', lessonNav: 'Lesson navigation', open: 'Open', done: 'Done', doneShort: 'Done', theory: 'Theory', codeExample: 'Code example', practice: 'Practice task', checkAnswer: 'Check answer', next: 'Next', previous: 'Previous', choosePlanShort: 'Choose plan', leaveReview: 'Leave a review', averageRating: 'Average rating' },
    forms: { fullName: 'Full name', cardholder: 'Cardholder name', cardNumber: 'Card number', expiry: 'Expiry date', cvc: 'CVC', selectedPlan: 'Selected plan', passwordReset: 'Reset password' },
    messages: { loginRequired: 'You need to log in to leave a review', invalidAuth: 'Please complete the form correctly', demoCredentials: 'Demo account: aisha@levelup.kg / demo123', resetLinkSent: 'A password reset link has been sent to your email', subscriptionActivated: 'Subscription activated successfully' },
    pricing: { free: 'Free', pro: 'PRO', aiPro: 'AI PRO', monthly: '/mo', checkout: 'Checkout', addToCart: 'Choose plan' },
    languageNames: { kg: 'Кыргызча', ru: 'Русский', en: 'English' }
  }
} as const

const resources = {
  kg: { translation: translations.kg },
  ru: { translation: translations.ru },
  en: { translation: translations.en }
}

i18next
  .use(initReactI18next)
  .init({
    resources,
    lng: getStoredLanguage(),
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
    defaultNS: 'translation',
    ns: ['translation']
  })

export default i18next
