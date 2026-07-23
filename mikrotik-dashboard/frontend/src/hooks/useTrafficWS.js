import { useEffect, useRef, useState, useCallback } from 'react'
import { WS_BASE, getToken, getActiveRouterId } from '../api'

const MAX_POINTS = 30
const RECONNECT_DELAY = 3000

export default function useTrafficWS(iface) {
  const [points, setPoints] = useState([])
  const [last, setLast] = useState({ tx_bps: 0, rx_bps: 0 })
  const [error, setError] = useState(null)
  const wsRef = useRef(null)
  const timerRef = useRef(null)
  const mountedRef = useRef(true)
  const ifaceRef = useRef(iface)
  ifaceRef.current = iface

  const connect = useCallback(() => {
    const name = ifaceRef.current
    if (!mountedRef.current || !name) return
    try { wsRef.current?.close() } catch {}

    const routerId = getActiveRouterId()
    let url = `${WS_BASE}/ws/traffic?iface=${encodeURIComponent(name)}&token=${encodeURIComponent(getToken())}`
    if (routerId) url += `&router_id=${encodeURIComponent(routerId)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (mountedRef.current) setError(null)
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.error) { setError(msg.error); return }
        setError(null)
        const point = {
          t: new Date(msg.ts).toLocaleTimeString('id-ID', { hour12: false }),
          tx: msg.tx_bps || 0,
          rx: msg.rx_bps || 0,
        }
        setLast({ tx_bps: point.tx, rx_bps: point.rx })
        setPoints((p) => {
          const next = [...p, point]
          return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next
        })
      } catch (e) {
        setError(String(e))
      }
    }

    ws.onerror = () => {
      if (mountedRef.current) setError('WebSocket terputus, reconnecting…')
    }

    ws.onclose = () => {
      if (mountedRef.current) {
        timerRef.current = setTimeout(connect, RECONNECT_DELAY)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (iface) {
      setPoints([])
      setError(null)
      connect()
    }
    return () => {
      mountedRef.current = false
      clearTimeout(timerRef.current)
      try { wsRef.current?.close() } catch {}
    }
  }, [iface, connect])

  return { points, last, error }
}
