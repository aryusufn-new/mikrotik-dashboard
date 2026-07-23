import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RouterProvider } from './context/RouterContext'
import AppLayout from './layouts/AppLayout'
import ErrorBoundary from './components/ErrorBoundary'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DeviceMonitor from './pages/DeviceMonitor'
import InterfaceTraffic from './pages/InterfaceTraffic'
import PppoeMonitor from './pages/PppoeMonitor'
import HotspotMonitor from './pages/HotspotMonitor'
import ConfigPage from './pages/ConfigPage'

function Wrap({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

function RequireAuth({ children }) {
  const { token, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>
  if (!token) return <Navigate to="/login" replace />
  return children
}

function GuestOnly({ children }) {
  const { token, loading } = useAuth()
  if (loading) return null
  if (token) return <Navigate to="/device" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RouterProvider>
          <Routes>
            <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route index element={<Navigate to="/device" replace />} />
              <Route path="/device" element={<Wrap><DeviceMonitor /></Wrap>} />
              <Route path="/interfaces" element={<Wrap><InterfaceTraffic /></Wrap>} />
              <Route path="/pppoe" element={<Wrap><PppoeMonitor /></Wrap>} />
              <Route path="/hotspot" element={<Wrap><HotspotMonitor /></Wrap>} />
              <Route path="/config" element={<Wrap><ConfigPage /></Wrap>} />
              <Route path="*" element={<Navigate to="/device" replace />} />
            </Route>
          </Routes>
        </RouterProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
