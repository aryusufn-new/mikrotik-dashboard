import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Cable,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Edit3,
  ExternalLink,
  Layers,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldAlert,
  Signal,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'
import {
  addCustomer,
  addOlt,
  autoScanCustomers,
  checkAllOptical,
  checkCustomerOptical,
  deleteCustomer,
  deleteOlt,
  getCustomers,
  getCustomerStats,
  getOlts,
  getPppActive,
  getPppSecrets,
  importAllPppoe,
  scanOltOnus,
  syncPppoe,
  testOltConnection,
  updateCustomer,
  updateOlt,
} from '../api'
import { useLanguage } from '../context/LanguageContext'
import { useRouter } from '../context/RouterContext'

// Helper: Format phone to WhatsApp link
function formatWhatsAppUrl(phone) {
  if (!phone) return null
  let cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1)
  return `https://wa.me/${cleaned}`
}

// Optical power color and tier badge helper
function getOpticalTier(rxPower) {
  if (rxPower === null || rxPower === undefined) {
    return {
      tier: 'unknown',
      label: 'Belum Dicek',
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      barColor: 'bg-slate-400',
      percentage: 0,
    }
  }
  const val = Number(rxPower)
  if (val <= -35.0) {
    return {
      tier: 'los',
      label: 'LOS (Putus)',
      badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-300 dark:border-rose-900',
      barColor: 'bg-rose-600',
      percentage: 5,
    }
  }
  if (val < -27.0) {
    return {
      tier: 'critical',
      label: 'Kritis (Jelek)',
      badgeClass: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border-red-300 dark:border-red-900',
      barColor: 'bg-red-500',
      percentage: Math.max(10, Math.min(35, 100 - (Math.abs(val) - 20) * 5)),
    }
  }
  if (val < -24.0) {
    return {
      tier: 'warning',
      label: 'Waspada (Tinggi)',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      barColor: 'bg-amber-500',
      percentage: 60,
    }
  }
  if (val >= -14.0) {
    return {
      tier: 'warning',
      label: 'Sinyal Kuat',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      barColor: 'bg-amber-500',
      percentage: 75,
    }
  }
  // -14 to -24 dBm is optimal
  const pct = Math.round(100 - (Math.abs(val) - 14) * 5)
  return {
    tier: 'normal',
    label: 'Normal (Bagus)',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    barColor: 'bg-emerald-500',
    percentage: Math.max(70, Math.min(98, pct)),
  }
}

