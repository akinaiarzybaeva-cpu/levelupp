import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { pick, type Lang } from '../appShared'

type NavLesson = { id: string; title: Record<Lang, string> }

/** Previous / next lesson buttons. The next lesson unlocks only after the current one is completed. */
export default function LessonNavigation({ previousLesson, nextLesson, isCompleted, language, onOpen }: {
  previousLesson?: NavLesson
  nextLesson?: NavLesson
  isCompleted: boolean
  language: Lang
  onOpen: (lessonId: string) => void
}) {
  return (
    <nav className="lesson-step-nav" aria-label={pick(language, 'Сабактар боюнча навигация', 'Навигация по урокам', 'Lesson navigation')}>
      <button type="button" className="lesson-step prev" disabled={!previousLesson} onClick={() => { if (previousLesson) onOpen(previousLesson.id) }}>
        <ChevronLeft size={20} />
        <span><small>{pick(language, 'Мурунку сабак', 'Предыдущий урок', 'Previous lesson')}</small><strong>{previousLesson ? previousLesson.title[language] : '—'}</strong></span>
      </button>
      <button type="button" className="lesson-step next" disabled={!nextLesson || !isCompleted} onClick={() => { if (nextLesson && isCompleted) onOpen(nextLesson.id) }}>
        <span><small>{pick(language, 'Кийинки сабак', 'Следующий урок', 'Next lesson')}</small><strong>{nextLesson ? nextLesson.title[language] : '—'}</strong></span>
        {nextLesson && !isCompleted ? <Lock size={18} /> : <ChevronRight size={20} />}
      </button>
    </nav>
  )
}
