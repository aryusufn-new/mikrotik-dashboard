import React, { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import useTrafficWS from '../hooks/useTrafficWS'
import { getInterfaces } from '../api'
import BoardInfo from './BoardInfo'
import { formatBps } from '../utils/format'

export default function TrafficPanel({ resource }) {
  const [interfaces, setInterfaces] = useState([])
  const [iface, setIface] = useState('')
  const [err, setErr] = useState(null)

  useEffect(() => {
    getInterfaces()
      .then((list) => {
        setInterfaces(list)
        const def = list.find((i) => i.name?.toLowerCase() === 'ether1') || list[0]
        if (def) setIface(def.name)
      })
      .catch((e) => setErr(e.message))
  }, [])

  const { points, last, error } = useTrafficWS(iface)

  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-800">Traffic</h2>
        <div className="flex items-center gap-2">
          <select
            className="border border-slate-200 rounded-md px-3 py-1.5 text-sm bg-white"
            value="API"
            disabled
          >
            <option>PORT API</option>
          </select>
          <select
            className="border border-slate-200 rounded-md px-3 py-1.5 text-sm bg-white"
            value={iface}
            onChange={(e) => setIface(e.target.value)}
          >
            {interfaces.map((i) => (
              <option key={i.name} value={i.name}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <BoardInfo res={resource} />

        <div>
          <div className="flex gap-6 mb-2 text-sm">
            <div className="text-brand-purple">
              TX: <span className="font-semibold">{formatBps(last.tx_bps)}</span>
            </div>
            <div className="text-brand-pink">
              RX: <span className="font-semibold">{formatBps(last.rx_bps)}</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="txg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rxg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={(v) => formatBps(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} width={70} />
                <Tooltip
                  formatter={(v) => formatBps(v)}
                  labelStyle={{ color: '#475569' }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="tx"
                  name="TX"
                  stroke="#a855f7"
                  fill="url(#txg)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="rx"
                  name="RX"
                  stroke="#ec4899"
                  fill="url(#rxg)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {(error || err) && (
            <div className="text-rose-600 text-sm mt-2">{error || err}</div>
          )}
        </div>
      </div>
    </div>
  )
}
