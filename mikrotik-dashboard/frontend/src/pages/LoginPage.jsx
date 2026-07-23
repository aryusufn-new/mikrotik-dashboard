import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AlertCircle, LogIn, ServerCrash, ShieldAlert, WifiOff } from 'lucide-react'

function parseError(err) {
  const status = err.response?.status
  const detail = err.response?.data?.detail

  if (!err.response) {
    if (err.message?.toLowerCase().includes('network') || err.code === 'ERR_NETWORK') {
      return {
        type: 'network',
        icon: WifiOff,
        title: 'Tidak dapat terhubung ke server',
        desc: 'Pastikan backend sedang berjalan dan jaringan tersambung.',
      }
    }
    if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
      return {
        type: 'timeout',
        icon: ServerCrash,
        title: 'Koneksi timeout',
        desc: 'Server tidak merespons. Coba lagi beberapa saat.',
      }
    }
    return {
      type: 'unknown',
      icon: AlertCircle,
      title: 'Terjadi kesalahan',
      desc: err.message || 'Error tidak diketahui.',
    }
  }

  if (status === 401 || status === 403) {
    return {
      type: 'auth',
      icon: ShieldAlert,
      title: 'Username atau password salah',
      desc: detail || 'Periksa kembali kredensial Anda.',
    }
  }

  if (status >= 500) {
    return {
      type: 'server',
      icon: ServerCrash,
      title: 'Server error',
      desc: detail || `Server mengembalikan error ${status}.`,
    }
  }

  return {
    type: 'unknown',
    icon: AlertCircle,
    title: 'Login gagal',
    desc: detail || err.message || 'Silakan coba lagi.',
  }
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [alert, setAlert] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAlert(null)
    setLoading(true)
    try {
      await login(username, password)
      navigate('/device', { replace: true })
    } catch (err) {
      setAlert(parseError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold tracking-tight text-slate-800">
            MIMO<span className="text-brand-purple">.SA</span>
          </div>
          <div className="text-sm text-slate-500 mt-1">Monitoring MikroTik System</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 text-center">Login</h2>

          {alert && (() => {
            const Icon = alert.icon
            const colors = {
              auth: 'bg-rose-50 border-rose-200 text-rose-700',
              network: 'bg-amber-50 border-amber-200 text-amber-700',
              timeout: 'bg-amber-50 border-amber-200 text-amber-700',
              server: 'bg-orange-50 border-orange-200 text-orange-700',
              unknown: 'bg-rose-50 border-rose-200 text-rose-700',
            }
            return (
              <div className={`flex gap-3 items-start border rounded-xl px-4 py-3 text-sm ${colors[alert.type] || colors.unknown}`}>
                <Icon size={18} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">{alert.title}</div>
                  <div className="text-xs mt-0.5 opacity-80">{alert.desc}</div>
                </div>
              </div>
            )
          })()}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setAlert(null) }}
              required
              autoFocus
              autoComplete="username"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 ${alert?.type === 'auth' ? 'border-rose-300' : 'border-slate-200'}`}
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setAlert(null) }}
              required
              autoComplete="current-password"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 ${alert?.type === 'auth' ? 'border-rose-300' : 'border-slate-200'}`}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-purple text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-purple/90 transition disabled:opacity-50"
          >
            <LogIn size={16} />
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600 mt-4">
          Belum punya akun? <Link to="/register" className="text-brand-purple hover:underline font-medium">Daftar di sini</Link>
        </p>
      </div>
    </div>
  )
}
