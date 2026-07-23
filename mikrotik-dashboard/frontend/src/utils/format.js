export function formatBps(bps) {
  if (!bps || bps < 1000) return `${bps || 0} bps`
  if (bps < 1_000_000) return `${(bps / 1000).toFixed(2)} kbps`
  if (bps < 1_000_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`
  return `${(bps / 1_000_000_000).toFixed(2)} Gbps`
}

export function formatBytes(b) {
  if (b == null) return '-'
  const n = Number(b)
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(2)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(2)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

// Convert RouterOS uptime string e.g. "1w1d3h47m22s" to "1 Minggu, 1 Hari, 3 Jam, 47 Menit, 22 Detik"
export function formatUptime(s) {
  if (!s) return '-'
  const map = { w: 'Minggu', d: 'Hari', h: 'Jam', m: 'Menit', s: 'Detik' }
  const parts = []
  const re = /(\d+)([wdhms])/g
  let m
  while ((m = re.exec(s)) !== null) {
    parts.push(`${m[1]} ${map[m[2]]}`)
  }
  return parts.length ? parts.join(', ') : s
}
