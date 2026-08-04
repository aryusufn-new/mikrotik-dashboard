import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getTopology } from '../api'
import { useRouter } from '../context/RouterContext'
import { Network, RefreshCw, ZoomIn, ZoomOut, Maximize2, Info, X, ChevronDown, ChevronRight } from 'lucide-react'

const NODE_COLORS = {
  router: { bg: '#7c3aed', border: '#6d28d9', text: '#ffffff', glow: 'rgba(124,58,237,0.3)' },
  network: { bg: '#0ea5e9', border: '#0284c7', text: '#ffffff', glow: 'rgba(14,165,233,0.3)' },
  neighbor: { bg: '#f59e0b', border: '#d97706', text: '#ffffff', glow: 'rgba(245,158,11,0.3)' },
  client_group: { bg: '#10b981', border: '#059669', text: '#ffffff', glow: 'rgba(16,185,129,0.3)' },
  gateway: { bg: '#ef4444', border: '#dc2626', text: '#ffffff', glow: 'rgba(239,68,68,0.3)' },
}

const ICONS = {
  router: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  network: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z',
  neighbor: 'M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z',
  client: 'M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z',
  gateway: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
}

function buildTopology(data) {
  if (!data) return { nodes: [], edges: [] }

  const nodes = []
  const edges = []

  const routerNode = {
    id: 'router-main',
    type: 'router',
    label: data.identity || 'Router',
    sublabel: data.host,
    detail: {
      board: data.resource?.board_name,
      version: data.resource?.version,
      cpu: data.resource?.cpu_load != null ? `${data.resource.cpu_load}%` : '-',
      uptime: data.resource?.uptime || '-',
    },
    x: 0, y: 0,
  }
  nodes.push(routerNode)

  const ifaceMap = {}
  ;(data.interfaces || []).forEach(iface => {
    ifaceMap[iface.name] = iface
  })

  const ipByIface = {}
  ;(data.ip_addresses || []).forEach(ip => {
    if (!ipByIface[ip.interface]) ipByIface[ip.interface] = []
    ipByIface[ip.interface].push(ip)
  })

  const arpByIface = {}
  ;(data.arp_table || []).forEach(a => {
    if (!arpByIface[a.interface]) arpByIface[a.interface] = []
    arpByIface[a.interface].push(a)
  })

  const dhcpByServer = {}
  ;(data.dhcp_leases || []).forEach(l => {
    const key = l.server || 'default'
    if (!dhcpByServer[key]) dhcpByServer[key] = []
    dhcpByServer[key].push(l)
  })

  const neighborByIface = {}
  ;(data.neighbors || []).forEach(n => {
    if (!neighborByIface[n.interface]) neighborByIface[n.interface] = []
    neighborByIface[n.interface].push(n)
  })

  const defaultGw = (data.routes || []).find(r => r.dst_address === '0.0.0.0/0' && r.active)
  if (defaultGw) {
    const gwNode = {
      id: 'gateway-default',
      type: 'gateway',
      label: 'Internet',
      sublabel: defaultGw.gateway,
      detail: { dst: '0.0.0.0/0', gateway: defaultGw.gateway, distance: defaultGw.distance },
      x: 0, y: 0,
    }
    nodes.push(gwNode)
    edges.push({ from: 'router-main', to: 'gateway-default', label: 'default route' })
  }

  const physicalIfaces = (data.interfaces || []).filter(i => {
    const t = i.type || ''
    return !i.disabled && (
      t === 'ether' || t === 'wlan' || t === 'bridge' || t === 'vlan' ||
      t === 'bonding' || t === 'lte'
    )
  })

  physicalIfaces.forEach((iface, idx) => {
    const ips = ipByIface[iface.name] || []
    if (ips.length === 0 && !neighborByIface[iface.name]) return

    const netId = `net-${iface.name}`
    const ipStr = ips.map(ip => ip.address).join(', ')
    const networkStr = ips.map(ip => ip.network).join(', ')

    nodes.push({
      id: netId,
      type: 'network',
      label: iface.name,
      sublabel: ipStr || iface.type,
      detail: {
        type: iface.type,
        mac: iface.mac_address,
        network: networkStr,
        ip: ipStr,
        running: iface.running ? 'Ya' : 'Tidak',
      },
      x: 0, y: 0,
    })
    edges.push({
      from: 'router-main',
      to: netId,
      label: iface.running ? '' : 'down',
      dashed: !iface.running,
    })

    const clients = arpByIface[iface.name] || []
    const dhcpClients = Object.values(dhcpByServer).flat().filter(l =>
      clients.some(c => c.address === l.address || c.mac_address === l.mac_address)
    )
    const activeClients = clients.filter(c => c.complete !== false)

    if (activeClients.length > 0) {
      const cgId = `cg-${iface.name}`
      nodes.push({
        id: cgId,
        type: 'client_group',
        label: `${activeClients.length} Client${activeClients.length > 1 ? 's' : ''}`,
        sublabel: iface.name,
        detail: {
          total_arp: activeClients.length,
          dhcp_leases: dhcpClients.length,
          clients: activeClients.slice(0, 20).map(c => {
            const lease = dhcpClients.find(l => l.mac_address === c.mac_address)
            return {
              ip: c.address,
              mac: c.mac_address,
              hostname: lease?.host_name || '-',
            }
          }),
        },
        x: 0, y: 0,
      })
      edges.push({ from: netId, to: cgId })
    }

    ;(neighborByIface[iface.name] || []).forEach((nb, ni) => {
      const nbId = `nb-${iface.name}-${ni}`
      nodes.push({
        id: nbId,
        type: 'neighbor',
        label: nb.identity || nb.address || 'Unknown',
        sublabel: nb.platform || nb.board || '',
        detail: {
          identity: nb.identity,
          address: nb.address || nb.address4,
          mac: nb.mac_address,
          platform: nb.platform,
          board: nb.board,
          version: nb.version,
          interface: nb.interface,
        },
        x: 0, y: 0,
      })
      edges.push({ from: netId, to: nbId })
    })
  })

  const pppCount = (data.ppp_active || []).length
  if (pppCount > 0) {
    const pppId = 'ppp-clients'
    nodes.push({
      id: pppId,
      type: 'client_group',
      label: `${pppCount} PPPoE`,
      sublabel: 'Active Sessions',
      detail: {
        total: pppCount,
        clients: data.ppp_active.slice(0, 20).map(p => ({
          name: p.name,
          ip: p.address,
          service: p.service,
          caller_id: p.caller_id,
        })),
      },
      x: 0, y: 0,
    })
    edges.push({ from: 'router-main', to: pppId, label: 'PPPoE' })
  }

  const hsCount = (data.hotspot_active || []).length
  if (hsCount > 0) {
    const hsId = 'hotspot-clients'
    nodes.push({
      id: hsId,
      type: 'client_group',
      label: `${hsCount} Hotspot`,
      sublabel: 'Active Sessions',
      detail: {
        total: hsCount,
        clients: data.hotspot_active.slice(0, 20).map(h => ({
          user: h.user,
          ip: h.address,
          mac: h.mac_address,
          server: h.server,
        })),
      },
      x: 0, y: 0,
    })
    edges.push({ from: 'router-main', to: hsId, label: 'Hotspot' })
  }

  layoutNodes(nodes, edges)

  return { nodes, edges }
}

