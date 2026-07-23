import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Activity, ChevronDown, Cpu, LogOut, Router, Settings, Users, Wifi } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'

const monitorItems = [
  { to: '/device', label: 'Device Monitor', icon: Cpu },
  { to: '/interfaces', label: 'Interface Traffic', icon: Activity },
  { to: '/pppoe', label: 'PPPoE Monitor', icon: Users },
  { to: '/hotspot', label: 'Hotspot Monitor', icon: Wifi },
]

const settingsItems = [
  { to: '/config', label: 'Konfigurasi', icon: Settings },
]

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth()
  const { routers, activeRouterId, activeRouter, setActiveRouterId } = useRouter()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
    onNavigate?.()
  }

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-slate-200 min-h-screen p-4 flex flex-col">
      <div className="px-2 py-3 mb-4">
        <div className="text-xl font-bold tracking-tight text-slate-800">
          MIMO<span className="text-brand-purple">.SA</span>
        </div>
        <div className="text-xs text-slate-400">Monitoring MikroTik System</div>
      </div>

      {/* Router Selector */}
      {routers.length > 0 && (
        <div className="mb-4 px-1">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 px-1 mb-1.5">
            Router Aktif
          </div>
          <div className="relative">
            <select
              value={activeRouterId || ''}
              onChange={(e) => setActiveRouterId(Number(e.target.value))}
              className="w-full appearance-none bg-gradient-to-r from-brand-purple/5 to-indigo-50 border border-brand-purple/20 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 cursor-pointer transition hover:border-brand-purple/40"
            >
              {routers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
          {activeRouter && (
            <div className="flex items-center gap-1.5 mt-1.5 px-1">
              <Router size={12} className="text-slate-400" />
              <span className="text-[11px] text-slate-400 truncate">
                {activeRouter.host}:{activeRouter.port}
              </span>
            </div>
          )}
        </div>
      )}

      {routers.length === 0 && (
        <div className="mb-4 px-1">
          <NavLink
            to="/config"
            onClick={onNavigate}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
          >
            <Router size={16} />
            <span>Tambah Router</span>
          </NavLink>
        </div>
      )}

      <div className="text-[11px] uppercase tracking-wider text-slate-400 px-2 mb-2">
        Monitoring
      </div>

      <nav className="space-y-1">
        {monitorItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition',
                isActive
                  ? 'bg-brand-purple/10 text-brand-purple font-medium'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="text-[11px] uppercase tracking-wider text-slate-400 px-2 mt-6 mb-2">
        Settings
      </div>

      <nav className="space-y-1">
        {settingsItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition',
                isActive
                  ? 'bg-brand-purple/10 text-brand-purple font-medium'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-slate-500 truncate">{user?.username || ''}</span>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-rose-500 transition"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
