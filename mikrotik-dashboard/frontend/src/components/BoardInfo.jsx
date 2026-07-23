import React from 'react'
import { formatBytes, formatUptime } from '../utils/format'

function Row({ label, value }) {
  return (
    <div className="mb-4">
      <div className="text-slate-900 font-semibold text-sm">{label}</div>
      <div className="text-slate-600 text-sm">{value ?? '-'}</div>
    </div>
  )
}

export default function BoardInfo({ res }) {
  const memTotal = res?.total_memory
  const memFree = res?.free_memory
  const memUsed = memTotal != null && memFree != null ? memTotal - memFree : null
  return (
    <div className="min-w-[200px]">
      <Row label="Board Name" value={res?.board_name} />
      <Row label="Version" value={res?.version} />
      <Row
        label="Memory"
        value={
          memUsed != null
            ? `${formatBytes(memUsed)} of ${formatBytes(memTotal)}`
            : '-'
        }
      />
      <Row label="CPU LOAD" value={res?.cpu_load != null ? `${res.cpu_load}%` : '-'} />
      <Row label="Uptime" value={formatUptime(res?.uptime)} />
    </div>
  )
}
