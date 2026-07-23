import React, { useEffect, useState } from 'react'
import { getInterfaces, getSystemResource } from '../api'
import { useRouter } from '../context/RouterContext'
import Gauge from '../components/Gauge'
import useTrafficWS from '../hooks/useTrafficWS'
import { formatBps, formatBytes, formatUptime } from '../utils/format'

function InfoCell({ label, value, valueClass = '' }) {
  return (
    <div className="px-5 py-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 font-semibold text-slate-800 ${valueClass}`}>{value ?? '-'}</div>
    </div>
  )
}

export default function DeviceMonitor() {
  const { activeRouterId, activeRouter } = useRouter()
  const [res, setRes] = useState(null)
  const [error, setError] = useState(null)
  const [lastPoll, setLastPoll] = useState(null)
  const [interfaces, setInterfaces] = useState([])
  const [iface, setIface] = useState('')

  // Reset and reload when router changes
  useEffect(() => {
    setRes(null)
    setError(null)
    setLastPoll(null)
    setInterfaces([])
    setIface('')

    if (!activeRouterId) return

    getInterfaces()
      .then((list) => {
        setInterfaces(list)
        const def = list.find((i) => i.name?.toLowerCase() === 'ether1') || list[0]
        if (def) setIface(def.name)
      })
      .catch(() => {})
  }, [activeRouterId])

  useEffect(() => {
    if (!activeRouterId) return
    let mounted = true
    const load = async () => {
      try {
        const r = await getSystemResource()
        if (!mounted) return
        setRes(r)
        setError(null)
        setLastPoll(new Date())
      } catch (e) {
        if (mounted) setError(e.message)
      }
    }
    load()
    const id = setInterval(load, 3000)
    return () => { mounted = false; clearInterval(id) }
  }, [activeRouterId])

  const { last } = useTrafficWS(iface)

  const memTotal = res?.total_memory
  const memFree = res?.free_memory
  const memUsed = memTotal != null && memFree != null ? memTotal - memFree : 0
  const memPct = memTotal ? (memUsed / memTotal) * 100 : 0

  const hddTotal = res?.total_hdd
  const hddFree = res?.free_hdd
  const hddUsed = hddTotal != null && hddFree != null ? hddTotal - hddFree : 0
  const hddPct = hddTotal ? (hddUsed / hddTotal) * 100 : 0

  if (!activeRouterId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="text-lg font-medium">Belum ada router</p>
        <p className="text-sm mt-1">Tambahkan router di halaman Konfigurasi</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Device Monitor</h1>
          <p className="text-slate-500 text-sm">Realtime · CPU · RAM · Disk · Traffic</p>
        </div>
        <select
          className="border border-slate-200 rounded-md px-3 py-1.5 text-sm bg-white w-full sm:w-auto"
          value={iface}
          onChange={(e) => setIface(e.target.value)}
        >
          {interfaces.map((i) => (
            <option key={i.name} value={i.name}>{i.name}</option>
          ))}
        </select>
      </div>

      {/* Header info */}
      <div className="bg-white rounded-2xl shadow-card mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 divide-x divide-slate-100">
        <InfoCell label="Device" value={res?.identity || res?.board_name} />
        <InfoCell label="Board" value={res?.board_name} />
        <InfoCell label="IP" value={res?.host} />
        <InfoCell
          label="Status"
          value={error ? 'Offline' : 'Online'}
          valueClass={error ? 'text-rose-500' : 'text-emerald-500'}
        />
        <InfoCell label="Uptime" value={formatUptime(res?.uptime)} />
        <InfoCell label="Firmware" value={res?.version} />
        <InfoCell label="Last Poll" value={lastPoll ? lastPoll.toLocaleTimeString('id-ID', { hour12: false }) : '-'} />
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="text-sm font-medium text-slate-500 mb-3">CPU LOAD</div>
          <Gauge value={res?.cpu_load ?? 0} color="#f59e0b" label={res?.board_name} />
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="text-sm font-medium text-slate-500 mb-3">RAM USAGE</div>
          <Gauge
            value={memPct}
            color="#10b981"
            label={memTotal ? `${formatBytes(memUsed)} / ${formatBytes(memTotal)}` : '-'}
          />
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="text-sm font-medium text-slate-500 mb-3">DISK USAGE</div>
          <Gauge
            value={hddPct}
            color="#f97316"
            label={hddTotal ? `${formatBytes(hddUsed)} / ${formatBytes(hddTotal)}` : '-'}
          />
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="text-sm font-medium text-slate-500 mb-3">TOTAL TRAFFIC</div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-sky-500 font-semibold">↓ RX DOWNLOAD</div>
              <div className="text-2xl font-bold text-sky-600">{formatBps(last.rx_bps)}</div>
            </div>
            <div>
              <div className="text-xs text-orange-500 font-semibold">↑ TX UPLOAD</div>
              <div className="text-2xl font-bold text-orange-600">{formatBps(last.tx_bps)}</div>
            </div>
            <div className="text-[11px] text-slate-400">on {iface || '-'}</div>
          </div>
        </div>
      </div>

      {error && <div className="mt-4 text-rose-600 text-sm">{error}</div>}
    </div>
  )
}
