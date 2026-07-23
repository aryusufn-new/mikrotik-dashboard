import React, { useEffect, useMemo, useState } from 'react'
import { Users, Wifi, WifiOff, Activity, X } from 'lucide-react'
import { getPppActive, getPppSecrets, getPppStats } from '../api'
import { useRouter } from '../context/RouterContext'
import usePppoeTrafficWS from '../hooks/usePppoeTrafficWS'
import { formatBps } from '../utils/format'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function StatCard({ title, value, color, Icon }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-5 flex items-center justify-between">
      <div>
        <div className="text-slate-500 text-sm">{title}</div>
        <div className="text-3xl font-semibold mt-2" style={{ color }}>{value ?? '-'}</div>
      </div>
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white" style={{ background: color }}>
        <Icon size={22} />
      </div>
    </div>
  )
}

function UserTrafficModal({ username, historyData, currentTraffic, onClose }) {
  if (!username) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 z-10 animate-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Activity className="text-brand-purple" size={20} />
              Traffic Real-Time: {username}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Interface: {currentTraffic?.interface || '-'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-100">
            <span className="text-xs text-purple-600 font-medium uppercase tracking-wider">Speed Upload (TX)</span>
            <div className="text-xl sm:text-2xl font-bold text-brand-purple mt-1">
              {formatBps(currentTraffic?.tx_bps || 0)}
            </div>
          </div>
          <div className="bg-pink-50/50 rounded-xl p-3 border border-pink-100">
            <span className="text-xs text-pink-600 font-medium uppercase tracking-wider">Speed Download (RX)</span>
            <div className="text-xl sm:text-2xl font-bold text-brand-pink mt-1">
              {formatBps(currentTraffic?.rx_bps || 0)}
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="txg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rxg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tickFormatter={(v) => formatBps(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={70} />
              <Tooltip
                formatter={(v) => formatBps(v)}
                labelStyle={{ color: '#475569' }}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Area
                type="monotone"
                dataKey="tx"
                name="TX (Upload)"
                stroke="#a855f7"
                fill="url(#txg)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="rx"
                name="RX (Download)"
                stroke="#ec4899"
                fill="url(#rxg)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
          <div>IP Address: {currentTraffic?.address || '-'}</div>
          <div>Uptime: {currentTraffic?.uptime || '-'}</div>
        </div>
      </div>
    </div>
  )
}

