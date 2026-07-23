import React from 'react'

function Card({ title, value, color, icon }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-5 flex items-center justify-between">
      <div>
        <div className="text-slate-500 text-sm">{title}</div>
        <div className="text-3xl font-semibold mt-2" style={{ color }}>{value}</div>
      </div>
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg"
        style={{ background: color }}
      >
        {icon}
      </div>
    </div>
  )
}

/**
 * Generic service stats section: Total / Online / Offline.
 *
 * Props:
 * - title: string judul section, contoh "PPPoE" / "Hotspot"
 * - stats: { total, online, offline }
 * - labels: { total?: string, online?: string, offline?: string } opsional
 */
export default function ServiceStatsCards({ title, stats, labels = {} }) {
  const total = stats?.total ?? '-'
  const online = stats?.online ?? '-'
  const offline = stats?.offline ?? '-'
  return (
    <section>
      {title && (
        <h3 className="text-lg font-semibold text-slate-800 mb-3">{title}</h3>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title={labels.total || 'Total Secrets'} value={total} color="#a855f7" icon="$" />
        <Card title={labels.online || 'Online'} value={online} color="#22c55e" icon="$" />
        <Card title={labels.offline || 'Offline'} value={offline} color="#ef4444" icon="$" />
      </div>
    </section>
  )
}
