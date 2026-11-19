import { Clock3, ArrowRight, Star, Users, PlayCircle } from 'lucide-react'
import { Badge, ProgressBar } from './ui'
import { Link } from 'react-router-dom'
import { type Course } from '../data'
import { translations, appendFromParam, pick, levelLabel, type Lang } from '../appShared'
import { CourseDirectionIcon } from './CourseCategories'
import { CourseLogo, formatWeeks } from './MobileHome'

export default function CourseCard({ course, language, favorites, onToggleFavorite, backTo = '/courses', completedLessons }: { course: Course; language?: Lang; favorites?: string[]; onToggleFavorite?: React.Dispatch<React.SetStateAction<string[]>>; backTo?: string; completedLessons?: string[] }) {
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
      {/* Phones: compact head as in the mobile mockup (logo tile, rating, favourite) */}
      <div className="course-card-mobile-head">
        <Link to={coursePath} className="course-card-mobile-logo" aria-label={course.title[activeLanguage]}><CourseLogo course={course} /></Link>
        <span className="course-card-mobile-side">
          <span className="course-rating-pill"><Star size={14} fill="currentColor" /> {course.rating.toFixed(1)}</span>
          {onToggleFavorite && (
          <button type="button" className={isFavorite ? 'favorite-button mobile-fav active' : 'favorite-button mobile-fav'} aria-pressed={!!isFavorite} onClick={() => { onToggleFavorite((current) => current.includes(course.id) ? current.filter((item) => item !== course.id) : [...current, course.id]) }} aria-label={pick(activeLanguage, 'Тандалмаларга', 'В избранное', 'Favorite course')}>
            <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
        </span>
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
          <span><Clock3 size={15} /> {formatWeeks(course.duration, activeLanguage)}</span>
          <span className="course-card-students"><Users size={15} /> {course.students}</span>
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
