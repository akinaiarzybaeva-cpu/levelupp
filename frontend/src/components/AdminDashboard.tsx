import { Bell, BookOpen, Check, Crown, GraduationCap, MessageSquareText, RefreshCw, Sparkles, UserRound, WalletCards } from 'lucide-react'
import { statusPill, formatDate, formatMoney, AdminInsights, type AdminStats, type AdminSection } from './adminShared'
import { useAdminT } from './adminI18n'

export default function AdminDashboard({
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
  const t = useAdminT()
  const statCards = stats ? [
    { label: t("Total Users"), value: stats.totalUsers, icon: UserRound, accent: 'emerald', section: 'users' as AdminSection },
    { label: t("Total Courses"), value: stats.totalCourses, icon: BookOpen, accent: 'blue', section: 'courses' as AdminSection },
    { label: t("Total Lessons"), value: stats.totalLessons, icon: GraduationCap, accent: 'cyan', section: 'lessons' as AdminSection },
    { label: t("Active Subscriptions"), value: stats.activeSubscriptions, icon: Crown, accent: 'gold', section: 'subscriptions' as AdminSection },
    { label: t("Total Reviews"), value: stats.totalReviews, icon: MessageSquareText, accent: 'indigo', section: 'reviews' as AdminSection },
    { label: t("Pending Reviews"), value: stats.pendingReviews, icon: Bell, accent: 'amber', section: 'reviews' as AdminSection },
    { label: t("PRO Subscribers"), value: stats.proSubscriptions, icon: WalletCards, accent: 'teal', section: 'subscriptions' as AdminSection },
    { label: t("AI PRO Users"), value: stats.aiproSubscriptions, icon: Sparkles, accent: 'purple', section: 'aipro' as AdminSection },
    { label: t("Total Revenue"), value: formatMoney(stats.revenue), icon: WalletCards, accent: 'orange', section: 'payments' as AdminSection },
    { label: t("Courses Started"), value: stats.startedCourses, icon: BookOpen, accent: 'amber', section: 'courses' as AdminSection },
    { label: t("Completed Courses"), value: stats.completedCourses, icon: Check, accent: 'green', section: 'courses' as AdminSection },
    { label: t("Average Rating"), value: `${Number(stats.averageRating || 0).toFixed(1)} / 5.0`, icon: Sparkles, accent: 'violet', section: 'reviews' as AdminSection }
  ] : []

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div>
          <span className="eyebrow">{t("LevelUp Real-time Database")}</span>
          <h2>{t("Dashboard")}</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary small" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? t("Refreshing…") : t("Refresh Data")}
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
            title={t('View {0}', [label])}
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
            <h3>{t("Recent User Registrations")}</h3>
            <button type="button" className="btn btn-secondary small" onClick={() => onNavigate('users')}>
              {t("View All Users (")}{stats.totalUsers})
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("User")}</th>
                  <th>{t("Role")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Joined")}</th>
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
