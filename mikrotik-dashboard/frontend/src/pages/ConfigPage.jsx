import React, { useEffect, useState } from 'react'
import {
  CheckCircle,
  Edit3,
  Loader2,
  Plus,
  Router,
  Trash2,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { addRouter, deleteRouter, testRouterConnection, updateRouter } from '../api'
import { useRouter } from '../context/RouterContext'

const emptyForm = { name: '', host: '', username: 'admin', password: '', port: 8728 }

function RouterCard({ router, isActive, onSelect, onEdit, onDelete, onTest }) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const handleTest = async (e) => {
    e.stopPropagation()
    setTesting(true)
    setTestResult(null)
    const res = await onTest(router.id)
    setTestResult(res)
    setTesting(false)
    setTimeout(() => setTestResult(null), 5000)
  }

  return (
    <div
      className={[
        'bg-white rounded-2xl shadow-card p-5 border-2 transition-all cursor-pointer hover:shadow-lg group',
        isActive
          ? 'border-brand-purple ring-2 ring-brand-purple/20'
          : 'border-transparent hover:border-slate-200',
      ].join(' ')}
      onClick={() => onSelect(router.id)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={[
              'w-10 h-10 rounded-xl flex items-center justify-center transition',
              isActive
                ? 'bg-brand-purple text-white'
                : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200',
            ].join(' ')}
          >
            <Router size={20} />
          </div>
          <div>
            <div className="font-semibold text-slate-800">{router.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {router.host}:{router.port}
            </div>
          </div>
        </div>
        {isActive && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-purple/10 text-brand-purple uppercase tracking-wider">
            Aktif
          </span>
        )}
      </div>

      <div className="text-xs text-slate-500 mb-3">
        <span className="text-slate-400">User:</span> {router.username}
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`mb-3 rounded-lg px-3 py-2 text-xs flex items-center gap-1.5 ${
            testResult.success
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}
        >
          {testResult.success ? (
            <>
              <CheckCircle size={14} />
              {testResult.identity} — RouterOS {testResult.version}
            </>
          ) : (
            <>
              <XCircle size={14} />
              {testResult.error}
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition"
        >
          {testing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
          Test
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit(router)
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition"
        >
          <Edit3 size={13} />
          Edit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(router)
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition ml-auto"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function RouterFormModal({ isOpen, onClose, onSubmit, initial, isEdit }) {
  const [form, setForm] = useState(initial || emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setForm(initial || emptyForm)
      setError(null)
    }
  }, [isOpen, initial])

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: name === 'port' ? Number(value) || 0 : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit(form)
      onClose()
    } catch (e) {
      setError(e?.response?.data?.detail || e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10 animate-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800">
            {isEdit ? 'Edit Router' : 'Tambah Router Baru'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nama Router
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Contoh: Router Kantor Pusat"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Host / IP Address
            </label>
            <input
              name="host"
              value={form.host}
              onChange={handleChange}
              required
              placeholder="192.168.88.1"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Username
              </label>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                placeholder="admin"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Port API
              </label>
              <input
                name="port"
                type="number"
                value={form.port}
                onChange={handleChange}
                required
                placeholder="8728"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder={isEdit ? 'Kosongkan jika tidak diubah' : 'Masukkan password'}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
            />
            <p className="text-xs text-slate-400 mt-1">
              Port default: 8728 (API) atau 8729 (API-SSL)
            </p>
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-700 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <XCircle size={16} />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-5 py-2.5 bg-brand-purple text-white rounded-lg text-sm font-medium hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2 transition"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Simpan Perubahan' : 'Tambah Router'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, router }) {
  const [deleting, setDeleting] = useState(false)

  if (!isOpen || !router) return null

  const handleConfirm = async () => {
    setDeleting(true)
    await onConfirm(router.id)
    setDeleting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Hapus Router?</h2>
        <p className="text-sm text-slate-500 mb-5">
          Router <strong>{router.name}</strong> ({router.host}) akan dihapus permanen.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 px-5 py-2.5 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2 transition"
          >
            {deleting && <Loader2 size={16} className="animate-spin" />}
            Ya, Hapus
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConfigPage() {
  const { routers, activeRouterId, setActiveRouterId, refreshRouters } = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editRouter, setEditRouter] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    refreshRouters()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async (form) => {
    await addRouter(form)
    await refreshRouters()
    setMsg('Router berhasil ditambahkan')
    setTimeout(() => setMsg(null), 3000)
  }

  const handleEdit = async (form) => {
    const payload = { name: form.name, host: form.host, username: form.username, port: form.port }
    if (form.password) payload.password = form.password
    await updateRouter(editRouter.id, payload)
    await refreshRouters()
    setEditRouter(null)
    setMsg('Router berhasil diperbarui')
    setTimeout(() => setMsg(null), 3000)
  }

  const handleDelete = async (routerId) => {
    await deleteRouter(routerId)
    await refreshRouters()
    setMsg('Router berhasil dihapus')
    setTimeout(() => setMsg(null), 3000)
  }

  const handleTest = async (routerId) => {
    try {
      return await testRouterConnection(routerId)
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Konfigurasi Router</h1>
          <p className="text-slate-500 text-sm">
            Kelola daftar router Mikrotik yang ingin dipantau
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-purple text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition shadow-sm"
        >
          <Plus size={18} />
          Tambah Router
        </button>
      </div>

      {msg && (
        <div className="mb-4 bg-emerald-50 text-emerald-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2 animate-in">
          <CheckCircle size={18} />
          {msg}
        </div>
      )}

      {routers.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Router size={32} className="text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Belum ada router</h3>
          <p className="text-sm text-slate-400 mb-4 max-w-sm">
            Tambahkan router Mikrotik untuk mulai monitoring. Kamu bisa menambahkan beberapa
            router dan memilih mana yang ingin dipantau.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-purple text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition"
          >
            <Plus size={18} />
            Tambah Router Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {routers.map((r) => (
            <RouterCard
              key={r.id}
              router={r}
              isActive={r.id === activeRouterId}
              onSelect={setActiveRouterId}
              onEdit={setEditRouter}
              onDelete={setDeleteTarget}
              onTest={handleTest}
            />
          ))}
        </div>
      )}

      {/* Add modal */}
      <RouterFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleAdd}
        initial={emptyForm}
        isEdit={false}
      />

      {/* Edit modal */}
      <RouterFormModal
        isOpen={!!editRouter}
        onClose={() => setEditRouter(null)}
        onSubmit={handleEdit}
        initial={
          editRouter
            ? { name: editRouter.name, host: editRouter.host, username: editRouter.username, password: '', port: editRouter.port }
            : emptyForm
        }
        isEdit={true}
      />

      {/* Delete confirmation */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        router={deleteTarget}
      />
    </div>
  )
}
