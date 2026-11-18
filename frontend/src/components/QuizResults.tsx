import type { Lang, translations } from '../appShared'

/** Result line shown after "Check answer": correct / try again. */
export default function QuizResults({ correct, t }: { correct: boolean; t: (typeof translations)[Lang] }) {
  return (
    <p className={correct ? 'success-message' : 'error-message'} role="status">
      {correct ? t.generic.correct : t.generic.tryAgain}
    </p>
  )
}