function layoutNodes(nodes, edges) {
  if (nodes.length === 0) return

  const router = nodes.find(n => n.id === 'router-main')
  if (router) { router.x = 0; router.y = 0 }

  const children = {}
  edges.forEach(e => {
    if (!children[e.from]) children[e.from] = []
    children[e.from].push(e.to)
  })

  const level1 = children['router-main'] || []
  const l1Count = level1.length
  const baseRadius = Math.max(220, l1Count * 55)

  level1.forEach((id, i) => {
    const node = nodes.find(n => n.id === id)
    if (!node) return
    const angle = (2 * Math.PI * i) / l1Count - Math.PI / 2
    node.x = Math.cos(angle) * baseRadius
    node.y = Math.sin(angle) * baseRadius

    const l2 = children[id] || []
    const l2Radius = Math.max(140, l2.length * 45)
    const spreadAngle = Math.min(Math.PI * 0.6, (l2.length * 0.35))
    const startAngle = angle - spreadAngle / 2

    l2.forEach((cid, ci) => {
      const cnode = nodes.find(n => n.id === cid)
      if (!cnode) return
      const cAngle = l2.length === 1 ? angle : startAngle + (spreadAngle * ci) / Math.max(1, l2.length - 1)
      cnode.x = node.x + Math.cos(cAngle) * l2Radius
      cnode.y = node.y + Math.sin(cAngle) * l2Radius
    })
  })
}

