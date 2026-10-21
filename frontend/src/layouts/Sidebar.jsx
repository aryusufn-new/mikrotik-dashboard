import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Activity,
  ChevronDown,
  Cpu,
  LogOut,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Router,
  Settings,
  ScrollText,
  User,
  Users,
  Wifi,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from '../context/RouterContext'
import { useLanguage } from '../context/LanguageContext'

export default function Sidebar({ onNavigate, isCollapsed = false, onToggleCollapse }) {
  const { user, logout } = useAuth()
  const { routers, activeRouterId, activeRouter, setActiveRouterId } = useRouter()
  const { t, language } = useLanguage()
  const navigate = useNavigate()

  const monitorItems = [
    { to: '/noc', label: t.navNoc, icon: Radio },
    { to: '/device', label: t.navDashboard, icon: Cpu },
    { to: '/interfaces', label: t.navTraffic, icon: Activity },
    { to: '/pppoe', label: t.navPppoe, icon: Users },
    { to: '/hotspot', label: t.navHotspot, icon: Wifi },
    { to: '/topology', label: t.navTopology, icon: Network },
  ]

  const settingsItems = [
    { to: '/config', label: t.navConfig, icon: Settings },
  ]

  const adminItems = [
    { to: '/admin/logs', label: t.navLogs, icon: ScrollText },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
    onNavigate?.()
  }

  const handleCycleRouter = () => {
    if (routers.length > 1) {
      const currentIndex = routers.findIndex((r) => r.id === activeRouterId)
      const nextIndex = (currentIndex + 1) % routers.length
      setActiveRouterId(routers[nextIndex].id)
    }
  }

  return (
    <aside
      className={`shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0 flex flex-col transition-all duration-300 ease-in-out select-none ${
        isCollapsed ? 'w-16 p-2' : 'w-60 p-4'
      }`}
    >
      {/* ── Brand / Logo & Toggle ── */}
      <div className={`flex items-center mb-4 ${isCollapsed ? 'flex-col gap-2 py-1' : 'justify-between px-2 py-1'}`}>
        {isCollapsed ? (
          <>
            <button
              onClick={onToggleCollapse}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-purple to-indigo-600 flex items-center justify-center font-bold text-white text-base shadow-sm hover:opacity-90 transition"
              title={language === 'en' ? 'MIMO.SA - Click to open menu' : 'MIMO.SA - Klik untuk buka menu'}
            >
              M
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-purple hover:bg-slate-100 dark:hover:bg-slate-800 transition hidden lg:flex"
              title={language === 'en' ? 'Open Sidebar (Expand)' : 'Buka Sidebar (Perluas)'}
            >
              <PanelLeftOpen size={17} />
            </button>
          </>
        ) : (
          <>
            <div className="overflow-hidden">
              <div className="text-xl font-bold tracking-tight text-slate-800 dark:text-white whitespace-nowrap">
                MIMO<span className="text-brand-purple">.SA</span>
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{t.appSubtitle}</div>
            </div>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition hidden lg:flex"
              title={language === 'en' ? 'Collapse Sidebar' : 'Tutup / Perkecil Sidebar'}
            >
              <PanelLeftClose size={18} />
            </button>
          </>
        )}
      </div>

      {/* ── Router Selector ── */}
      {routers.length > 0 && (
        <div className="mb-4">
          {isCollapsed ? (
            <div className="flex justify-center">
              <button
                onClick={handleCycleRouter}
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-brand-purple/10 to-indigo-50 dark:from-brand-purple/20 dark:to-indigo-950/40 border border-brand-purple/20 dark:border-brand-purple/30 flex items-center justify-center text-brand-purple hover:bg-brand-purple/20 transition relative group"
                title={`${language === 'en' ? 'Active Router' : 'Router Aktif'}: ${activeRouter?.name || 'Router'} (${activeRouter?.host || ''})${
                  routers.length > 1 ? (language === 'en' ? ' - Click to switch' : ' - Klik untuk ganti') : ''
                }`}
              >
                <Router size={18} />
                {routers.length > 1 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-purple text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {routers.length}
                  </span>
                )}
                {/* Floating tooltip */}
                <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-800 dark:bg-slate-700 text-white text-[11px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                  {activeRouter?.name || 'Router'} ({activeRouter?.host})
                </div>
              </button>
            </div>
          ) : (
            <div className="px-1">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-1.5 font-semibold">
                {t.activeRouter}
              </div>
              <div className="relative">
                <select
                  value={activeRouterId || ''}
                  onChange={(e) => setActiveRouterId(Number(e.target.value))}
                  className="w-full appearance-none bg-gradient-to-r from-brand-purple/5 to-indigo-50 dark:from-slate-800 dark:to-slate-800/80 border border-brand-purple/20 dark:border-slate-700 rounded-xl px-3 py-2 pr-8 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 cursor-pointer transition hover:border-brand-purple/40"
                >
                  {routers.map((r) => (
                    <option key={r.id} value={r.id} className="dark:bg-slate-900 dark:text-slate-200">
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
                  <Router size={12} className="text-slate-400 dark:text-slate-500" />
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    {activeRouter.host}:{activeRouter.port}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {routers.length === 0 && (
        <div className="mb-4">
          <NavLink
            to="/config"
            onClick={onNavigate}
            title={language === 'en' ? 'Add Router' : 'Tambah Router'}
            className={`flex items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition ${
              isCollapsed ? 'w-10 h-10 mx-auto' : 'gap-2 px-3 py-2 text-sm'
            }`}
          >
            <Router size={16} />
            {!isCollapsed && <span>{language === 'en' ? 'Add Router' : 'Tambah Router'}</span>}
          </NavLink>
        </div>
      )}

      {/* ── Section: Monitoring ── */}
      {!isCollapsed ? (
        <div className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 mb-2 font-semibold">
          {language === 'en' ? 'Monitoring' : 'Pemantauan'}
        </div>
      ) : (
        <div className="my-2 border-t border-slate-100 dark:border-slate-800 mx-2" />
      )}

      <nav className="space-y-1">
        {monitorItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            title={isCollapsed ? label : undefined}
            className={({ isActive }) =>
              isCollapsed
                ? [
                    'flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition relative group',
                    isActive
                      ? 'bg-brand-purple/15 dark:bg-brand-purple/25 text-brand-purple font-semibold shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70',
                  ].join(' ')
                : [
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition',
                    isActive
                      ? 'bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-800 dark:hover:text-white',
                  ].join(' ')
            }
          >
            <Icon size={isCollapsed ? 19 : 18} className="shrink-0" />
            {!isCollapsed && <span className="truncate">{label}</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                {label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Section: Settings ── */}
      {!isCollapsed ? (
        <div className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 mt-5 mb-2 font-semibold">
          {language === 'en' ? 'Settings' : 'Pengaturan'}
        </div>
      ) : (
        <div className="my-2 border-t border-slate-100 dark:border-slate-800 mx-2" />
      )}

      <nav className="space-y-1">
        {settingsItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            title={isCollapsed ? label : undefined}
            className={({ isActive }) =>
              isCollapsed
                ? [
                    'flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition relative group',
                    isActive
                      ? 'bg-brand-purple/15 dark:bg-brand-purple/25 text-brand-purple font-semibold shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70',
                  ].join(' ')
                : [
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition',
                    isActive
                      ? 'bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-800 dark:hover:text-white',
                  ].join(' ')
            }
          >
            <Icon size={isCollapsed ? 19 : 18} className="shrink-0" />
            {!isCollapsed && <span className="truncate">{label}</span>}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                {label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Section: Admin (if role === 'admin') ── */}
      {user?.role === 'admin' && (
        <>
          {!isCollapsed ? (
            <div className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 mt-5 mb-2 font-semibold">
              Admin
            </div>
          ) : (
            <div className="my-2 border-t border-slate-100 dark:border-slate-800 mx-2" />
          )}
          <nav className="space-y-1">
            {adminItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onNavigate}
                title={isCollapsed ? label : undefined}
                className={({ isActive }) =>
                  isCollapsed
                    ? [
                        'flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition relative group',
                        isActive
                          ? 'bg-brand-purple/15 dark:bg-brand-purple/25 text-brand-purple font-semibold shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70',
                      ].join(' ')
                    : [
                        'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition',
                        isActive
                          ? 'bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-800 dark:hover:text-white',
                      ].join(' ')
                }
              >
                <Icon size={isCollapsed ? 19 : 18} className="shrink-0" />
                {!isCollapsed && <span className="truncate">{label}</span>}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                    {label}
                  </div>
                )}
              </NavLink>
            ))}
          </nav>
        </>
      )}

      {/* ── Bottom: User profile & Logout ── */}
      <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <div
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold uppercase relative group cursor-pointer"
              title={`User: ${user?.username || 'user'}`}
            >
              {user?.username ? user.username[0].toUpperCase() : <User size={14} />}
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                {user?.username}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              title={t.logout}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold uppercase shrink-0">
                {user?.username ? user.username[0].toUpperCase() : <User size={14} />}
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">{user?.username || ''}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              title={t.logout}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

