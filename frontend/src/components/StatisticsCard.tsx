import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export default function StatisticsCard({ icon: Icon, value, label, tone = 'green' }: { icon: LucideIcon; value: ReactNode; label: ReactNode; tone?: 'green' | 'gold' | 'blue' | 'violet' }) {
  return (
    <div className={`stat-card ui-stat-tile tone-${tone}`}>
      <span className="ui-stat-icon"><Icon size={20} aria-hidden="true" /></span>
      <div><strong>{value}</strong><span>{label}</span></div>
    </div>
  )
}
