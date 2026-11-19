import { ArrowRight, BookOpen, ChevronRight, Clock3, Home, MessageCircleMore, Play, Star, Trophy, TrendingUp, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { type Course } from '../data'
import { AnimatedMetric, formatCompactNumber, pick, type Lang, type SiteStats } from '../appShared'
import { CourseDirectionIcon } from './CourseCategories'

/* Mobile layout of the home page and the course catalog (follows the LevelUp mobile mockup).
   Everything here is real: links open the real pages, numbers come from the API / progress. */

// ─── Duration "6 недель" → localized ("6 апта", "6 weeks") ────────────────────
export function formatWeeks(duration: string, language: Lang): string {
  const n = Number(String(duration).match(/\d+/)?.[0])
  if (!Number.isFinite(n) || !/нед|week|апта/i.test(duration)) return duration
  if (language === 'kg') return `${n} апта`
  if (language === 'en') return `${n} ${n === 1 ? 'week' : 'weeks'}`
  const mod10 = n % 10
  const mod100 = n % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'неделя' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'недели' : 'недель'
  return `${n} ${word}`
}

// ─── Course logos (HTML5, CSS3, JS, AI) on pastel tiles ──────────────────────
const LOGO_TILE: Record<string, string> = { html: '#fde4dc', css: '#dcebff', javascript: '#fff2c2', ai: '#ece3ff' }

function BrandLogo({ courseId }: { courseId: string }) {
  if (courseId === 'html' || courseId === 'css') {
    const isHtml = courseId === 'html'
    return (
      <svg viewBox="0 0 40 46" className="course-logo-svg" aria-hidden="true">
        <text x="20" y="8" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="8.4" fill="#1b1b1b">{isHtml ? 'HTML' : 'CSS'}</text>
        <path d="M6 11h28l-2.6 29L20 44l-11.4-4z" fill={isHtml ? '#e44d26' : '#1572b6'} />
        <path d="M20 13.4v28l9.3-2.6 2.2-25.4z" fill={isHtml ? '#f16529' : '#33a9dc'} />
        {isHtml
          ? <path d="M12.5 17h15l-.35 3.6H16.2l.35 3.6h10.3l-.95 10.2L20 36l-5.9-1.6-.4-4.5h3.6l.2 2.3 2.5.7 2.5-.7.35-3.7H13.4z" fill="#fff" />
          : <path d="M12.6 17h15l-.35 3.6H17l.25 3.4h9.95l-.85 10.4L20 36l-6.3-1.6-.4-4.4h3.6l.2 2.2 2.9.8 2.9-.8.35-4H13.3z" fill="#fff" />}
      </svg>
    )
  }
  if (courseId === 'javascript') {
    return (
      <svg viewBox="0 0 40 40" className="course-logo-svg" aria-hidden="true">
        <rect x="3" y="3" width="34" height="34" rx="4" fill="#f7df1e" />
        <text x="35" y="33" textAnchor="end" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="16" fill="#1b1b1b">JS</text>
      </svg>
    )
  }
  if (courseId === 'ai') {
    return (
      <svg viewBox="0 0 40 40" className="course-logo-svg" aria-hidden="true">
        <g stroke="#3b2b8f" strokeWidth="2.4" strokeLinecap="round">
          {[13, 20, 27].map((p) => <g key={p}><path d={`M${p} 4v4`} /><path d={`M${p} 32v4`} /><path d={`M4 ${p}h4`} /><path d={`M32 ${p}h4`} /></g>)}
        </g>
        <rect x="8" y="8" width="24" height="24" rx="5" fill="#3b2b8f" />
        <text x="20" y="25" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="11" fill="#fff">AI</text>
      </svg>
    )
  }
  return null
}

/** Pastel tile with the course logo (brand logo for HTML / CSS / JS / AI, icon for the others). */
export function CourseLogo({ course, size = 'md' }: { course: Course; size?: 'sm' | 'md' }) {
  const brand = ['html', 'css', 'javascript', 'ai'].includes(course.id)
  return (
    <span className={`course-logo course-logo-${size}`} style={{ background: LOGO_TILE[course.id] ?? course.color }}>
      {brand ? <BrandLogo courseId={course.id} /> : <span className="course-logo-icon" style={{ background: course.accent }}><CourseDirectionIcon courseId={course.id} size={size === 'sm' ? 20 : 24} /></span>}
    </span>
  )
}

// ─── Illustrations ────────────────────────────────────────────────────────────
function Laptop() {
  return (
    <g>
      <rect x="62" y="44" width="122" height="84" rx="9" fill="#3d4a50" />
      <rect x="69" y="51" width="108" height="70" rx="5" fill="#26313a" />
      <text x="123" y="96" textAnchor="middle" fontFamily="Consolas, monospace" fontWeight="700" fontSize="26" fill="#e3ece9">&lt;/&gt;</text>
      <path d="M48 130h150l12 14H36z" fill="#c9d3d1" />
      <path d="M36 144h174v5c0 2-2 4-4 4H40c-2 0-4-2-4-4z" fill="#9fb0ad" />
      <rect x="104" y="133" width="38" height="5" rx="2.5" fill="#8a9b98" />
    </g>
  )
}

export function MobileHomeIllustration() {
  return (
    <svg className="mobile-hero-art" viewBox="0 0 240 170" aria-hidden="true">
      <ellipse cx="128" cy="152" rx="104" ry="14" fill="#1fbf6e" opacity="0.18" />
      <g transform="translate(120 96)">
        <rect x="0" y="34" width="112" height="18" rx="4" fill="#2f6fde" /><rect x="4" y="38" width="100" height="10" rx="2" fill="#eaf1ff" />
        <rect x="6" y="16" width="104" height="18" rx="4" fill="#1fbf6e" /><rect x="10" y="20" width="92" height="10" rx="2" fill="#e8fff2" />
      </g>
      <g transform="translate(-10 10) rotate(-6 123 100)"><Laptop /></g>
      <g transform="translate(150 6) rotate(10)">
        <path d="M0 22 L44 0 L88 22 L44 44 Z" fill="#26313a" />
        <path d="M20 32v16c0 8 48 8 48 0V32l-24 12z" fill="#1b2328" />
        <path d="M80 26v28" stroke="#f2b632" strokeWidth="2.6" /><path d="M75 54h10l-2 13h-6z" fill="#f2b632" />
      </g>
      <g stroke="#1fbf6e" strokeWidth="4" strokeLinecap="round"><path d="M116 22l-8-10" /><path d="M128 18l1-12" /><path d="M104 32l-12-5" /></g>
    </svg>
  )
}

export function MobileCatalogIllustration() {
  return (
    <svg className="mobile-hero-art" viewBox="0 0 240 170" aria-hidden="true">
      <ellipse cx="128" cy="152" rx="104" ry="14" fill="#1fbf6e" opacity="0.2" />
      <g transform="translate(6 18) rotate(-8 123 100)"><Laptop /></g>
      <g transform="translate(108 4)"><rect width="40" height="40" rx="12" fill="#fff" /><g transform="translate(6 3) scale(0.7)"><path d="M6 11h28l-2.6 29L20 44l-11.4-4z" fill="#e44d26" /><path d="M20 13.4v28l9.3-2.6 2.2-25.4z" fill="#f16529" /><path d="M12.5 17h15l-.35 3.6H16.2l.35 3.6h10.3l-.95 10.2L20 36l-5.9-1.6-.4-4.5h3.6l.2 2.3 2.5.7 2.5-.7.35-3.7H13.4z" fill="#fff" /></g></g>
      <g transform="translate(156 6)"><rect width="40" height="40" rx="12" fill="#fff" /><g transform="translate(20 20)" fill="none" stroke="#1597c9" strokeWidth="2"><ellipse rx="14" ry="5.5" /><ellipse rx="14" ry="5.5" transform="rotate(60)" /><ellipse rx="14" ry="5.5" transform="rotate(120)" /><circle r="2.4" fill="#1597c9" stroke="none" /></g></g>
      <g transform="translate(196 36)"><rect width="38" height="38" rx="11" fill="#f7df1e" /><text x="33" y="32" textAnchor="end" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="15" fill="#1b1b1b">JS</text></g>
      <g stroke="#1fbf6e" strokeWidth="4" strokeLinecap="round"><path d="M96 30l-10-8" /><path d="M90 46l-14-2" /></g>
    </svg>
  )
}

// ─── Hero card ────────────────────────────────────────────────────────────────
export function MobileHeroCard({ variant, language, to, onClick }: { variant: 'home' | 'catalog'; language: Lang; to?: string; onClick?: () => void }) {
  const button = (
    <>
      <span>{pick(language, 'Курстарга өтүү', 'Перейти к курсам', 'Go to courses')}</span>
      <ArrowRight size={18} />
    </>
  )
  return (
    <section className={`mobile-hero-card mobile-hero-${variant}`}>
      <div className="mobile-hero-copy">
        {variant === 'home' ? (
          <h1>
            <span className="line">{pick(language, 'Үйрөн.', 'Учись.', 'Learn.')} <b>{pick(language, 'Өнүк.', 'Развивайся.', 'Grow.')}</b></span>
            <span className="line accent">{pick(language, 'Бийиктерге жет!', 'Достигай большего!', 'Achieve more!')}</span>
          </h1>
        ) : (
          <h1>
            {pick(language, '', 'Изучай программирование ', 'Learn programming ')}
            <span className="accent">{pick(language, 'LevelUp менен', 'с LevelUp!', 'with LevelUp!')}</span>
            {pick(language, ' программалоону үйрөн!', '', '')}
          </h1>
        )}
        <p>{variant === 'home'
          ? pick(language, 'LevelUp — IT дүйнөсүнө жолуң', 'LevelUp — твой путь в мир IT', 'LevelUp — your path into IT')
          : pick(language, 'Курстарды танда жана биз менен бирге өнүк', 'Выбирай курсы и развивайся вместе с нами', 'Choose courses and grow with us')}</p>
        {to ? <Link to={to} className="mobile-hero-btn">{button}</Link> : <button type="button" className="mobile-hero-btn" onClick={onClick}>{button}</button>}
      </div>
      {variant === 'home' ? <MobileHomeIllustration /> : <MobileCatalogIllustration />}
    </section>
  )
}

// ─── Quick navigation tiles ──────────────────────────────────────────────────
export function MobileQuickNav({ language, isLoggedIn, labels }: { language: Lang; isLoggedIn: boolean; labels: { home: string; courses: string; rating: string; reviews: string; profile: string } }) {
  const items = [
    { to: '/home', label: labels.home, icon: Home },
    { to: '/courses', label: labels.courses, icon: Play },
    { to: '/rating', label: labels.rating, icon: Star },
    { to: '/reviews', label: labels.reviews, icon: MessageCircleMore },
    { to: isLoggedIn ? '/dashboard/profile' : '/auth?mode=login', label: labels.profile, icon: UserRound },
  ]
  return (
    <nav className="mobile-quick-nav" aria-label={pick(language, 'Тез өтүү', 'Быстрый переход', 'Quick links')}>
      {items.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className="mobile-quick-item">
          <span className="mobile-quick-icon"><Icon size={24} fill="currentColor" strokeWidth={1.6} /></span>
          <span className="mobile-quick-label">{label}</span>
        </Link>
      ))}
    </nav>
  )
}

