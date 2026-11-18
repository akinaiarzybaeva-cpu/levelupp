import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import {
  Bell,
  BookOpen,
  Check,
  Crown,
  Eye,
  EyeOff,
  GraduationCap,
  Home,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trash2,
  UserRound,
  WalletCards,
  X,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Edit2,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { apiFetch, createClientId } from '../api'
import siteLogo from '../assets/logo.webp'

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminStats = {
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

type AdminUserRecord = {
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

type AdminUserDetail = {
  user: AdminUserRecord
  subscription: { planId: string; status: string; endsAt: string } | null
  progress: Array<{ course_id: string; lessons_completed: number; lessons_started: number; status: string }>
  reviews: Array<{ id: string }>
}

type AdminCourse = {
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

type AdminLesson = {
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

type AdminReview = {
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

type AdminSubscription = {
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

type AdminPayment = {
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

type AdminAiProUser = {
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

type UserProfile = {
  name: string
  email: string
  avatar: string
  role: string
}

type AdminSection =
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

const adminFetch = apiFetch

/** Delays search input so typing does not fire one API request per keystroke. */
function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function statusPill(status: string, isBlocked: boolean) {
  if (isBlocked || status === 'blocked') return 'admin-pill danger'
  if (status === 'active') return 'admin-pill success'
  return 'admin-pill neutral'
}

function planBadgeClass(planId: string) {
  if (planId === 'aipro') return 'admin-pill violet'
  if (planId === 'pro') return 'admin-pill cyan'
  return 'admin-pill neutral'
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ru-RU')
}

function formatMoney(amount: number, currency = 'KGS'): string {
  return `${Number(amount).toLocaleString('ru-RU')} ${currency}`
}

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
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

type ToastKind = 'success' | 'error' | 'info'
type Toast = { id: string; message: string; kind: ToastKind }

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
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

function useToast() {
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

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
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
function AdminInsights({ stats }: { stats: AdminStats }) {
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

function DashboardSection({
  stats,
  loading,
  onRefresh,
  onNavigate
}: {
  stats: AdminStats | null
  loading: boolean
  onRefresh: () => void
  onNavigate: (section: AdminSection) => void
}) {
  const statCards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, icon: UserRound, accent: 'emerald', section: 'users' as AdminSection },
    { label: 'Total Courses', value: stats.totalCourses, icon: BookOpen, accent: 'blue', section: 'courses' as AdminSection },
    { label: 'Total Lessons', value: stats.totalLessons, icon: GraduationCap, accent: 'cyan', section: 'lessons' as AdminSection },
    { label: 'Active Subscriptions', value: stats.activeSubscriptions, icon: Crown, accent: 'gold', section: 'subscriptions' as AdminSection },
    { label: 'Total Reviews', value: stats.totalReviews, icon: MessageSquareText, accent: 'indigo', section: 'reviews' as AdminSection },
    { label: 'Pending Reviews', value: stats.pendingReviews, icon: Bell, accent: 'amber', section: 'reviews' as AdminSection },
    { label: 'PRO Subscribers', value: stats.proSubscriptions, icon: WalletCards, accent: 'teal', section: 'subscriptions' as AdminSection },
    { label: 'AI PRO Users', value: stats.aiproSubscriptions, icon: Sparkles, accent: 'purple', section: 'aipro' as AdminSection },
    { label: 'Total Revenue', value: formatMoney(stats.revenue), icon: WalletCards, accent: 'orange', section: 'payments' as AdminSection },
    { label: 'Courses Started', value: stats.startedCourses, icon: BookOpen, accent: 'amber', section: 'courses' as AdminSection },
    { label: 'Completed Courses', value: stats.completedCourses, icon: Check, accent: 'green', section: 'courses' as AdminSection },
    { label: 'Average Rating', value: `${Number(stats.averageRating || 0).toFixed(1)} / 5.0`, icon: Sparkles, accent: 'violet', section: 'reviews' as AdminSection }
  ] : []

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div>
          <span className="eyebrow">LevelUp Real-time Database</span>
          <h2>Dashboard</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary small" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Refreshing…' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {loading && <div className="admin-loading-bar" />}

      <div className="admin-stats-grid">
        {statCards.map(({ label, value, icon: Icon, accent, section }) => (
          <div
            key={label}
            className={`admin-stat-card ${accent}`}
            onClick={() => onNavigate(section)}
            style={{ cursor: 'pointer' }}
            title={`View ${label}`}
          >
            <div className="admin-stat-icon"><Icon size={20} /></div>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>

      {stats && <AdminInsights stats={stats} />}

      {stats?.recentUsers && stats.recentUsers.length > 0 && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Recent User Registrations</h3>
            <button type="button" className="btn btn-secondary small" onClick={() => onNavigate('users')}>
              View All Users ({stats.totalUsers})
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentUsers.map((row) => (
                  <tr key={row.email}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="mini-avatar tiny">{row.name?.charAt(0)?.toUpperCase() ?? 'U'}</div>
                        <div>
                          <strong>{row.name}</strong>
                          <small>{row.email}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className="admin-role-badge">{row.role}</span></td>
                    <td>
                      <span className={statusPill(row.accountStatus, row.isBlocked)}>
                        {row.isBlocked ? 'Blocked' : row.accountStatus}
                      </span>
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Users section ────────────────────────────────────────────────────────────

function UsersSection({ currentUserEmail, onToast }: { currentUserEmail: string; onToast: (msg: string, kind: ToastKind) => void }) {
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null)

  const toggleUserDetail = async (email: string) => {
    if (expandedUser === email) {
      setExpandedUser(null)
      setUserDetail(null)
      return
    }
    setExpandedUser(email)
    setUserDetail(null)
    setDetailLoading(true)
    try {
      setUserDetail(await adminFetch<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(email)}/detail`))
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load user details', 'error')
      setExpandedUser(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (roleFilter !== 'all') params.set('role', roleFilter)
      const data = await adminFetch<{ users: AdminUserRecord[] }>(`/api/admin/users?${params}`)
      setUsers(data.users ?? [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, roleFilter, onToast])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const updateUser = async (email: string, update: Partial<AdminUserRecord>) => {
    try {
      const result = await adminFetch<{ ok: true; user: AdminUserRecord }>(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      })
      setUsers((current) => current.map((u) => u.email === email ? { ...u, ...result.user } : u))
      onToast('User updated successfully', 'success')
      setEditingUser(null)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Update failed', 'error')
    }
  }

  const deleteUser = async (email: string) => {
    try {
      await adminFetch(`/api/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' })
      setUsers((current) => current.filter((u) => u.email !== email))
      onToast('User deleted successfully', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Deletion failed', 'error')
    }
    setConfirmDelete(null)
  }

  return (
    <div className="admin-section">
      {confirmDelete && (
        <ConfirmDialog
          message={`Delete account "${confirmDelete}" permanently? All associated progress and data will be removed.`}
          onConfirm={() => void deleteUser(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {editingUser && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h3>Edit User: {editingUser.email}</h3>
              <button type="button" className="admin-modal-close" onClick={() => setEditingUser(null)}><X size={18} /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault()
              void updateUser(editingUser.email, editingUser)
            }}>
              <div className="admin-modal-body">
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>First Name</label>
                    <input
                      value={editingUser.firstName}
                      onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })}
                      placeholder="First Name"
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Last Name</label>
                    <input
                      value={editingUser.lastName}
                      onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })}
                      placeholder="Last Name"
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Phone Number</label>
                    <input
                      value={editingUser.phone ?? ''}
                      onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                      placeholder="+996..."
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Role</label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                      disabled={editingUser.email === currentUserEmail}
                    >
                      <option value="User">User</option>
                      <option value="Student">Student</option>
                      {editingUser.email === currentUserEmail && <option value="Admin">Admin</option>}
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Account Status</label>
                    <select
                      value={editingUser.accountStatus}
                      onChange={(e) => setEditingUser({ ...editingUser, accountStatus: e.target.value })}
                      disabled={editingUser.email === currentUserEmail}
                    >
                      <option value="active">Active</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>
                  <div className="admin-form-group full-width">
                    <label>Biography</label>
                    <textarea
                      value={editingUser.bio ?? ''}
                      onChange={(e) => setEditingUser({ ...editingUser, bio: e.target.value })}
                      placeholder="User biography..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn btn-secondary small" onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary small">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-section-header">
        <div><span className="eyebrow">Database Records</span><h2>User Management</h2></div>
        <button type="button" className="btn btn-secondary small" onClick={() => void loadUsers()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Registered Users <span className="admin-count-badge">{users.length}</span></h3>
          <div className="table-tools">
            <label className="search-field">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="User">User</option>
              <option value="Student">Student</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state"><RefreshCw size={18} className="spin" /> Loading users…</div>
        ) : users.length === 0 ? (
          <div className="admin-empty-state">No users found</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <Fragment key={row.email}>
                  <tr className={expandedUser === row.email ? 'admin-row-expanded' : ''}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="mini-avatar tiny">{row.name?.charAt(0)?.toUpperCase() ?? 'U'}</div>
                        <div>
                          <strong>{row.name}</strong>
                          <small>{row.email}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className="admin-role-badge">{row.role}</span></td>
                    <td>
                      <span className={statusPill(row.accountStatus, row.isBlocked)}>
                        {row.isBlocked ? 'Blocked' : row.accountStatus}
                      </span>
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn btn-secondary small"
                          onClick={() => setEditingUser({ ...row })}
                          title="Edit user info"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className={`btn small ${row.isBlocked ? 'btn-secondary' : 'btn-warning'}`}
                          onClick={() => void updateUser(row.email, {
                            accountStatus: row.isBlocked ? 'active' : 'blocked',
                            isBlocked: !row.isBlocked
                          })}
                          disabled={row.email === currentUserEmail}
                        >
                          {row.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger small"
                          onClick={() => setConfirmDelete(row.email)}
                          disabled={row.email === currentUserEmail}
                          title="Delete user"
                        >
                          <Trash2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary small"
                          onClick={() => void toggleUserDetail(row.email)}
                          aria-label="Toggle details"
                          aria-expanded={expandedUser === row.email}
                        >
                          {expandedUser === row.email ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedUser === row.email && (
                    <tr className="admin-row-detail">
                      <td colSpan={5}>
                        {detailLoading || !userDetail ? (
                          <div className="admin-empty-state"><RefreshCw size={16} className="spin" /> Loading details…</div>
                        ) : (
                          <div className="admin-info-list">
                            <div className="admin-info-row"><span>Phone</span><strong>{userDetail.user.phone || '—'}</strong></div>
                            <div className="admin-info-row"><span>Bio</span><small>{userDetail.user.bio || '—'}</small></div>
                            <div className="admin-info-row">
                              <span>Subscription</span>
                              <strong>
                                {userDetail.subscription
                                  ? `${userDetail.subscription.planId.toUpperCase()} · ${userDetail.subscription.status} · until ${formatDate(userDetail.subscription.endsAt)}`
                                  : 'FREE (no paid plan)'}
                              </strong>
                            </div>
                            <div className="admin-info-row">
                              <span>Course progress</span>
                              <small>
                                {userDetail.progress.length === 0
                                  ? 'No courses started'
                                  : userDetail.progress.map((p) => `${p.course_id}: ${p.lessons_completed} done (${p.status})`).join(' · ')}
                              </small>
                            </div>
                            <div className="admin-info-row"><span>Reviews</span><strong>{userDetail.reviews.length}</strong></div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Course Management Section ────────────────────────────────────────────────

function CoursesSection({ onToast }: { onToast: (msg: string, kind: ToastKind) => void }) {
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [currentCourse, setCurrentCourse] = useState<Partial<AdminCourse>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadCourses = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<{ courses: AdminCourse[] }>('/api/admin/courses')
      setCourses(data.courses ?? [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load courses', 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => {
    void loadCourses()
  }, [loadCourses])

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (modalMode === 'add') {
        await adminFetch('/api/admin/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentCourse)
        })
        onToast('Course added successfully', 'success')
      } else if (modalMode === 'edit' && currentCourse.id) {
        await adminFetch(`/api/admin/courses/${encodeURIComponent(currentCourse.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentCourse)
        })
        onToast('Course updated successfully', 'success')
      }
      setModalMode(null)
      void loadCourses()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to save course', 'error')
    }
  }

  const togglePublish = async (courseId: string, currentStatus: boolean) => {
    try {
      await adminFetch(`/api/admin/courses/${encodeURIComponent(courseId)}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !currentStatus })
      })
      setCourses((cur) => cur.map((c) => c.id === courseId ? { ...c, isPublished: !currentStatus } : c))
      onToast(`Course ${!currentStatus ? 'published' : 'unpublished'}`, 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to update publication', 'error')
    }
  }

  const deleteCourse = async (courseId: string) => {
    try {
      await adminFetch(`/api/admin/courses/${encodeURIComponent(courseId)}`, { method: 'DELETE' })
      setCourses((cur) => cur.filter((c) => c.id !== courseId))
      onToast('Course and associated lessons deleted', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to delete course', 'error')
    }
    setConfirmDelete(null)
  }

  const filtered = courses.filter((c) => {
    const matchSearch = search.trim() === '' ||
      c.title_ru.toLowerCase().includes(search.toLowerCase()) ||
      c.title_kg.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'all' || c.category === categoryFilter
    return matchSearch && matchCat
  })

  return (
    <div className="admin-section">
      {confirmDelete && (
        <ConfirmDialog
          message={`Delete course "${confirmDelete}" and all its lessons? This cannot be undone.`}
          onConfirm={() => void deleteCourse(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {modalMode && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card large">
            <div className="admin-modal-header">
              <h3>{modalMode === 'add' ? 'Add New Course' : `Edit Course: ${currentCourse.id}`}</h3>
              <button type="button" className="admin-modal-close" onClick={() => setModalMode(null)}><X size={18} /></button>
            </div>
            <form onSubmit={(e) => void handleSaveCourse(e)}>
              <div className="admin-modal-body">
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Course ID / Slug</label>
                    <input
                      value={currentCourse.id ?? ''}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, id: e.target.value })}
                      placeholder="e.g. react-native"
                      disabled={modalMode === 'edit'}
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Badge</label>
                    <input
                      value={currentCourse.badge ?? ''}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, badge: e.target.value })}
                      placeholder="e.g. Mobile"
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Title (Russian)</label>
                    <input
                      value={currentCourse.title_ru ?? ''}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, title_ru: e.target.value })}
                      placeholder="Course title in Russian"
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Title (Kyrgyz)</label>
                    <input
                      value={currentCourse.title_kg ?? ''}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, title_kg: e.target.value })}
                      placeholder="Course title in Kyrgyz"
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Title (English)</label>
                    <input
                      value={currentCourse.title_en ?? ''}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, title_en: e.target.value })}
                      placeholder="Course title in English"
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Category</label>
                    <input
                      value={currentCourse.category ?? ''}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, category: e.target.value })}
                      placeholder="Frontend, AI & Data, Career, Design..."
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Level</label>
                    <select
                      value={currentCourse.level ?? 'Beginner'}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, level: e.target.value })}
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Duration</label>
                    <input
                      value={currentCourse.duration ?? ''}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, duration: e.target.value })}
                      placeholder="e.g. 6 недель"
                    />
                  </div>
                  <div className="admin-form-group full-width">
                    <label>Description (Russian)</label>
                    <textarea
                      value={currentCourse.description_ru ?? ''}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, description_ru: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="admin-form-group full-width">
                    <label>Description (Kyrgyz)</label>
                    <textarea
                      value={currentCourse.description_kg ?? ''}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, description_kg: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="admin-form-group full-width">
                    <label>Description (English)</label>
                    <textarea
                      value={currentCourse.description_en ?? ''}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, description_en: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Card Color Hex</label>
                    <input
                      value={currentCourse.color ?? '#ffefeb'}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, color: e.target.value })}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Accent Color Hex</label>
                    <input
                      value={currentCourse.accent ?? '#f97316'}
                      onChange={(e) => setCurrentCourse({ ...currentCourse, accent: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn btn-secondary small" onClick={() => setModalMode(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary small">
                  {modalMode === 'add' ? 'Create Course' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-section-header">
        <div><span className="eyebrow">Database Catalog</span><h2>Course Management</h2></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary small"
            onClick={() => {
              setCurrentCourse({
                badge: 'Web',
                category: 'Frontend',
                level: 'Beginner',
                duration: '6 недель',
                color: '#ffefeb',
                accent: '#f97316',
                isPublished: true
              })
              setModalMode('add')
            }}
          >
            <Plus size={14} /> Add Course
          </button>
          <button type="button" className="btn btn-secondary small" onClick={() => void loadCourses()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>All Courses <span className="admin-count-badge">{filtered.length}</span></h3>
          <div className="table-tools">
            <label className="search-field">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses" />
            </label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              <option value="Frontend">Frontend</option>
              <option value="AI & Data">AI & Data</option>
              <option value="Career">Career</option>
              <option value="CS Basics">CS Basics</option>
              <option value="Science">Science</option>
              <option value="Design">Design</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state"><RefreshCw size={18} className="spin" /> Loading courses…</div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty-state">No courses found</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Badge</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Level</th>
                  <th>Lessons</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td><span className="plan-tag" style={{ background: c.color, color: c.accent }}>{c.badge}</span></td>
                    <td>
                      <div>
                        <strong>{c.title_ru}</strong>
                        <small style={{ display: 'block', color: 'var(--muted)' }}>{c.id}</small>
                      </div>
                    </td>
                    <td><span className="admin-badge-category">{c.category}</span></td>
                    <td><span className="admin-badge-level">{c.level}</span></td>
                    <td><strong>{c.lessonsCount}</strong></td>
                    <td>
                      <span className={c.isPublished ? 'admin-pill success' : 'admin-pill neutral'}>
                        {c.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn btn-secondary small"
                          onClick={() => {
                            setCurrentCourse({ ...c })
                            setModalMode('edit')
                          }}
                          title="Edit course"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className={`btn small ${c.isPublished ? 'btn-warning' : 'btn-secondary'}`}
                          onClick={() => void togglePublish(c.id, c.isPublished)}
                        >
                          {c.isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger small"
                          onClick={() => setConfirmDelete(c.id)}
                          title="Delete course"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Lesson Management Section ────────────────────────────────────────────────

function LessonsSection({ onToast }: { onToast: (msg: string, kind: ToastKind) => void }) {
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [lessons, setLessons] = useState<AdminLesson[]>([])
  const [selectedCourse, setSelectedCourse] = useState('all')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [currentLesson, setCurrentLesson] = useState<Partial<AdminLesson>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const coursesData = await adminFetch<{ courses: AdminCourse[] }>('/api/admin/courses')
      setCourses(coursesData.courses ?? [])

      const params = selectedCourse !== 'all' ? `?courseId=${encodeURIComponent(selectedCourse)}` : ''
      const lessonsData = await adminFetch<{ lessons: AdminLesson[] }>(`/api/admin/lessons${params}`)
      setLessons(lessonsData.lessons ?? [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load lessons', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedCourse, onToast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (modalMode === 'add') {
        await adminFetch('/api/admin/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentLesson)
        })
        onToast('Lesson added successfully', 'success')
      } else if (modalMode === 'edit' && currentLesson.id) {
        await adminFetch(`/api/admin/lessons/${encodeURIComponent(currentLesson.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentLesson)
        })
        onToast('Lesson updated successfully', 'success')
      }
      setModalMode(null)
      void loadData()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to save lesson', 'error')
    }
  }

  const deleteLesson = async (lessonId: string) => {
    try {
      await adminFetch(`/api/admin/lessons/${encodeURIComponent(lessonId)}`, { method: 'DELETE' })
      setLessons((cur) => cur.filter((l) => l.id !== lessonId))
      onToast('Lesson deleted successfully', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to delete lesson', 'error')
    }
    setConfirmDelete(null)
  }

  const reorderLesson = async (lessonId: string, direction: 'up' | 'down') => {
    try {
      await adminFetch(`/api/admin/lessons/${encodeURIComponent(lessonId)}/order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction })
      })
      void loadData()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to reorder', 'error')
    }
  }

  const filtered = lessons.filter((l) => {
    return search.trim() === '' ||
      l.title_ru.toLowerCase().includes(search.toLowerCase()) ||
      l.id.toLowerCase().includes(search.toLowerCase()) ||
      l.courseId.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="admin-section">
      {confirmDelete && (
        <ConfirmDialog
          message={`Delete lesson "${confirmDelete}" permanently?`}
          onConfirm={() => void deleteLesson(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {modalMode && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-card large">
            <div className="admin-modal-header">
              <h3>{modalMode === 'add' ? 'Add New Lesson' : `Edit Lesson: ${currentLesson.id}`}</h3>
              <button type="button" className="admin-modal-close" onClick={() => setModalMode(null)}><X size={18} /></button>
            </div>
            <form onSubmit={(e) => void handleSaveLesson(e)}>
              <div className="admin-modal-body">
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Course Assignment</label>
                    <select
                      value={currentLesson.courseId ?? (courses[0]?.id ?? '')}
                      onChange={(e) => setCurrentLesson({ ...currentLesson, courseId: e.target.value })}
                      required
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title_ru} ({c.id})</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Duration</label>
                    <input
                      value={currentLesson.duration ?? '30 мин'}
                      onChange={(e) => setCurrentLesson({ ...currentLesson, duration: e.target.value })}
                      placeholder="e.g. 45 мин"
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Title (Russian)</label>
                    <input
                      value={currentLesson.title_ru ?? ''}
                      onChange={(e) => setCurrentLesson({ ...currentLesson, title_ru: e.target.value })}
                      placeholder="Lesson title in Russian"
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Title (Kyrgyz)</label>
                    <input
                      value={currentLesson.title_kg ?? ''}
                      onChange={(e) => setCurrentLesson({ ...currentLesson, title_kg: e.target.value })}
                      placeholder="Lesson title in Kyrgyz"
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Title (English)</label>
                    <input
                      value={currentLesson.title_en ?? ''}
                      onChange={(e) => setCurrentLesson({ ...currentLesson, title_en: e.target.value })}
                      placeholder="Lesson title in English"
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Lesson Type</label>
                    <select
                      value={currentLesson.type ?? 'Видеоурок'}
                      onChange={(e) => setCurrentLesson({ ...currentLesson, type: e.target.value })}
                    >
                      <option value="Видеоурок">Видеоурок</option>
                      <option value="Видео + практика">Видео + практика</option>
                      <option value="Теория + тест">Теория + тест</option>
                    </select>
                  </div>
                  <div className="admin-form-group full-width">
                    <label>Video URL (YouTube or embed)</label>
                    <input
                      value={currentLesson.videoUrl ?? ''}
                      onChange={(e) => setCurrentLesson({ ...currentLesson, videoUrl: e.target.value })}
                      placeholder="https://youtu.be/..."
                    />
                  </div>
                  <div className="admin-form-group full-width">
                    <label>Theory & Materials</label>
                    <textarea
                      value={currentLesson.theory ?? ''}
                      onChange={(e) => setCurrentLesson({ ...currentLesson, theory: e.target.value })}
                      rows={3}
                      placeholder="Lesson theoretical explanation..."
                    />
                  </div>
                  <div className="admin-form-group full-width">
                    <label>Practical Task</label>
                    <textarea
                      value={currentLesson.task ?? ''}
                      onChange={(e) => setCurrentLesson({ ...currentLesson, task: e.target.value })}
                      rows={2}
                      placeholder="Exercise for students..."
                    />
                  </div>
                  <div className="admin-form-group full-width">
                    <label>Code Snippet</label>
                    <textarea
                      value={currentLesson.code ?? ''}
                      onChange={(e) => setCurrentLesson({ ...currentLesson, code: e.target.value })}
                      rows={3}
                      placeholder="Example code..."
                    />
                  </div>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn btn-secondary small" onClick={() => setModalMode(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary small">
                  {modalMode === 'add' ? 'Create Lesson' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-section-header">
        <div><span className="eyebrow">Database Lessons</span><h2>Lesson Management</h2></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary small"
            onClick={() => {
              setCurrentLesson({
                courseId: selectedCourse !== 'all' ? selectedCourse : (courses[0]?.id ?? 'html'),
                type: 'Видеоурок',
                duration: '35 мин'
              })
              setModalMode('add')
            }}
          >
            <Plus size={14} /> Add Lesson
          </button>
          <button type="button" className="btn btn-secondary small" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Lessons <span className="admin-count-badge">{filtered.length}</span></h3>
          <div className="table-tools">
            <label className="search-field">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lessons" />
            </label>
            <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title_ru}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state"><RefreshCw size={18} className="spin" /> Loading lessons…</div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty-state">No lessons found</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Order</th>
                  <th>Title</th>
                  <th>Course</th>
                  <th>Duration</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="admin-order-controls">
                        <span style={{ fontWeight: 600, minWidth: '18px' }}>#{l.orderIndex}</span>
                        <button type="button" className="admin-order-btn" onClick={() => void reorderLesson(l.id, 'up')} title="Move Up">
                          <ArrowUp size={12} />
                        </button>
                        <button type="button" className="admin-order-btn" onClick={() => void reorderLesson(l.id, 'down')} title="Move Down">
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{l.title_ru}</strong>
                        <small style={{ display: 'block', color: 'var(--muted)' }}>{l.id}</small>
                      </div>
                    </td>
                    <td><span className="admin-badge-category">{l.courseId}</span></td>
                    <td><small>{l.duration}</small></td>
                    <td><small>{l.type}</small></td>
                    <td>
                      <span className={l.isPublished ? 'admin-pill success' : 'admin-pill neutral'}>
                        {l.isPublished ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn btn-secondary small"
                          onClick={() => {
                            setCurrentLesson({ ...l })
                            setModalMode('edit')
                          }}
                          title="Edit lesson"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger small"
                          onClick={() => setConfirmDelete(l.id)}
                          title="Delete lesson"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── AI Pro Management Section ────────────────────────────────────────────────

function AiProSection({ onToast }: { onToast: (msg: string, kind: ToastKind) => void }) {
  const [systemEnabled, setSystemEnabled] = useState(true)
  const [aiProvider, setAiProvider] = useState<{ configured: boolean; model: string } | null>(null)
  const [activeUsersCount, setActiveUsersCount] = useState(0)
  const [totalGrants, setTotalGrants] = useState(0)
  const [users, setUsers] = useState<AdminAiProUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadAiProData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<{
        provider?: { configured: boolean; model: string }
        systemEnabled: boolean
        activeAiProUsers: number
        totalAiProGrants: number
        users: AdminAiProUser[]
      }>('/api/admin/ai-pro')

      setSystemEnabled(data.systemEnabled)
      setAiProvider(data.provider ?? null)
      setActiveUsersCount(data.activeAiProUsers)
      setTotalGrants(data.totalAiProGrants)
      setUsers(data.users ?? [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load AI Pro data', 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => {
    void loadAiProData()
  }, [loadAiProData])

  const toggleSystemAvailability = async () => {
    try {
      const next = !systemEnabled
      await adminFetch('/api/admin/ai-pro/system', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next })
      })
      setSystemEnabled(next)
      onToast(`AI Pro system feature ${next ? 'enabled' : 'disabled'}`, 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to toggle AI Pro system', 'error')
    }
  }

  const toggleUserAiPro = async (userEmail: string, action: 'activate' | 'deactivate') => {
    try {
      await adminFetch('/api/admin/ai-pro/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, action, days: 30 })
      })
      onToast(`AI Pro ${action === 'activate' ? 'activated for 30 days' : 'deactivated'}`, 'success')
      void loadAiProData()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Operation failed', 'error')
    }
  }

  const filtered = users.filter((u) => {
    const matchSearch = search.trim() === '' ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || u.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div><span className="eyebrow">Service Control</span><h2>AI Pro Management</h2></div>
        <button type="button" className="btn btn-secondary small" onClick={() => void loadAiProData()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* System-wide Availability Control */}
      <div className="admin-system-toggle-card">
        <div className="admin-toggle-info">
          <strong>System-wide AI Pro Availability</strong>
          <p>
            When enabled, users with active AI Pro subscriptions can use the interactive AI learning assistant.
          </p>
        </div>
        <button
          type="button"
          className={`admin-toggle-btn ${systemEnabled ? 'active' : 'inactive'}`}
          onClick={() => void toggleSystemAvailability()}
        >
          {systemEnabled ? '✓ AI Pro Enabled' : '✕ AI Pro Disabled'}
        </button>
      </div>

      {aiProvider && (
        <p className="admin-hint">
          AI provider (Claude API): {aiProvider.configured
            ? <span className="admin-pill success">configured · {aiProvider.model}</span>
            : <span className="admin-pill danger">not configured — set ANTHROPIC_API_KEY on the backend</span>}
        </p>
      )}

      <div className="admin-stats-grid compact-stats">
        <div className="admin-stat-card purple">
          <div className="admin-stat-icon"><Sparkles size={18} /></div>
          <div>
            <strong>{activeUsersCount}</strong>
            <span>Active AI Pro Users</span>
          </div>
        </div>
        <div className="admin-stat-card cyan">
          <div className="admin-stat-icon"><Crown size={18} /></div>
          <div>
            <strong>{totalGrants}</strong>
            <span>Total Historical Grants</span>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>User AI Pro Access <span className="admin-count-badge">{filtered.length}</span></h3>
          <div className="table-tools">
            <label className="search-field">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users" />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active Access</option>
              <option value="expired">Expired</option>
              <option value="none">No Access</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state"><RefreshCw size={18} className="spin" /> Loading AI Pro records…</div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty-state">No users matching filter</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Days Remaining</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.email}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="mini-avatar tiny">{u.name?.charAt(0)?.toUpperCase() ?? 'U'}</div>
                        <div>
                          <strong>{u.name}</strong>
                          <small>{u.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={u.hasAiPro ? 'admin-pill violet' : u.status === 'expired' ? 'admin-pill danger' : 'admin-pill neutral'}>
                        {u.hasAiPro ? 'Active AI Pro' : u.status === 'expired' ? 'Expired' : 'None'}
                      </span>
                    </td>
                    <td>
                      {u.hasAiPro ? <strong>{u.daysRemaining} days</strong> : '—'}
                    </td>
                    <td>{formatDate(u.endsAt)}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn btn-primary small"
                          onClick={() => void toggleUserAiPro(u.email, 'activate')}
                          title="Grant or extend 30 days"
                        >
                          <Sparkles size={13} /> {u.hasAiPro ? '+30 Days' : 'Activate (30d)'}
                        </button>
                        {u.hasAiPro && (
                          <button
                            type="button"
                            className="btn btn-warning small"
                            onClick={() => void toggleUserAiPro(u.email, 'deactivate')}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Reviews section ──────────────────────────────────────────────────────────

function ReviewsSection({ onToast }: { onToast: (msg: string, kind: ToastKind) => void }) {
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [statusFilter, setStatusFilter] = useState('all')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadReviews = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const data = await adminFetch<{ reviews: AdminReview[] }>(`/api/admin/reviews?${params}`)
      setReviews(data.reviews ?? [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load reviews', 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, onToast])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  const moderateReview = async (id: string, moderationStatus: string) => {
    try {
      await adminFetch(`/api/admin/reviews/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moderationStatus })
      })
      setReviews((current) => current.map((r) => r.id === id ? { ...r, moderationStatus } : r))
      onToast(`Review ${moderationStatus}`, 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Moderation failed', 'error')
    }
  }

  const deleteReview = async (id: string) => {
    try {
      await adminFetch(`/api/admin/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' })
      setReviews((current) => current.filter((r) => r.id !== id))
      onToast('Review deleted permanently', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Deletion failed', 'error')
    }
    setConfirmDelete(null)
  }

  const moderationPill = (status: string) => {
    if (status === 'published') return 'admin-pill success'
    if (status === 'rejected') return 'admin-pill danger'
    return 'admin-pill neutral'
  }

  return (
    <div className="admin-section">
      {confirmDelete && (
        <ConfirmDialog
          message="Delete this review permanently from the database?"
          onConfirm={() => void deleteReview(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div className="admin-section-header">
        <div><span className="eyebrow">Database Reviews</span><h2>Reviews & Ratings</h2></div>
        <button type="button" className="btn btn-secondary small" onClick={() => void loadReviews()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>All Reviews <span className="admin-count-badge">{reviews.length}</span></h3>
          <div className="table-tools">
            <label className="search-field">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reviews" />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="hidden">Hidden</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state"><RefreshCw size={18} className="spin" /> Loading reviews…</div>
        ) : reviews.length === 0 ? (
          <div className="admin-empty-state">No reviews found</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Lesson</th>
                  <th>Rating</th>
                  <th>Text</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="mini-avatar tiny">{row.userName?.charAt(0)?.toUpperCase() ?? 'U'}</div>
                        <div><strong>{row.userName}</strong><small>{row.userId}</small></div>
                      </div>
                    </td>
                    <td><small>{row.lessonLabel}</small></td>
                    <td><span className="stars-small">{'★'.repeat(row.rating)}{'☆'.repeat(5 - row.rating)}</span></td>
                    <td><span className="admin-review-text">{row.text}</span></td>
                    <td><span className={moderationPill(row.moderationStatus)}>{row.moderationStatus}</span></td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <div className="admin-actions">
                        {row.moderationStatus !== 'published' && (
                          <button type="button" className="btn btn-secondary small" onClick={() => void moderateReview(row.id, 'published')}>
                            Publish
                          </button>
                        )}
                        {row.moderationStatus !== 'hidden' && (
                          <button type="button" className="btn btn-warning small" onClick={() => void moderateReview(row.id, 'hidden')}>
                            Hide
                          </button>
                        )}
                        {row.moderationStatus !== 'rejected' && (
                          <button type="button" className="btn btn-warning small" onClick={() => void moderateReview(row.id, 'rejected')}>
                            Reject
                          </button>
                        )}
                        <button type="button" className="btn btn-danger small" onClick={() => setConfirmDelete(row.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Subscriptions section ────────────────────────────────────────────────────

function SubscriptionsSection({ onToast }: { onToast: (msg: string, kind: ToastKind) => void }) {
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [grantTarget, setGrantTarget] = useState<string | null>(null)
  const [grantPlan, setGrantPlan] = useState('pro')

  const loadSubs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
      if (planFilter !== 'all') params.set('plan', planFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const data = await adminFetch<{ subscriptions: AdminSubscription[] }>(`/api/admin/subscriptions?${params}`)
      setSubscriptions(data.subscriptions ?? [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load subscriptions', 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, planFilter, statusFilter, onToast])

  useEffect(() => { void loadSubs() }, [loadSubs])

  const updateSub = async (userEmail: string, action: 'activate' | 'revoke', planId?: string) => {
    try {
      await adminFetch(`/api/admin/subscriptions/${encodeURIComponent(userEmail)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, planId })
      })
      onToast(`Subscription ${action === 'activate' ? 'activated' : 'revoked'} successfully`, 'success')
      void loadSubs()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Operation failed', 'error')
    }
    setGrantTarget(null)
  }

  const subStatusPill = (status: string) => {
    if (status === 'active') return 'admin-pill success'
    if (status === 'expired') return 'admin-pill danger'
    if (status === 'cancelled') return 'admin-pill warning'
    return 'admin-pill neutral'
  }

  return (
    <div className="admin-section">
      {historyFor && <SubscriptionHistoryModal userEmail={historyFor} onClose={() => setHistoryFor(null)} />}
      {grantTarget && (
        <div className="admin-confirm-backdrop">
          <div className="admin-confirm-card">
            <h3>Activate Subscription</h3>
            <p>Grant a subscription plan to <strong>{grantTarget}</strong></p>
            <select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)} className="admin-inline-select">
              <option value="pro">PRO plan (free grant, plan period)</option>
              <option value="aipro">AI PRO plan (free grant, plan period)</option>
            </select>
            <div className="admin-confirm-actions">
              <button type="button" className="btn btn-secondary small" onClick={() => setGrantTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-primary small" onClick={() => void updateSub(grantTarget, 'activate', grantPlan)}>
                Activate Plan
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-section-header">
        <div><span className="eyebrow">Database Subscriptions</span><h2>Subscriptions</h2></div>
        <button type="button" className="btn btn-secondary small" onClick={() => void loadSubs()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Active Subscriptions <span className="admin-count-badge">{subscriptions.length}</span></h3>
          <div className="table-tools">
            <label className="search-field">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email or name" />
            </label>
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="pro">PRO</option>
              <option value="aipro">AI PRO</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state"><RefreshCw size={18} className="spin" /> Loading subscriptions…</div>
        ) : subscriptions.length === 0 ? (
          <div className="admin-empty-state">No subscriptions found</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Expires</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((row) => (
                  <tr key={row.userEmail}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="mini-avatar tiny">{row.userName?.charAt(0)?.toUpperCase() ?? 'U'}</div>
                        <div><strong>{row.userName}</strong><small>{row.userEmail}</small></div>
                      </div>
                    </td>
                    <td><span className={planBadgeClass(row.planId)}>{row.planId.toUpperCase()}</span></td>
                    <td><span className={subStatusPill(row.status)}>{row.status}</span></td>
                    <td>{formatDate(row.startedAt)}</td>
                    <td>{formatDate(row.endsAt)}</td>
                    <td>{row.paymentMethod}</td>
                    <td>{row.amount ? formatMoney(row.amount, row.currency) : 'Free'}</td>
                    <td>
                      <div className="admin-actions">
                        <button type="button" className="btn btn-secondary small" onClick={() => setGrantTarget(row.userEmail)}>
                          Grant
                        </button>
                        <button type="button" className="btn btn-secondary small" onClick={() => setHistoryFor(row.userEmail)}>History</button>
                        <button type="button" className="btn btn-warning small" onClick={() => void updateSub(row.userEmail, 'revoke')}>
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Payments section ─────────────────────────────────────────────────────────

function PaymentsSection({ onToast }: { onToast: (msg: string, kind: ToastKind) => void }) {
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailFor, setDetailFor] = useState<string | null>(null)

  const loadPayments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const data = await adminFetch<{ payments: AdminPayment[] }>(`/api/admin/payments?${params}`)
      setPayments(data.payments ?? [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load payments', 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, onToast])

  useEffect(() => { void loadPayments() }, [loadPayments])

  const payStatusPill = (status: string) => {
    if (status === 'paid') return 'admin-pill success'
    if (status === 'cancelled') return 'admin-pill danger'
    return 'admin-pill neutral'
  }

  const totalRevenue = payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="admin-section">
      {detailFor && <PaymentDetailModal orderId={detailFor} onClose={() => setDetailFor(null)} />}
      <div className="admin-section-header">
        <div><span className="eyebrow">Database Transactions</span><h2>Payment History</h2></div>
        <button type="button" className="btn btn-secondary small" onClick={() => void loadPayments()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="admin-stats-grid compact-stats">
        <div className="admin-stat-card green">
          <div className="admin-stat-icon"><WalletCards size={18} /></div>
          <div>
            <strong>{formatMoney(totalRevenue)}</strong>
            <span>Verified Paid Revenue</span>
          </div>
        </div>
        <div className="admin-stat-card cyan">
          <div className="admin-stat-icon"><TrendingUp size={18} /></div>
          <div>
            <strong>{payments.filter((p) => p.status === 'paid').length}</strong>
            <span>Successful Payments</span>
          </div>
        </div>
        <div className="admin-stat-card amber">
          <div className="admin-stat-icon"><AlertCircle size={18} /></div>
          <div>
            <strong>{payments.filter((p) => p.status === 'pending').length}</strong>
            <span>Pending Orders</span>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Payment Orders <span className="admin-count-badge">{payments.length}</span></h3>
          <div className="table-tools">
            <label className="search-field">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email or order ID" />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state"><RefreshCw size={18} className="spin" /> Loading payments…</div>
        ) : payments.length === 0 ? (
          <div className="admin-empty-state">No payment records found</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Activated</th>
                  <th>Date</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((row) => (
                  <tr key={row.id}>
                    <td><small className="admin-mono">{row.id.slice(0, 8)}…</small></td>
                    <td><small>{row.userEmail}</small></td>
                    <td><span className={planBadgeClass(row.planId)}>{row.planId.toUpperCase()}</span></td>
                    <td>{row.paymentMethod}</td>
                    <td>{formatMoney(row.amount, row.currency)}</td>
                    <td><span className={payStatusPill(row.status)}>{row.status}</span></td>
                    <td>
                      {row.isActivated
                        ? <span className="admin-pill success">Yes</span>
                        : <span className="admin-pill neutral">No</span>}
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td><button type="button" className="btn btn-secondary small" onClick={() => setDetailFor(row.id)}>Details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Settings section ─────────────────────────────────────────────────────────

function SettingsSection({ adminEmail, onLogout, onToast }: { adminEmail: string; onLogout: () => void; onToast: (msg: string, kind: ToastKind) => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const strength = passwordStrength(newPassword)
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setNotice({ kind: 'error', message: 'All password fields are required' })
      return
    }

    if (newPassword.length < 8) {
      setNotice({ kind: 'error', message: 'New password must be at least 8 characters' })
      return
    }

    if (newPassword !== confirmPassword) {
      setNotice({ kind: 'error', message: 'New passwords do not match' })
      return
    }

    if (!/[A-Za-zА-Яа-яЁё]/.test(newPassword) || !/\d/.test(newPassword)) {
      setNotice({ kind: 'error', message: 'New password must contain both letters and digits' })
      return
    }

    if (newPassword === currentPassword) {
      setNotice({ kind: 'error', message: 'New password must be different from the current password' })
      return
    }

    setSubmitting(true)
    try {
      await adminFetch('/api/admin/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      })

      setNotice({ kind: 'success', message: 'Password changed successfully. You will be logged out.' })
      onToast('Password changed successfully. Logging out…', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        onLogout()
      }, 1800)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password change failed'
      setNotice({ kind: 'error', message })
      onToast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div><span className="eyebrow">Admin Panel</span><h2>Settings & Security</h2></div>
      </div>

      <div className="admin-settings-grid">
        <TelegramSettingsCard onToast={onToast} />
        <div className="admin-card admin-settings-card">
          <div className="admin-card-header"><h3><Lock size={16} /> Security — Change Password</h3></div>

          <form className="admin-settings-form" onSubmit={(e) => void handlePasswordChange(e)}>
            <div className="admin-form-row">
              <label>
                <span>Current Password</span>
                <div className="password-field">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setNotice(null) }}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowCurrent((v) => !v)} aria-label="Toggle password visibility">
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </label>
            </div>

            <div className="admin-form-row">
              <label>
                <span>New Password</span>
                <div className="password-field">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setNotice(null) }}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowNew((v) => !v)} aria-label="Toggle password visibility">
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {newPassword && (
                  <div className="password-strength-bar">
                    <div
                      className="password-strength-fill"
                      style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }}
                    />
                    <span style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                )}
              </label>
            </div>

            <div className="admin-form-row">
              <label>
                <span>Confirm New Password</span>
                <div className="password-field">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setNotice(null) }}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label="Toggle password visibility">
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {confirmPassword && (
                  <small style={{ color: passwordsMatch ? '#38a169' : '#e53e3e' }}>
                    {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </small>
                )}
              </label>
            </div>

            <ul className="admin-password-rules">
              <li className={currentPassword.length > 0 ? 'rule-met' : ''}>Enter current password</li>
              <li className={newPassword.length >= 8 ? 'rule-met' : ''}>At least 8 characters</li>
              <li className={/[A-Z]/.test(newPassword) ? 'rule-met' : ''}>At least one uppercase letter</li>
              <li className={/[0-9]/.test(newPassword) ? 'rule-met' : ''}>At least one number</li>
              <li className={passwordsMatch ? 'rule-met' : ''}>Passwords match</li>
            </ul>

            {notice && (
              <div className={`admin-notice admin-notice-${notice.kind}`}>
                {notice.kind === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                <span>{notice.message}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Changing Password…' : 'Change Password'}
            </button>
          </form>
        </div>

        <div className="admin-card admin-settings-card">
          <div className="admin-card-header"><h3><ShieldCheck size={16} /> Account Information</h3></div>
          <div className="admin-info-list">
            <div className="admin-info-row">
              <span>Admin Email</span>
              <strong>{adminEmail}</strong>
            </div>
            <div className="admin-info-row">
              <span>Role</span>
              <span className="admin-pill success">Single Administrator</span>
            </div>
            <div className="admin-info-row">
              <span>Admin Privileges</span>
              <small>Protected backend singleton account. Only one administrator account is permitted.</small>
            </div>
          </div>

          <div className="admin-settings-divider" />

          <div className="admin-card-header"><h3><Lock size={16} /> Security Rules</h3></div>
          <ul className="check-list compact-list admin-tips-list">
            <li><Check size={13} /> Only ONE administrator account permitted</li>
            <li><Check size={13} /> Strict backend RBAC on all admin endpoints (HTTP 403 on violations)</li>
            <li><Check size={13} /> SHA-256 session tokens with O(1) indexed database lookups</li>
            <li><Check size={13} /> Passwords hashed with bcrypt 12-round work factor</li>
            <li><Check size={13} /> Rate-limited authentication & password reset endpoints</li>
          </ul>

          <div className="admin-settings-divider" />

          <button
            type="button"
            className="btn btn-danger full-width"
            onClick={onLogout}
          >
            <LogOut size={15} /> Secure Logout
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main AdminPanel Component ────────────────────────────────────────────────

type AdminPanelProps = {
  user: UserProfile | null
  onLogout: () => void
}

// ─── Plans (prices, texts, availability) ──────────────────────────────────────

type AdminPlan = {
  id: 'free' | 'pro' | 'aipro'
  name: string
  price: number
  currency: string
  durationDays: number
  isEnabled: boolean
  isFeatured: boolean
  label: { kg: string; ru: string; en: string }
  description: { kg: string; ru: string; en: string }
  features: { kg: string[]; ru: string[]; en: string[] }
  updatedAt: string
}

const PLAN_LANGS = [['kg', 'Кыргызча'], ['ru', 'Русский'], ['en', 'English']] as const

function PlansSection({ onToast }: { onToast: (msg: string, kind: ToastKind) => void }) {
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AdminPlan | null>(null)
  const [featuresText, setFeaturesText] = useState({ kg: '', ru: '', en: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<{ plans: AdminPlan[] }>('/api/admin/plans')
      setPlans(data.plans ?? [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load plans', 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => { void load() }, [load])

  const save = async (planId: string, patch: Record<string, unknown>, message: string) => {
    setSaving(true)
    try {
      await adminFetch(`/api/admin/plans/${planId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      onToast(message, 'success')
      setEditing(null)
      void load()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to save plan', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openEditor = (plan: AdminPlan) => {
    setEditing({ ...plan, label: { ...plan.label }, description: { ...plan.description } })
    setFeaturesText({ kg: plan.features.kg.join('\n'), ru: plan.features.ru.join('\n'), en: plan.features.en.join('\n') })
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div>
          <span className="eyebrow">Pricing</span>
          <h2>Plans</h2>
        </div>
        <button type="button" className="btn btn-secondary small" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>
      <p className="admin-hint">Prices and texts are read by the website and by the payment backend. A new price applies to new orders only; already paid subscriptions are not changed.</p>
      {loading && <div className="admin-loading-bar" />}
      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Price</th>
                <th>Period</th>
                <th>Status</th>
                <th>Recommended</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td><strong>{plan.name}</strong><br /><small>{plan.label.ru}</small></td>
                  <td>{formatMoney(plan.price, plan.currency)}</td>
                  <td>{plan.durationDays} days</td>
                  <td><span className={plan.isEnabled ? 'admin-pill success' : 'admin-pill neutral'}>{plan.isEnabled ? 'Enabled' : 'Disabled'}</span></td>
                  <td>{plan.isFeatured ? 'Yes' : '—'}</td>
                  <td>{formatDate(plan.updatedAt)}</td>
                  <td>
                    <div className="admin-actions">
                      <button type="button" className="btn btn-secondary small" onClick={() => openEditor(plan)} title="Edit plan"><Edit2 size={13} /> Edit</button>
                      {plan.id !== 'free' && (
                        <button type="button" className={`btn small ${plan.isEnabled ? 'btn-warning' : 'btn-secondary'}`} onClick={() => void save(plan.id, { isEnabled: !plan.isEnabled }, plan.isEnabled ? `${plan.name} disabled` : `${plan.name} enabled`)}>
                          {plan.isEnabled ? 'Disable' : 'Enable'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Edit ${editing.name}`}>
          <div className="admin-modal-card large">
            <div className="admin-modal-header">
              <h3>Edit plan: {editing.name}</h3>
              <button type="button" className="admin-modal-close" onClick={() => setEditing(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <form
              className="admin-modal-body"
              onSubmit={(event) => {
                event.preventDefault()
                const features = Object.fromEntries(PLAN_LANGS.map(([lang]) => [lang, featuresText[lang].split('\n').map((line) => line.trim()).filter(Boolean)]))
                void save(editing.id, {
                  price: Number(editing.price),
                  durationDays: Number(editing.durationDays),
                  isFeatured: editing.isFeatured,
                  label: editing.label,
                  description: editing.description,
                  features
                }, `${editing.name} saved`)
              }}
            >
              <div className="admin-form-grid">
                <label className="admin-form-group">
                  <span>Price ({editing.currency})</span>
                  <input type="number" min={0} step={1} value={editing.price} disabled={editing.id === 'free'} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
                </label>
                <label className="admin-form-group">
                  <span>Period (days)</span>
                  <input type="number" min={1} max={366} step={1} value={editing.durationDays} onChange={(e) => setEditing({ ...editing, durationDays: Number(e.target.value) })} />
                </label>
                <label className="admin-form-group full-width admin-checkbox-row">
                  <input type="checkbox" checked={editing.isFeatured} onChange={(e) => setEditing({ ...editing, isFeatured: e.target.checked })} />
                  <span>Highlight as the recommended plan</span>
                </label>
                {PLAN_LANGS.map(([lang, langName]) => (
                  <Fragment key={lang}>
                    <label className="admin-form-group">
                      <span>Title — {langName}</span>
                      <input value={editing.label[lang]} maxLength={80} onChange={(e) => setEditing({ ...editing, label: { ...editing.label, [lang]: e.target.value } })} />
                    </label>
                    <label className="admin-form-group">
                      <span>Description — {langName}</span>
                      <input value={editing.description[lang]} maxLength={400} onChange={(e) => setEditing({ ...editing, description: { ...editing.description, [lang]: e.target.value } })} />
                    </label>
                    <label className="admin-form-group full-width">
                      <span>Features — {langName} (one per line)</span>
                      <textarea rows={4} value={featuresText[lang]} onChange={(e) => setFeaturesText({ ...featuresText, [lang]: e.target.value })} />
                    </label>
                  </Fragment>
                ))}
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn btn-secondary small" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary small" disabled={saving}>{saving ? 'Saving…' : 'Save Plan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Payment details & subscription history dialogs ───────────────────────────

type PaymentDetail = {
  order: { id: string; userEmail: string; planId: string; paymentMethod: string; amount: number; currency: string; provider: string; providerOrderId: string | null; providerPaymentId: string | null; status: string; isActivated: boolean; createdAt: string; updatedAt: string; lastProviderPayload: unknown }
  transactions: Array<{ id: string; provider: string; transactionId: string; amount: number; currency: string; status: string; createdAt: string }>
}

function PaymentDetailModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<PaymentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    adminFetch<PaymentDetail>(`/api/admin/payments/${encodeURIComponent(orderId)}`).then(setDetail).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [orderId])
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Payment details">
      <div className="admin-modal-card large">
        <div className="admin-modal-header">
          <h3>Payment details</h3>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="admin-modal-body">
          {error && <div className="admin-notice admin-notice-error"><AlertCircle size={14} /><span>{error}</span></div>}
          {!detail && !error && <div className="admin-loading-bar" />}
          {detail && (
            <>
              <div className="admin-info-list">
                {([
                  ['Order ID', detail.order.id],
                  ['User', detail.order.userEmail],
                  ['Plan', detail.order.planId.toUpperCase()],
                  ['Amount', formatMoney(detail.order.amount, detail.order.currency)],
                  ['Method', detail.order.paymentMethod],
                  ['Provider', detail.order.provider],
                  ['Provider order ID', detail.order.providerOrderId ?? '—'],
                  ['Transaction ID', detail.order.providerPaymentId ?? '—'],
                  ['Status', detail.order.status],
                  ['Subscription activated', detail.order.isActivated ? 'Yes' : 'No'],
                  ['Created', formatDate(detail.order.createdAt)],
                  ['Updated', formatDate(detail.order.updatedAt)]
                ] as Array<[string, string]>).map(([key, value]) => (
                  <div className="admin-info-row" key={key}><span>{key}</span><strong className="admin-mono">{value}</strong></div>
                ))}
              </div>
              <h4>Verified transactions</h4>
              {detail.transactions.length === 0 ? <p className="admin-empty-state">No verified transaction yet.</p> : (
                <ul className="admin-plain-list">
                  {detail.transactions.map((tx) => <li key={tx.id}><span className="admin-mono">{tx.transactionId}</span> · {formatMoney(tx.amount, tx.currency)} · {tx.status} · {formatDate(tx.createdAt)}</li>)}
                </ul>
              )}
              {detail.order.lastProviderPayload != null && (
                <details>
                  <summary>Last provider callback</summary>
                  <pre className="admin-json">{JSON.stringify(detail.order.lastProviderPayload, null, 2)}</pre>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

type HistoryEntry = { id: string; event: string; planId: string; status: string; startedAt: string | null; endsAt: string | null; amount: number; currency: string; paymentMethod: string | null; orderId: string | null; transactionId: string | null; createdAt: string }

function SubscriptionHistoryModal({ userEmail, onClose }: { userEmail: string; onClose: () => void }) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    adminFetch<{ history: HistoryEntry[] }>(`/api/admin/subscriptions/${encodeURIComponent(userEmail)}/history`).then((data) => setHistory(data.history ?? [])).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [userEmail])
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Subscription history">
      <div className="admin-modal-card large">
        <div className="admin-modal-header">
          <h3>History: {userEmail}</h3>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="admin-modal-body">
          {error && <div className="admin-notice admin-notice-error"><AlertCircle size={14} /><span>{error}</span></div>}
          {!history && !error && <div className="admin-loading-bar" />}
          {history && history.length === 0 && <p className="admin-empty-state">No subscription events yet.</p>}
          {history && history.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>When</th><th>Event</th><th>Plan</th><th>Period</th><th>Amount</th><th>Transaction</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td>{formatDate(h.createdAt)}</td>
                      <td>{h.event.replace(/_/g, ' ')}</td>
                      <td>{h.planId.toUpperCase()}</td>
                      <td>{h.startedAt ? formatDate(h.startedAt) : '—'} → {h.endsAt ? formatDate(h.endsAt) : '—'}</td>
                      <td>{h.amount ? formatMoney(h.amount, h.currency) : '—'}</td>
                      <td><small className="admin-mono">{h.transactionId ?? '—'}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Telegram purchase notifications ──────────────────────────────────────────

type TelegramStatus = {
  botTokenConfigured: boolean
  chatIdConfigured: boolean
  configured: boolean
  enabled: boolean
  lastSuccessAt: string | null
  lastSuccessKind: string | null
  purchaseCounts: Record<string, number>
  recentErrors: Array<{ kind: string; error: string; at: string }>
}

function TelegramSettingsCard({ onToast }: { onToast: (msg: string, kind: ToastKind) => void }) {
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

type PurchaseRequest = {
  id: string
  userEmail: string
  fullName: string | null
  accountId: string | null
  planId: string
  amount: number
  currency: string
  paymentMethod: string
  status: string
  activated: boolean
  payerName: string | null
  transactionId: string | null
  receiptNote: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  reviewNote: string | null
  createdAt: string
}

/** Manual bank transfers: the administrator checks the bank statement, then approves or rejects. */
function PurchaseRequestsSection({ onToast }: { onToast: (msg: string, kind: ToastKind) => void }) {
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [manualEnabled, setManualEnabled] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<{ requests: PurchaseRequest[]; manualTransfer: { enabled: boolean } }>(`/api/admin/purchase-requests?status=${encodeURIComponent(statusFilter)}`)
      setRequests(data.requests)
      setManualEnabled(data.manualTransfer.enabled)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load purchase requests', 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, onToast])

  useEffect(() => { void load() }, [load])

  const review = async (request: PurchaseRequest, action: 'approve' | 'reject') => {
    let note = ''
    if (action === 'approve') {
      if (!window.confirm(`Approve ${formatMoney(request.amount, request.currency)} from ${request.payerName ?? request.userEmail} (ref ${request.transactionId})?\nOnly approve after you have seen this payment in the bank account.`)) return
    } else {
      const reason = window.prompt('Reason for rejection (shown to the user):', 'Payment not found')
      if (reason === null) return
      note = reason
    }
    setBusyId(request.id)
    try {
      await adminFetch(`/api/admin/purchase-requests/${encodeURIComponent(request.id)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note })
      })
      onToast(action === 'approve' ? 'Payment approved — plan activated' : 'Request rejected', 'success')
      await load()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Action failed', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const pillClass = (status: string) => status === 'paid' ? 'admin-pill success' : status === 'pending' ? 'admin-pill warning' : 'admin-pill danger'

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div><span className="eyebrow">Manual bank transfers</span><h2>Purchase Requests</h2></div>
        <button type="button" className="btn btn-secondary small" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>
      {!manualEnabled && (
        <p className="admin-hint">Bank transfer is turned off for users. Set MANUAL_TRANSFER_ENABLED=true and MANUAL_TRANSFER_ACCOUNT on the backend to enable it.</p>
      )}
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Requests <span className="admin-count-badge">{requests.length}</span></h3>
          <div className="table-tools">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="pending">Pending</option>
              <option value="paid">Approved (paid)</option>
              <option value="failed">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className="admin-empty-state"><RefreshCw size={18} className="spin" /> Loading…</div>
        ) : requests.length === 0 ? (
          <div className="admin-empty-state">No purchase requests</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Payer / Transaction ID</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.fullName ?? '—'}</strong><br /><small>{row.userEmail}{row.accountId ? ` · ${row.accountId}` : ''}</small></td>
                    <td>{row.planId.toUpperCase()}</td>
                    <td>{formatMoney(row.amount, row.currency)}</td>
                    <td>{row.payerName ?? '—'}<br /><span className="admin-mono">{row.transactionId ?? '—'}</span>{row.receiptNote && <><br /><small>{row.receiptNote}</small></>}</td>
                    <td>
                      <span className={pillClass(row.status)}>{row.status === 'failed' ? 'rejected' : row.status}</span>
                      {row.reviewedAt && <><br /><small>{formatDate(row.reviewedAt)}{row.reviewNote ? ` · ${row.reviewNote}` : ''}</small></>}
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      {row.status === 'pending' ? (
                        <div className="admin-actions">
                          <button type="button" className="btn btn-primary small" disabled={busyId === row.id} onClick={() => void review(row, 'approve')}><Check size={14} /> Approve</button>
                          <button type="button" className="btn btn-warning small" disabled={busyId === row.id} onClick={() => void review(row, 'reject')}><X size={14} /> Reject</button>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

type AdminPurchase = {
  orderId: string
  userName: string | null
  userEmail: string
  planId: string
  amount: number
  currency: string
  paymentType: string
  purchasedAt: string
  activated: boolean
  currentlyActive: boolean
  endsAt: string | null
}

/** All completed purchases (Demo Payment, provider, approved transfers). Refreshes itself every 10 s. */
function PurchasesSection({ onToast }: { onToast: (msg: string, kind: ToastKind) => void }) {
  const [rows, setRows] = useState<AdminPurchase[]>([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const failedOnce = useRef(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      const data = await adminFetch<{ purchases: AdminPurchase[]; generatedAt: string }>(`/api/admin/purchases?${params.toString()}`)
      setRows(data.purchases)
      setUpdatedAt(data.generatedAt)
      failedOnce.current = false
    } catch (err) {
      // Background refreshes report an error only once, not every 10 seconds.
      if (!silent || !failedOnce.current) onToast(err instanceof Error ? err.message : 'Failed to load purchases', 'error')
      failedOnce.current = true
    } finally {
      if (!silent) setLoading(false)
    }
  }, [debouncedSearch, onToast])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true) }, 10000)
    return () => window.clearInterval(timer)
  }, [load])

  const revenue = rows.reduce((sum, row) => sum + row.amount, 0)

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div><span className="eyebrow">Live · updates every 10 s</span><h2>Purchases</h2></div>
        <button type="button" className="btn btn-secondary small" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="admin-stats-grid compact-stats">
        <div className="admin-stat-card green">
          <div className="admin-stat-icon"><WalletCards size={18} /></div>
          <div><strong>{rows.length}</strong><span>Purchases</span></div>
        </div>
        <div className="admin-stat-card cyan">
          <div className="admin-stat-icon"><TrendingUp size={18} /></div>
          <div><strong>{formatMoney(revenue)}</strong><span>Total (incl. demo)</span></div>
        </div>
        <div className="admin-stat-card amber">
          <div className="admin-stat-icon"><Sparkles size={18} /></div>
          <div><strong>{rows.filter((row) => row.currentlyActive).length}</strong><span>Currently active</span></div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Purchase list <span className="admin-count-badge">{rows.length}</span></h3>
          <div className="table-tools">
            <label className="search-field">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" />
            </label>
          </div>
        </div>
        {updatedAt && <p className="admin-hint">Last update: {formatDate(updatedAt)}</p>}
        {loading && rows.length === 0 ? (
          <div className="admin-empty-state"><RefreshCw size={18} className="spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <div className="admin-empty-state">No purchases yet</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Plan</th>
                  <th>Price</th>
                  <th>Purchased</th>
                  <th>Payment</th>
                  <th>Activation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.orderId}>
                    <td><strong>{row.userName ?? '—'}</strong></td>
                    <td>{row.userEmail}</td>
                    <td>{row.planId.toUpperCase()}</td>
                    <td>{formatMoney(row.amount, row.currency)}</td>
                    <td>{formatDate(row.purchasedAt)}</td>
                    <td>{row.paymentType}</td>
                    <td>
                      {!row.activated
                        ? <span className="admin-pill danger">Not activated</span>
                        : row.currentlyActive
                          ? <span className="admin-pill success">Active{row.endsAt ? ` until ${formatDate(row.endsAt)}` : ''}</span>
                          : <span className="admin-pill warning">Activated · ended / replaced</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminPanel({ user, onLogout }: AdminPanelProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const { toasts, addToast, removeToast } = useToast()
  const sidebarRef = useRef<HTMLElement | null>(null)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await adminFetch<AdminStats>('/api/admin/stats')
      setStats(data)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load stats', 'error')
    } finally {
      setStatsLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    setSidebarOpen(false)
  }, [activeSection])

  const navItems: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: UserRound },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'lessons', label: 'Lessons', icon: GraduationCap },
    { id: 'aipro', label: 'AI Pro', icon: Sparkles },
    { id: 'reviews', label: 'Reviews', icon: MessageSquareText },
    { id: 'subscriptions', label: 'Subscriptions', icon: Crown },
    { id: 'payments', label: 'Payments', icon: WalletCards },
    { id: 'purchases', label: 'Purchases', icon: WalletCards },
    { id: 'requests', label: 'Purchase requests', icon: Check },
    { id: 'plans', label: 'Plans', icon: Crown },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  return (
    <div className="admin-shell">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {sidebarOpen && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close admin menu"
        />
      )}

      <aside ref={sidebarRef} className={sidebarOpen ? 'admin-sidebar open' : 'admin-sidebar'}>
        <div className="admin-brand-wrap">
          <img src={siteLogo} alt="LEVEL UP" className="admin-brand-logo" />
          <div>
            <span className="eyebrow">LEVEL UP</span>
            <strong>Admin Panel</strong>
          </div>
          <button type="button" className="admin-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={16} />
          </button>
        </div>

        <nav className="admin-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeSection === id ? 'admin-nav-item active' : 'admin-nav-item'}
              onClick={() => setActiveSection(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-panel-profile">
          <div className="mini-avatar">{user?.name?.charAt(0)?.toUpperCase() ?? 'A'}</div>
          <div>
            <strong>{user?.name ?? 'Admin'}</strong>
            <span>{user?.email ?? ''}</span>
          </div>
        </div>

        <button
          type="button"
          className="admin-nav-item danger admin-logout-item"
          onClick={onLogout}
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </aside>

      <main className="admin-main">
        <div className="admin-header">
          <div>
            <span className="eyebrow">LEVEL UP ADMINISTRATOR</span>
            <h1>Admin Panel</h1>
          </div>
          <div className="admin-header-actions">
            <button
              type="button"
              className="btn btn-secondary small admin-menu-toggle"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle admin sidebar"
            >
              <Menu size={16} />
            </button>
            <NavLink to="/home" className="btn btn-secondary small">
              <Home size={14} /> Website
            </NavLink>
            <NavLink to="/dashboard" className="btn btn-secondary small">
              <LayoutDashboard size={14} /> Dashboard
            </NavLink>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="admin-tab-bar">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeSection === id ? 'admin-tab active' : 'admin-tab'}
              onClick={() => setActiveSection(id)}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="admin-content-area">
          {activeSection === 'dashboard' && (
            <DashboardSection
              stats={stats}
              loading={statsLoading}
              onRefresh={loadStats}
              onNavigate={setActiveSection}
            />
          )}
          {activeSection === 'users' && (
            <UsersSection currentUserEmail={user?.email ?? ''} onToast={addToast} />
          )}
          {activeSection === 'courses' && (
            <CoursesSection onToast={addToast} />
          )}
          {activeSection === 'lessons' && (
            <LessonsSection onToast={addToast} />
          )}
          {activeSection === 'aipro' && (
            <AiProSection onToast={addToast} />
          )}
          {activeSection === 'reviews' && (
            <ReviewsSection onToast={addToast} />
          )}
          {activeSection === 'subscriptions' && (
            <SubscriptionsSection onToast={addToast} />
          )}
          {activeSection === 'payments' && (
            <PaymentsSection onToast={addToast} />
          )}
          {activeSection === 'purchases' && (
            <PurchasesSection onToast={addToast} />
          )}
          {activeSection === 'requests' && (
            <PurchaseRequestsSection onToast={addToast} />
          )}
          {activeSection === 'plans' && (
            <PlansSection onToast={addToast} />
          )}
          {activeSection === 'settings' && (
            <SettingsSection
              adminEmail={user?.email ?? ''}
              onLogout={onLogout}
              onToast={addToast}
            />
          )}
        </div>
      </main>
    </div>
  )
}
