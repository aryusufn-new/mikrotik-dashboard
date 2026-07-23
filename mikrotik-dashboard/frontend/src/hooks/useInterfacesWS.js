import { useEffect, useRef, useState, useCallback } from 'react'
import { WS_BASE, getToken, getActiveRouterId } from '../api'

const MAX_POINTS = 60
const RECONNECT_DELAY = 3000

export default function useInterfacesWS(routerId) {
  const [interfaces, setInterfaces] = useState([])
  const [totals, setTotals] = useState({ rx_bps: 0, tx_bps: 0, running: 0, down: 0 })
  const [points, setPoints] = useState([])
  const [error, setError] = useState(null)
  const wsRef = useRef(null)
  const timerRef = useRef(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    try { wsRef.current?.close() } catch {}

    const rid = routerId || getActiveRouterId()
    let url = `${WS_BASE}/ws/interfaces-traffic?token=${encodeURIComponent(getToken())}`
    if (rid) url += `&router_id=${encodeURIComponent(rid)}`
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
        setInterfaces(msg.interfaces || [])
        setTotals(msg.totals || { rx_bps: 0, tx_bps: 0, running: 0, down: 0 })
        if (!msg.first) {
          const point = {
            t: new Date(msg.ts).toLocaleTimeString('id-ID', { hour12: false }),
            rx: msg.totals?.rx_bps || 0,
            tx: msg.totals?.tx_bps || 0,
          }
          setPoints((p) => {
            const next = [...p, point]
            return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next
          })
        }
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
  }, [routerId])

  useEffect(() => {
    mountedRef.current = true
    setInterfaces([])
    setPoints([])
    setError(null)
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(timerRef.current)
      try { wsRef.current?.close() } catch {}
    }
  }, [connect])

  return { interfaces, totals, points, error }
}
