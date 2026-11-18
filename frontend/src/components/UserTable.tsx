import { Fragment, useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search, Trash2, X, ChevronDown, ChevronUp, Edit2 } from 'lucide-react'
import { adminFetch, useDebouncedValue, statusPill, formatDate, ConfirmDialog, type AdminUserRecord, type AdminUserDetail, type ToastKind } from './adminShared'

export default function UserTable({ currentUserEmail, onToast }: { currentUserEmail: string; onToast: (msg: string, kind: ToastKind) => void }) {
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
