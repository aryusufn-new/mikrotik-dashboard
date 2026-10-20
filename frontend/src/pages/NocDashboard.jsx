import React, { useEffect, useState, useMemo } from 'react'
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
  Globe,
  HardDrive,
  Maximize2,
  Minimize2,
  Radio,
  RefreshCw,
  Server,
  Thermometer,
  Users,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react'
import { useRouter } from '../context/RouterContext'
import { getNocOverview, getNocTopDomains } from '../api'
import useInterfacesWS from '../hooks/useInterfacesWS'
import useTrafficWS from '../hooks/useTrafficWS'
import { formatBps, formatBytes, formatUptime } from '../utils/format'

export default function NocDashboard() {
  const { activeRouterId, activeRouter } = useRouter()
  const [nocData, setNocData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [selectedPortName, setSelectedPortName] = useState(null)
  const [selectedIface, setSelectedIface] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Real-time interface traffic via WebSocket
  const { interfaces: wsInterfaces, totals, points } = useInterfacesWS(activeRouterId)
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

  // Periodic polling for non-WS telemetry (hardware health, top domains, ping, drops)
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
  const ping = nocData?.ping
  const topDomains = nocData?.top_domains || []
  const topTalkers = nocData?.top_talkers || []
  const portsSummary = nocData?.ports_summary

  // Memory & Disk calculations
  const memTotal = res?.total_memory
  const memFree = res?.free_memory
  const memUsed = memTotal && memFree ? memTotal - memFree : 0
  const memPct = memTotal ? Math.round((memUsed / memTotal) * 100) : 0

  const hddTotal = res?.total_hdd
  const hddFree = res?.free_hdd
  const hddUsed = hddTotal && hddFree ? hddTotal - hddFree : 0
  const hddPct = hddTotal ? Math.round((hddUsed / hddTotal) * 100) : 0

  if (!activeRouterId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Server size={48} className="mb-3 text-slate-300" />
        <p className="text-lg font-medium text-slate-700">Router Belum Dipilih</p>
        <p className="text-sm text-slate-500 mt-1">Pilih atau tambahkan router dari menu Konfigurasi</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-12">
      {/* ── Top Header & NOC Status Bar ── */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-400">
              <Radio size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">NOC Command Center</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE TELEMETRY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {res?.identity || 'MikroTik Router'} · {res?.board_name || activeRouter?.name} · {res?.host || activeRouter?.host}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Ping latency status */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-xl px-3.5 py-1.5">
              <Activity size={16} className={ping?.status === 'online' ? 'text-emerald-400' : 'text-rose-400'} />
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Uplink Latency</div>
                <div className="text-xs font-semibold text-white">
                  {ping?.latency_ms != null ? `${ping.latency_ms} ms` : ping?.status === 'online' ? '< 1 ms' : 'Offline'}
                  <span className="text-[10px] text-slate-400 font-normal ml-1">({ping?.host || '8.8.8.8'})</span>
                </div>
              </div>
            </div>

            {/* Uptime pill */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3.5 py-1.5">
              <div className="text-[10px] uppercase font-bold text-slate-400">Uptime</div>
              <div className="text-xs font-semibold text-white truncate max-w-[180px]">
                {formatUptime(res?.uptime)}
              </div>
            </div>

            {/* Controls */}
            <button
              onClick={() => fetchTelemetry(true)}
              disabled={refreshing}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition"
              title="Kiosk / TV Wall Mode"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isFullscreen ? 'Exit Kiosk' : 'Kiosk Mode'}</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Row 1: Hardware & Environment Telemetry ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* CPU Load */}
        <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">CPU Load</span>
            <Cpu size={16} className="text-violet-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{res?.cpu_load ?? 0}%</span>
            <span className="text-xs text-slate-400">Total</span>
          </div>
          {/* Per-core visualizer */}
          {cpuCores.length > 1 ? (
            <div className="mt-2.5 space-y-1">
              <div className="text-[10px] text-slate-400 font-medium">Per Core:</div>
              <div className="grid grid-cols-2 gap-1.5">
                {cpuCores.slice(0, 8).map((c) => (
                  <div key={c.core} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className="w-3 text-slate-400 font-mono">#{c.core}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
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
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
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
        <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">RAM Memory</span>
            <Server size={16} className="text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{memPct}%</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {formatBytes(memUsed)} / {formatBytes(memTotal)}
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                memPct > 85 ? 'bg-rose-500' : memPct > 65 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${memPct}%` }}
            />
          </div>
        </div>

        {/* Temperature Sensors */}
        <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Temperatur</span>
            <Thermometer size={16} className="text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">
              {health?.cpu_temperature != null
                ? `${health.cpu_temperature}°C`
                : health?.temperature != null
                ? `${health.temperature}°C`
                : 'Normal'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {health?.board_temperature != null ? `Board: ${health.board_temperature}°C` : 'Sensor Hardware'}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
            <span
              className={`w-2 h-2 rounded-full ${
                (health?.cpu_temperature || health?.temperature) > 70
                  ? 'bg-rose-500'
                  : 'bg-emerald-500'
              }`}
            />
            <span>{(health?.cpu_temperature || health?.temperature) > 70 ? 'High Temp Warning' : 'Optimal Thermal'}</span>
          </div>
        </div>

        {/* Voltage & Power */}
        <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Voltase & Daya</span>
            <Zap size={16} className="text-sky-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">
              {health?.voltage != null ? `${health.voltage} V` : 'Stabil'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {health?.fan_speed != null ? `Fan: ${health.fan_speed} RPM` : 'Power Supply DC'}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>Power line OK</span>
          </div>
        </div>

        {/* Storage / HDD */}
        <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Storage Disk</span>
            <HardDrive size={16} className="text-indigo-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{hddPct}%</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {formatBytes(hddUsed)} / {formatBytes(hddTotal)}
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                hddPct > 90 ? 'bg-rose-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${hddPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Row 2: Physical Port Visualizer Panel ── */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <span>Port Matrix & Physical Link</span>
              <span className="text-xs font-normal text-slate-400">({mergedPorts.length} interfaces detected)</span>
            </div>
            <p className="text-xs text-slate-500">
              Panel visual status link port fisik, negosiasi speed, packet error, dan drops
            </p>
          </div>

          {/* Quick summary badges */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded-lg border border-emerald-200">
              {portsSummary?.running ?? 0} Up
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-semibold rounded-lg border border-slate-200">
              {portsSummary?.down ?? 0} Down
            </span>
            {(portsSummary?.rx_drop > 0 || portsSummary?.tx_drop > 0) && (
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-semibold rounded-lg border border-amber-200 flex items-center gap-1">
                <AlertTriangle size={12} />
                {(portsSummary?.rx_drop || 0) + (portsSummary?.tx_drop || 0)} Drops
              </span>
            )}
            {(portsSummary?.rx_error > 0 || portsSummary?.tx_error > 0) && (
              <span className="px-2.5 py-1 bg-rose-50 text-rose-700 font-semibold rounded-lg border border-rose-200 flex items-center gap-1">
                <XCircle size={12} />
                {(portsSummary?.rx_error || 0) + (portsSummary?.tx_error || 0)} Errors
              </span>
            )}
          </div>
        </div>

        {/* Physical Ports Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {mergedPorts.map((port) => {
            const isUp = port.running
            const isSfp = port.name.toLowerCase().includes('sfp')
            const hasAnomaly = (port.rx_drop > 0 || port.tx_drop > 0 || port.rx_error > 0 || port.tx_error > 0)

            return (
              <div
                key={port.name}
                onClick={() => setSelectedPortName(port.name)}
                className={`group relative p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  isUp
                    ? 'bg-slate-900 border-slate-700 hover:border-emerald-500/80 shadow-md'
                    : 'bg-slate-100/80 border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Port header: Port Name & LED */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold truncate ${isUp ? 'text-white' : 'text-slate-600'}`}>
                    {port.name}
                  </span>
                  {/* Status LED */}
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      isUp
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
                        : port.disabled
                        ? 'bg-slate-400'
                        : 'bg-rose-500'
                    }`}
                  />
                </div>

                {/* Port Icon / RJ45 Mockup Visual */}
                <div className="flex items-center justify-center my-2">
                  <div
                    className={`w-12 h-8 rounded border flex flex-col items-center justify-center transition ${
                      isUp
                        ? 'bg-slate-800 border-slate-600 text-emerald-400 group-hover:border-emerald-400'
                        : 'bg-slate-200 border-slate-300 text-slate-400'
                    }`}
                  >
                    <span className="text-[9px] font-mono font-bold tracking-wider">
                      {isSfp ? 'SFP' : 'RJ45'}
                    </span>
                    <span className="text-[8px] opacity-75">
                      {port.speed ? String(port.speed).replace('bps', '') : isUp ? '1G' : 'DOWN'}
                    </span>
                  </div>
                </div>

                {/* Traffic summary on port */}
                <div className="mt-1 space-y-0.5">
                  <div className={`text-[10px] truncate flex items-center justify-between ${isUp ? 'text-slate-300' : 'text-slate-500'}`}>
                    <span className="text-sky-400">↓ {formatBps(port.rx_bps || 0)}</span>
                  </div>
                  <div className={`text-[10px] truncate flex items-center justify-between ${isUp ? 'text-slate-300' : 'text-slate-500'}`}>
                    <span className="text-orange-400">↑ {formatBps(port.tx_bps || 0)}</span>
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
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-card border border-slate-100 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Activity size={16} className="text-violet-600" />
                <span>Interface Throughput ({selectedIface || '-'})</span>
              </div>
              <p className="text-xs text-slate-500">Live RX & TX bandwidth interface terpilih langsung dari RouterOS</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Dropdown Interface Selector */}
              <select
                value={selectedIface}
                onChange={(e) => setSelectedIface(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer max-w-[220px] truncate"
              >
                {mergedPorts.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} {p.running ? '● Up' : '○ Down'} {p.comment ? `— ${p.comment}` : ''}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-sky-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.6)] animate-pulse" />
                  RX {formatBps(ifaceTraffic.rx_bps)}
                </span>
                <span className="flex items-center gap-1.5 text-orange-600">
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
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
                <YAxis tickFormatter={(v) => formatBps(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  formatter={(val, name) => [formatBps(val), name === 'rx' ? 'Download (RX)' : 'Upload (TX)']}
                  labelFormatter={(lbl) => `Waktu: ${lbl}`}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, color: '#f8fafc', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="rx" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#rxGrad)" isAnimationActive={false} />
                <Area type="monotone" dataKey="tx" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#txGrad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Port: <strong className="text-slate-800">{selectedIface || '-'}</strong> ({currentIfaceObj?.running ? 'Running' : 'Down'})</span>
            <span>Speed: <strong className="text-slate-700">{currentIfaceObj?.speed || '1 Gbps'}</strong></span>
            <span>Total Akumulasi: <strong className="text-sky-600">↓ {formatBytes(currentIfaceObj?.rx_byte)}</strong> / <strong className="text-orange-600">↑ {formatBytes(currentIfaceObj?.tx_byte)}</strong></span>
          </div>
        </div>

        {/* Right (1 col): Top 5 Visited Domains (DNS Cache) */}
        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Globe size={16} className="text-sky-600" />
                <span>Top 5 Web / Domain</span>
              </div>
              <span className="text-[10px] font-semibold bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full border border-sky-200">
                DNS Cache
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">Domain tujuan paling sering diakses oleh klien di jaringan</p>

            {topDomains.length > 0 ? (
              <div className="space-y-3.5">
                {topDomains.map((item, idx) => (
                  <div key={item.domain} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium text-slate-700">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="truncate max-w-[170px]" title={item.domain}>
                          {item.domain}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-slate-800">{item.hits}</span>
                        <span className="text-[10px] text-slate-400 ml-1">({item.percentage}%)</span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(5, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs">
                <Globe size={32} className="mb-2 text-slate-300" />
                <span>Belum ada query DNS tercatat</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Pastikan klien menggunakan DNS RouterOS</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Metode 1: /ip dns cache</span>
            <span>Update setiap 5 dtk</span>
          </div>
        </div>
      </div>

      {/* ── Row 4: Top Bandwidth Consumers & Anomaly List ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Talkers */}
        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Users size={16} className="text-emerald-600" />
              <span>Top Bandwidth Consumers</span>
            </div>
            <span className="text-xs text-slate-400">Hotspot / PPPoE</span>
          </div>

          {topTalkers.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {topTalkers.map((t, idx) => (
                <div key={`${t.name}-${idx}`} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-[10px] border border-emerald-200">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-800">{t.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {t.ip || '-'} · <span className="font-medium text-slate-500">{t.service}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-800">
                      {t.total_bytes ? formatBytes(t.total_bytes) : 'Active Session'}
                    </div>
                    {t.bytes_in != null && t.bytes_out != null && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                        <span className="text-sky-500">↓ {formatBytes(t.bytes_in)}</span>
                        <span className="text-orange-500">↑ {formatBytes(t.bytes_out)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs">
              <Users size={28} className="mb-1 text-slate-300" />
              <span>Belum ada klien aktif terdeteksi</span>
            </div>
          )}
        </div>

        {/* Link Error & Packet Drop Watchlist */}
        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <span>Link Error & Packet Drop Watchlist</span>
            </div>
            <span className="text-xs text-slate-400">Kualitas Fisik Kabel / SFP</span>
          </div>

          {mergedPorts.filter((p) => p.rx_drop > 0 || p.tx_drop > 0 || p.rx_error > 0 || p.tx_error > 0).length > 0 ? (
            <div className="divide-y divide-slate-100">
              {mergedPorts
                .filter((p) => p.rx_drop > 0 || p.tx_drop > 0 || p.rx_error > 0 || p.tx_error > 0)
                .map((p) => (
                  <div key={p.name} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{p.name}</span>
                      <span className="text-[10px] text-slate-400 ml-2">({p.speed || '1G'})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {(p.rx_drop > 0 || p.tx_drop > 0) && (
                        <span className="text-amber-600 font-medium">
                          Drops: {p.rx_drop + p.tx_drop}
                        </span>
                      )}
                      {(p.rx_error > 0 || p.tx_error > 0) && (
                        <span className="text-rose-600 font-medium">
                          Errors: {p.rx_error + p.tx_error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-emerald-600 text-xs">
              <CheckCircle2 size={32} className="mb-2 text-emerald-500" />
              <span className="font-semibold text-slate-700">Semua Link Interface Bersih</span>
              <span className="text-[11px] text-slate-400 mt-0.5">0 packet drop & 0 CRC error pada semua port</span>
            </div>
          )}
        </div>
      </div>

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
  const { last: liveTraffic } = useTrafficWS(port.name)
  const rx = liveTraffic?.rx_bps > 0 ? liveTraffic.rx_bps : (port.rx_bps || 0)
  const tx = liveTraffic?.tx_bps > 0 ? liveTraffic.tx_bps : (port.tx_bps || 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                port.running ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-rose-500'
              }`}
            />
            <h3 className="font-bold text-base text-slate-800">{port.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
              {port.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-2.5 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-400">Link Status</span>
            <span className={`font-semibold ${port.running ? 'text-emerald-600' : 'text-rose-600'}`}>
              {port.running ? 'LINK UP (Running)' : 'LINK DOWN'}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-400">Negotiated Speed</span>
            <span className="font-semibold text-slate-700">{port.speed || '1 Gbps (Full Duplex)'}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-400">MAC Address</span>
            <span className="font-mono text-slate-700">{port.mac_address || '-'}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50 items-center">
            <span className="text-slate-400">Current Live Traffic</span>
            <div className="flex items-center gap-3 font-semibold text-slate-700">
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
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-400">Total Cumulative RX/TX</span>
            <span className="text-slate-700 font-medium">
              ↓ {formatBytes(port.rx_byte)} / ↑ {formatBytes(port.tx_byte)}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-400">Packet Drops</span>
            <span className={`font-semibold ${port.rx_drop > 0 || port.tx_drop > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
              RX: {port.rx_drop} · TX: {port.tx_drop}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-400">Packet Errors</span>
            <span className={`font-semibold ${port.rx_error > 0 || port.tx_error > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              RX: {port.rx_error} · TX: {port.tx_error}
            </span>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
