import { BookOpen } from 'lucide-react'
import { Badge, Button, StarRating } from './ui'
import { formatReviewDate, renderAvatarContent, pick, type Lang, type Review } from '../appShared'

/** Shared review card (home page and reviews page). */
export default function ReviewCard({ review, language, onEdit }: { review: Review; language: Lang; onEdit?: () => void }) {
  return (
    <article className="review-card">
      <div className="review-head">
        <div className="avatar">{renderAvatarContent(review.avatar, review.name?.charAt(0)?.toUpperCase() || 'U')}</div>
        <div><h4>{review.name}</h4><span>{formatReviewDate(review.date, language)}</span></div>
        {review.isOwn && <Badge tone="green">{pick(language, 'Сиздин', 'Ваш', 'Yours')}</Badge>}
      </div>
      <StarRating value={review.rating} size={16} />
      {review.lessonLabel && <small className="review-lesson"><BookOpen size={13} /> {review.lessonLabel}</small>}
      <p>{review.text}</p>
      {onEdit && <Button variant="secondary" size="sm" onClick={onEdit}>{pick(language, 'Өзгөртүү', 'Редактировать', 'Edit')}</Button>}
    </article>
  )
}
