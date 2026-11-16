import { useCallback, useEffect, useRef, useState } from 'react'
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
import { NavLink, useNavigate } from 'react-router-dom'

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
  | 'settings'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiBaseUrl(): string {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
  if (configured) return configured
  const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
  if (isLocal) return 'http://localhost:8787'
  return import.meta.env.PROD ? 'https://levelupp-2b3j.onrender.com' : 'http://localhost:8787'
}

const API_BASE = getApiBaseUrl()

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = window.localStorage.getItem('levelup-auth-token') ?? ''
  const headers = new Headers(init?.headers ?? {})

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const payload = await response.json().catch(() => ({})) as { error?: string }

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status})`)
  }
  return payload as T
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
    const id = crypto.randomUUID()
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
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (roleFilter !== 'all') params.set('role', roleFilter)
      const data = await adminFetch<{ users: AdminUserRecord[] }>(`/api/admin/users?${params}`)
      setUsers(data.users ?? [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, roleFilter, onToast])

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
                  <tr key={row.email} className={expandedUser === row.email ? 'admin-row-expanded' : ''}>
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
                          onClick={() => setExpandedUser(expandedUser === row.email ? null : row.email)}
                          aria-label="Toggle details"
                        >
                          {expandedUser === row.email ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
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
        systemEnabled: boolean
        activeAiProUsers: number
        totalAiProGrants: number
        users: AdminAiProUser[]
      }>('/api/admin/ai-pro')

      setSystemEnabled(data.systemEnabled)
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
  const [statusFilter, setStatusFilter] = useState('all')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadReviews = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const data = await adminFetch<{ reviews: AdminReview[] }>(`/api/admin/reviews?${params}`)
      setReviews(data.reviews ?? [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load reviews', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, onToast])

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
  const [planFilter, setPlanFilter] = useState('all')
  const [grantTarget, setGrantTarget] = useState<string | null>(null)
  const [grantPlan, setGrantPlan] = useState('pro')

  const loadSubs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (planFilter !== 'all') params.set('plan', planFilter)
      const data = await adminFetch<{ subscriptions: AdminSubscription[] }>(`/api/admin/subscriptions?${params}`)
      setSubscriptions(data.subscriptions ?? [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load subscriptions', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, planFilter, onToast])

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
    return 'admin-pill neutral'
  }

  return (
    <div className="admin-section">
      {grantTarget && (
        <div className="admin-confirm-backdrop">
          <div className="admin-confirm-card">
            <h3>Activate Subscription</h3>
            <p>Grant a subscription plan to <strong>{grantTarget}</strong></p>
            <select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)} className="admin-inline-select">
              <option value="pro">PRO Plan (499 KGS, 30 days)</option>
              <option value="aipro">AI PRO Plan (799 KGS, 30 days)</option>
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
  const [statusFilter, setStatusFilter] = useState('all')

  const loadPayments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const data = await adminFetch<{ payments: AdminPayment[] }>(`/api/admin/payments?${params}`)
      setPayments(data.payments ?? [])
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load payments', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, onToast])

  useEffect(() => { void loadPayments() }, [loadPayments])

  const payStatusPill = (status: string) => {
    if (status === 'paid') return 'admin-pill success'
    if (status === 'cancelled') return 'admin-pill danger'
    return 'admin-pill neutral'
  }

  const totalRevenue = payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="admin-section">
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
  const navigate = useNavigate()
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
        window.localStorage.removeItem('levelup-auth-token')
        window.localStorage.removeItem('levelup-user')
        window.localStorage.removeItem('levelup-auth')
        onLogout()
        navigate('/admin/login', { replace: true })
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
              <li className={Boolean(passwordsMatch) ? 'rule-met' : ''}>Passwords match</li>
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
            onClick={() => {
              window.localStorage.removeItem('levelup-auth-token')
              window.localStorage.removeItem('levelup-user')
              onLogout()
              navigate('/admin/login', { replace: true })
            }}
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

export default function AdminPanel({ user, onLogout }: AdminPanelProps) {
  const navigate = useNavigate()
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
          <div className="admin-brand-mark">L</div>
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
          onClick={() => {
            window.localStorage.removeItem('levelup-auth-token')
            window.localStorage.removeItem('levelup-user')
            onLogout()
            navigate('/admin/login', { replace: true })
          }}
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
