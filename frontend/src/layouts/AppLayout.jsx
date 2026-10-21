import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import ThemeSelector from '../components/ThemeSelector'
import { useLanguage } from '../context/LanguageContext'

export default function AppLayout() {
  const { t } = useLanguage()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sidebar_collapsed', String(next))
      } catch {}
      return next
    })
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-2.5 left-3 z-40 lg:hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 shadow-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 lg:relative lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="relative h-full">
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          )}
          <Sidebar
            onNavigate={() => setMobileOpen(false)}
            isCollapsed={collapsed}
            onToggleCollapse={toggleCollapse}
          />
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-3">
            <div className="lg:hidden w-8" />
            <span className="hidden sm:inline-block text-xs font-medium text-slate-400 dark:text-slate-500">
              {t.appSubtitle}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSelector showLanguage={true} />
          </div>
        </header>

        <main className="flex-1 min-w-0 p-4 sm:p-6 transition-all duration-300">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

