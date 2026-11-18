import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { adminFetch, formatDate, type ToastKind } from './adminShared'

export default function TelegramNotification({ onToast }: { onToast: (msg: string, kind: ToastKind) => void }) {
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setStatus(await adminFetch<TelegramStatus>('/api/admin/telegram'))
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load Telegram status', 'error')
    }
  }, [onToast])

  useEffect(() => { void load() }, [load])

  const toggle = async () => {
    if (!status) return
    setBusy(true)
    try {
      setStatus(await adminFetch<TelegramStatus>('/api/admin/telegram', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !status.enabled }) }))
      onToast(`Purchase notifications ${status.enabled ? 'disabled' : 'enabled'}`, 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to update', 'error')
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setBusy(true)
    try {
      const result = await adminFetch<{ ok: boolean; status: TelegramStatus }>('/api/admin/telegram/test', { method: 'POST' })
      setStatus(result.status)
      onToast('Test message delivered to Telegram', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Test message failed', 'error')
      void load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-card admin-settings-card admin-telegram-card">
      <div className="admin-card-header"><h3><Bell size={16} /> Telegram notifications</h3></div>
      {!status ? <div className="admin-loading-bar" /> : (
        <>
          <div className="admin-info-list">
            <div className="admin-info-row"><span>Connection</span><span className={status.configured ? 'admin-pill success' : 'admin-pill danger'}>{status.configured ? 'Configured' : 'Not configured'}</span></div>
            <div className="admin-info-row"><span>Bot token (TELEGRAM_BOT_TOKEN)</span><strong>{status.botTokenConfigured ? 'Set' : 'Missing'}</strong></div>
            <div className="admin-info-row"><span>Admin chat (TELEGRAM_ADMIN_CHAT_ID)</span><strong>{status.chatIdConfigured ? 'Set' : 'Missing'}</strong></div>
            <div className="admin-info-row"><span>Purchase notifications</span><strong>{status.enabled ? 'On' : 'Off'}</strong></div>
            <div className="admin-info-row"><span>Last successful message</span><strong>{status.lastSuccessAt ? `${formatDate(status.lastSuccessAt)} (${status.lastSuccessKind})` : 'Never'}</strong></div>
            <div className="admin-info-row"><span>Purchase messages sent / failed</span><strong>{status.purchaseCounts.sent ?? 0} / {status.purchaseCounts.failed ?? 0}</strong></div>
          </div>
          <div className="admin-telegram-actions">
            <button type="button" className={status.enabled ? 'btn btn-warning small' : 'btn btn-primary small'} onClick={() => void toggle()} disabled={busy}>
              {status.enabled ? 'Turn notifications off' : 'Turn notifications on'}
            </button>
            <button type="button" className="btn btn-secondary small" onClick={() => void sendTest()} disabled={busy || !status.configured}>
              <Bell size={14} /> Send test message
            </button>
          </div>
          {!status.configured && <p className="admin-hint">Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID on the backend (Render → Environment) and redeploy.</p>}
          {status.recentErrors.length > 0 && (
            <details className="admin-telegram-errors">
              <summary>Recent errors ({status.recentErrors.length})</summary>
              <ul className="admin-plain-list">
                {status.recentErrors.map((e) => <li key={`${e.at}-${e.kind}`}><small>{formatDate(e.at)} · {e.kind}</small><br /><span>{e.error}</span></li>)}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  )
}

export type TelegramStatus = {
  botTokenConfigured: boolean
  chatIdConfigured: boolean
  configured: boolean
  enabled: boolean
  lastSuccessAt: string | null
  lastSuccessKind: string | null
  purchaseCounts: Record<string, number>
  recentErrors: Array<{ kind: string; error: string; at: string }>
}