export default function PppoeMonitor() {
  const { activeRouterId } = useRouter()
  const [stats, setStats] = useState(null)
  const [active, setActive] = useState([])
  const [secrets, setSecrets] = useState([])
  const [filter, setFilter] = useState('all') // all|online|offline
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)

  // Real-time Traffic WebSocket hook
  const { trafficMap, history, error: wsError } = usePppoeTrafficWS()

  // Selected user for details chart modal
  const [selectedUser, setSelectedUser] = useState(null)

  useEffect(() => {
    if (!activeRouterId) return
    setStats(null)
    setActive([])
    setSecrets([])
    setError(null)

    let mounted = true
    const load = async () => {
      try {
        const [s, a, sec] = await Promise.all([getPppStats(), getPppActive(), getPppSecrets()])
        if (!mounted) return
        setStats(s); setActive(a); setSecrets(sec); setError(null)
      } catch (e) {
        if (mounted) setError(e.message)
      }
    }
    load()
    const id = setInterval(load, 5000)
    return () => { mounted = false; clearInterval(id) }
  }, [activeRouterId])

  const activeByName = useMemo(() => {
    const m = new Map()
    for (const a of active) m.set(a.name, a)
    return m
  }, [active])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()

    // 1. Map static secrets
    const mergedMap = new Map()
    for (const s of secrets) {
      mergedMap.set(s.name, {
        name: s.name,
        profile: s.profile,
        disabled: s.disabled,
        online: s.online,
        comment: s.comment || '',
        isRadius: false
      })
    }

    // 2. Add active sessions not in local secrets (e.g. RADIUS users)
    for (const a of active) {
      if (a.name && !mergedMap.has(a.name)) {
        mergedMap.set(a.name, {
          name: a.name,
          profile: 'RADIUS',
          disabled: false,
          online: true,
          comment: 'RADIUS Active Session',
          isRadius: true
        })
      }
    }

    const mergedList = Array.from(mergedMap.values())

    return mergedList
      .filter((s) => {
        if (filter === 'online' && !s.online) return false
        if (filter === 'offline' && s.online) return false
        if (q && !(`${s.name} ${s.profile || ''} ${s.comment || ''}`.toLowerCase().includes(q))) return false
        return true
      })
      .sort((a, b) => Number(b.online) - Number(a.online) || String(a.name ?? '').localeCompare(String(b.name ?? '')))
  }, [secrets, active, filter, search])

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
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">PPPoE Monitor</h1>
        <p className="text-slate-500 text-sm">Status user PPPoE: online & offline</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <StatCard title="Total Secrets" value={stats?.total} color="#a855f7" Icon={Users} />
        <StatCard title="Online" value={stats?.online} color="#22c55e" Icon={Wifi} />
        <StatCard title="Offline" value={stats?.offline} color="#ef4444" Icon={WifiOff} />
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="text-sm font-semibold text-slate-700">PPPoE Users</div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari user / profile / comment…"
              className="border border-slate-200 rounded-md px-3 py-1.5 text-sm w-full sm:w-64"
            />
            <div className="flex rounded-md border border-slate-200 overflow-hidden text-sm">
              {['all', 'online', 'offline'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 capitalize ${filter === f ? 'bg-brand-purple text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >{f}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase border-b border-slate-100">
                <th className="text-left py-2 px-2">User</th>
                <th className="text-left py-2 px-2">Profile</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">IP Address</th>
                <th className="text-left py-2 px-2">Uptime</th>
                <th className="text-left py-2 px-2">Caller ID</th>
                <th className="text-left py-2 px-2">Traffic (TX / RX)</th>
                <th className="text-left py-2 px-2">Comment</th>
                <th className="text-left py-2 px-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const a = activeByName.get(s.name)
                const liveTraffic = trafficMap[s.name]
                
                return (
                  <tr key={s.name} className="border-b border-slate-50 hover:bg-slate-50 transition">
                    <td className="py-2 px-2 font-medium text-slate-800">{s.name}</td>
                    <td className="py-2 px-2 text-slate-500">{s.profile || '-'}</td>
                    <td className="py-2 px-2">
                      {s.disabled ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">disabled</span>
                      ) : s.online ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-600 font-medium">online</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-rose-50 text-rose-600 font-medium">offline</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-slate-600">{a?.address || '-'}</td>
                    <td className="py-2 px-2 text-slate-600">{a?.uptime || '-'}</td>
                    <td className="py-2 px-2 text-slate-600">{a?.caller_id || '-'}</td>
                    <td className="py-2 px-2">
                      {s.online && liveTraffic ? (
                        <div className="flex flex-col sm:flex-row sm:gap-2 text-[11px] leading-tight">
                          <span className="text-brand-purple font-medium">
                            TX: <span className="font-semibold">{formatBps(liveTraffic.tx_bps)}</span>
                          </span>
                          <span className="hidden sm:inline text-slate-300">|</span>
                          <span className="text-brand-pink font-medium">
                            RX: <span className="font-semibold">{formatBps(liveTraffic.rx_bps)}</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-slate-500">{s.comment || '-'}</td>
                    <td className="py-2 px-2 text-center">
                      {s.online ? (
                        <button
                          onClick={() => setSelectedUser(s.name)}
                          title="Lihat Grafik Traffic Real-time"
                          className="p-1.5 rounded-lg bg-brand-purple/10 text-brand-purple hover:bg-brand-purple hover:text-white transition flex items-center justify-center mx-auto"
                        >
                          <Activity size={14} />
                        </button>
                      ) : (
                        <button
                          disabled
                          className="p-1.5 rounded-lg bg-slate-50 text-slate-300 flex items-center justify-center mx-auto cursor-not-allowed"
                        >
                          <Activity size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="py-6 text-center text-slate-400">Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time details Modal */}
      {selectedUser && (
        <UserTrafficModal
          username={selectedUser}
          historyData={history[selectedUser] || []}
          currentTraffic={trafficMap[selectedUser]}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {(error || wsError) && (
        <div className="mt-4 text-rose-600 text-sm font-medium bg-rose-50 border border-rose-100 rounded-xl p-3">
          {error || wsError}
        </div>
      )}
    </div>
  )
}
