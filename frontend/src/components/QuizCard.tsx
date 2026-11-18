import { useState } from 'react'
import type { Lang, translations } from '../appShared'
import QuizResults from './QuizResults'

export type LessonQuiz = { prompt: Record<Lang, string>; options: string[]; answer: number }

/** Single-choice lesson quiz: pick an option, check it, see which answer is correct. */
export default function QuizCard({ quiz, t, language }: { quiz: LessonQuiz; t: (typeof translations)[Lang]; language: Lang }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const isCorrect = checked && selected === quiz.answer

  return (
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
      {checked && <QuizResults correct={isCorrect} t={t} />}
    </section>
  )
}
