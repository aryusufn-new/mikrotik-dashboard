import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Archive,
  ArrowDownToLine,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  Eye,
  FileCode,
  FileText,
  Filter,
  HardDrive,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  X,
  AlertTriangle,
  FolderArchive,
  Check,
} from 'lucide-react'
import {
  deleteBackup,
  downloadBackupFile,
  getBackupSettings,
  getBackupStats,
  listBackups,
  previewBackup,
  runBackup,
  updateBackupSettings,
} from '../api'
import { useRouter } from '../context/RouterContext'
import { useLanguage } from '../context/LanguageContext'

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatDate(isoStr) {
  if (!isoStr) return '-'
  try {
    const d = new Date(isoStr)
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return isoStr
  }
}

const DAY_NAMES_ID = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function BackupPage() {
  const { routers, activeRouterId } = useRouter()
  const { language } = useLanguage()
  const isEn = language === 'en'

  const [backups, setBackups] = useState([])
  const [stats, setStats] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [filterRouter, setFilterRouter] = useState('')
  const [search, setSearch] = useState('')

  // Modals
  const [showRunModal, setShowRunModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [copied, setCopied] = useState(false)

  // Manual run state
  const [selectedRouterForRun, setSelectedRouterForRun] = useState('')
  const [selectedTypeForRun, setSelectedTypeForRun] = useState('both')
  const [runningBackup, setRunningBackup] = useState(false)
  const [runSuccessMsg, setRunSuccessMsg] = useState(null)
  const [runErrorMsg, setRunErrorMsg] = useState(null)

  // Delete state
  const [deletingId, setDeletingId] = useState(null)

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [listRes, statsRes, settingsRes] = await Promise.all([
        listBackups(),
        getBackupStats(),
        getBackupSettings(),
      ])
      setBackups(listRes || [])
      setStats(statsRes || null)
      setSettings(settingsRes || null)
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.detail || (isEn ? 'Failed to load backup data' : 'Gagal memuat data backup'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (activeRouterId && !selectedRouterForRun) {
      setSelectedRouterForRun(String(activeRouterId))
    }
  }, [activeRouterId, selectedRouterForRun])

  // Filtered backups
  const filteredBackups = useMemo(() => {
    return backups.filter((b) => {
      if (filterRouter && String(b.router_id) !== String(filterRouter)) return false
      if (search) {
        const q = search.toLowerCase()
        const fn = (b.filename || '').toLowerCase()
        const rn = (b.router_name || '').toLowerCase()
        const rh = (b.router_host || '').toLowerCase()
        if (!fn.includes(q) && !rn.includes(q) && !rh.includes(q)) return false
      }
      return true
    })
  }, [backups, filterRouter, search])

  const handleRunBackup = async () => {
    if (!selectedRouterForRun) return
    setRunningBackup(true)
    setRunSuccessMsg(null)
    setRunErrorMsg(null)
    setError(null)
    try {
      const res = await runBackup(Number(selectedRouterForRun), selectedTypeForRun)
      setRunSuccessMsg(
        isEn
          ? `Backup completed successfully: ${res.filename}`
          : `Backup berhasil dibuat: ${res.filename}`
      )
      await loadAll()
      setTimeout(() => {
        setShowRunModal(false)
        setRunSuccessMsg(null)
        setRunErrorMsg(null)
      }, 1800)
    } catch (err) {
      console.error(err)
      const detail = err?.response?.data?.detail || err?.message || (isEn ? 'Backup failed' : 'Pencadangan gagal')
      setRunErrorMsg(detail)
    } finally {
      setRunningBackup(false)
    }
  }

  const handleDelete = async (id, filename) => {
    const confirmMsg = isEn
      ? `Are you sure you want to delete backup "${filename}"?`
      : `Yakin ingin menghapus file backup "${filename}" dari server?`
    if (!window.confirm(confirmMsg)) return

    setDeletingId(id)
    try {
      await deleteBackup(id)
      setBackups((prev) => prev.filter((b) => b.id !== id))
      getBackupStats().then(setStats).catch(() => {})
    } catch (err) {
      alert(err?.response?.data?.detail || (isEn ? 'Failed to delete' : 'Gagal menghapus'))
    } finally {
      setDeletingId(null)
    }
  }

  const handlePreview = async (id) => {
    try {
      const res = await previewBackup(id)
      setPreviewData(res)
    } catch (err) {
      alert(err?.response?.data?.detail || (isEn ? 'Failed to preview file' : 'Gagal membaca pratinjau file'))
    }
  }

  const handleCopyCode = () => {
    if (!previewData?.content) return
    navigator.clipboard.writeText(previewData.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dayNames = isEn ? DAY_NAMES_EN : DAY_NAMES_ID
  const scheduledDayName = settings ? dayNames[settings.schedule_day ?? 6] : (isEn ? 'Sunday' : 'Minggu')
  const scheduledHourStr = settings
    ? `${String(settings.schedule_hour ?? 2).padStart(2, '0')}:${String(settings.schedule_minute ?? 0).padStart(2, '0')}`
    : '02:00'

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-brand-purple flex items-center justify-center text-white shadow-md shadow-brand-purple/20">
              <Archive size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                {isEn ? 'Auto Backup & Archive' : 'Auto Backup & Arsip MikroTik'}
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                    settings?.enabled
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}
                >
                  {settings?.enabled
                    ? isEn
                      ? `Weekly: ${scheduledDayName} ${scheduledHourStr}`
                      : `Mingguan: Setiap ${scheduledDayName} ${scheduledHourStr} WIB`
                    : isEn
                    ? 'Auto Disabled'
                    : 'Otomatis Nonaktif'}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {isEn
                  ? 'Automated weekly backups of router configurations stored safely in internal server storage.'
                  : 'Pencadangan otomatis mingguan konfigurasi router yang tersimpan aman di internal server.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAll}
            disabled={loading}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition"
            title={isEn ? 'Refresh data' : 'Segarkan data'}
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-750 transition"
          >
            <Settings2 size={16} className="text-slate-500" />
            <span>{isEn ? 'Schedule Settings' : 'Jadwal Otomatis'}</span>
          </button>

          <button
            onClick={() => setShowRunModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-brand-purple to-indigo-600 rounded-xl shadow-md shadow-brand-purple/20 hover:opacity-95 transition"
          >
            <Play size={15} />
            <span>{isEn ? 'Backup Now' : 'Backup Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Files */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs uppercase font-semibold tracking-wider">
              {isEn ? 'Total Backups' : 'Total File Backup'}
            </span>
            <FolderArchive size={18} className="text-brand-purple" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {stats?.total_count ?? backups.length}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {isEn ? 'Stored in internal server volume' : 'Tersimpan di volume internal server'}
          </p>
        </div>

        {/* Total Size */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs uppercase font-semibold tracking-wider">
              {isEn ? 'Storage Used' : 'Kapasitas Terpakai'}
            </span>
            <HardDrive size={18} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white">
            {formatBytes(stats?.total_size)}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {isEn ? 'Auto-pruned by retention limit' : 'Dibersihkan otomatis sesuai retensi'}
          </p>
        </div>

        {/* Last Run */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs uppercase font-semibold tracking-wider">
              {isEn ? 'Last Run' : 'Terakhir Dijalankan'}
            </span>
            <Clock size={18} className="text-emerald-500" />
          </div>
          <div className="text-sm sm:text-base font-semibold text-slate-800 dark:text-white truncate">
            {stats?.last_backup_at ? formatDate(stats.last_backup_at) : (isEn ? 'Never' : 'Belum pernah')}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {stats?.last_backup_at ? (isEn ? 'Completed successfully' : 'Sukses dicadangkan') : '-'}
          </p>
        </div>

        {/* Next Scheduled */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs uppercase font-semibold tracking-wider">
              {isEn ? 'Next Schedule' : 'Jadwal Berikutnya'}
            </span>
            <Calendar size={18} className="text-amber-500" />
          </div>
          <div className="text-sm sm:text-base font-semibold text-slate-800 dark:text-white truncate">
            {stats?.enabled && stats?.next_run_at
              ? formatDate(stats.next_run_at)
              : (isEn ? 'Disabled' : 'Nonaktif')}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {stats?.enabled
              ? isEn
                ? `Every ${scheduledDayName} ${scheduledHourStr}`
                : `Setiap ${scheduledDayName} ${scheduledHourStr} WIB`
              : (isEn ? 'Enable in settings' : 'Aktifkan di pengaturan')}
          </p>
        </div>
      </div>

      {/* ─── Filter & Search Bar ─── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={isEn ? 'Search by filename, router name, IP host...' : 'Cari nama file, nama router, atau IP host...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
          />
        </div>

        <div className="relative w-full sm:w-64">
          <Filter size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={filterRouter}
            onChange={(e) => setFilterRouter(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 appearance-none"
          >
            <option value="">{isEn ? 'All Routers' : 'Semua Router'}</option>
            {routers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.host})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── Backup Table ─── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-card dark:shadow-none overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-brand-purple" />
            <span className="text-sm">{isEn ? 'Loading backup archives...' : 'Memuat arsip file backup...'}</span>
          </div>
        ) : filteredBackups.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Archive size={26} />
            </div>
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
              {isEn ? 'No backup files found' : 'Belum ada file backup'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto mt-1 mb-4">
              {isEn
                ? 'Backups will be created automatically every week according to schedule, or click "Backup Now" to create one immediately.'
                : 'Pencadangan akan otomatis berjalan setiap minggu sesuai jadwal, atau klik tombol "Backup Sekarang" untuk membuat cadangan saat ini.'}
            </p>
            <button
              onClick={() => setShowRunModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-purple rounded-xl hover:bg-brand-purple/90 transition shadow-sm"
            >
              <Play size={14} />
              <span>{isEn ? 'Backup Now' : 'Backup Sekarang'}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {isEn ? 'Router' : 'Router'}
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {isEn ? 'File Name' : 'Nama File'}
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {isEn ? 'Type & Size' : 'Tipe & Ukuran'}
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {isEn ? 'Trigger' : 'Pemicu'}
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {isEn ? 'Created At' : 'Waktu Pembuatan'}
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {isEn ? 'Status' : 'Status'}
                  </th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {isEn ? 'Actions' : 'Aksi'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBackups.map((item) => {
                  const isZip = item.filename?.endsWith('.zip')
                  const isRsc = item.filename?.endsWith('.rsc')
                  const isBackup = item.filename?.endsWith('.backup')

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Router */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {item.router_name || `Router #${item.router_id}`}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.router_host || '-'}
                        </div>
                      </td>

                      {/* File Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isZip ? (
                            <Archive size={17} className="text-amber-500 shrink-0" />
                          ) : isRsc ? (
                            <FileCode size={17} className="text-brand-purple shrink-0" />
                          ) : (
                            <Database size={17} className="text-indigo-500 shrink-0" />
                          )}
                          <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                            {item.filename}
                          </span>
                        </div>
                      </td>

                      {/* Type & Size */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                              isZip
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : isRsc
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            }`}
                          >
                            {isZip ? 'FULL ZIP' : isRsc ? 'RSC SCRIPT' : 'SYSTEM BACKUP'}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {formatBytes(item.file_size)}
                          </span>
                        </div>
                      </td>

                      {/* Trigger */}
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${
                            item.trigger_type === 'auto'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {item.trigger_type === 'auto' ? (
                            <>
                              <Calendar size={12} />
                              {isEn ? 'Weekly Auto' : 'Mingguan'}
                            </>
                          ) : (
                            <>
                              <Play size={12} />
                              Manual
                            </>
                          )}
                        </span>
                      </td>

                      {/* Created At */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {item.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={14} />
                            {isEn ? 'Completed' : 'Selesai'}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400"
                            title={item.error_message || ''}
                          >
                            <AlertTriangle size={14} />
                            {isEn ? 'Failed' : 'Gagal'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview (only for RSC) */}
                          {isRsc && item.status === 'completed' && (
                            <button
                              onClick={() => handlePreview(item.id)}
                              className="p-1.5 text-slate-500 hover:text-brand-purple hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition"
                              title={isEn ? 'Preview script content' : 'Lihat isi script'}
                            >
                              <Eye size={16} />
                            </button>
                          )}

                          {/* Download */}
                          {item.status === 'completed' && (
                            <button
                              onClick={() => downloadBackupFile(item.id, item.filename)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition"
                              title={isEn ? 'Download file to computer' : 'Unduh file ke komputer'}
                            >
                              <Download size={16} />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(item.id, item.filename)}
                            disabled={deletingId === item.id}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition disabled:opacity-50"
                            title={isEn ? 'Delete backup' : 'Hapus file backup'}
                          >
                            <Trash2 size={16} />
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

      {/* ─── Modal 1: Manual Backup Trigger ─── */}
      {showRunModal && (
        <ManualBackupModal
          routers={routers}
          selectedRouter={selectedRouterForRun}
          setSelectedRouter={setSelectedRouterForRun}
          selectedType={selectedTypeForRun}
          setSelectedType={setSelectedTypeForRun}
          onClose={() => {
            setShowRunModal(false)
            setRunErrorMsg(null)
          }}
          onRun={handleRunBackup}
          running={runningBackup}
          successMsg={runSuccessMsg}
          errorMsg={runErrorMsg}
          isEn={isEn}
        />
      )}

      {/* ─── Modal 2: Weekly Schedule Settings ─── */}
      {showSettingsModal && (
        <ScheduleSettingsModal
          settings={settings}
          onClose={() => setShowSettingsModal(false)}
          onSaved={(newSettings) => {
            setSettings(newSettings)
            getBackupStats().then(setStats).catch(() => {})
          }}
          isEn={isEn}
        />
      )}

      {/* ─── Modal 3: RSC Script Preview ─── */}
      {previewData && (
        <ScriptPreviewModal
          data={previewData}
          onClose={() => setPreviewData(null)}
          onCopy={handleCopyCode}
          copied={copied}
          isEn={isEn}
        />
      )}
    </div>
  )
}

function ManualBackupModal({
  routers,
  selectedRouter,
  setSelectedRouter,
  selectedType,
  setSelectedType,
  onClose,
  onRun,
  running,
  successMsg,
  errorMsg,
  isEn,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !running) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'auto'
    }
  }, [onClose, running])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md transition-opacity"
        onClick={!running ? onClose : undefined}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-purple/10 text-brand-purple flex items-center justify-center">
              <Play size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                {isEn ? 'Run Manual Backup' : 'Pencadangan Manual Sekarang'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEn ? 'Generate and save backup file to server' : 'Ambil konfigurasi router dan simpan ke server'}
              </p>
            </div>
          </div>
          {!running && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1 leading-relaxed break-words font-medium">{errorMsg}</div>
          </div>
        )}

        {successMsg ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} />
            </div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{successMsg}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Router Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                {isEn ? 'Target Router' : 'Pilih Router'}
              </label>
              <select
                value={selectedRouter}
                onChange={(e) => setSelectedRouter(e.target.value)}
                disabled={running}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
              >
                {routers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.host})
                  </option>
                ))}
              </select>
            </div>

            {/* Backup Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wider">
                {isEn ? 'Backup Format' : 'Format File Cadangan'}
              </label>
              <div className="space-y-2">
                {[
                  {
                    id: 'both',
                    title: isEn ? 'Full Package (.ZIP)' : 'Paket Lengkap (.ZIP: .rsc + .backup)',
                    desc: isEn
                      ? 'Recommended: Includes both human-readable script and full binary system backup.'
                      : 'Direkomendasikan: Menggabungkan script export teks (.rsc) dan binary sistem (.backup).',
                  },
                  {
                    id: 'rsc',
                    title: isEn ? 'Configuration Script (.rsc)' : 'Export Script (.rsc)',
                    desc: isEn
                      ? 'Plain text export, readable and can be previewed or edited.'
                      : 'File teks berisi perintah konfigurasi RouterOS, mudah diaudit dan diedit.',
                  },
                  {
                    id: 'backup',
                    title: isEn ? 'System Binary Backup (.backup)' : 'System Binary (.backup)',
                    desc: isEn
                      ? 'Full RouterOS binary image (includes passwords and certificates).'
                      : 'File image biner lengkap RouterOS (termasuk sertifikat dan password enkripsi).',
                  },
                ].map((t) => (
                  <label
                    key={t.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      selectedType === t.id
                        ? 'border-brand-purple bg-brand-purple/5 dark:bg-brand-purple/10'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="backupType"
                      value={t.id}
                      checked={selectedType === t.id}
                      onChange={() => setSelectedType(t.id)}
                      disabled={running}
                      className="mt-0.5 text-brand-purple focus:ring-brand-purple"
                    />
                    <div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {t.title}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700 text-xs text-slate-500">
              💡 {isEn ? 'File will be retrieved via FTP and saved directly into the internal volume.' : 'File akan ditarik via FTP dan langsung disimpan ke storage internal server.'}
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={onClose}
                disabled={running}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                {isEn ? 'Cancel' : 'Batal'}
              </button>
              <button
                onClick={onRun}
                disabled={running || !selectedRouter}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-brand-purple to-indigo-600 rounded-xl shadow-md shadow-brand-purple/20 hover:opacity-95 transition disabled:opacity-50"
              >
                {running ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>{isEn ? 'Backing up...' : 'Memproses Backup...'}</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine size={15} />
                    <span>{isEn ? 'Start Backup' : 'Mulai Pencadangan'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

function ScheduleSettingsModal({ settings, onClose, onSaved, isEn }) {
  const [enabled, setEnabled] = useState(settings?.enabled ?? true)
  const [scheduleDay, setScheduleDay] = useState(settings?.schedule_day ?? 6)
  const [scheduleHour, setScheduleHour] = useState(settings?.schedule_hour ?? 2)
  const [backupType, setBackupType] = useState(settings?.backup_type ?? 'both')
  const [retentionCount, setRetentionCount] = useState(settings?.retention_count ?? 8)
  const [saving, setSaving] = useState(false)

  const dayNames = isEn ? DAY_NAMES_EN : DAY_NAMES_ID

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'auto'
    }
  }, [onClose, saving])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateBackupSettings({
        enabled,
        schedule_day: Number(scheduleDay),
        schedule_hour: Number(scheduleHour),
        schedule_minute: 0,
        backup_type: backupType,
        retention_count: Number(retentionCount),
      })
      onSaved(res)
      onClose()
    } catch (err) {
      alert(err?.response?.data?.detail || (isEn ? 'Failed to save settings' : 'Gagal menyimpan pengaturan'))
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md transition-opacity"
        onClick={!saving ? onClose : undefined}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 z-10 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                {isEn ? 'Weekly Schedule Settings' : 'Jadwal Backup Mingguan'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEn ? 'Automated background execution' : 'Pengaturan jadwal otomatis background server'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Toggle Enable */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {isEn ? 'Enable Weekly Auto-Backup' : 'Aktifkan Backup Otomatis'}
              </div>
              <p className="text-xs text-slate-400">
                {isEn ? 'Runs every week in background' : 'Berjalan otomatis tiap minggu di latar belakang'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
            </label>
          </div>

          {/* Schedule Day */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              {isEn ? 'Execution Day' : 'Hari Eksekusi'}
            </label>
            <select
              value={scheduleDay}
              onChange={(e) => setScheduleDay(Number(e.target.value))}
              disabled={!enabled}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 disabled:opacity-50"
            >
              {dayNames.map((dayName, idx) => (
                <option key={idx} value={idx}>
                  {isEn ? `Every ${dayName}` : `Setiap ${dayName}`}
                </option>
              ))}
            </select>
          </div>

          {/* Schedule Hour */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              {isEn ? 'Execution Time' : 'Jam Eksekusi'}
            </label>
            <select
              value={scheduleHour}
              onChange={(e) => setScheduleHour(Number(e.target.value))}
              disabled={!enabled}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 disabled:opacity-50"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00 {isEn ? '' : 'WIB'}
                </option>
              ))}
            </select>
          </div>

          {/* Default Format */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              {isEn ? 'Default Format' : 'Format Default'}
            </label>
            <select
              value={backupType}
              onChange={(e) => setBackupType(e.target.value)}
              disabled={!enabled}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 disabled:opacity-50"
            >
              <option value="both">{isEn ? 'Both (.ZIP: .rsc + .backup)' : 'Keduanya (.ZIP: .rsc + .backup)'}</option>
              <option value="rsc">{isEn ? 'Export Script (.rsc)' : 'Export Script (.rsc)'}</option>
              <option value="backup">{isEn ? 'System Binary (.backup)' : 'System Binary (.backup)'}</option>
            </select>
          </div>

          {/* Retention Count */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              {isEn ? 'Retention Limit (Files per router)' : 'Batas Retensi (File per router)'}
            </label>
            <select
              value={retentionCount}
              onChange={(e) => setRetentionCount(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            >
              <option value={4}>{isEn ? 'Keep last 4 files (~1 month)' : 'Simpan 4 file terakhir (~1 bulan)'}</option>
              <option value={8}>{isEn ? 'Keep last 8 files (~2 months)' : 'Simpan 8 file terakhir (~2 bulan)'}</option>
              <option value={12}>{isEn ? 'Keep last 12 files (~3 months)' : 'Simpan 12 file terakhir (~3 bulan)'}</option>
              <option value={20}>{isEn ? 'Keep last 20 files (~5 months)' : 'Simpan 20 file terakhir (~5 bulan)'}</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {isEn ? 'Older backups will be deleted automatically to preserve storage.' : 'File lebih lama akan dibersihkan otomatis agar kapasitas penyimpanan tetap hemat.'}
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2.5 pt-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              {isEn ? 'Cancel' : 'Batal'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-brand-purple rounded-xl shadow-md shadow-brand-purple/20 hover:opacity-95 transition disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>{isEn ? 'Saving...' : 'Menyimpan...'}</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>{isEn ? 'Save Schedule' : 'Simpan Pengaturan'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function ScriptPreviewModal({ data, onClose, onCopy, copied, isEn }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'auto'
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col p-6 z-10 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
              <FileCode size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white font-mono">
                {data.filename}
              </h3>
              <p className="text-xs text-slate-400">
                {isEn ? 'RouterOS export script preview' : 'Pratinjau isi script ekspor konfigurasi RouterOS'}
                {data.size ? ` • ${formatBytes(data.size)}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>{copied ? (isEn ? 'Copied!' : 'Tersalin!') : (isEn ? 'Copy' : 'Salin')}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-200 border border-slate-800 select-text leading-relaxed">
          <pre>{data.content || data.message || (isEn ? 'Empty file' : 'File kosong')}</pre>
        </div>

        {data.truncated && (
          <div className="pt-2 text-xs text-amber-500 font-medium">
            ⚠️ {isEn ? 'Preview truncated at 100KB. Download the full file to view everything.' : 'Pratinjau dibatasi pada 100KB pertama. Unduh file lengkap untuk melihat seluruh isi.'}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
