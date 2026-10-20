import { useState, useEffect, useMemo } from 'react'
import { ScrollText, Search, Filter } from 'lucide-react'
import { getAuditLogs } from '../api'

const ACTION_COLORS = {
  LOGIN: 'bg-blue-100 text-blue-700',
  REGISTER: 'bg-green-100 text-green-700',
  POST: 'bg-emerald-100 text-emerald-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
}

export default function AdminLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    getAuditLogs()
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const actions = useMemo(() => [...new Set(logs.map(l => l.action))], [logs])

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (actionFilter && l.action !== actionFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          l.username?.toLowerCase().includes(q) ||
          l.target?.toLowerCase().includes(q) ||
          l.endpoint?.toLowerCase().includes(q) ||
          l.ip_address?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [logs, search, actionFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-purple/10 flex items-center justify-center">
          <ScrollText size={20} className="text-brand-purple" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Audit Logs</h1>
          <p className="text-xs text-slate-400">{logs.length} total entries</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari username, target, endpoint, IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 appearance-none bg-white"
          >
            <option value="">Semua Action</option>
            {actions.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Tidak ada log ditemukan</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-400 font-medium">User</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-400 font-medium">Action</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-400 font-medium">Target</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-400 font-medium">Endpoint</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-400 font-medium">IP</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-400 font-medium">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3 font-medium text-slate-700">{log.username}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.target || '-'}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{log.endpoint}</td>
                    <td className="px-4 py-3">
                      {log.ip_address ? (
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono">{log.ip_address}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' '}
                      {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
