import { Link } from 'react-router-dom'
import { renderAvatarContent } from '../appShared'

/** Profile header card: avatar (uploaded photo or initial), name, role and a link back to the dashboard. */
export default function UserProfile({ name, role, kicker, photo, avatar, initial, homeLabel, homeTo = '/dashboard' }: {
  name: string
  role?: string
  kicker: string
  /** Uploaded photo (data URL / URL); falls back to the avatar initial. */
  photo?: string
  avatar?: string
  /** Letter shown when there is no photo. */
  initial?: string
  homeLabel: string
  homeTo?: string
}) {
  return (
    <div className="profile-card-header">
      <div className="profile-user-meta">
        <div className="avatar large profile-avatar">
          {photo ? <img src={photo} alt={name} className="profile-avatar-image" /> : renderAvatarContent(avatar, initial ?? 'S')}
        </div>
        <div>
          <p className="profile-kicker">{kicker}</p>
          <h2>{name}</h2>
          <small>{role ?? 'Student'}</small>
        </div>
      </div>
      <Link to={homeTo} className="btn btn-secondary small">{homeLabel}</Link>
    </div>
  )
}
