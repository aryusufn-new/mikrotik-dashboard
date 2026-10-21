import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RouterProvider } from './context/RouterContext'
import AppLayout from './layouts/AppLayout'
import ErrorBoundary from './components/ErrorBoundary'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DeviceMonitor from './pages/DeviceMonitor'
import NocDashboard from './pages/NocDashboard'
import InterfaceTraffic from './pages/InterfaceTraffic'
import PppoeMonitor from './pages/PppoeMonitor'
import HotspotMonitor from './pages/HotspotMonitor'
import ConfigPage from './pages/ConfigPage'
import NetworkTopology from './pages/NetworkTopology'
import AdminLogs from './pages/AdminLogs'

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
  if (token) return <Navigate to="/noc" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <RouterProvider>
            <Routes>
              <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
              <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
              <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route index element={<Navigate to="/noc" replace />} />
                <Route path="/noc" element={<Wrap><NocDashboard /></Wrap>} />
                <Route path="/device" element={<Wrap><DeviceMonitor /></Wrap>} />
                <Route path="/interfaces" element={<Wrap><InterfaceTraffic /></Wrap>} />
                <Route path="/pppoe" element={<Wrap><PppoeMonitor /></Wrap>} />
                <Route path="/hotspot" element={<Wrap><HotspotMonitor /></Wrap>} />
                <Route path="/topology" element={<Wrap><NetworkTopology /></Wrap>} />
                <Route path="/config" element={<Wrap><ConfigPage /></Wrap>} />
                <Route path="/admin/logs" element={<Wrap><AdminLogs /></Wrap>} />
                <Route path="*" element={<Navigate to="/noc" replace />} />
              </Route>
            </Routes>
          </RouterProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </BrowserRouter>
  )
}