function NodeShape({ node, selected, onSelect }) {
  const colors = NODE_COLORS[node.type] || NODE_COLORS.network
  const isRouter = node.type === 'router'
  const r = isRouter ? 40 : 30

  return (
    <g
      className="cursor-pointer"
      onClick={(e) => { e.stopPropagation(); onSelect(node) }}
      style={{ transition: 'transform 0.2s' }}
    >
      {selected && (
        <circle cx={node.x} cy={node.y} r={r + 8} fill="none"
          stroke={colors.border} strokeWidth={2} strokeDasharray="6 3" opacity={0.6}>
          <animateTransform attributeName="transform" type="rotate"
            from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`} dur="8s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={node.x} cy={node.y} r={r + 3} fill={colors.glow} opacity={0.5} />
      <circle cx={node.x} cy={node.y} r={r} fill={colors.bg} stroke={colors.border} strokeWidth={2.5} />
      <text x={node.x} y={node.y - r - 12} textAnchor="middle"
        className="text-[11px] font-semibold" fill="#334155">{node.label}</text>
      {node.sublabel && (
        <text x={node.x} y={node.y - r - 1} textAnchor="middle"
          className="text-[9px]" fill="#94a3b8">{node.sublabel}</text>
      )}
      <text x={node.x} y={node.y + 5} textAnchor="middle"
        className="text-[10px] font-bold" fill={colors.text}>
        {node.type === 'router' ? '⬡' : node.type === 'gateway' ? '☁' : node.type === 'neighbor' ? '⬢' : node.type === 'client_group' ? '⊞' : '◆'}
      </text>
    </g>
  )
}

function EdgeLine({ edge, nodes }) {
  const from = nodes.find(n => n.id === edge.from)
  const to = nodes.find(n => n.id === edge.to)
  if (!from || !to) return null

  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return null

  const fromR = from.type === 'router' ? 43 : 33
  const toR = to.type === 'router' ? 43 : 33

  const x1 = from.x + (dx / dist) * fromR
  const y1 = from.y + (dy / dist) * fromR
  const x2 = to.x - (dx / dist) * toR
  const y2 = to.y - (dy / dist) * toR

  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={edge.dashed ? '#f87171' : '#cbd5e1'}
        strokeWidth={1.5}
        strokeDasharray={edge.dashed ? '6 4' : 'none'}
        markerEnd="url(#arrowhead)"
      />
      {edge.label && (
        <text x={mx} y={my - 6} textAnchor="middle"
          className="text-[9px]" fill="#94a3b8">{edge.label}</text>
      )}
    </g>
  )
}

function DetailPanel({ node, onClose }) {
  if (!node) return null
  const colors = NODE_COLORS[node.type] || NODE_COLORS.network
  const [showClients, setShowClients] = useState(false)
  const detail = node.detail || {}

  return (
    <div className="absolute top-4 right-4 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-20 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: colors.bg }}>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <Info size={16} color="#fff" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{node.label}</div>
          {node.sublabel && <div className="text-xs text-white/70 truncate">{node.sublabel}</div>}
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <X size={18} />
        </button>
      </div>
      <div className="px-4 py-3 space-y-1.5 max-h-80 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
          {node.type === 'router' ? 'Router Info' : node.type === 'gateway' ? 'Gateway Info' : node.type === 'neighbor' ? 'Neighbor Info' : node.type === 'client_group' ? 'Client Group' : 'Network Info'}
        </div>
        {Object.entries(detail).filter(([k]) => k !== 'clients').map(([k, v]) => (
          <div key={k} className="flex justify-between items-center py-1 border-b border-slate-50">
            <span className="text-xs text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span>
            <span className="text-xs font-medium text-slate-700">{String(v ?? '-')}</span>
          </div>
        ))}
        {detail.clients && detail.clients.length > 0 && (
          <div className="pt-1">
            <button onClick={() => setShowClients(!showClients)}
              className="flex items-center gap-1 text-xs text-brand-purple font-medium hover:underline">
              {showClients ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {detail.clients.length} client(s)
            </button>
            {showClients && (
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                {detail.clients.map((c, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-2 text-[11px]">
                    {Object.entries(c).map(([ck, cv]) => (
                      <div key={ck} className="flex justify-between">
                        <span className="text-slate-400 capitalize">{ck}</span>
                        <span className="text-slate-600 font-mono">{cv || '-'}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Legend() {
  const items = [
    { type: 'router', label: 'Router' },
    { type: 'gateway', label: 'Internet/Gateway' },
    { type: 'network', label: 'Network/Interface' },
    { type: 'neighbor', label: 'Neighbor Device' },
    { type: 'client_group', label: 'Clients' },
  ]
  return (
    <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-slate-200 px-3 py-2 z-10">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1.5">Legend</div>
      <div className="space-y-1">
        {items.map(({ type, label }) => (
          <div key={type} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[type].bg }} />
            <span className="text-[11px] text-slate-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatsBar({ data }) {
  if (!data) return null
  const items = [
    { label: 'Interfaces', value: data.interfaces?.length || 0 },
    { label: 'IP Address', value: data.ip_addresses?.length || 0 },
    { label: 'ARP Entry', value: data.arp_table?.length || 0 },
    { label: 'Neighbors', value: data.neighbors?.length || 0 },
    { label: 'DHCP Lease', value: data.dhcp_leases?.length || 0 },
    { label: 'PPPoE', value: data.ppp_active?.length || 0 },
    { label: 'Hotspot', value: data.hotspot_active?.length || 0 },
    { label: 'Routes', value: data.routes?.length || 0 },
  ]
  return (
    <div className="bg-white rounded-2xl shadow-card mb-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-slate-100">
      {items.map(({ label, value }) => (
        <div key={label} className="px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
          <div className="mt-1 font-semibold text-slate-800">{value}</div>
        </div>
      ))}
    </div>
  )
}

export default function NetworkTopology() {
  const { activeRouterId } = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  const svgRef = useRef(null)
  const [viewBox, setViewBox] = useState({ x: -500, y: -400, w: 1000, h: 800 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, vx: 0, vy: 0 })

  const loadData = useCallback(async () => {
    if (!activeRouterId) return
    setLoading(true)
    setError(null)
    try {
      const res = await getTopology()
      setData(res)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }, [activeRouterId])

  useEffect(() => {
    setData(null)
    setSelected(null)
    loadData()
  }, [activeRouterId, loadData])

  const { nodes, edges } = buildTopology(data)

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const scale = e.deltaY > 0 ? 1.1 : 0.9
    setViewBox(prev => {
      const cx = prev.x + prev.w / 2
      const cy = prev.y + prev.h / 2
      const nw = prev.w * scale
      const nh = prev.h * scale
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh }
    })
  }, [])

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    setIsPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y })
  }, [viewBox])

  const handleMouseMove = useCallback((e) => {
    if (!isPanning) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const scaleX = viewBox.w / rect.width
    const scaleY = viewBox.h / rect.height
    const dx = (e.clientX - panStart.x) * scaleX
    const dy = (e.clientY - panStart.y) * scaleY
    setViewBox(prev => ({ ...prev, x: panStart.vx - dx, y: panStart.vy - dy }))
  }, [isPanning, panStart, viewBox.w, viewBox.h])

  const handleMouseUp = useCallback(() => setIsPanning(false), [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const zoom = (factor) => {
    setViewBox(prev => {
      const cx = prev.x + prev.w / 2
      const cy = prev.y + prev.h / 2
      const nw = prev.w * factor
      const nh = prev.h * factor
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh }
    })
  }

  const fitView = () => {
    if (nodes.length === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    nodes.forEach(n => {
      minX = Math.min(minX, n.x - 60)
      minY = Math.min(minY, n.y - 60)
      maxX = Math.max(maxX, n.x + 60)
      maxY = Math.max(maxY, n.y + 60)
    })
    const pad = 80
    setViewBox({ x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 })
  }

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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Network Topology</h1>
          <p className="text-slate-500 text-sm">Visualisasi topologi jaringan · Interface · Neighbor · Client</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-lg text-sm font-medium hover:bg-brand-purple/90 transition disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <StatsBar data={data} />

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-4 text-sm text-rose-600">{error}</div>
      )}

      <div className="bg-white rounded-2xl shadow-card relative overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
        {loading && !data && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-30">
            <div className="flex items-center gap-3 text-slate-500">
              <RefreshCw size={20} className="animate-spin" />
              <span className="text-sm">Memuat data topologi...</span>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          className="w-full h-full select-none"
          style={{ cursor: isPanning ? 'grabbing' : 'grab', background: 'radial-gradient(circle at center, #f8fafc 0%, #f1f5f9 100%)' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => setSelected(null)}
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#cbd5e1" />
            </marker>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>

          <rect x={viewBox.x - 2000} y={viewBox.y - 2000}
            width={viewBox.w + 4000} height={viewBox.h + 4000} fill="url(#grid)" />

          {edges.map((e, i) => (
            <EdgeLine key={i} edge={e} nodes={nodes} />
          ))}
          {nodes.map(n => (
            <NodeShape key={n.id} node={n} selected={selected?.id === n.id} onSelect={setSelected} />
          ))}
        </svg>

        <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
          <button onClick={() => zoom(0.8)} className="w-8 h-8 bg-white rounded-lg shadow border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition">
            <ZoomIn size={16} className="text-slate-600" />
          </button>
          <button onClick={() => zoom(1.25)} className="w-8 h-8 bg-white rounded-lg shadow border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition">
            <ZoomOut size={16} className="text-slate-600" />
          </button>
          <button onClick={fitView} className="w-8 h-8 bg-white rounded-lg shadow border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition">
            <Maximize2 size={16} className="text-slate-600" />
          </button>
        </div>

        <Legend />

        <DetailPanel node={selected} onClose={() => setSelected(null)} />
      </div>
    </div>
  )
}
