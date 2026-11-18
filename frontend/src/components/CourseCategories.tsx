import { BookOpen, Code2, Languages, Atom, Bot, Calculator, Palette } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguage, useCourseCatalog } from '../appShared'

/** "Popular directions": one pastel tile per course, opening that course. */
export const courseDirectionIcons: Record<string, typeof BookOpen> = {
  html: Code2,
  css: Palette,
  ai: Bot,
  math: Calculator,
  physics: Atom,
  english: Languages,
  webdesign: Palette
}

export default function CourseCategories() {
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

export function CourseDirectionIcon({ courseId, size }: { courseId: string; size: number }) {
  if (courseId === 'javascript') return <span className="direction-js">JS</span>
  const Icon = courseDirectionIcons[courseId] ?? BookOpen
  return <Icon size={size} />
}
