export type LangText = {
  kg: string
  ru: string
  en: string
}

export type QuizQuestion = {
  prompt: LangText
  options: string[]
  answer: number
}

export type Lesson = {
  id: string
  title: LangText
  duration: string
  type: string
  theory: string
  code: string
  task: string
  videoUrl: string
  quiz: QuizQuestion
}

export type Course = {
  id: string
  badge: string
  title: LangText
  description: LangText
  category: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  rating: number
  students: string
  duration: string
  lessonsCount: number
  color: string
  accent: string
  tags: string[]
  outline: string[]
  lessons: Lesson[]
}

const toEmbedUrl = (url: string) => {
  const videoId = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/)?.[1]
  if (!videoId) return url
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`
}

const lessonVideoLibrary = {
  html: [
    'https://youtu.be/yE4Rlp0OeVc',
    'https://youtu.be/-MY61d175_o',
    'https://youtu.be/aDGJ3St-jqU',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc',
    'https://youtu.be/ny-ouhU-cCc'
  ],
  css: [
    'https://youtu.be/hft4XYApT44',
    'https://youtu.be/DX9ITfNVM7I',
    'https://youtu.be/LQxx5Z9XEdM',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4',
    'https://youtu.be/nZHrCDJEnw4'
  ],
  javascript: [
    'https://youtu.be/tR_UdpCy4LQ',
    'https://youtu.be/QhK6hU0CBe0',
    'https://youtu.be/_kS7sNAaBC8',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y',
    'https://youtu.be/OLn2xxOF51Y'
  ],
  ai: [
    'https://youtu.be/3mvbRsOxzGY',
    'https://youtu.be/xu1XcCbT3fQ',
    'https://youtu.be/TxYPwVH6m_E',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE',
    'https://youtu.be/h8EtZPG_BVE'
  ],
  english: [
    'https://youtu.be/_dVF0SXgs0w',
    'https://youtu.be/fvbl1y2C4bg',
    'https://youtu.be/ro74ZX-bs1I',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA',
    'https://youtu.be/1WWGgvkY2IA'
  ],
  physics: [
    'https://youtu.be/2JGbRnJfG0g',
    'https://youtu.be/Ioaq97Jp10Q',
    'https://youtu.be/E-Hps8rwGDY',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk'
  ],
  webdesign: [
    'https://youtu.be/kkThgsC1tnk',
    'https://youtu.be/pMTl6hj6Jlk',
    'https://youtu.be/lPsoouVUnYU',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08',
    'https://youtu.be/untWeLiHo08'
  ],
  math: [
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk',
    'https://youtu.be/8sHSZK0MDsk'
  ]
} as const

const lessonNames = {
  html: {
    kg: [
      'Сайт құрылымы', 'HTML тегтер', 'Медиа және суреттер', 'Ақпараттық формалар', 'Кестелер', 'HTML5 құрылымы', 'Архивтелмелер', 'Семантикалық HTML', 'Сілтемелер', 'Медиафайлы', 'Аудио және видеолар', 'Навигация', 'Формалар', 'Терезелер', 'Семантикалық элементтер', 'Структуралың төлөв', 'Фреймдер', 'API және атрибуттар', 'Жұмысқа негіз', 'HTML проекті'
    ],
    ru: [
      'Структура сайта', 'Теги HTML', 'Медиа и изображения', 'Формы данных', 'Таблицы', 'Структура HTML5', 'Списки', 'Семантический HTML', 'Ссылки', 'Медиафайлы', 'Аудио и видео', 'Навигация', 'Формы', 'Валидация', 'Семантические элементы', 'Структурные паттерны', 'Фреймы', 'API и атрибуты', 'Практика', 'Проект HTML'
    ],
    en: [
      'Website structure', 'HTML tags', 'Media and images', 'Form fields', 'Tables', 'HTML5 structure', 'Lists', 'Semantic HTML', 'Links', 'Media files', 'Audio and video', 'Navigation', 'Forms', 'Validation', 'Semantic elements', 'Structure patterns', 'Frames', 'API and attributes', 'Practice', 'HTML project'
    ]
  },
  css: {
    kg: [
      'CSS негіздері', 'Селекторлар', 'Өлшемдер', 'Түс схемасы', 'Өлшем және_PADDING', 'Фоны', 'Позициялау', 'Flexbox', 'Grid', 'Responsive дизайн', 'Типография', 'Анимациялар', 'Трансформация', 'Медиа сұраныстар', 'Карта және навигация', 'Кнопкалар', 'Карталар', 'Модульдер', 'Дизайн жүйе', 'CSS проекті'
    ],
    ru: [
      'Основы CSS', 'Селекторы', 'Размеры', 'Цвета', 'Отступы и поля', 'Фон', 'Позиционирование', 'Flexbox', 'Grid', 'Адаптивный дизайн', 'Типография', 'Анимации', 'Трансформации', 'Медиа-запросы', 'Карточки и навигация', 'Кнопки', 'Изображения', 'Модели компонентов', 'Дизайн-система', 'Проект CSS'
    ],
    en: [
      'CSS basics', 'Selectors', 'Sizes', 'Color system', 'Spacing', 'Backgrounds', 'Positioning', 'Flexbox', 'Grid', 'Responsive design', 'Typography', 'Animations', 'Transforms', 'Media queries', 'Cards and navigation', 'Buttons', 'Images', 'Component patterns', 'Design system', 'CSS project'
    ]
  },
  javascript: {
    kg: [
      'JavaScript негіздері', 'Айнымалылар', 'Массивтер', 'Нысандар', 'Функциялар', 'Шарттар', 'Loops', 'DOM', 'Элементтер', 'Events', 'Form validation', 'Promises', 'Async/await', 'Modules', 'Data fetching', 'Storage', 'OOP basics', 'ES6 features', 'Project', 'Advanced app'
    ],
    ru: [
      'Основы JavaScript', 'Переменные', 'Массивы', 'Объекты', 'Функции', 'Условия', 'Циклы', 'DOM', 'Элементы', 'События', 'Валидация форм', 'Promise', 'Async/await', 'Модули', 'Запросы', 'Хранилище', 'ООП', 'ES6', 'Проект', 'Продвинутый проект'
    ],
    en: [
      'JavaScript basics', 'Variables', 'Arrays', 'Objects', 'Functions', 'Conditions', 'Loops', 'DOM', 'Elements', 'Events', 'Form validation', 'Promises', 'Async/await', 'Modules', 'Fetching data', 'Storage', 'OOP basics', 'ES6 features', 'Project', 'Advanced app'
    ]
  },
  ai: {
    kg: [
      'ИИге кіріспе', 'Машиналық оқыту', 'Жасанды нейрондар', 'Prompt engineering', 'Модельдердің типтері', 'Деректерді өңдеу', 'Терминилер', 'ИИ көмегі', 'Генеративті ИИ', 'Этика', 'Автоматизация', 'Код талдау', 'Диалогтар', 'Рекомендациялар', 'Модель бағалау', 'AI жобасы', 'Лаборатория', 'Пайдалану сценарийлері', 'Нәтиже', 'AI проект'
    ],
    ru: [
      'Введение в ИИ', 'Машинное обучение', 'Нейросети', 'Промпт-инжиниринг', 'Типы моделей', 'Обработка данных', 'Основные термины', 'Помощь ИИ', 'Генеративный ИИ', 'Этика', 'Автоматизация', 'Анализ кода', 'Диалоги', 'Рекомендации', 'Оценка моделей', 'AI-проект', 'Лаборатория', 'Сценарии использования', 'Итоги', 'Проект AI'
    ],
    en: [
      'AI introduction', 'Machine learning', 'Neural networks', 'Prompt engineering', 'Model types', 'Data processing', 'Core terms', 'AI assistance', 'Generative AI', 'Ethics', 'Automation', 'Code review', 'Dialogues', 'Recommendations', 'Model evaluation', 'AI project', 'Lab sessions', 'Use cases', 'Wrap up', 'AI project'
    ]
  },
  english: {
    kg: [
      'Негізгі сөздік', 'Сәлемдесу', 'Күнделікті сұхбат', 'Өмірлік тақырыптар', 'Сөйлеу дағдылары', 'Лексика', 'Грамматика', 'Сөйлеу мәдениеті', 'Жазу дағдылары', 'Тыңдау', 'Мәтін оқу', 'Диалог', 'Сұрақ қою', 'Жауап беру', 'Тіл үйрену', 'Өткінші жағдай', 'Тақырыптар', 'Білікті сөйлеу', 'Практика', 'Английский проект'
    ],
    ru: [
      'Основы языка', 'Приветствия', 'Повседневные диалоги', 'Бытовые темы', 'Говорение', 'Лексика', 'Грамматика', 'Разговорный стиль', 'Письмо', 'Аудирование', 'Чтение', 'Диалог', 'Вопросы', 'Ответы', 'Изучение языка', 'Ролевая практика', 'Темы общения', 'Свободное говорение', 'Практика', 'Проект по английскому'
    ],
    en: [
      'English basics', 'Greetings', 'Daily conversations', 'Everyday topics', 'Speaking skills', 'Vocabulary', 'Grammar', 'Conversation flow', 'Writing', 'Listening', 'Reading', 'Dialogues', 'Questions', 'Answers', 'Language learning', 'Role play', 'Talk topics', 'Fluent speaking', 'Practice', 'English project'
    ]
  },
  math: {
    kg: [
      'Сандар әлемі', 'Функциялар', 'Логика', 'Алгебра', 'Графиктер', 'Статистика', 'Вероятность', 'Процент', 'Модельдеу', 'Теңдеулер', 'Деректер', 'Жиындар', 'Комбинаторика', 'Рекурсия', 'Қайталанулар', 'Математикалық дәлел', 'Прогрессия', 'Сериялар', 'Қарапайым есептер', 'Математика проекті'
    ],
    ru: [
      'Мир чисел', 'Функции', 'Логика', 'Алгебра', 'Графики', 'Статистика', 'Вероятность', 'Проценты', 'Моделирование', 'Уравнения', 'Данные', 'Множества', 'Комбинаторика', 'Рекурсия', 'Последовательности', 'Математическое доказательство', 'Прогрессии', 'Ряды', 'Задачи', 'Проект по математике'
    ],
    en: [
      'World of numbers', 'Functions', 'Logic', 'Algebra', 'Graphs', 'Statistics', 'Probability', 'Percentages', 'Modeling', 'Equations', 'Data', 'Sets', 'Combinatorics', 'Recursion', 'Sequences', 'Proofs', 'Progressions', 'Series', 'Practice', 'Math project'
    ]
  },
  physics: {
    kg: [
      'Физикаға кіріспе', 'Қозғалыс', 'Күштер', 'Энергия', 'Жұмыс', 'Температура', 'Электр', 'Магнетизм', 'Толқындар', 'Оптика', 'Атом', 'Механика', 'Ғылыми өлшеу', 'Динамика', 'Станция', 'Заттың күйі', 'Молекулалар', 'Сұйықтар', 'Атомдық құрылым', 'Физика проекті'
    ],
    ru: [
      'Введение в физику', 'Движение', 'Силы', 'Энергия', 'Работа', 'Температура', 'Электричество', 'Магнетизм', 'Волны', 'Оптика', 'Атом', 'Механика', 'Измерения', 'Динамика', 'Состояние вещества', 'Молекулы', 'Жидкости', 'Атомные структуры', 'Заключение', 'Проект по физике'
    ],
    en: [
      'Physics basics', 'Motion', 'Forces', 'Energy', 'Work', 'Temperature', 'Electricity', 'Magnetism', 'Waves', 'Optics', 'Atoms', 'Mechanics', 'Measurements', 'Dynamics', 'States of matter', 'Molecules', 'Fluids', 'Atomic structures', 'Review', 'Physics project'
    ]
  },
  webdesign: {
    kg: [
      'Дизайн негіздері', 'Визуалды иерархия', 'Түс теориясы', 'Макет', 'Типография', 'Медиа', 'Шрифт және көлемдер', 'Басқару элементтері', 'Навигация', 'Карточкалар', 'Форма стилі', 'Түсті палитра', 'Анимациялар', 'Кнопкалар', 'Лайаут', 'Мобильді дизайн', 'Темалар', 'Сайт композициясы', 'Жұмыс тәжірибесі', 'Web design проекті'
    ],
    ru: [
      'Основы дизайна', 'Визуальная иерархия', 'Цветовая теория', 'Макет', 'Типография', 'Медиа', 'Шрифты и размеры', 'Элементы управления', 'Навигация', 'Карточки', 'Стили форм', 'Палитра', 'Анимации', 'Кнопки', 'Композиция', 'Мобильный дизайн', 'Темы', 'Сеточная система', 'Практика', 'Проект по веб-дизайну'
    ],
    en: [
      'Design basics', 'Visual hierarchy', 'Color theory', 'Layout', 'Typography', 'Media', 'Fonts and spacing', 'Controls', 'Navigation', 'Cards', 'Form styling', 'Palette', 'Animations', 'Buttons', 'Composition', 'Mobile design', 'Themes', 'Grid system', 'Practice', 'Web design project'
    ]
  }
} as const

const makeLessons = (courseKey: keyof typeof lessonNames) => {
  const names = lessonNames[courseKey]
  const urls = lessonVideoLibrary[courseKey] ?? Array.from({ length: names.kg.length }, () => 'https://youtu.be/OLn2xxOF51Y')

  return names.kg.map((_, index) => ({
    id: `${courseKey}-lesson-${index + 1}`,
    title: {
      kg: `Сабақ ${index + 1}. ${names.kg[index]}`,
      ru: `Урок ${index + 1}. ${names.ru[index]}`,
      en: `Lesson ${index + 1}. ${names.en[index]}`
    },
    duration: `${35 + ((index * 13) % 28)} мин`,
    type: index % 3 === 0 ? 'Видео + практика' : 'Видеоурок',
    theory: `Изучаем ключевую тему урока ${index + 1} и закрепляем практическое понимание на примерах из реального проекта.`,
    code: `const lesson${index + 1} = () => {\n  const result = 'Урок ${index + 1} готов';\n  console.log(result);\n  return result;\n};`,
    task: `Выполни практическое задание для урока ${index + 1} и проверь результат на примере проекта.`,
    videoUrl: toEmbedUrl(urls[index] ?? urls[urls.length - 1]),
    quiz: {
      prompt: {
        kg: 'Правильный ответ на вопрос урока?',
        ru: 'Какой ответ на вопрос урока?',
        en: 'What is the correct answer to this lesson question?'
      },
      options: ['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D'],
      answer: (index + 1) % 4
    }
  }))
}

export const courses: Course[] = [
  {
    id: 'html',
    badge: 'Web',
    title: { kg: 'HTML', ru: 'HTML', en: 'HTML' },
    description: {
      kg: 'Веб-структура, семантика, формы және современные HTML практикалары.',
      ru: 'Структура веб-сайтов, семантика, формы и практики современного HTML.',
      en: 'Build website structure, semantics, forms, and modern HTML practices.'
    },
    category: 'Frontend',
    level: 'Beginner',
    rating: 4.9,
    students: '18.4K',
    duration: '6 недель',
    lessonsCount: 20,
    color: '#ffefeb',
    accent: '#f97316',
    tags: ['HTML5', 'Semantic', 'Forms'],
    outline: ['Структура документа', 'Теги и атрибуты', 'Семантика', 'Формы и доступность'],
    lessons: makeLessons('html')
  },
  {
    id: 'css',
    badge: 'Design',
    title: { kg: 'CSS', ru: 'CSS', en: 'CSS' },
    description: {
      kg: 'Дизайн, визуализация, адаптивность және стиль UI.',
      ru: 'Дизайн, визуализация, адаптивность и стилизация интерфейсов.',
      en: 'Design interfaces, layouts, responsiveness, and visual polish.'
    },
    category: 'Frontend',
    level: 'Beginner',
    rating: 4.8,
    students: '16.1K',
    duration: '7 недель',
    lessonsCount: 20,
    color: '#eef6ff',
    accent: '#2563eb',
    tags: ['Flexbox', 'Grid', 'UI'],
    outline: ['Основы CSS', 'Layout', 'Адаптивность', 'Анимации'],
    lessons: makeLessons('css')
  },
  {
    id: 'javascript',
    badge: 'Logic',
    title: { kg: 'JavaScript', ru: 'JavaScript', en: 'JavaScript' },
    description: {
      kg: 'Интерактивность, DOM, события, асинхронность және логика веб-приложений.',
      ru: 'Интерактивность, DOM, события, асинхронность и логика веб-приложений.',
      en: 'Build interactivity, DOM logic, events, async flows, and app behavior.'
    },
    category: 'Programming',
    level: 'Intermediate',
    rating: 4.9,
    students: '22.7K',
    duration: '8 недель',
    lessonsCount: 20,
    color: '#fff8d8',
    accent: '#f59e0b',
    tags: ['DOM', 'Async', 'JS'],
    outline: ['Основы JavaScript', 'DOM', 'Асинхронность', 'Проекты'],
    lessons: makeLessons('javascript')
  },
  {
    id: 'ai',
    badge: 'AI',
    title: { kg: 'Искусственный интеллект', ru: 'Искусственный интеллект', en: 'Artificial Intelligence' },
    description: {
      kg: 'ИИ-идеология, модели, генерация және практическое применение в повседневной работе.',
      ru: 'ИИ-основы, модели, генерация и практическое применение в повседневной работе.',
      en: 'Understand AI foundations, models, generation, and real-world use cases.'
    },
    category: 'AI',
    level: 'Intermediate',
    rating: 4.9,
    students: '14.2K',
    duration: '6 недель',
    lessonsCount: 20,
    color: '#eefbf6',
    accent: '#10b981',
    tags: ['Prompting', 'Models', 'AI'],
    outline: ['ИИ основы', 'Модели', 'Работа с данными', 'AI-агенты'],
    lessons: makeLessons('ai')
  },
  {
    id: 'math',
    badge: 'Science',
    title: { kg: 'Математика', ru: 'Математика', en: 'Mathematics' },
    description: {
      kg: 'Логика, алгебра және математическое мышление для решения сложных задач.',
      ru: 'Логика, алгебра и математическое мышление для решения задач и анализа данных.',
      en: 'Strengthen logic, algebra, and mathematical thinking for technical problem solving.'
    },
    category: 'Science',
    level: 'Intermediate',
    rating: 4.7,
    students: '11.8K',
    duration: '5 недель',
    lessonsCount: 20,
    color: '#f3efff',
    accent: '#8b5cf6',
    tags: ['Logic', 'Algebra', 'Stats'],
    outline: ['Логика', 'Функции', 'Вероятность', 'Статистика'],
    lessons: makeLessons('math')
  },
  {
    id: 'physics',
    badge: 'Science',
    title: { kg: 'Физика', ru: 'Физика', en: 'Physics' },
    description: {
      kg: 'Физические законы, явления, энергия и эксперименты для точных наук.',
      ru: 'Физические законы, явления, энергия и эксперименты для точных наук.',
      en: 'Explore laws of motion, energy, and physical phenomena through experiments.'
    },
    category: 'Science',
    level: 'Intermediate',
    rating: 4.8,
    students: '9.7K',
    duration: '6 недель',
    lessonsCount: 20,
    color: '#edf7ff',
    accent: '#0ea5e9',
    tags: ['Motion', 'Energy', 'Mechanics'],
    outline: ['Механика', 'Энергия', 'Электричество', 'Волны'],
    lessons: makeLessons('physics')
  },
  {
    id: 'english',
    badge: 'Language',
    title: { kg: 'Английский', ru: 'Английский', en: 'English' },
    description: {
      kg: 'Английский тилде сүйлөйүү, түсүнүү, жазуу жана күнделікті карым-катышуу.',
      ru: 'Развитие английского языка через разговорную практику, грамматику и повседневные темы.',
      en: 'Improve speaking, listening, writing, and daily communication in English.'
    },
    category: 'Language',
    level: 'Beginner',
    rating: 4.7,
    students: '8.6K',
    duration: '5 недель',
    lessonsCount: 20,
    color: '#f7f0ff',
    accent: '#7c3aed',
    tags: ['Speaking', 'Grammar', 'Listening'],
    outline: ['Базовые фразы', 'Грамматика', 'Диалоги', 'Практика общения'],
    lessons: makeLessons('english')
  },
  {
    id: 'webdesign',
    badge: 'Design',
    title: { kg: 'Веб-дизайн', ru: 'Веб-дизайн', en: 'Web Design' },
    description: {
      kg: 'Сайттын визуалды дизайны, композиция, цвета жана пайдаланушыга ыңгайлуу интерфейстер.',
      ru: 'Визуальный дизайн сайта, композиция, цвета и удобные интерфейсы для пользователей.',
      en: 'Design modern interfaces with layout, color, and user-focused visual systems.'
    },
    category: 'Design',
    level: 'Beginner',
    rating: 4.8,
    students: '10.2K',
    duration: '6 недель',
    lessonsCount: 20,
    color: '#eefdf7',
    accent: '#14b8a6',
    tags: ['UI', 'UX', 'Layout'],
    outline: ['Идея и композиция', 'Типография', 'Цвет', 'Мобильный дизайн'],
    lessons: makeLessons('webdesign')
  }
]

export const courseIndex = Object.fromEntries(courses.map((course) => [course.id, course])) as Record<string, Course>