// ── Modals: Customer Create/Edit ───────────────────────────
function CustomerModal({ isOpen, onClose, onSave, initial, olts, secrets }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    odp_name: '',
    pppoe_username: '',
    olt_id: olts?.[0]?.id || '',
    pon_port: 'PON 1',
    onu_id: 1,
    onu_sn: '',
    onu_model: 'V2801SG',
    package_name: '20 Mbps',
    status: 'active',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      if (initial) {
        setForm({
          name: initial.name || '',
          phone: initial.phone || '',
          address: initial.address || '',
          odp_name: initial.odp_name || '',
          pppoe_username: initial.pppoe_username || '',
          olt_id: initial.olt_id || olts?.[0]?.id || '',
          pon_port: initial.pon_port || 'PON 1',
          onu_id: initial.onu_id || 1,
          onu_sn: initial.onu_sn || '',
          onu_model: initial.onu_model || 'V2801SG',
          package_name: initial.package_name || '20 Mbps',
          status: initial.status || 'active',
        })
      } else {
        setForm({
          name: '',
          phone: '',
          address: '',
          odp_name: '',
          pppoe_username: '',
          olt_id: olts?.[0]?.id || '',
          pon_port: 'PON 1',
          onu_id: 1,
          onu_sn: '',
          onu_model: 'V2801SG',
          package_name: '20 Mbps',
          status: 'active',
        })
      }
      setError(null)
    }
  }, [isOpen, initial, olts])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({
      ...f,
      [name]: name === 'onu_id' || name === 'olt_id' ? (Number(value) || '') : value,
    }))
  }

  const handleSelectPppoe = (e) => {
    const u = e.target.value
    if (!u) return
    const match = secrets?.find((s) => s.name === u)
    setForm((f) => ({
      ...f,
      pppoe_username: u,
      name: f.name || match?.comment || u,
      package_name: match?.profile || f.package_name,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl p-6 z-10 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
              <UserPlus size={19} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                {initial ? 'Edit Pelanggan FTTH' : 'Tambah Pelanggan Baru'}
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Data profil pelanggan, pemetaan OLT & ONU redaman
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick autofill from PPPoE secret */}
          {secrets && secrets.length > 0 && !initial && (
            <div className="p-3 bg-violet-50/60 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-900/40 rounded-xl">
              <label className="block text-xs font-semibold text-violet-900 dark:text-violet-300 mb-1">
                ⚡ Impor Cepat dari Akun PPPoE MikroTik:
              </label>
              <select
                onChange={handleSelectPppoe}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-violet-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">-- Pilih akun PPPoE dari router --</option>
                {secrets.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} {s.comment ? `(${s.comment})` : ''} - Profil: {s.profile || 'default'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Pelanggan *
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="Contoh: Budi Santoso"
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                No. Telepon / WhatsApp
              </label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="081234567890"
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Username PPPoE MikroTik
              </label>
              <input
                name="pppoe_username"
                value={form.pppoe_username}
                onChange={handleChange}
                placeholder="budi_ftth"
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Paket Layanan
              </label>
              <input
                name="package_name"
                value={form.package_name}
                onChange={handleChange}
                placeholder="Contoh: 30 Mbps"
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kotak ODP / FAT
              </label>
              <input
                name="odp_name"
                value={form.odp_name}
                onChange={handleChange}
                placeholder="Contoh: ODP-MWR-01/04"
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status Layanan
              </label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="active">Aktif (Berlangganan)</option>
                <option value="isolir">Isolir (Tunggakan)</option>
                <option value="maintenance">Perbaikan / Maintenance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Alamat Rumah / Lokasi Pemasangan
            </label>
            <input
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="Jl. Mawar No. 12, RT 02/05"
              className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* OLT and PON Mapping */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Server size={14} className="text-violet-500" /> Pemetaan OLT & Modem ONU
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  OLT
                </label>
                <select
                  name="olt_id"
                  value={form.olt_id}
                  onChange={handleChange}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">-- Pilih OLT --</option>
                  {olts?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.brand.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Port PON
                </label>
                <select
                  name="pon_port"
                  value={form.pon_port}
                  onChange={handleChange}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((p) => (
                    <option key={p} value={`PON ${p}`}>
                      PON {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  ONU ID
                </label>
                <input
                  type="number"
                  min="1"
                  max="128"
                  name="onu_id"
                  value={form.onu_id}
                  onChange={handleChange}
                  required
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Serial Number (SN) / MAC Modem ONU
                </label>
                <input
                  name="onu_sn"
                  value={form.onu_sn}
                  onChange={handleChange}
                  placeholder="VSOL1A2B3C4D atau HWTC..."
                  className="w-full font-mono uppercase border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Model Modem / ONT
                </label>
                <input
                  name="onu_model"
                  value={form.onu_model}
                  onChange={handleChange}
                  placeholder="V2801SG, HG8245H, F609"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition shadow-sm"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {initial ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// ── Modals: OLT Manager ────────────────────────────────────
function OltManagerModal({ isOpen, onClose, olts, onReload }) {
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'add'
  const [testingId, setTestingId] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [form, setForm] = useState({
    name: '',
    brand: 'vsol',
    host: '192.168.10.1',
    snmp_port: 161,
    snmp_community: 'public',
    telnet_port: 23,
    telnet_user: 'admin',
    telnet_pass: 'admin',
    pon_ports_count: 8,
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanningId, setScanningId] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleTest = async (id) => {
    setTestingId(id)
    setTestResult(null)
    try {
      const res = await testOltConnection(id)
      setTestResult({ id, ...res })
    } catch (e) {
      setTestResult({ id, reachable: false, details: e.message })
    } finally {
      setTestingId(null)
    }
  }

  const handleScan = async (id) => {
    setScanningId(id)
    setScanResult(null)
    try {
      const res = await scanOltOnus(id)
      setScanResult({ id, items: res })
    } catch (e) {
      alert('Scan gagal: ' + e.message)
    } finally {
      setScanningId(null)
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Hapus OLT "${name}"? Pelanggan yang terhubung akan dilepas OLT-nya.`)) return
    try {
      await deleteOlt(id)
      onReload()
    } catch (e) {
      alert('Gagal menghapus: ' + e.message)
    }
  }

  const handleSaveOlt = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await addOlt(form)
      setForm({
        name: '',
        brand: 'vsol',
        host: '192.168.10.1',
        snmp_port: 161,
        snmp_community: 'public',
        telnet_port: 23,
        telnet_user: 'admin',
        telnet_pass: 'admin',
        pon_ports_count: 8,
        description: '',
      })
      setActiveTab('list')
      onReload()
    } catch (err) {
      alert('Gagal menambah OLT: ' + (err?.response?.data?.detail || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-6 z-10 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
              <Server size={19} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Kelola Optical Line Terminal (OLT)
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Konfigurasi VSOL, HSGQ, C-Data via SNMP & Telnet CLI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'list'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Daftar OLT ({olts?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'add'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Plus size={14} /> Tambah OLT Baru
          </button>
        </div>

        {activeTab === 'list' ? (
          <div className="space-y-3.5">
            {olts?.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Belum ada OLT yang terdaftar. Klik "Tambah OLT Baru" untuk menambahkan.
              </div>
            ) : (
              olts.map((olt) => (
                <div
                  key={olt.id}
                  className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800 dark:text-white">
                          {olt.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                          {olt.brand}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                          SNMP v2c
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Host: {olt.host} • Port SNMP: {olt.snmp_port || 161} (Community: {olt.snmp_community || 'public'}) • {olt.pon_ports_count} Port PON
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTest(olt.id)}
                        disabled={testingId === olt.id}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-500 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        {testingId === olt.id ? (
                          <Loader2 size={13} className="animate-spin text-violet-500" />
                        ) : (
                          <Zap size={13} className="text-violet-500" />
                        )}
                        Test SNMP
                      </button>

                      <button
                        onClick={() => handleScan(olt.id)}
                        disabled={scanningId === olt.id}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        {scanningId === olt.id ? (
                          <Loader2 size={13} className="animate-spin text-emerald-500" />
                        ) : (
                          <Radio size={13} className="text-emerald-500" />
                        )}
                        Scan ONU
                      </button>

                      <button
                        onClick={() => handleDelete(olt.id, olt.name)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
                        title="Hapus OLT"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Test Result Banner */}
                  {testResult && testResult.id === olt.id && (
                    <div
                      className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                        testResult.reachable
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                          : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                      }`}
                    >
                      {testResult.reachable ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                      <span>
                        Status: <strong>{testResult.reachable ? 'Tersambung Online' : 'Tidak Terjangkau'}</strong>
                        {testResult.latency_ms && ` (${testResult.latency_ms} ms)`} — {testResult.details}
                      </span>
                    </div>
                  )}

                  {/* Scan Result */}
                  {scanResult && scanResult.id === olt.id && (
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>Daftar ONU Terdeteksi ({scanResult.items.length} unit):</span>
                        <button
                          onClick={() => setScanResult(null)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          Tutup
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                        {scanResult.items.map((it) => (
                          <div key={it.onu_sn} className="py-1.5 flex items-center justify-between">
                            <span className="font-mono text-slate-800 dark:text-slate-200">
                              {it.pon_port} #{it.onu_id} • <strong>{it.onu_sn}</strong> ({it.onu_model})
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold ${
                                it.status === 'normal'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {it.rx_power} dBm
                            </span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const res = await autoScanCustomers(olt.id)
                            alert(res.message || 'Berhasil mensinkronkan semua ONU ke daftar pelanggan!')
                            onReload()
                          } catch (e) {
                            alert('Gagal impor ONU: ' + e.message)
                          }
                        }}
                        className="w-full mt-2 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                      >
                        <Zap size={13} className="text-amber-300" />
                        {t.btnImporSemuaOnu || 'Impor Semua ONU ke Pelanggan'} ({scanResult.items.length})
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <form onSubmit={handleSaveOlt} className="space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama OLT *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Contoh: OLT Sentral V1600G"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Merk OLT
                </label>
                <select
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="vsol">VSOL (EPON / GPON)</option>
                  <option value="hsgq">HSGQ</option>
                  <option value="cdata">C-Data</option>
                  <option value="generic">Generic PON OLT</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Host / IP Address OLT *
                </label>
                <input
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  required
                  placeholder="192.168.10.1"
                  className="w-full font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jumlah Port PON
                </label>
                <select
                  value={form.pon_ports_count}
                  onChange={(e) => setForm({ ...form, pon_ports_count: Number(e.target.value) })}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value={4}>4 Port PON</option>
                  <option value={8}>8 Port PON</option>
                  <option value={16}>16 Port PON</option>
                </select>
              </div>
            </div>

            {/* SNMP Configuration */}
            <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <Zap size={14} className="text-emerald-600" /> Konfigurasi SNMP v2c (Koneksi Utama)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Protokol SNMP v2c digunakan untuk membaca redaman optik (RX/TX dBm), jarak fiber, dan status live ONU dari OLT secara berkala.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Port SNMP (UDP) *
                  </label>
                  <input
                    type="number"
                    value={form.snmp_port}
                    onChange={(e) => setForm({ ...form, snmp_port: Number(e.target.value) || 161 })}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SNMP Community (Read-Only) *
                  </label>
                  <input
                    value={form.snmp_community}
                    onChange={(e) => setForm({ ...form, snmp_community: e.target.value })}
                    placeholder="public"
                    className="w-full font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Username Telnet
                </label>
                <input
                  value={form.telnet_user}
                  onChange={(e) => setForm({ ...form, telnet_user: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password Telnet
                </label>
                <input
                  type="password"
                  value={form.telnet_pass}
                  onChange={(e) => setForm({ ...form, telnet_pass: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Catatan Lokasi
              </label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Rak Server Lt. 1 Sentral"
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Simpan OLT
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Modals: Sync PPPoE ─────────────────────────────────────
function SyncPppoeModal({ isOpen, onClose, onImport, activeRouter }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [importingUser, setImportingUser] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      syncPppoe()
        .then((res) => setData(res))
        .catch((err) => alert('Gagal memuat PPPoE: ' + err.message))
        .finally(() => setLoading(false))
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const [importingAll, setImportingAll] = useState(false)

  const handleImportSingle = async (item) => {
    setImportingUser(item.pppoe_username)
    try {
      await onImport({
        name: item.comment || item.pppoe_username,
        pppoe_username: item.pppoe_username,
        package_name: item.profile || '20 Mbps',
        status: 'active',
      })
      setData((d) => ({
        ...d,
        unregistered_secrets: d.unregistered_secrets.filter(
          (u) => u.pppoe_username !== item.pppoe_username
        ),
      }))
    } catch (e) {
      alert('Gagal impor: ' + e.message)
    } finally {
      setImportingUser(null)
    }
  }

  const handleImportAll = async () => {
    setImportingAll(true)
    try {
      const res = await autoScanCustomers()
      alert(res.message || 'Semua akun PPPoE berhasil disinkronkan ke pelanggan!')
      onSuccess?.()
      onClose()
    } catch (e) {
      alert('Gagal impor massal: ' + e.message)
    } finally {
      setImportingAll(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl p-6 z-10 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
              <LinkIcon size={19} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Sinkronisasi PPPoE MikroTik
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Router: <strong>{activeRouter?.name || 'Default'}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 size={24} className="animate-spin text-violet-500" />
            <span className="text-xs">Memeriksa akun PPPoE di MikroTik...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <div className="text-xl font-bold text-slate-800 dark:text-white">
                  {data?.total_secrets || 0}
                </div>
                <div className="text-[11px] text-slate-400">Total Akun Secret</div>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {data?.total_active || 0}
                </div>
                <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                  Sedang Online
                </div>
              </div>
              <div className="p-3 bg-violet-50 dark:bg-violet-950/40 rounded-xl border border-violet-200/60 dark:border-violet-900/40">
                <div className="text-xl font-bold text-violet-600 dark:text-violet-400">
                  {data?.unregistered_secrets?.length || 0}
                </div>
                <div className="text-[11px] text-violet-600/80 dark:text-violet-400/80">
                  Belum Terdaftar
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Akun PPPoE yang Belum Masuk Database Pelanggan:
                </h4>
                {data?.unregistered_secrets?.length > 0 && (
                  <button
                    onClick={handleImportAll}
                    disabled={importingAll}
                    className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    {importingAll ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} className="text-amber-300" />}
                    {t.btnImportAllPppoe || 'Impor Semua Sekaligus'} ({data.unregistered_secrets.length})
                  </button>
                )}
              </div>

              {data?.unregistered_secrets?.length === 0 ? (
                <div className="text-center py-6 text-emerald-600 dark:text-emerald-400 text-xs font-semibold bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/40">
                  ✓ Semua akun PPPoE dari router sudah terdaftar di database pelanggan!
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                  {data?.unregistered_secrets?.map((s) => (
                    <div
                      key={s.pppoe_username}
                      className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-white">
                            {s.pppoe_username}
                          </span>
                          {s.is_active && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                              Online ({s.active_ip})
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Profil: {s.profile || '-'} {s.comment ? `• Catatan: ${s.comment}` : ''}
                        </p>
                      </div>

                      <button
                        onClick={() => handleImportSingle(s)}
                        disabled={importingUser === s.pppoe_username}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                      >
                        {importingUser === s.pppoe_username ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Plus size={13} />
                        )}
                        Impor
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Main Customer & OLT Monitor Page ───────────────────────
export default function CustomerMonitor() {
  const { t } = useLanguage()
  const { activeRouter } = useRouter()

  const [customers, setCustomers] = useState([])
  const [olts, setOlts] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    normal: 0,
    warning: 0,
    critical: 0,
    los: 0,
  })
  const [secrets, setSecrets] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedOlt, setSelectedOlt] = useState('')
  const [selectedTier, setSelectedTier] = useState('')

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [oltModalOpen, setOltModalOpen] = useState(false)
  const [syncModalOpen, setSyncModalOpen] = useState(false)

  // Live Optical Checking state
  const [checkingId, setCheckingId] = useState(null)
  const [checkingAll, setCheckingAll] = useState(false)
  const [scanningAll, setScanningAll] = useState(false)

  const handleAutoScan = async () => {
    setScanningAll(true)
    try {
      const res = await autoScanCustomers(selectedOlt ? Number(selectedOlt) : null)
      alert(res.message || 'Auto scan selesai!')
      await loadData()
    } catch (e) {
      alert('Gagal auto scan: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setScanningAll(false)
    }
  }

  const loadData = async () => {
    try {
      const [custRes, oltRes, statRes] = await Promise.all([
        getCustomers({ search, status: selectedTier, olt_id: selectedOlt || undefined }),
        getOlts(),
        getCustomerStats(),
      ])
      setCustomers(custRes || [])
      setOlts(oltRes || [])
      setStats(statRes || { total: 0, active: 0, normal: 0, warning: 0, critical: 0, los: 0 })
    } catch (e) {
      console.error('Failed to load customers:', e)
    } finally {
      setLoading(false)
    }
  }

  // Load PPPoE secrets for autofill
  useEffect(() => {
    getPppSecrets()
      .then((res) => setSecrets(res || []))
      .catch(() => {})
  }, [activeRouter])

  useEffect(() => {
    loadData()
  }, [search, selectedOlt, selectedTier, activeRouter])

  const handleCheckOpticalSingle = async (id) => {
    setCheckingId(id)
    try {
      const res = await checkCustomerOptical(id)
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                last_rx_power: res.rx_power,
                last_tx_power: res.tx_power,
                last_olt_rx: res.olt_rx,
                last_distance: res.distance_km,
                last_optical_status: res.status,
                last_checked_at: res.timestamp,
              }
            : c
        )
      )
      // Update summary stats
      getCustomerStats().then(setStats).catch(() => {})
    } catch (e) {
      alert('Gagal mengecek redaman: ' + e.message)
    } finally {
      setCheckingId(null)
    }
  }

  const handleCheckAllOptical = async () => {
    setCheckingAll(true)
    try {
      await checkAllOptical(selectedOlt ? Number(selectedOlt) : null)
      await loadData()
    } catch (e) {
      alert('Gagal mengecek redaman massal: ' + e.message)
    } finally {
      setCheckingAll(false)
    }
  }

  const handleSaveCustomer = async (formData) => {
    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, formData)
    } else {
      await addCustomer(formData)
    }
    loadData()
  }

  const handleDeleteCustomer = async (id, name) => {
    if (!window.confirm(`Hapus pelanggan "${name}" dari sistem?`)) return
    try {
      await deleteCustomer(id)
      loadData()
    } catch (e) {
      alert('Gagal menghapus pelanggan: ' + e.message)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Page Header & Quick Actions ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              <Cable size={22} />
            </span>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              {t.customerTitle || 'Monitoring Pelanggan & Redaman OLT'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              FTTH Live
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.customerSubtitle ||
              'Pemantauan redaman optik FTTH (dBm), status koneksi ONU/ONT, dan integrasi PPPoE MikroTik'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleAutoScan}
            disabled={scanningAll}
            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-violet-500/20 transition hover:shadow-lg disabled:opacity-60"
            title={t.autoScanDesc || 'Auto scan semua akun PPPoE & ONU OLT'}
          >
            {scanningAll ? (
              <Loader2 size={14} className="animate-spin text-white" />
            ) : (
              <Zap size={14} className="text-amber-300" />
            )}
            {t.btnAutoScan || 'Auto Scan Pelanggan'}
          </button>

          <button
            onClick={handleCheckAllOptical}
            disabled={checkingAll}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-500 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700/60"
            title="Cek redaman semua pelanggan saat ini"
          >
            <RefreshCw size={14} className={checkingAll ? 'animate-spin text-violet-500' : 'text-violet-500'} />
            {t.btnCekSemuaRedaman || 'Cek Redaman Semua'}
          </button>

          <button
            onClick={() => setSyncModalOpen(true)}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-500 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700/60"
          >
            <LinkIcon size={14} className="text-indigo-500" />
            {t.btnSyncPppoe || 'Sinkronisasi PPPoE'}
          </button>

          <button
            onClick={() => setOltModalOpen(true)}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-500 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700/60"
          >
            <Server size={14} className="text-amber-500" />
            {t.btnKelolaOlt || 'Kelola OLT'} ({olts.length})
          </button>

          <button
            onClick={() => {
              setEditingCustomer(null)
              setModalOpen(true)
            }}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md transition shadow-violet-500/20"
          >
            <UserPlus size={15} />
            {t.btnTambahPelanggan || 'Tambah Pelanggan'}
          </button>
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Total Pelanggan */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t.totalCustomers || 'Total Pelanggan'}
            </span>
            <Users size={16} className="text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-800 dark:text-white">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {stats.active} {t.activeSubscribers || 'aktif berlangganan'}
          </div>
        </div>

        {/* Online PPPoE */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {t.onlinePppoe || 'Online PPPoE'}
            </span>
            <Wifi size={16} className="text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {customers.filter((c) => c.is_pppoe_online).length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {t.activeSessionsInMikrotik || 'Sesi aktif di MikroTik'}
          </div>
        </div>

        {/* Normal Attenuation (-14 to -24 dBm) */}
        <div
          onClick={() => setSelectedTier(selectedTier === 'normal' ? '' : 'normal')}
          className={`p-4 rounded-2xl cursor-pointer border transition ${
            selectedTier === 'normal'
              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-400'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {t.optNormal || 'Normal (Optimal)'}
            </span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.normal}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">-14 s/d -24 dBm</div>
        </div>

        {/* Warning Attenuation (-24.1 to -27 dBm) */}
        <div
          onClick={() => setSelectedTier(selectedTier === 'warning' ? '' : 'warning')}
          className={`p-4 rounded-2xl cursor-pointer border transition ${
            selectedTier === 'warning'
              ? 'ring-2 ring-amber-500 bg-amber-50/50 dark:bg-amber-950/30 border-amber-400'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {t.optWarning || 'Waspada (Tinggi)'}
            </span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.warning}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">-24.1 s/d -27 dBm</div>
        </div>

        {/* Critical & LOS (< -27 dBm) */}
        <div
          onClick={() => setSelectedTier(selectedTier === 'critical' ? '' : 'critical')}
          className={`p-4 rounded-2xl cursor-pointer border transition ${
            selectedTier === 'critical'
              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30 border-rose-400'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {t.optCriticalLos || 'Kritis / LOS'}
            </span>
            <ShieldAlert size={16} className="text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {stats.critical + stats.los}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            &lt; -27 dBm ({t.needInspection || 'Perlu Cek'})
          </div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              t.searchCustomerPlaceholder || 'Cari nama, user PPPoE, telepon, SN ONU, atau ODP...'
            }
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={selectedOlt}
            onChange={(e) => setSelectedOlt(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">{t.allOlt || 'Semua OLT'}</option>
            {olts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">{t.allAttenuation || 'Semua Kualitas Redaman'}</option>
            <option value="normal">{t.optNormal || 'Normal (-14 s/d -24 dBm)'}</option>
            <option value="warning">{t.optWarning || 'Waspada (-24 s/d -27 dBm)'}</option>
            <option value="critical">{t.optCritical || 'Kritis (< -27 dBm)'}</option>
            <option value="los">{t.optLos || 'LOS (Tidak Ada Sinyal)'}</option>
          </select>
        </div>
      </div>

      {/* ── Customer FTTH Table ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 size={28} className="animate-spin text-violet-500" />
            <span className="text-xs">{t.loadingCustomerData || 'Memuat data pelanggan & telemetri OLT...'}</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
            <p>{t.noCustomersFound || 'Tidak ada pelanggan yang cocok dengan kriteria pencarian atau filter.'}</p>
            <button
              onClick={handleAutoScan}
              disabled={scanningAll}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-violet-500/20 transition hover:shadow-lg disabled:opacity-60"
            >
              {scanningAll ? <Loader2 size={14} className="animate-spin text-white" /> : <Zap size={14} className="text-amber-300" />}
              {t.btnAutoScan || 'Mulai Auto Scan Sekarang'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3.5 px-4">{t.colCustomer || 'Pelanggan & Kontak'}</th>
                  <th className="py-3.5 px-4">{t.colPppoe || 'Koneksi PPPoE'}</th>
                  <th className="py-3.5 px-4">{t.colOltPon || 'OLT & Port PON'}</th>
                  <th className="py-3.5 px-4">{t.colOptical || 'Redaman Optik (dBm)'}</th>
                  <th className="py-3.5 px-4 text-right">{t.colAction || 'Aksi'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((c) => {
                  const opt = getOpticalTier(c.last_rx_power)
                  const waUrl = formatWhatsAppUrl(c.phone)

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition duration-150"
                    >
                      {/* Customer info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-3">
                          <span
                            className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                              c.is_pppoe_online
                                ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                                : opt.tier === 'los'
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                            }`}
                            title={c.is_pppoe_online ? 'PPPoE Aktif' : 'PPPoE Offline'}
                          />
                          <div>
                            <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                              {c.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                              {c.phone && <span>{c.phone}</span>}
                              {c.odp_name && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                                  {c.odp_name}
                                </span>
                              )}
                            </div>
                            {c.address && (
                              <p className="text-[11px] text-slate-400/80 line-clamp-1 mt-0.5">
                                {c.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* PPPoE Session */}
                      <td className="py-3.5 px-4">
                        <div>
                          {c.pppoe_username ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                  {c.pppoe_username}
                                </span>
                                {c.is_pppoe_online && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="PPPoE Online" />
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {c.is_pppoe_online ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                                    {c.pppoe_ip}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    Offline
                                  </span>
                                )}
                                <span className="text-[11px] text-slate-400">• {c.package_name || '20M'}</span>
                              </div>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
                              Belum Sync PPPoE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* OLT & Port PON & ONU SN */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {c.olt_name || 'OLT Default'}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                            <span className="font-mono text-violet-600 dark:text-violet-400 font-bold">
                              {c.pon_port || 'PON 1'}:{c.onu_id || 1}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="font-mono font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700">
                              {c.onu_sn || '-'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Model: {c.onu_model || 'V2801SG'}</div>
                        </div>
                      </td>

                      {/* Optical Power Telemetry */}
                      <td className="py-3.5 px-4">
                        <div className="max-w-[190px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm text-slate-800 dark:text-white">
                              {c.last_rx_power !== null && c.last_rx_power !== undefined
                                ? `${c.last_rx_power} dBm`
                                : '-'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${opt.badgeClass}`}>
                              {opt.label}
                            </span>
                          </div>

                          {/* Optical Power Gauge Bar */}
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${opt.barColor}`}
                              style={{ width: `${opt.percentage}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                            <span>TX: {c.last_tx_power !== null ? `${c.last_tx_power} dBm` : '-'}</span>
                            <span>{c.last_distance !== null ? `${c.last_distance} km` : ''}</span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Live Optical Probe */}
                          <button
                            onClick={() => handleCheckOpticalSingle(c.id)}
                            disabled={checkingId === c.id}
                            className="px-2.5 py-1.5 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                            title="Uji redaman laser ONU pelanggan saat ini"
                          >
                            {checkingId === c.id ? (
                              <Loader2 size={13} className="animate-spin text-violet-600" />
                            ) : (
                              <Activity size={13} />
                            )}
                            {t.btnCekRedaman || 'Cek'}
                          </button>

                          {/* WhatsApp Direct */}
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                              title="Chat WhatsApp Pelanggan"
                            >
                              <MessageCircle size={15} />
                            </a>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => {
                              setEditingCustomer(c)
                              setModalOpen(true)
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            title="Edit Data Pelanggan"
                          >
                            <Edit3 size={15} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteCustomer(c.id, c.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
                            title="Hapus Pelanggan"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <CustomerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveCustomer}
        initial={editingCustomer}
        olts={olts}
        secrets={secrets}
      />

      <OltManagerModal
        isOpen={oltModalOpen}
        onClose={() => setOltModalOpen(false)}
        olts={olts}
        onReload={loadData}
      />

      <SyncPppoeModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        activeRouter={activeRouter}
        onImport={async (item) => {
          await addCustomer({ ...item, olt_id: olts?.[0]?.id || null })
          loadData()
        }}
      />
    </div>
  )
}
