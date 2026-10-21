import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { registerApi } from '../api'
import { AlertCircle, UserPlus, ServerCrash, WifiOff } from 'lucide-react'
import ThemeSelector from '../components/ThemeSelector'

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
    return {
      type: 'unknown',
      icon: AlertCircle,
      title: 'Terjadi kesalahan',
      desc: err.message || 'Error tidak diketahui.',
    }
  }

  if (status === 400) {
    return {
      type: 'validation',
      icon: AlertCircle,
      title: 'Data tidak valid',
      desc: detail || 'Periksa kembali data yang Anda masukkan.',
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
    title: 'Registrasi gagal',
    desc: detail || err.message || 'Silakan coba lagi.',
  }
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [alert, setAlert] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAlert(null)

    if (password !== confirmPassword) {
      setAlert({
        type: 'validation',
        icon: AlertCircle,
        title: 'Password tidak cocok',
        desc: 'Pastikan password dan konfirmasi password sama.',
      })
      return
    }

    if (username.trim().length < 3) {
      setAlert({
        type: 'validation',
        icon: AlertCircle,
        title: 'Username terlalu pendek',
        desc: 'Username minimal 3 karakter.',
      })
      return
    }

    if (password.length < 4) {
      setAlert({
        type: 'validation',
        icon: AlertCircle,
        title: 'Password terlalu pendek',
        desc: 'Password minimal 4 karakter.',
      })
      return
    }

    setLoading(true)
    try {
      const data = await registerApi(username, password)
      localStorage.setItem('token', data.access_token)
      navigate('/device', { replace: true })
      window.location.reload()
    } catch (err) {
      setAlert(parseError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 relative transition-colors duration-200">
      {/* Top right Theme and Language selector */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeSelector showLanguage={true} />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">
            MIMO<span className="text-brand-purple">.SA</span>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monitoring MikroTik System</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-card dark:shadow-none p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white text-center">Daftar Akun Baru</h2>

          {alert && (() => {
            const Icon = alert.icon
            const colors = {
              validation: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300',
              network: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300',
              server: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-300',
              unknown: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300',
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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setAlert(null) }}
              required
              autoFocus
              autoComplete="username"
              className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 ${alert?.type === 'validation' ? 'border-rose-300 dark:border-rose-800' : 'border-slate-200 dark:border-slate-700'}`}
              placeholder="Minimal 3 karakter"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setAlert(null) }}
              required
              autoComplete="new-password"
              className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 ${alert?.type === 'validation' ? 'border-rose-300 dark:border-rose-800' : 'border-slate-200 dark:border-slate-700'}`}
              placeholder="Minimal 4 karakter"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Konfirmasi Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setAlert(null) }}
              required
              autoComplete="new-password"
              className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 ${alert?.type === 'validation' ? 'border-rose-300 dark:border-rose-800' : 'border-slate-200 dark:border-slate-700'}`}
              placeholder="Ulangi password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-purple text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-purple/90 transition disabled:opacity-50"
          >
            <UserPlus size={16} />
            {loading ? 'Mendaftar…' : 'Daftar'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-4">
          Sudah punya akun? <Link to="/login" className="text-brand-purple hover:underline font-medium">Login di sini</Link>
        </p>
      </div>
    </div>
  )
}
