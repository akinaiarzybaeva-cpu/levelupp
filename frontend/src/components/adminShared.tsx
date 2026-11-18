// Types and helpers shared by the admin panel and its section components (moved unchanged from AdminPanel.tsx).
import { useCallback, useEffect, useState } from 'react'
import { Bell, X, AlertCircle, CheckCircle } from 'lucide-react'
import { apiFetch, createClientId } from '../api'

export type AdminStats = {
  totalUsers: number
  newRegistrations: number
  activeStudents: number
  blockedUsers: number
  completedCourses: number
  startedCourses: number
  averageRating: number
  totalReviews: number
  pendingReviews: number
  activeSubscriptions: number
  proSubscriptions: number
  aiproSubscriptions: number
  revenue: number
  totalCourses: number
  totalLessons: number
  recentUsers: AdminUserRecord[]
}

export type AdminUserRecord = {
  email: string
  name: string
  firstName: string
  lastName: string
  phone?: string
  bio?: string
  role: string
  accountStatus: string
  isBlocked: boolean
  createdAt?: string
}

export type AdminUserDetail = {
  user: AdminUserRecord
  subscription: { planId: string; status: string; endsAt: string } | null
  progress: Array<{ course_id: string; lessons_completed: number; lessons_started: number; status: string }>
  reviews: Array<{ id: string }>
}

export type AdminCourse = {
  id: string
  badge: string
  title_kg: string
  title_ru: string
  title_en: string
  description_kg: string
  description_ru: string
  description_en: string
  category: string
  level: string
  rating: number
  students: string
  duration: string
  lessonsCount: number
  color: string
  accent: string
  tags: string[]
  outline: string[]
  isPublished: boolean
  orderIndex: number
  createdAt?: string
  updatedAt?: string
}

export type AdminLesson = {
  id: string
  courseId: string
  title_kg: string
  title_ru: string
  title_en: string
  duration: string
  type: string
  theory: string
  code: string
  task: string
  videoUrl: string
  quiz?: {
    prompt?: { kg?: string; ru?: string; en?: string }
    options?: string[]
    answer?: number
  }
  orderIndex: number
  isPublished: boolean
  createdAt?: string
  updatedAt?: string
}

export type AdminReview = {
  id: string
  userId: string
  userName: string
  userAvatar: string
  lessonId: string
  lessonLabel: string
  rating: number
  text: string
  moderationStatus: string
  createdAt: string
  updatedAt: string
}

export type AdminSubscription = {
  userEmail: string
  userName: string
  planId: string
  status: string
  startedAt: string
  endsAt: string
  purchasedAt: string
  paymentMethod: string
  amount: number
  currency: string
  orderId: string
}

export type AdminPayment = {
  id: string
  userEmail: string
  planId: string
  paymentMethod: string
  amount: number
  currency: string
  status: string
  isActivated: boolean
  createdAt: string
  updatedAt: string
}

export type AdminAiProUser = {
  email: string
  name: string
  role: string
  accountStatus: string
  hasAiPro: boolean
  status: 'active' | 'expired' | 'none'
  startedAt: string | null
  endsAt: string | null
  daysRemaining: number
}

export type UserProfile = {
  name: string
  email: string
  avatar: string
  role: string
}

export type AdminSection =
  | 'dashboard'
  | 'users'
  | 'courses'
  | 'lessons'
  | 'aipro'
  | 'reviews'
  | 'subscriptions'
  | 'payments'
  | 'plans'
  | 'requests'
  | 'purchases'
  | 'settings'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const adminFetch = apiFetch

/** Delays search input so typing does not fire one API request per keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

export function statusPill(status: string, isBlocked: boolean) {
  if (isBlocked || status === 'blocked') return 'admin-pill danger'
  if (status === 'active') return 'admin-pill success'
  return 'admin-pill neutral'
}

export function planBadgeClass(planId: string) {
  if (planId === 'aipro') return 'admin-pill violet'
  if (planId === 'pro') return 'admin-pill cyan'
  return 'admin-pill neutral'
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ru-RU')
}

export function formatMoney(amount: number, currency = 'KGS'): string {
  return `${Number(amount).toLocaleString('ru-RU')} ${currency}`
}

export function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++

  if (score <= 1) return { score, label: 'Weak', color: '#e53e3e' }
  if (score <= 2) return { score, label: 'Fair', color: '#dd6b20' }
  if (score <= 3) return { score, label: 'Good', color: '#d69e2e' }
  return { score, label: 'Strong', color: '#38a169' }
}

// ─── Toast notification ───────────────────────────────────────────────────────

export type ToastKind = 'success' | 'error' | 'info'
export type Toast = { id: string; message: string; kind: ToastKind }

export function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="admin-toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`admin-toast admin-toast-${toast.kind}`}>
          {toast.kind === 'success' ? <CheckCircle size={16} /> : toast.kind === 'error' ? <AlertCircle size={16} /> : <Bell size={16} />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => onRemove(toast.id)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = createClientId()
    setToasts((current) => [...current, { id, message, kind }])
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4500)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

export function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="admin-confirm-backdrop">
      <div className="admin-confirm-card">
        <AlertCircle size={24} className="admin-confirm-icon" />
        <p>{message}</p>
        <div className="admin-confirm-actions">
          <button type="button" className="btn btn-secondary small" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-danger small" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard section ────────────────────────────────────────────────────────

/** Bar charts built only from the real /api/admin/stats numbers (no invented data). */
export function AdminInsights({ stats }: { stats: AdminStats }) {
  const groups = [
    {
      title: 'Learning funnel',
      rows: [
        { label: 'Users', value: stats.totalUsers },
        { label: 'Courses started', value: stats.startedCourses },
        { label: 'Courses completed', value: stats.completedCourses }
      ]
    },
    {
      title: 'Subscriptions',
      rows: [
        { label: 'Active', value: stats.activeSubscriptions },
        { label: 'PRO', value: stats.proSubscriptions },
        { label: 'AI PRO', value: stats.aiproSubscriptions }
      ]
    },
    {
      title: 'Reviews moderation',
      rows: [
        { label: 'Published', value: Math.max(0, stats.totalReviews - stats.pendingReviews) },
        { label: 'Pending', value: stats.pendingReviews }
      ]
    }
  ]

  return (
    <div className="admin-insights">
      {groups.map((group) => {
        const max = Math.max(1, ...group.rows.map((row) => Number(row.value) || 0))
        return (
          <div key={group.title} className="admin-card admin-chart-card">
            <h3>{group.title}</h3>
            <div className="admin-bars">
              {group.rows.map((row) => (
                <div key={row.label} className="admin-bar-row">
                  <span>{row.label}</span>
                  <div className="admin-bar-track" role="img" aria-label={`${row.label}: ${row.value}`}>
                    <div className="admin-bar-fill" style={{ width: `${Math.round(((Number(row.value) || 0) / max) * 100)}%` }} />
                  </div>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
