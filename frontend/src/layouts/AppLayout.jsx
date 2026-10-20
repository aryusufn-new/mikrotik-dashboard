import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'

export default function AppLayout() {
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
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 lg:hidden bg-white border border-slate-200 rounded-lg p-2 shadow-sm text-slate-700 hover:bg-slate-50"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-sm"
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
              className="absolute top-3 right-3 lg:hidden text-slate-400 hover:text-slate-600 p-1 rounded-lg"
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

      <main className="flex-1 min-w-0 p-4 pt-14 sm:p-6 lg:pt-6 transition-all duration-300">
        <Outlet />
      </main>
    </div>
  )
}

