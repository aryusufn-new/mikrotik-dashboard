import React from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useRouter } from '../context/RouterContext'
import useInterfacesWS from '../hooks/useInterfacesWS'
import { formatBps } from '../utils/format'

function StatCard({ title, value, sub, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-3xl font-bold mt-2" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function InterfaceTraffic() {
  const { activeRouterId } = useRouter()
  const { interfaces, totals, points, error } = useInterfacesWS(activeRouterId)

  if (!activeRouterId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="text-lg font-medium">Belum ada router</p>
        <p className="text-sm mt-1">Tambahkan router di halaman Konfigurasi</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Interface Traffic</h1>
        <p className="text-slate-500 text-sm">Monitor traffic real-time semua interface Mikrotik</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard title="Running" value={totals.running} sub="Interface aktif" color="#6366f1" />
        <StatCard title="Down" value={totals.down} sub="Interface mati" color="#ef4444" />
        <StatCard title="Total RX" value={formatBps(totals.rx_bps)} sub="Download aggregate" color="#0ea5e9" />
        <StatCard title="Total TX" value={formatBps(totals.tx_bps)} sub="Upload aggregate" color="#f97316" />
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4 sm:p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
          <div className="text-sm font-semibold text-slate-700">REAL TIME TRAFFIC</div>
          <div className="text-xs text-slate-500 flex gap-3">
            <span className="text-sky-500">● RX {formatBps(totals.rx_bps)}</span>
            <span className="text-orange-500">● TX {formatBps(totals.tx_bps)}</span>
          </div>
        </div>
        <div className="h-52 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={(v) => formatBps(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} width={80} />
              <Tooltip formatter={(v) => formatBps(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend />
              <Line type="monotone" dataKey="rx" name="RX" stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="tx" name="TX" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-700">Interfaces</div>
          <div className="text-xs text-slate-500">{interfaces.length} interface</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase border-b border-slate-100">
                <th className="text-left py-2 px-2">Name</th>
                <th className="text-left py-2 px-2">Type</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-right py-2 px-2">RX</th>
                <th className="text-right py-2 px-2">TX</th>
                <th className="text-left py-2 px-2">Comment</th>
              </tr>
            </thead>
            <tbody>
              {interfaces.map((i) => (
                <tr key={i.name} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 px-2 font-medium text-slate-800">{i.name}</td>
                  <td className="py-2 px-2 text-slate-500">{i.type}</td>
                  <td className="py-2 px-2">
                    {i.disabled ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">disabled</span>
                    ) : i.running ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-600">running</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-rose-50 text-rose-600">down</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right text-sky-600">{formatBps(i.rx_bps)}</td>
                  <td className="py-2 px-2 text-right text-orange-600">{formatBps(i.tx_bps)}</td>
                  <td className="py-2 px-2 text-slate-500">{i.comment || '-'}</td>
                </tr>
              ))}
              {interfaces.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-slate-400">Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && <div className="mt-4 text-rose-600 text-sm">{error}</div>}
    </div>
  )
}