// ─── "My lessons": continue where the learner stopped ────────────────────────
export function MobileMyLessons({ courses, completedLessons, isLoggedIn, language }: { courses: Course[]; completedLessons: string[]; isLoggedIn: boolean; language: Lang }) {
  if (courses.length === 0) return null
  // The course in progress (some lessons done, not finished); otherwise the first course.
  const inProgress = courses.find((c) => c.lessons.some((l) => completedLessons.includes(l.id)) && c.lessons.some((l) => !completedLessons.includes(l.id)))
  const course = inProgress ?? courses[0]
  const next = course.lessons.find((l) => !completedLessons.includes(l.id)) ?? course.lessons[0]
  const done = course.lessons.filter((l) => completedLessons.includes(l.id)).length
  const percent = course.lessons.length ? Math.round((done / course.lessons.length) * 100) : 0
  const lessonPath = next ? `/courses/${course.id}/lessons/${next.id}` : `/courses/${course.id}`
  return (
    <section className="mobile-card mobile-lessons">
      <div className="mobile-card-head">
        <h2><BookOpen size={22} className="mobile-head-icon" fill="currentColor" strokeWidth={1.4} /> {pick(language, 'Менин сабактарым', 'Мои уроки', 'My lessons')}</h2>
        <Link to={isLoggedIn ? '/dashboard/my-lessons' : '/courses'} className="mobile-see-all">{pick(language, 'Бардык сабактар', 'Все уроки', 'All lessons')} <ArrowRight size={16} /></Link>
      </div>
      <Link to={lessonPath} className="mobile-continue">
        <span className="mobile-continue-icon"><Play size={18} fill="currentColor" /></span>
        <span className="mobile-continue-body">
          <small>{done > 0 ? pick(language, 'Окууну улантуу', 'Продолжить обучение', 'Continue learning') : pick(language, 'Окууну башта', 'Начни обучение', 'Start learning')}</small>
          <strong>{next?.title[language] ?? course.title[language]}</strong>
          <span className="mobile-progress-row">
            <span className="mobile-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(percent, 0)}%` }} /></span>
            <span className="mobile-progress-value">{percent}%</span>
          </span>
        </span>
        <span className="mobile-continue-play" aria-hidden="true"><Play size={20} fill="currentColor" /></span>
      </Link>
    </section>
  )
}

