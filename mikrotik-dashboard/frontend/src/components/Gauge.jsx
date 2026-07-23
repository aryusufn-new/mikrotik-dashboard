import React from 'react'

/**
 * Donut-style gauge using SVG (no extra deps).
 * Props:
 *  - value: 0..100 percentage
 *  - label: small text below value (e.g. "90 / 256 MB")
 *  - color: arc color
 *  - size: px (default 160)
 */
export default function Gauge({ value = 0, label, color = '#3b82f6', size = 160 }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct / 100)

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      {label && <div className="text-xs text-slate-500 mt-2">{label}</div>}
    </div>
  )
}
