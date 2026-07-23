import { useEffect, useRef, useState, useCallback } from 'react'
import { WS_BASE, getToken, getActiveRouterId } from '../api'

const MAX_POINTS = 30
const RECONNECT_DELAY = 3000

/**
 * Hook: stream per-user PPPoE traffic from /ws/ppp-traffic.
 *
 * Returns:
 *   trafficMap  – { [username]: { rx_bps, tx_bps, interface, address, uptime, caller_id } }
 *   history     – { [username]: Array<{ t, rx, tx }> }  (last MAX_POINTS samples)
 *   error       – string | null
 */
export default function usePppoeTrafficWS() {
  const [trafficMap, setTrafficMap]   = useState({})
  const [history, setHistory]         = useState({})
  const [error, setError]             = useState(null)

  const wsRef       = useRef(null)
  const timerRef    = useRef(null)
  const mountedRef  = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    try { wsRef.current?.close() } catch {}

    const routerId = getActiveRouterId()
    let url = `${WS_BASE}/ws/ppp-traffic?token=${encodeURIComponent(getToken())}`
    if (routerId) url += `&router_id=${encodeURIComponent(routerId)}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (mountedRef.current) setError(null)
    }

    ws.onmessage = (ev) => {
      if (!mountedRef.current) return
      try {
        const msg = JSON.parse(ev.data)
        if (msg.error) { setError(msg.error); return }
        setError(null)

        const users = msg.users || {}
        const t = new Date(msg.ts).toLocaleTimeString('id-ID', { hour12: false })

        setTrafficMap(users)
        setHistory((prev) => {
          const next = { ...prev }
          for (const [name, d] of Object.entries(users)) {
            const point = { t, rx: d.rx_bps || 0, tx: d.tx_bps || 0 }
            const arr   = prev[name] ? [...prev[name], point] : [point]
            next[name]  = arr.length > MAX_POINTS ? arr.slice(arr.length - MAX_POINTS) : arr
          }
          return next
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
    setTrafficMap({})
    setHistory({})
    setError(null)
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(timerRef.current)
      try { wsRef.current?.close() } catch {}
    }
  }, [connect])

  return { trafficMap, history, error }
}