// ─── Popular courses list ────────────────────────────────────────────────────
export function MobilePopularCourses({ courses, language }: { courses: Course[]; language: Lang }) {
  return (
    <section className="mobile-card mobile-popular">
      <div className="mobile-card-head">
        <h2><span className="mobile-fire" aria-hidden="true">🔥</span> {pick(language, 'Популярдуу курстар', 'Популярные курсы', 'Popular courses')}</h2>
        <Link to="/courses" className="mobile-see-all">{pick(language, 'Баарын көрүү', 'Смотреть все', 'View all')} <ArrowRight size={16} /></Link>
      </div>
      <div className="mobile-course-rows">
        {courses.map((course) => (
          <Link key={course.id} to={`/courses/${course.id}`} className="mobile-course-row">
            <CourseLogo course={course} />
            <span className="mobile-course-info">
              <strong>{course.title[language]}</strong>
              <span className="mobile-course-meta">
                <span><Clock3 size={15} /> {formatWeeks(course.duration, language)}</span>
                <span className="sep" aria-hidden="true">|</span>
                <span><TrendingUp size={15} className="mobile-meta-green" /> {course.rating.toFixed(1)} <Star size={14} className="mobile-star" fill="currentColor" /></span>
              </span>
            </span>
            <span className="mobile-course-go" aria-hidden="true"><ChevronRight size={22} /></span>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ─── Stats card ──────────────────────────────────────────────────────────────
export function MobileStatsCard({ siteStats, language }: { siteStats: SiteStats; language: Lang }) {
  return (
    <section className="mobile-stats-card">
      <div className="mobile-stat">
        <TrendingUp size={34} className="mobile-stat-icon" strokeWidth={2.6} />
        <span>
          <AnimatedMetric value={siteStats.students} formatter={(v: number) => `${formatCompactNumber(v)}+`} loading={siteStats.loading} fallback="—" />
          <small>{pick(language, 'Активдүү колдонуучулар', 'Активных пользователей', 'Active users')}</small>
        </span>
      </div>
      <span className="mobile-stats-divider" aria-hidden="true" />
      <div className="mobile-stat">
        <Trophy size={34} className="mobile-stat-icon" strokeWidth={2.2} />
        <span>
          <AnimatedMetric value={siteStats.rating} formatter={(v: number) => Number(v).toFixed(1)} loading={siteStats.loading} fallback="—" />
          <small>{pick(language, 'Орточо рейтинг', 'Средний рейтинг', 'Average rating')}</small>
        </span>
      </div>
    </section>
  )
}

// ─── Catalog section heading ─────────────────────────────────────────────────
export function MobileCatalogHeading({ language, onAll }: { language: Lang; onAll: () => void }) {
  return (
    <div className="mobile-catalog-head">
      <h2><BookOpen size={26} className="mobile-head-icon-outline" /> {pick(language, 'Курстар каталогу', 'Каталог курсов', 'Course catalog')}</h2>
      <button type="button" className="mobile-see-all" onClick={onAll}>{pick(language, 'Бардык курстар', 'Все курсы', 'All courses')} <ArrowRight size={16} /></button>
    </div>
  )
}
