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
  ChevronRight,
  Copy,
  Edit3,
  ExternalLink,
  Layers,
  Link as LinkIcon,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldAlert,
  Signal,
  Trash2,
  Unlink,
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
  scanOltOnus,
  testOltConnection,
  updateCustomer,
  updateOlt,
} from '../api'
import { useLanguage } from '../context/LanguageContext'
import { useRouter } from '../context/RouterContext'

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
  const pct = Math.round(100 - (Math.abs(val) - 14) * 5)
  return {
    tier: 'normal',
    label: 'Normal (Bagus)',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    barColor: 'bg-emerald-500',
    percentage: Math.max(70, Math.min(98, pct)),
  }
}

// ── Modals: 1. Manage OLTs (Add / Edit / SNMP Test / Scan) ──
function OltManagementModal({ isOpen, onClose, olts, onReload }) {
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'add'
  const [testingId, setTestingId] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [editingOltId, setEditingOltId] = useState(null)
  const [form, setForm] = useState({
    name: '',
    brand: 'cdata',
    host: '192.168.10.1',
    snmp_port: 161,
    snmp_community: 'public',
    telnet_port: 23,
    telnet_user: 'admin',
    telnet_pass: 'admin',
    pon_ports_count: 4,
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanningId, setScanningId] = useState(null)
  const [importingId, setImportingId] = useState(null)

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

  const handleEdit = (olt) => {
    setEditingOltId(olt.id)
    setForm({
      name: olt.name || '',
      brand: olt.brand || 'cdata',
      host: olt.host || '192.168.10.1',
      snmp_port: olt.snmp_port || 161,
      snmp_community: olt.snmp_community || 'public',
      telnet_port: olt.telnet_port || 23,
      telnet_user: olt.telnet_user || 'admin',
      telnet_pass: olt.telnet_pass || 'admin',
      pon_ports_count: olt.pon_ports_count || 4,
      description: olt.description || '',
    })
    setActiveTab('add')
  }

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
      const items = Array.isArray(res) ? res : res.items || []
      const breakdown = res.port_breakdown || {}
      setScanResult({ id, items, breakdown, source: res.source })
    } catch (e) {
      alert('Gagal scan OLT: ' + e.message)
    } finally {
      setScanningId(null)
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Hapus konfigurasi OLT "${name}" beserta seluruh data ONU terdaftarnya?`)) return
    try {
      await deleteOlt(id)
      if (scanResult?.id === id) setScanResult(null)
      onReload()
    } catch (e) {
      alert('Gagal menghapus OLT: ' + (e?.response?.data?.detail || e.message))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingOltId) {
        await updateOlt(editingOltId, {
          ...form,
          snmp_port: Number(form.snmp_port) || 161,
          pon_ports_count: Number(form.pon_ports_count) || 4,
          telnet_port: Number(form.telnet_port) || 23,
        })
        alert('OLT berhasil diperbarui!')
      } else {
        await addOlt({
          ...form,
          snmp_port: Number(form.snmp_port) || 161,
          pon_ports_count: Number(form.pon_ports_count) || 4,
          telnet_port: Number(form.telnet_port) || 23,
        })
        alert('OLT berhasil ditambahkan via SNMP!')
      }
      setEditingOltId(null)
      setForm({
        name: '',
        brand: 'cdata',
        host: '192.168.10.1',
        snmp_port: 161,
        snmp_community: 'public',
        telnet_port: 23,
        telnet_user: 'admin',
        telnet_pass: 'admin',
        pon_ports_count: 4,
        description: '',
      })
      setActiveTab('list')
      onReload()
    } catch (e) {
      alert(`Gagal ${editingOltId ? 'memperbarui' : 'menambahkan'} OLT: ` + e.message)
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
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
              <Server size={19} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Kelola OLT (Optical Line Terminal)
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Langkah 1: Tambah & kelola koneksi OLT via protokol SNMP v2c (Port 161 UDP)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl mb-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-1.5 rounded-lg transition ${
              activeTab === 'list'
                ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Daftar OLT ({olts.length})
          </button>
          <button
            onClick={() => {
              setEditingOltId(null)
              setForm({
                name: '',
                brand: 'cdata',
                host: '192.168.10.1',
                snmp_port: 161,
                snmp_community: 'public',
                telnet_port: 23,
                telnet_user: 'admin',
                telnet_pass: 'admin',
                pon_ports_count: 4,
                description: '',
              })
              setActiveTab('add')
            }}
            className={`flex-1 py-1.5 rounded-lg transition ${
              activeTab === 'add'
                ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {editingOltId ? 'Edit OLT' : '+ Tambah OLT via SNMP'}
          </button>
        </div>

        {activeTab === 'list' ? (
          <div className="space-y-3">
            {olts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <Server size={32} className="mx-auto mb-2 opacity-50 text-slate-400" />
                <p className="text-sm font-semibold">Belum ada OLT yang terdaftar</p>
                <p className="text-xs text-slate-500 mt-1">
                  Klik tab "+ Tambah OLT via SNMP" untuk menambahkan OLT C-Data, VSOL, atau HSGQ.
                </p>
              </div>
            ) : (
              olts.map((olt) => (
                <div
                  key={olt.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-white text-sm">
                          {olt.name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                          {olt.brand}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        {olt.host}:{olt.snmp_port} • Community: <strong>{olt.snmp_community}</strong> • {olt.pon_ports_count} Port PON
                      </p>
                      {olt.description && (
                        <p className="text-[11px] text-slate-400 mt-1">{olt.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTest(olt.id)}
                        disabled={testingId === olt.id}
                        className="px-2.5 py-1 text-xs rounded-lg font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-500 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm transition"
                      >
                        {testingId === olt.id ? (
                          <Loader2 size={12} className="animate-spin text-violet-600" />
                        ) : (
                          <Signal size={12} className="text-emerald-500" />
                        )}
                        Cek Koneksi
                      </button>
                      <button
                        onClick={() => handleScan(olt.id)}
                        disabled={scanningId === olt.id}
                        className="px-2.5 py-1 text-xs rounded-lg font-semibold bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5 shadow-sm transition"
                      >
                        {scanningId === olt.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Radio size={12} />
                        )}
                        Scan ONUs
                      </button>
                      <button
                        onClick={() => handleEdit(olt)}
                        className="p-1 text-slate-400 hover:text-violet-500 transition"
                        title="Edit OLT"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(olt.id, olt.name)}
                        className="p-1 text-slate-400 hover:text-rose-500 transition"
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
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>Daftar ONU ({scanResult.items.length} unit):</span>
                          {scanResult.source === 'SNMP Live' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                              🟢 Live SNMP (Real OLT)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200" title="IP OLT lokal belum tembus dari server cloud">
                              🟡 Mode Simulasi (OLT belum tembus IP/VPN)
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setScanResult(null)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          Tutup
                        </button>
                      </div>

                      {/* Port breakdown badges */}
                      {scanResult.breakdown && Object.keys(scanResult.breakdown).length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {Object.entries(scanResult.breakdown).map(([p, cnt]) => (
                            <span
                              key={p}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-200 dark:border-violet-900"
                            >
                              {p}: <strong>{cnt} ONU</strong>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                        {scanResult.items.map((it, idx) => (
                          <div key={idx} className="py-1.5 flex items-center justify-between">
                            <span className="font-mono text-slate-800 dark:text-slate-200">
                              {it.pon_port} #{it.onu_id} • <strong>{it.onu_sn}</strong> ({it.onu_model})
                              {it.description ? (
                                <span className="ml-1.5 text-violet-600 dark:text-violet-400 font-sans font-semibold">
                                  — {it.description}
                                </span>
                              ) : null}
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
                          setImportingId(olt.id)
                          try {
                            const res = await autoScanCustomers(olt.id, { items: scanResult.items })
                            alert(res.message || 'Berhasil mensinkronkan semua ONU ke daftar pelanggan!')
                            onReload()
                            onClose()
                          } catch (e) {
                            alert('Gagal impor ONU: ' + (e?.response?.data?.detail || e.message))
                          } finally {
                            setImportingId(null)
                          }
                        }}
                        disabled={importingId === olt.id}
                        className="w-full mt-2 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                      >
                        {importingId === olt.id ? (
                          <>
                            <Loader2 size={14} className="animate-spin text-white" />
                            <span>Mengimpor ONU ke FTTH...</span>
                          </>
                        ) : (
                          <>
                            <Zap size={14} className="text-amber-300" />
                            <span>Tampilkan List ONU Ini ke Menu FTTH</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama OLT *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OLT C-Data Sentral"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Merk / Tipe OLT *
                </label>
                <select
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                >
                  <option value="cdata">C-Data (EPON / GPON)</option>
                  <option value="vsol">VSOL (V1600 Series)</option>
                  <option value="hsgq">HSGQ (EPON / GPON)</option>
                  <option value="generic">Generic IEEE EPON / GPON</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Host / IP OLT *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 192.168.10.1 atau IP Publik/VPN"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Port PON
                </label>
                <select
                  value={form.pon_ports_count}
                  onChange={(e) => setForm({ ...form, pon_ports_count: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                >
                  <option value={4}>4 Port PON</option>
                  <option value={8}>8 Port PON</option>
                  <option value={16}>16 Port PON</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Port SNMP (UDP)
                </label>
                <input
                  type="number"
                  value={form.snmp_port}
                  onChange={(e) => setForm({ ...form, snmp_port: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SNMP Community (v2c)
                </label>
                <input
                  type="text"
                  value={form.snmp_community}
                  onChange={(e) => setForm({ ...form, snmp_community: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Deskripsi / Lokasi OLT
              </label>
              <input
                type="text"
                placeholder="e.g. OLT Rak Sentral Lantai 2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingOltId(null)
                  setActiveTab('list')
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold flex items-center gap-1.5 shadow"
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                {editingOltId ? 'Simpan Perubahan' : 'Simpan OLT'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Modals: 4 & 5. Sync ONU to MikroTik PPPoE Modal ─────────
function SyncOnuToPppoeModal({ isOpen, onClose, customer, secrets, activeSessions, onSyncSuccess }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSecret, setSelectedSecret] = useState(null)
  const [customerName, setCustomerName] = useState('')
  const [packageName, setPackageName] = useState('20 Mbps')
  const [saving, setSaving] = useState(false)

  // Pre-fill when modal opens
  useEffect(() => {
    if (customer && isOpen) {
      setCustomerName(customer.name?.startsWith('ONU PON') ? '' : customer.name || '')
      setPackageName(customer.package_name || '20 Mbps')
      setSelectedSecret(null)
      setSearchTerm('')

      // Auto-suggest secret if caller-id or comment matches ONU SN
      if (customer.onu_sn && secrets) {
        const cleanSn = customer.onu_sn.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
        const matched = secrets.find((s) => {
          const cid = (s.caller_id || s['caller-id'] || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
          const cmt = (s.comment || '').toUpperCase()
          const uname = (s.name || '').toUpperCase()
          return (
            (cid && (cid === cleanSn || cleanSn.includes(cid) || cid.includes(cleanSn))) ||
            (cmt && cmt.includes(cleanSn)) ||
            (uname && uname === cleanSn)
          )
        })
        if (matched) {
          setSelectedSecret(matched)
          if (!customer.name || customer.name.startsWith('ONU PON')) {
            setCustomerName(matched.comment || matched.name)
          }
          if (matched.profile) {
            setPackageName(matched.profile)
          }
        }
      }
    }
  }, [customer, isOpen, secrets])

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

  if (!isOpen || !customer) return null

  // Active sessions map for live indicator
  const activeMap = {}
  if (Array.isArray(activeSessions)) {
    activeSessions.forEach((a) => {
      if (a.name) activeMap[a.name] = a
    })
  }

  // Filter secrets based on search term
  const filteredSecrets = (secrets || []).filter((s) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      s.name?.toLowerCase().includes(term) ||
      s.comment?.toLowerCase().includes(term) ||
      (s.caller_id || s['caller-id'])?.toLowerCase().includes(term)
    )
  })

  const handleSelectSecret = (sec) => {
    setSelectedSecret(sec)
    setCustomerName(sec.comment || sec.name)
    if (sec.profile) {
      setPackageName(sec.profile)
    }
  }

  const handleSaveSync = async () => {
    if (!selectedSecret && !customer.pppoe_username) {
      alert('Pilih salah satu akun PPPoE MikroTik untuk ditautkan.')
      return
    }
    setSaving(true)
    try {
      const usernameToBind = selectedSecret ? selectedSecret.name : customer.pppoe_username
      const finalName = customerName.trim() || usernameToBind

      await updateCustomer(customer.id, {
        pppoe_username: usernameToBind,
        name: finalName,
        package_name: packageName,
      })
      alert(`Berhasil mensinkronkan ${customer.pon_port} #${customer.onu_id} ke akun PPPoE "${usernameToBind}"!`)
      onSyncSuccess?.()
      onClose()
    } catch (e) {
      alert('Gagal sinkronisasi: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUnlink = async () => {
    if (!window.confirm(`Putuskan sinkronisasi PPPoE dari ONU ${customer.pon_port} #${customer.onu_id}?`)) return
    setSaving(true)
    try {
      await updateCustomer(customer.id, {
        pppoe_username: '',
        name: `ONU ${customer.pon_port} #${customer.onu_id}`,
      })
      alert('Sinkronisasi PPPoE telah diputuskan.')
      onSyncSuccess?.()
      onClose()
    } catch (e) {
      alert('Gagal memutuskan link: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const cleanSn = (customer.onu_sn || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()

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
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl p-6 z-10 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
              <LinkIcon size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white">
                Sync ONU ke Akun MikroTik PPPoE
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Langkah 4 & 5: Hubungkan ONU fisik dari OLT ke akun PPPoE di MikroTik
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* ONU Physical Card */}
        <div className="p-3.5 bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/80 dark:border-violet-900/40 rounded-xl space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            Data Perangkat ONU (Dari OLT Fisik)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block">Port PON:</span>
              <strong className="font-mono text-violet-700 dark:text-violet-300">
                {customer.pon_port} #{customer.onu_id}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Serial / MAC:</span>
              <strong className="font-mono text-slate-800 dark:text-slate-200">
                {customer.onu_sn || '-'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Model:</span>
              <span className="text-slate-700 dark:text-slate-300">{customer.onu_model || 'ONT-GE'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Redaman Optik:</span>
              <span
                className={`font-bold ${
                  customer.last_rx_power ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                }`}
              >
                {customer.last_rx_power ? `${customer.last_rx_power} dBm` : '-'}
              </span>
            </div>
          </div>

          {customer.pppoe_username && (
            <div className="pt-2 border-t border-violet-200/50 dark:border-violet-900/30 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Saat ini tertaut ke: <strong className="font-mono text-violet-700 dark:text-violet-300">{customer.pppoe_username}</strong>
              </span>
              <button
                type="button"
                onClick={handleUnlink}
                disabled={saving}
                className="px-2 py-0.5 rounded text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center gap-1"
              >
                <Unlink size={12} />
                Putus Link
              </button>
            </div>
          )}
        </div>

        {/* Secret Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Pilih Akun PPPoE MikroTik ({filteredSecrets.length} akun tersedia)
            </label>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Cari username PPPoE, nama pelanggan, atau MAC address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
          </div>

          {/* List of Secrets */}
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-xs">
            {filteredSecrets.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                Tidak ada akun PPPoE yang cocok dengan pencarian.
              </div>
            ) : (
              filteredSecrets.map((s) => {
                const isSelected = selectedSecret?.name === s.name || (!selectedSecret && customer.pppoe_username === s.name)
                const isLiveOnline = !!activeMap[s.name]
                const secretMacClean = (s.caller_id || s['caller-id'] || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
                const isMacMatch = secretMacClean && cleanSn && (secretMacClean === cleanSn || cleanSn.includes(secretMacClean) || secretMacClean.includes(cleanSn))

                return (
                  <div
                    key={s.name}
                    onClick={() => handleSelectSecret(s)}
                    className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? 'bg-violet-50/80 dark:bg-violet-950/40 text-violet-900 dark:text-violet-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {s.name}
                        </span>
                        {isLiveOnline && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Sedang Online di MikroTik" />
                        )}
                        {isMacMatch && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                            ⭐ Rekomendasi (MAC Cocok)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>{s.comment ? `Nama: ${s.comment}` : 'Tanpa Komentar'}</span>
                        <span>•</span>
                        <span>Paket: {s.profile || 'default'}</span>
                        {s.caller_id && (
                          <>
                            <span>•</span>
                            <span className="font-mono">MAC: {s.caller_id}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-violet-100 hover:text-violet-700'
                      }`}
                    >
                      {isSelected ? 'Terpilih' : 'Pilih'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Editable customer name & package details */}
        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Pelanggan (Asli)
            </label>
            <input
              type="text"
              placeholder="e.g. Budi Santoso"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Profil Paket
            </label>
            <input
              type="text"
              placeholder="e.g. 20 Mbps"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveSync}
            disabled={saving || (!selectedSecret && !customer.pppoe_username)}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold flex items-center gap-1.5 text-xs shadow-md transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <LinkIcon size={13} />}
            Simpan Sinkronisasi ke MikroTik
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main Customer & FTTH Management Page ───────────────────
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
  const [activeSessions, setActiveSessions] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters & Selected OLT
  const [search, setSearch] = useState('')
  const [selectedOlt, setSelectedOlt] = useState('')
  const [selectedPonPort, setSelectedPonPort] = useState('')
  const [selectedSyncStatus, setSelectedSyncStatus] = useState('') // 'synced' | 'unsynced' | ''
  const [selectedTier, setSelectedTier] = useState('')

  // Modals state
  const [oltModalOpen, setOltModalOpen] = useState(false)
  const [syncTargetCustomer, setSyncTargetCustomer] = useState(null)

  // Quick Action Loading states
  const [testingOlt, setTestingOlt] = useState(false)
  const [oltTestResult, setOltTestResult] = useState(null)
  const [scanningOlt, setScanningOlt] = useState(false)
  const [autoSyncingAll, setAutoSyncingAll] = useState(false)
  const [checkingAll, setCheckingAll] = useState(false)
  const [checkingSingleId, setCheckingSingleId] = useState(null)

  // Load master data
  const loadData = async () => {
    try {
      const [custRes, oltRes, statRes] = await Promise.all([
        getCustomers({
          search,
          status: selectedTier || undefined,
          olt_id: selectedOlt ? Number(selectedOlt) : undefined,
        }),
        getOlts(),
        getCustomerStats(),
      ])
      setCustomers(custRes || [])
      setOlts(oltRes || [])
      setStats(statRes || { total: 0, active: 0, normal: 0, warning: 0, critical: 0, los: 0 })

      // Auto-select primary OLT if none selected
      if (!selectedOlt && oltRes && oltRes.length > 0) {
        setSelectedOlt(String(oltRes[0].id))
      }
    } catch (e) {
      console.error('Failed to load FTTH customer data:', e)
    } finally {
      setLoading(false)
    }
  }

  // Load PPPoE secrets & active sessions from MikroTik for binding
  useEffect(() => {
    getPppSecrets()
      .then((res) => setSecrets(res || []))
      .catch(() => setSecrets([]))

    getPppActive()
      .then((res) => setActiveSessions(res || []))
      .catch(() => setActiveSessions([]))
  }, [activeRouter])

  useEffect(() => {
    loadData()
  }, [search, selectedOlt, selectedTier, activeRouter])

  // Step 2: Test OLT Connection via SNMP
  const handleTestOlt = async () => {
    if (!selectedOlt) {
      alert('Pilih OLT terlebih dahulu atau klik "+ Tambah OLT"')
      return
    }
    setTestingOlt(true)
    setOltTestResult(null)
    try {
      const res = await testOltConnection(Number(selectedOlt))
      setOltTestResult(res)
    } catch (e) {
      setOltTestResult({ reachable: false, details: e.message })
    } finally {
      setTestingOlt(false)
    }
  }

  // Step 2: Scan OLT ONUs by PON Ports & populate list
  const handleScanOlt = async () => {
    setScanningOlt(true)
    setOltTestResult(null)
    try {
      const res = await autoScanCustomers(selectedOlt ? Number(selectedOlt) : null)
      alert(res.message || 'Scan OLT selesai!')
      await loadData()
    } catch (e) {
      alert('Gagal scan OLT: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setScanningOlt(false)
    }
  }

  // Step 4 & 5: Auto Sync all unlinked ONUs matching MikroTik MAC/SN
  const handleAutoSyncAll = async () => {
    setAutoSyncingAll(true)
    try {
      const res = await autoScanCustomers(selectedOlt ? Number(selectedOlt) : null)
      alert(res.message || 'Sinkronisasi selesai!')
      await loadData()
    } catch (e) {
      alert('Gagal sinkronisasi: ' + e.message)
    } finally {
      setAutoSyncingAll(false)
    }
  }

  // Check single optical power
  const handleCheckOpticalSingle = async (id) => {
    setCheckingSingleId(id)
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
      getCustomerStats().then(setStats).catch(() => {})
    } catch (e) {
      alert('Gagal cek redaman: ' + e.message)
    } finally {
      setCheckingSingleId(null)
    }
  }

  // Check all optical power
  const handleCheckAllOptical = async () => {
    setCheckingAll(true)
    try {
      await checkAllOptical(selectedOlt ? Number(selectedOlt) : null)
      await loadData()
    } catch (e) {
      alert('Gagal cek redaman massal: ' + e.message)
    } finally {
      setCheckingAll(false)
    }
  }

  // Delete an ONU customer row
  const handleDeleteCustomer = async (id, name) => {
    if (!window.confirm(`Hapus ONU / Pelanggan "${name}" dari sistem?`)) return
    try {
      await deleteCustomer(id)
      loadData()
    } catch (e) {
      alert('Gagal menghapus: ' + e.message)
    }
  }

  // Calculate PON port breakdown from current customers
  const ponPortBreakdown = useMemo(() => {
    const counts = {}
    customers.forEach((c) => {
      const p = c.pon_port || 'PON 1'
      counts[p] = (counts[p] || 0) + 1
    })
    return counts
  }, [customers])

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (selectedPonPort && c.pon_port !== selectedPonPort) return false
      if (selectedSyncStatus === 'synced' && !c.pppoe_username) return false
      if (selectedSyncStatus === 'unsynced' && !!c.pppoe_username) return false
      return true
    })
  }, [customers, selectedPonPort, selectedSyncStatus])

  // Current active OLT object
  const currentOlt = olts.find((o) => String(o.id) === String(selectedOlt)) || olts[0]

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ── Page Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              <Cable size={22} />
            </span>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              Menu FTTH & Monitoring OLT
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              FTTH Live
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sistem FTTH berpusat pada OLT fisik: Tambah OLT via SNMP → Scan ONU per Port → Tampilkan List ONU → Action Sync ke PPPoE MikroTik
          </p>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setOltModalOpen(true)}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-500 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700/60"
          >
            <Settings size={14} className="text-violet-500" />
            Kelola OLT ({olts.length})
          </button>

          <button
            onClick={handleAutoSyncAll}
            disabled={autoSyncingAll}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-60"
            title="Cocokkan otomatis ONU yang belum sync dengan akun PPPoE MikroTik via MAC/SN"
          >
            {autoSyncingAll ? (
              <Loader2 size={13} className="animate-spin text-indigo-600" />
            ) : (
              <LinkIcon size={13} className="text-indigo-600" />
            )}
            Auto Sync PPPoE (MAC/SN)
          </button>

          <button
            onClick={handleCheckAllOptical}
            disabled={checkingAll}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-500 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700/60"
            title="Cek redaman optik semua ONU saat ini"
          >
            <RefreshCw size={13} className={checkingAll ? 'animate-spin text-emerald-500' : 'text-emerald-500'} />
            Cek Redaman Semua
          </button>
        </div>
      </div>

      {/* ── 5-Step Operational Flow Indicator Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div 
          onClick={() => setOltModalOpen(true)}
          className="cursor-pointer p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-800 hover:border-violet-500 dark:hover:border-violet-500 transition shadow-sm flex items-start gap-3 group"
        >
          <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
            1
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>Tambah OLT via SNMP</span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-900">
                {olts.length} OLT
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              SNMP UDP 161 & Community v2c
            </div>
          </div>
        </div>

        <div 
          onClick={handleScanOlt}
          className="cursor-pointer p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition shadow-sm flex items-start gap-3 group"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
            2
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>Cek Koneksi & Scan Port</span>
              {scanningOlt && <Loader2 size={12} className="animate-spin text-indigo-500" />}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              Deteksi berapa ONU per port OLT
            </div>
          </div>
        </div>

        <div 
          className="p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-800 shadow-sm flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
            3
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>List ONU Terdeteksi</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                {customers.length} ONU
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              Tampil di daftar master OLT
            </div>
          </div>
        </div>

        <div 
          onClick={handleAutoSyncAll}
          className="cursor-pointer p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 transition shadow-sm flex items-start gap-3 group"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
            4 & 5
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>Action Sync PPPoE</span>
              {autoSyncingAll && <Loader2 size={12} className="animate-spin text-amber-500" />}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              Sinkronisasi data ONU ke MikroTik
            </div>
          </div>
        </div>
      </div>

      {/* ── Step 1 & 2: Active OLT Card & Scan Controller Banner ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-violet-600/30 border border-violet-500/40 text-violet-300 flex items-center justify-center font-bold">
              <Server size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                  Langkah 1 & 2: OLT Terpilih
                </span>
                {currentOlt && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {currentOlt.brand}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5">
                {currentOlt?.name || 'Belum Ada OLT'}
              </h2>
              <p className="text-xs font-mono text-slate-400">
                {currentOlt ? `${currentOlt.host}:${currentOlt.snmp_port} • Community: ${currentOlt.snmp_community} • ${currentOlt.pon_ports_count} Port PON` : 'Tambahkan OLT fisik Anda via SNMP'}
              </p>
            </div>
          </div>

          {/* OLT Selector & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {olts.length > 1 && (
              <select
                value={selectedOlt}
                onChange={(e) => {
                  setSelectedOlt(e.target.value)
                  setSelectedPonPort('')
                }}
                className="px-3 py-1.5 bg-slate-800/90 text-white text-xs rounded-xl border border-slate-700"
              >
                {olts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.brand.toUpperCase()})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setOltModalOpen(true)}
              className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
            >
              <Plus size={14} className="text-violet-400" />
              Tambah OLT
            </button>

            <button
              onClick={handleTestOlt}
              disabled={testingOlt || !currentOlt}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 disabled:opacity-50"
            >
              {testingOlt ? (
                <Loader2 size={13} className="animate-spin text-emerald-400" />
              ) : (
                <Signal size={13} className="text-emerald-400" />
              )}
              Cek Koneksi (SNMP)
            </button>

            <button
              onClick={handleScanOlt}
              disabled={scanningOlt || !currentOlt}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-violet-600/30 transition disabled:opacity-50"
            >
              {scanningOlt ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Zap size={14} className="text-amber-300" />
              )}
              Scan ONU dari OLT
            </button>
          </div>
        </div>

        {/* Test Result Indicator */}
        {oltTestResult && (
          <div
            className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
              oltTestResult.reachable
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                : 'bg-rose-950/60 text-rose-300 border-rose-800'
            }`}
          >
            {oltTestResult.reachable ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>
              <strong>{oltTestResult.reachable ? 'Koneksi Sukses (Online)' : 'Gagal Tersambung'}</strong>
              {oltTestResult.latency_ms && ` (${oltTestResult.latency_ms} ms)`} — {oltTestResult.details}
            </span>
          </div>
        )}

        {/* Step 2: Port Breakdown Pills */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">
            Breakdown Port OLT:
          </span>

          <button
            onClick={() => setSelectedPonPort('')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              selectedPonPort === ''
                ? 'bg-white text-slate-900 shadow'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
            }`}
          >
            Semua Port ({customers.length})
          </button>

          {Object.keys(ponPortBreakdown).length > 0 ? (
            Object.entries(ponPortBreakdown).map(([p, count]) => (
              <button
                key={p}
                onClick={() => setSelectedPonPort(p === selectedPonPort ? '' : p)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  selectedPonPort === p
                    ? 'bg-violet-500 text-white shadow'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                }`}
              >
                <span>{p}:</span>
                <span className="font-bold text-violet-300">{count} ONU</span>
              </button>
            ))
          ) : (
            <span className="text-xs text-slate-500 italic">
              Klik "Scan ONU dari OLT" untuk membaca port & ONU yang aktif.
            </span>
          )}
        </div>
      </div>

      {/* ── Summary Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Total ONU Terdeteksi</span>
            <Users size={16} />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {customers.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Unit ONU di OLT</p>
        </div>

        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-500 mb-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tersinkron PPPoE</span>
            <LinkIcon size={16} />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {customers.filter((c) => !!c.pppoe_username).length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Tertaut ke MikroTik</p>
        </div>

        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-amber-500 mb-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Belum Sync PPPoE</span>
            <Unlink size={16} />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {customers.filter((c) => !c.pppoe_username).length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Perlu Action Sync</p>
        </div>

        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-emerald-500 mb-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Redaman Normal</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {stats.normal}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">-14 s/d -24 dBm</p>
        </div>

        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-rose-500 mb-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Kritis / LOS</span>
            <ShieldAlert size={16} />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {stats.critical + stats.los}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">&lt; -27 dBm atau putus</p>
        </div>
      </div>

      {/* ── Step 3: Tampilkan List ONU Hasil Scan OLT ── */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Cari Port, ONU SN/MAC, Nama, atau Username PPPoE..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Filter PON Port */}
            <select
              value={selectedPonPort}
              onChange={(e) => setSelectedPonPort(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold"
            >
              <option value="">Semua Port PON</option>
              {Object.keys(ponPortBreakdown).map((p) => (
                <option key={p} value={p}>
                  {p} ({ponPortBreakdown[p]})
                </option>
              ))}
            </select>

            {/* Filter Sync Status */}
            <select
              value={selectedSyncStatus}
              onChange={(e) => setSelectedSyncStatus(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold"
            >
              <option value="">Semua Status Sync</option>
              <option value="synced">Tersinkron PPPoE</option>
              <option value="unsynced">Belum Sync PPPoE</option>
            </select>

            {/* Filter Signal Tier */}
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold"
            >
              <option value="">Semua Redaman</option>
              <option value="normal">Normal (Bagus)</option>
              <option value="warning">Waspada (Sedang)</option>
              <option value="critical">Kritis (Jelek)</option>
              <option value="los">LOS (Putus)</option>
            </select>
          </div>
        </div>

        {/* Master ONU Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/40 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Port PON & ONU</th>
                <th className="py-3 px-4">Serial Number / MAC OLT</th>
                <th className="py-3 px-4">Redaman Optik (dBm)</th>
                <th className="py-3 px-4">Koneksi PPPoE MikroTik</th>
                <th className="py-3 px-4 text-right">Aksi Sinkronisasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-violet-500" />
                    Memuat data ONU dari OLT...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Server size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300 text-sm">
                      Belum ada ONU yang terdeteksi
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Klik tombol <strong>"Scan ONU dari OLT"</strong> di atas untuk memindai port OLT.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const opt = getOpticalTier(c.last_rx_power)
                  const isLinked = !!c.pppoe_username

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      {/* Port & ONU */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-900">
                            {c.pon_port || 'PON 1'}:{c.onu_id || 1}
                          </span>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {c.name || `ONU ${c.pon_port} #${c.onu_id}`}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Model: {c.onu_model || 'ONT-GE'} • {c.olt_name || 'OLT Sentral'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Serial Number / MAC */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {c.onu_sn || '-'}
                          </span>
                          {c.onu_sn && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(c.onu_sn)
                                alert(`Serial ${c.onu_sn} disalin ke clipboard!`)
                              }}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                              title="Salin Serial Number"
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Optical Power Telemetry */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                            {c.last_rx_power !== null && c.last_rx_power !== undefined
                              ? `${Number(c.last_rx_power).toFixed(2)} dBm`
                              : '-'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${opt.badgeClass}`}>
                            {opt.label}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>TX: {c.last_tx_power ? `${c.last_tx_power} dBm` : '2.0 dBm'}</span>
                          <span>•</span>
                          <span>Jarak: {c.last_distance ? `${c.last_distance} km` : '1.2 km'}</span>
                        </div>
                      </td>

                      {/* PPPoE MikroTik Connection */}
                      <td className="py-3 px-4">
                        {isLinked ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                {c.pppoe_username}
                              </span>
                              {c.is_pppoe_online ? (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="PPPoE Online" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-slate-400" title="PPPoE Offline" />
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                              {c.is_pppoe_online ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                                  {c.pppoe_ip || 'Online'}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  Offline
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">• {c.package_name || '20M'}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
                            Belum Sync PPPoE
                          </span>
                        )}
                      </td>

                      {/* Step 4 & 5: Action Sync PPPoE */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Sync PPPoE Button */}
                          <button
                            onClick={() => setSyncTargetCustomer(c)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition ${
                              isLinked
                                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-violet-500/20'
                            }`}
                            title={isLinked ? 'Ubah tautan PPPoE' : 'Tautkan ONU ini ke akun PPPoE MikroTik'}
                          >
                            <LinkIcon size={12} />
                            {isLinked ? 'Edit Sync' : 'Sync PPPoE'}
                          </button>

                          {/* Quick single optical check */}
                          <button
                            onClick={() => handleCheckOpticalSingle(c.id)}
                            disabled={checkingSingleId === c.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Cek Redaman Optik Live"
                          >
                            {checkingSingleId === c.id ? (
                              <Loader2 size={13} className="animate-spin text-violet-600" />
                            ) : (
                              <Activity size={13} />
                            )}
                          </button>

                          {/* Delete row */}
                          <button
                            onClick={() => handleDeleteCustomer(c.id, c.name || `ONU ${c.pon_port} #${c.onu_id}`)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Hapus dari daftar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals: Step 1. Kelola OLT ── */}
      <OltManagementModal
        isOpen={oltModalOpen}
        onClose={() => setOltModalOpen(false)}
        olts={olts}
        onReload={loadData}
      />

      {/* ── Modals: Step 4 & 5. Sync PPPoE ke MikroTik ── */}
      <SyncOnuToPppoeModal
        isOpen={!!syncTargetCustomer}
        onClose={() => setSyncTargetCustomer(null)}
        customer={syncTargetCustomer}
        secrets={secrets}
        activeSessions={activeSessions}
        onSyncSuccess={loadData}
      />
    </div>
  )
}
