/**
 * Inline status message used by forms and panels. Renders nothing when there is no message.
 * Tones map to the existing styles: info → .field-note, error → .error-message, success → .success-message.
 */
export default function Notification({ message, tone = 'info', inline = false, role }: {
  message?: string | null
  tone?: 'info' | 'error' | 'success'
  /** `true` renders a compact <small> (under form fields), otherwise a <p>. */
  inline?: boolean
  role?: 'status' | 'alert'
}) {
  if (!message) return null
  const className = tone === 'error' ? 'error-message' : tone === 'success' ? 'success-message' : 'field-note'
  return inline
    ? <small className={className} role={role}>{message}</small>
    : <p className={className} role={role}>{message}</p>
}
