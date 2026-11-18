import type { Lang } from '../appShared'

type VideoLesson = { id: string; type: string; videoUrl: string; title: Record<Lang, string> }

/** Lesson video with the watch timer and the "Mark lesson complete" button (enabled after the required watch time). */
export default function LessonVideo({ lesson, language, watchElapsedSec, watchRequirementSec, isCompleted, watchReady, onComplete }: {
  lesson: VideoLesson
  language: Lang
  watchElapsedSec: number
  watchRequirementSec: number
  isCompleted: boolean
  watchReady: boolean
  onComplete: () => void
}) {
  const watched = Math.min(watchElapsedSec, watchRequirementSec)
  return (
    <div className="video-box">
      <div className="video-header-row">
        <span className="video-badge">{lesson.type}</span>
        <span className="video-timer-badge">
          {language === 'ru'
            ? `Просмотр ${watched} / ${watchRequirementSec} сек`
            : language === 'kg'
              ? `Көрүү ${watched} / ${watchRequirementSec} сек`
              : `Watch ${watched} / ${watchRequirementSec}s`}
        </span>
      </div>

      <div className="video-frame-wrap">
        <iframe
          key={lesson.videoUrl}
          src={lesson.videoUrl}
          title={lesson.title[language]}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="video-frame"
          onError={() => console.error(`Video load error for ${lesson.id}`)}
        />
      </div>

      {!isCompleted && (
        <div className="lesson-watch-controls">
          <small>
            {language === 'ru'
              ? `Просмотр: ${watched} / ${watchRequirementSec} сек`
              : language === 'kg'
                ? `Көрүү: ${watched} / ${watchRequirementSec} сек`
                : `Watch time: ${watched} / ${watchRequirementSec} sec`}
          </small>
          <button type="button" className="btn btn-primary small" disabled={!watchReady} onClick={onComplete}>
            {language === 'ru' ? 'Завершить урок' : language === 'kg' ? 'Сабакты аяктоо' : 'Mark lesson complete'}
          </button>
        </div>
      )}
    </div>
  )
}
