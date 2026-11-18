import type { Dispatch, SetStateAction } from 'react'
import { Search } from 'lucide-react'
import type { Course } from '../data'
import type { Lang } from '../appShared'
import CourseCard from './CourseCard'
import { EmptyState } from './ui'

/** Grid of course cards, or an empty-state message when the list is empty. */
export default function CourseList({ courses, language, className = 'course-grid', emptyText, favorites, onToggleFavorite, backTo, completedLessons }: {
  courses: Course[]
  language: Lang
  className?: string
  /** Shown instead of the grid when there are no courses (omit to render an empty grid). */
  emptyText?: string
  favorites?: string[]
  onToggleFavorite?: Dispatch<SetStateAction<string[]>>
  backTo?: string
  completedLessons?: string[]
}) {
  if (courses.length === 0 && emptyText) return <EmptyState icon={Search}>{emptyText}</EmptyState>
  return (
    <div className={className}>
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} language={language} favorites={favorites} onToggleFavorite={onToggleFavorite} backTo={backTo} completedLessons={completedLessons} />
      ))}
    </div>
  )
}
