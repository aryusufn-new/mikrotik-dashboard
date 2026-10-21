import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Maximize2,
  Minimize2,
  Network,
  Radio,
  RefreshCw,
  ScrollText,
  Server,
  Settings,
  ShieldAlert,
  Thermometer,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react'
import { useRouter } from '../context/RouterContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { getNocOverview } from '../api'
import useInterfacesWS from '../hooks/useInterfacesWS'
import useTrafficWS from '../hooks/useTrafficWS'
import { formatBps, formatBytes, formatUptime } from '../utils/format'

// Web Audio API Synthesizer for Link Down Alarm
function playWarningBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  } catch {}
}

export default function NocDashboard() {
  const { activeRouterId, activeRouter } = useRouter()
  const { resolvedTheme } = useTheme()
  const { t, language } = useLanguage()
  const [nocData, setNocData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [selectedPortName, setSelectedPortName] = useState(null)
  const [selectedIface, setSelectedIface] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Listen to browser fullscreen changes (e.g. Esc key pressed)
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  // Feature 4: Bandwidth Capacity Threshold
  const [wanCapacityMbps, setWanCapacityMbps] = useState(() => {
    const saved = localStorage.getItem('nocWanCapacityMbps')
    return saved ? Number(saved) : 500
  })
  const [showCapModal, setShowCapModal] = useState(false)
  const [capInput, setCapInput] = useState(wanCapacityMbps)

  // Feature 5: Sound Alert Toggle
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('nocSoundAlertEnabled') === 'true'
  })

  // Feature 1: Log Filter State
  const [logFilter, setLogFilter] = useState('all')

  // Real-time interface traffic via WebSocket
  const { interfaces: wsInterfaces, totals } = useInterfacesWS(activeRouterId)
  const { points: ifacePoints, last: ifaceTraffic } = useTrafficWS(selectedIface)

  const fetchTelemetry = async (isManual = false) => {
    if (!activeRouterId) return
    if (isManual) setRefreshing(true)
    try {
      const data = await getNocOverview()
      setNocData(data)
      setError(null)
    } catch (e) {
      setError(e.message || 'Gagal memuat data telemetri NOC')
    } finally {
      setLoading(false)
      if (isManual) setRefreshing(false)
    }
  }

  // Periodic polling for non-WS telemetry (hardware health, top domains, multi-ping, incident logs, conntrack)
  useEffect(() => {
    fetchTelemetry()
    const timer = setInterval(() => {
      fetchTelemetry()
    }, 5000)
    return () => clearInterval(timer)
  }, [activeRouterId])

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
      setIsFullscreen(false)
    }
  }

  // Toggle sound alert
  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem('nocSoundAlertEnabled', String(next))
    if (next) playWarningBeep()
  }

  // Save WAN Capacity
  const handleSaveCapacity = (e) => {
    e.preventDefault()
    const num = Number(capInput)
    if (num > 0) {
      setWanCapacityMbps(num)
      localStorage.setItem('nocWanCapacityMbps', String(num))
    }
    setShowCapModal(false)
  }

  // Merged ports data (static + live WS traffic)
  const mergedPorts = useMemo(() => {
    if (!nocData?.ports) return []
    const wsMap = new Map((wsInterfaces || []).map((i) => [i.name, i]))
    return nocData.ports.map((p) => {
      const live = wsMap.get(p.name)
      return {
        ...p,
        running: live ? live.running : p.running,
        rx_bps: live ? live.rx_bps : 0,
        tx_bps: live ? live.tx_bps : 0,
      }
    })
  }, [nocData?.ports, wsInterfaces])

  const selectedPort = useMemo(() => {
    if (!selectedPortName) return null
    return mergedPorts.find((p) => p.name === selectedPortName) || null
  }, [selectedPortName, mergedPorts])

  // Feature 5: Link Down Audio Alarm detector
  const prevPortsStatusRef = useRef(new Map())
  useEffect(() => {
    if (mergedPorts.length === 0) return
    const prevMap = prevPortsStatusRef.current
    if (prevMap.size > 0 && soundEnabled) {
      for (const p of mergedPorts) {
        const wasUp = prevMap.get(p.name)
        // If port was previously running and is now DOWN and not disabled
        if (wasUp === true && p.running === false && !p.disabled) {
          playWarningBeep()
          break
        }
      }
    }
    const newMap = new Map()
    for (const p of mergedPorts) {
      newMap.set(p.name, p.running)
    }
    prevPortsStatusRef.current = newMap
  }, [mergedPorts, soundEnabled])

  // Auto-select default WAN or first running interface
  useEffect(() => {
    if (!selectedIface && mergedPorts.length > 0) {
      const defaultIface =
        mergedPorts.find((p) => (p.comment && p.comment.toLowerCase().includes('wan')) || p.name.toLowerCase().includes('wan')) ||
        mergedPorts.find((p) => p.name.toLowerCase() === 'ether1') ||
        mergedPorts.find((p) => p.running) ||
        mergedPorts[0]
      if (defaultIface) setSelectedIface(defaultIface.name)
    }
  }, [mergedPorts, selectedIface])

  const currentIfaceObj = useMemo(() => {
    return mergedPorts.find((p) => p.name === selectedIface) || null
  }, [mergedPorts, selectedIface])

  const res = nocData?.resource
  const health = nocData?.health
  const cpuCores = nocData?.cpu_cores || []
  const multiPing = nocData?.multi_ping || []
  const topDomains = nocData?.top_domains || []
  const topTalkers = nocData?.top_talkers || []
  const portsSummary = nocData?.ports_summary
  const incidentLogs = nocData?.incident_logs || []
  const dhcpConntrack = nocData?.dhcp_conntrack

  // Memory & Disk calculations
  const memTotal = res?.total_memory
  const memFree = res?.free_memory
  const memUsed = memTotal && memFree ? memTotal - memFree : 0
  const memPct = memTotal ? Math.round((memUsed / memTotal) * 100) : 0

  const hddTotal = res?.total_hdd
  const hddFree = res?.free_hdd
  const hddUsed = hddTotal && hddFree ? hddTotal - hddFree : 0
  const hddPct = hddTotal ? Math.round((hddUsed / hddTotal) * 100) : 0

  // Feature 4: Bandwidth Saturation Calculation
  const wanCapBps = wanCapacityMbps * 1_000_000
  const maxIfaceThroughput = Math.max(ifaceTraffic.rx_bps || 0, ifaceTraffic.tx_bps || 0)
  const capPct = wanCapBps > 0 ? Math.round((maxIfaceThroughput / wanCapBps) * 100) : 0
  const isSaturated = capPct >= 85

  // Filtered Incident Logs
  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return incidentLogs
    return incidentLogs.filter((l) => l.severity === logFilter)
  }, [incidentLogs, logFilter])

  if (!activeRouterId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Server size={48} className="mb-3 text-slate-300 dark:text-slate-600" />
        <p className="text-lg font-medium text-slate-700 dark:text-slate-200">{t.noRouterTitle}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.noRouterDesc}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-12">
      {/* ── Top Header & NOC Status Bar ── */}
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl p-5 shadow-card dark:shadow-none border border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <Radio size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t.nocTitle}</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
                  {t.liveTelemetry}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {res?.identity || 'MikroTik Router'} · {res?.board_name || activeRouter?.name} · {res?.host || activeRouter?.host}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Feature 2: Multi-Target Latency Matrix */}
            <div className="flex items-center gap-2">
              {multiPing.length > 0 ? (
                multiPing.map((mp) => {
                  const isOnline = mp.status === 'online'
                  const lat = mp.latency_ms
                  const isGood = lat != null && lat < 30
                  const isFair = lat != null && lat >= 30 && lat <= 80
                  return (
                    <div
                      key={mp.name}
                      className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs shadow-xs"
                      title={`Target: ${mp.host} (Loss: ${mp.loss}%)`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          !isOnline
                            ? 'bg-rose-500'
                            : isGood
                            ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                            : isFair
                            ? 'bg-amber-500 dark:bg-amber-400'
                            : 'bg-rose-500 dark:bg-rose-400'
                        }`}
                      />
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-400 leading-tight">
                          {mp.name}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 leading-tight font-mono">
                          {lat != null ? `${lat} ms` : isOnline ? '< 1 ms' : (language === 'en' ? 'Down' : 'Mati')}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-slate-500 dark:text-slate-300">
                  <Activity size={15} className="text-emerald-500 dark:text-emerald-400" />
                  <span>{t.checkingUplink}</span>
                </div>
              )}
            </div>

            {/* Uptime pill */}
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-1.5">
              <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400">{t.uptime}</div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">
                {formatUptime(res?.uptime)}
              </div>
            </div>

            {/* Feature 5: Sound Alert Toggle */}
            <button
              onClick={toggleSound}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                soundEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40 hover:bg-emerald-100 dark:hover:bg-emerald-500/30'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title={soundEnabled ? t.alarmTitleOn : t.alarmTitleOff}
            >
              {soundEnabled ? <Volume2 size={14} className="text-emerald-500 dark:text-emerald-400" /> : <VolumeX size={14} />}
              <span>{soundEnabled ? t.alarmOn : t.alarmMute}</span>
            </button>

            {/* Controls */}
            <button
              onClick={() => fetchTelemetry(true)}
              disabled={refreshing}
              className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition"
              title={t.refreshData}
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition shadow-sm"
              title={t.kioskTooltip}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isFullscreen ? t.keluarLayarPenuh : t.layarPenuh}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feature 4: Saturation Alert Banner */}
      {isSaturated && (
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center justify-between animate-pulse border border-rose-400/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20">
              <AlertTriangle size={22} className="text-amber-200" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide uppercase">
                {t.saturationWarning} ({capPct}% {t.saturationCapacityUsed})
              </div>
              <div className="text-xs text-rose-100">
                {t.saturationText1} <strong>{selectedIface}</strong> {t.saturationText2} {formatBps(maxIfaceThroughput)} {t.saturationText3} {wanCapacityMbps} Mbps.
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCapModal(true)}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-semibold backdrop-blur-sm transition"
          >
            {t.adjustCapacity}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Row 1: Hardware, Environment & System Capacity Telemetry ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* CPU Load */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.cpuLoad}</span>
            <Cpu size={16} className="text-violet-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{res?.cpu_load ?? 0}%</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{t.cpuTotal}</span>
          </div>
          {cpuCores.length > 1 ? (
            <div className="mt-2.5 space-y-1">
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{t.cpuPerCore}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {cpuCores.slice(0, 8).map((c) => (
                  <div key={c.core} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="w-3 text-slate-400 dark:text-slate-500 font-mono">#{c.core}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          c.load > 80 ? 'bg-rose-500' : c.load > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, c.load))}%` }}
                      />
                    </div>
                    <span className="w-5 text-right font-mono">{c.load}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (res?.cpu_load ?? 0) > 80 ? 'bg-rose-500' : (res?.cpu_load ?? 0) > 50 ? 'bg-amber-500' : 'bg-violet-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, res?.cpu_load ?? 0))}%` }}
              />
            </div>
          )}
        </div>

        {/* RAM Usage */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.ramMemory}</span>
            <Server size={16} className="text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{memPct}%</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {formatBytes(memUsed)} / {formatBytes(memTotal)}
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                memPct > 85 ? 'bg-rose-500' : memPct > 65 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${memPct}%` }}
            />
          </div>
        </div>

        {/* Feature 3: Firewall Conntrack Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.conntrackTable}</span>
            <Network size={16} className="text-sky-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {dhcpConntrack?.conntrack_pct != null ? `${dhcpConntrack.conntrack_pct}%` : t.conntrackNormal}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {dhcpConntrack?.conntrack_total != null
                ? `${dhcpConntrack.conntrack_total.toLocaleString()} / ${dhcpConntrack.conntrack_max.toLocaleString()}`
                : t.conntrackFirewall}
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (dhcpConntrack?.conntrack_pct || 0) > 85
                  ? 'bg-rose-500'
                  : (dhcpConntrack?.conntrack_pct || 0) > 60
                  ? 'bg-amber-500'
                  : 'bg-sky-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, dhcpConntrack?.conntrack_pct || 0))}%` }}
            />
          </div>
        </div>

        {/* Feature 3: DHCP IP Pool Meter */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.dhcpLeases}</span>
            <Database size={16} className="text-indigo-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {dhcpConntrack?.dhcp_bound_leases ?? 0}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {t.dhcpActiveBound} ({dhcpConntrack?.dhcp_pool_count ?? 0} {t.dhcpPoolsDefined})
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500 dark:text-slate-400">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>{t.poolCapacityNormal}</span>
          </div>
        </div>

        {/* Temperature Sensors */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.temperature}</span>
            <Thermometer size={16} className="text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {health?.cpu_temperature != null
                ? `${health.cpu_temperature}°C`
                : health?.temperature != null
                ? `${health.temperature}°C`
                : t.optimal}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {health?.board_temperature != null ? `Board: ${health.board_temperature}°C` : t.sensorThermal}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                (health?.cpu_temperature || health?.temperature) > 70 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
            <span>{(health?.cpu_temperature || health?.temperature) > 70 ? t.highTemp : t.optimal}</span>
          </div>
        </div>

        {/* Storage / HDD */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t.storageDisk}</span>
            <HardDrive size={16} className="text-rose-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{hddPct}%</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {formatBytes(hddUsed)} / {formatBytes(hddTotal)}
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                hddPct > 90 ? 'bg-rose-500' : 'bg-slate-400'
              }`}
              style={{ width: `${hddPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Row 2: Physical Port Visualizer Panel ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-card dark:shadow-none border border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
              <span>{t.portMatrixTitle}</span>
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500">({mergedPorts.length} {t.interfacesDetected})</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.portMatrixSubtitle}
            </p>
          </div>

          {/* Quick summary badges */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold rounded-lg border border-emerald-200 dark:border-emerald-900/60">
              {portsSummary?.running ?? 0} {t.portUp}
            </span>
            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold rounded-lg border border-slate-200 dark:border-slate-700">
              {portsSummary?.down ?? 0} {t.portDown}
            </span>
            {(portsSummary?.rx_drop > 0 || portsSummary?.tx_drop > 0) && (
              <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold rounded-lg border border-amber-200 dark:border-amber-900/60 flex items-center gap-1">
                <AlertTriangle size={12} />
                {(portsSummary?.rx_drop || 0) + (portsSummary?.tx_drop || 0)} {t.portDrops}
              </span>
            )}
            {(portsSummary?.rx_error > 0 || portsSummary?.tx_error > 0) && (
              <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold rounded-lg border border-rose-200 dark:border-rose-900/60 flex items-center gap-1">
                <XCircle size={12} />
                {(portsSummary?.rx_error || 0) + (portsSummary?.tx_error || 0)} {t.portErrors}
              </span>
            )}
          </div>
        </div>

        {/* Physical Ports Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {mergedPorts.map((port) => {
            const isUp = port.running
            const isSfp = port.name.toLowerCase().includes('sfp')
            const hasAnomaly = port.rx_drop > 0 || port.tx_drop > 0 || port.rx_error > 0 || port.tx_error > 0

            return (
              <div
                key={port.name}
                onClick={() => setSelectedPortName(port.name)}
                className={`group relative p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  isUp
                    ? 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/70 hover:border-emerald-500/70 dark:hover:border-emerald-500/70 shadow-xs dark:shadow-none'
                    : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 opacity-75 hover:opacity-100'
                }`}
              >
                {/* Port header: Port Name & LED */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold truncate ${isUp ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                    {port.name}
                  </span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      isUp
                        ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse'
                        : port.disabled
                        ? 'bg-slate-300 dark:bg-slate-600'
                        : 'bg-rose-500/80'
                    }`}
                  />
                </div>

                {/* Port Icon / RJ45 Mockup Visual */}
                <div className="flex items-center justify-center my-2">
                  <div
                    className={`w-12 h-8 rounded border flex flex-col items-center justify-center transition ${
                      isUp
                        ? 'bg-emerald-50/70 dark:bg-slate-800 border-emerald-200/70 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 group-hover:border-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <span className="text-[9px] font-mono font-bold tracking-wider">
                      {isSfp ? 'SFP' : 'RJ45'}
                    </span>
                    <span className="text-[8px] opacity-75">
                      {port.speed ? String(port.speed).replace('bps', '') : isUp ? '1G' : t.portStatusDown}
                    </span>
                  </div>
                </div>

                {/* Traffic summary on port */}
                <div className="mt-1 space-y-0.5">
                  <div className="text-[10px] truncate flex items-center justify-between">
                    <span className={isUp ? 'text-sky-600 dark:text-sky-400 font-medium' : 'text-slate-400 dark:text-slate-500'}>
                      ↓ {formatBps(port.rx_bps || 0)}
                    </span>
                  </div>
                  <div className="text-[10px] truncate flex items-center justify-between">
                    <span className={isUp ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-slate-400 dark:text-slate-500'}>
                      ↑ {formatBps(port.tx_bps || 0)}
                    </span>
                  </div>
                </div>

                {/* Anomaly badge indicator */}
                {hasAnomaly && (
                  <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white rounded-full p-0.5 shadow">
                    <AlertTriangle size={10} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Row 3: Live Traffic Chart & Top 5 Domains ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left (2 cols): Real-time Traffic Area Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-card dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                <Activity size={16} className="text-violet-600" />
                <span>{t.ifaceThroughputTitle} ({selectedIface || '-'})</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.ifaceThroughputSubtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Feature 4: Capacity setting button */}
              <button
                onClick={() => {
                  setCapInput(wanCapacityMbps)
                  setShowCapModal(true)
                }}
                className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 transition"
                title={t.capacityModalTitle}
              >
                <Settings size={13} />
                <span>{t.capLabel} <strong>{wanCapacityMbps} Mbps</strong> ({capPct}%)</span>
              </button>

              {/* Dropdown Interface Selector */}
              <select
                value={selectedIface}
                onChange={(e) => setSelectedIface(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer max-w-[200px] truncate"
              >
                {mergedPorts.map((p) => (
                  <option key={p.name} value={p.name} className="dark:bg-slate-900 dark:text-slate-200">
                    {p.name} {p.running ? `● ${t.portUp}` : `○ ${t.portDown}`} {p.comment ? `— ${p.comment}` : ''}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.6)] animate-pulse" />
                  RX {formatBps(ifaceTraffic.rx_bps)}
                </span>
                <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.6)] animate-pulse" />
                  TX {formatBps(ifaceTraffic.tx_bps)}
                </span>
              </div>
            </div>
          </div>

          {/* Area Chart */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ifacePoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={resolvedTheme === 'dark' ? '#1e293b' : '#f1f5f9'} vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
                <YAxis tickFormatter={(v) => formatBps(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  formatter={(val, name) => [formatBps(val), name === 'rx' ? t.chartDownload : t.chartUpload]}
                  labelFormatter={(lbl) => `${t.chartTime} ${lbl}`}
                  contentStyle={{
                    backgroundColor: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: resolvedTheme === 'dark' ? '#334155' : '#e2e8f0',
                    borderRadius: 8,
                    color: resolvedTheme === 'dark' ? '#f8fafc' : '#0f172a',
                    fontSize: 12,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Area type="monotone" dataKey="rx" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#rxGrad)" isAnimationActive={false} />
                <Area type="monotone" dataKey="tx" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#txGrad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{t.ifacePort} <strong className="text-slate-800 dark:text-slate-200">{selectedIface || '-'}</strong> ({currentIfaceObj?.running ? t.ifaceRunning : t.ifaceDown})</span>
            <span>{t.ifaceSpeed} <strong className="text-slate-700 dark:text-slate-300">{currentIfaceObj?.speed || '1 Gbps'}</strong></span>
            <span>{t.cumulativeTotal} <strong className="text-sky-600 dark:text-sky-400">↓ {formatBytes(currentIfaceObj?.rx_byte)}</strong> / <strong className="text-orange-600 dark:text-orange-400">↑ {formatBytes(currentIfaceObj?.tx_byte)}</strong></span>
          </div>
        </div>

        {/* Right (1 col): Top 5 Visited Domains (DNS Cache) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-card dark:shadow-none border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
                <Globe size={16} className="text-sky-600 dark:text-sky-400" />
                <span>{t.topDomainsTitle}</span>
              </div>
              <span className="text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800">
                {t.dnsCacheBadge}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.topDomainsSubtitle}</p>

            {topDomains.length > 0 ? (
              <div className="space-y-3.5">
                {topDomains.map((item, idx) => (
                  <div key={item.domain} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="truncate max-w-[170px]" title={item.domain}>
                          {item.domain}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{item.hits}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">({item.percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(5, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500 text-xs">
                <Globe size={32} className="mb-2 text-slate-300 dark:text-slate-600" />
                <span>{t.noDnsQueries}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t.noDnsQueriesHelp}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>{t.dnsMethod}</span>
            <span>{t.dnsUpdateFreq}</span>
          </div>
        </div>
      </div>

      {/* ── Row 4: Top Bandwidth Consumers & Anomaly List ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Talkers */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-card dark:shadow-none border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
              <Users size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>{t.topTalkersTitle}</span>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">Hotspot & PPPoE</span>
          </div>

          {topTalkers.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {topTalkers.map((tClient, idx) => (
                <div key={`${tClient.name}-${idx}`} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px] border border-emerald-200 dark:border-emerald-800">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{tClient.name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        {tClient.ip || '-'} · <span className="font-medium text-slate-500 dark:text-slate-400">{tClient.service}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-800 dark:text-slate-100">
                      {tClient.total_bytes ? formatBytes(tClient.total_bytes) : t.activeSession}
                    </div>
                    {tClient.bytes_in != null && tClient.bytes_out != null && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 justify-end">
                        <span className="text-sky-500 dark:text-sky-400">↓ {formatBytes(tClient.bytes_in)}</span>
                        <span className="text-orange-500 dark:text-orange-400">↑ {formatBytes(tClient.bytes_out)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-xs">
              <Users size={28} className="mb-1 text-slate-300 dark:text-slate-600" />
              <span>{t.noActiveClients}</span>
            </div>
          )}
        </div>

        {/* Link Error & Packet Drop Watchlist */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-card dark:shadow-none border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <span>{t.watchlistTitle}</span>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">{t.watchlistSubtitle}</span>
          </div>

          {mergedPorts.filter((p) => p.rx_drop > 0 || p.tx_drop > 0 || p.rx_error > 0 || p.tx_error > 0).length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {mergedPorts
                .filter((p) => p.rx_drop > 0 || p.tx_drop > 0 || p.rx_error > 0 || p.tx_error > 0)
                .map((p) => (
                  <div key={p.name} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{p.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2">({p.speed || '1G'})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {(p.rx_drop > 0 || p.tx_drop > 0) && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {t.portDrops}: {p.rx_drop + p.tx_drop}
                        </span>
                      )}
                      {(p.rx_error > 0 || p.tx_error > 0) && (
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          {t.portErrors}: {p.rx_error + p.tx_error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-emerald-600 dark:text-emerald-400 text-xs">
              <CheckCircle2 size={32} className="mb-2 text-emerald-500" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">{t.allLinksHealthy}</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{t.allLinksHealthyDesc}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Feature 1: Row 5: Real-Time Incident & System Log Stream ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-card dark:shadow-none border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
              <ScrollText size={16} className="text-rose-600 dark:text-rose-400" />
              <span>{t.incidentLogsTitle}</span>
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500">({filteredLogs.length} {t.eventsCount})</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.incidentLogsSubtitle}
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {[
              { id: 'all', label: t.severityAll },
              { id: 'critical', label: t.severityCritical },
              { id: 'error', label: t.severityError },
              { id: 'warning', label: t.severityWarning },
            ].map(({ id: f, label }) => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={`px-3 py-1 rounded-lg font-semibold uppercase text-[10px] transition ${
                  logFilter === f
                    ? f === 'critical'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : f === 'error'
                      ? 'bg-red-500 text-white shadow-sm'
                      : f === 'warning'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs max-h-72 overflow-y-auto">
              {filteredLogs.map((log, idx) => {
                const isCrit = log.severity === 'critical'
                const isErr = log.severity === 'error'
                return (
                  <div
                    key={`${log.time}-${idx}`}
                    className="py-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition rounded-lg"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-slate-400 dark:text-slate-500 text-[11px] whitespace-nowrap">{log.time}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isCrit
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                            : isErr
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60'
                        }`}
                      >
                        {log.severity}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                        {log.topics}
                      </span>
                    </div>
                    <div className="text-slate-800 dark:text-slate-200 font-sans text-xs flex-1 sm:text-right truncate sm:ml-4" title={log.message}>
                      {log.message}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-28 text-slate-400 dark:text-slate-500 text-xs">
            <CheckCircle2 size={28} className="mb-1 text-emerald-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">{t.noIncidentsTitle}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{t.noIncidentsDesc}</span>
          </div>
        )}
      </div>

      {/* ── Feature 4: Modal Setting Kapasitas ISP ── */}
      {showCapModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in">
          <form
            onSubmit={handleSaveCapacity}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-800 dark:text-white">{t.capacityModalTitle}</h3>
              <button
                type="button"
                onClick={() => setShowCapModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">
                  {t.subscriptionCapacity}
                </label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={t.capacityPlaceholder}
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {t.capacityModalHelp}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCapModal(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                {t.btnBatal}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition shadow"
              >
                {t.btnSimpan}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal Dialog: Port Detail Inspector ── */}
      {selectedPort && (
        <PortDetailModal
          port={selectedPort}
          onClose={() => setSelectedPortName(null)}
        />
      )}
    </div>
  )
}

function PortDetailModal({ port, onClose }) {
  const { t } = useLanguage()
  const { last: liveTraffic } = useTrafficWS(port.name)
  const rx = liveTraffic?.rx_bps > 0 ? liveTraffic.rx_bps : (port.rx_bps || 0)
  const tx = liveTraffic?.tx_bps > 0 ? liveTraffic.tx_bps : (port.tx_bps || 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                port.running ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-rose-500'
              }`}
            />
            <h3 className="font-bold text-base text-slate-800 dark:text-white">{port.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
              {port.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-2.5 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500">{t.linkStatus}</span>
            <span className={`font-semibold ${port.running ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {port.running ? t.linkRunning : t.linkDisconnected}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500">{t.negotiatedSpeed}</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{port.speed || '1 Gbps (Full Duplex)'}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500">{t.macAddress}</span>
            <span className="font-mono text-slate-700 dark:text-slate-200">{port.mac_address || '-'}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 items-center">
            <span className="text-slate-400 dark:text-slate-500">{t.currentLiveTraffic}</span>
            <div className="flex items-center gap-3 font-semibold text-slate-700 dark:text-slate-200">
              <span className="text-sky-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                ↓ {formatBps(rx)}
              </span>
              <span className="text-orange-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                ↑ {formatBps(tx)}
              </span>
            </div>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500">{t.cumulativeRxTx}</span>
            <span className="text-slate-700 dark:text-slate-200 font-medium">
              ↓ {formatBytes(port.rx_byte)} / ↑ {formatBytes(port.tx_byte)}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500">{t.packetDrops}</span>
            <span className={`font-semibold ${port.rx_drop > 0 || port.tx_drop > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>
              RX: {port.rx_drop} · TX: {port.tx_drop}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500">{t.packetErrors}</span>
            <span className={`font-semibold ${port.rx_error > 0 || port.tx_error > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
              RX: {port.rx_error} · TX: {port.tx_error}
            </span>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-600 transition"
          >
            {t.btnTutup}
          </button>
        </div>
      </div>
    </div>
  )
}
