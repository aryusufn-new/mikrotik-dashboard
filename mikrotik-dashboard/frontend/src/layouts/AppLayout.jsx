import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-50 lg:hidden bg-white border border-slate-200 rounded-lg p-2 shadow-sm"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 lg:relative lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="relative">
          {open && (
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 lg:hidden text-slate-400 hover:text-slate-600"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          )}
          <Sidebar onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <main className="flex-1 min-w-0 p-4 pt-14 sm:p-6 lg:pt-6">
        <Outlet />
      </main>
    </div>
  )
}
