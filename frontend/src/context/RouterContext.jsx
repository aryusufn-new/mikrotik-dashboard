import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { listRouters } from '../api'

const RouterContext = createContext(null)

export function RouterProvider({ children }) {
  const [routers, setRouters] = useState([])
  const [activeRouterId, setActiveRouterIdState] = useState(() => {
    const stored = localStorage.getItem('activeRouterId')
    return stored ? Number(stored) : null
  })
  const [loading, setLoading] = useState(true)

  const setActiveRouterId = useCallback((id) => {
    const numId = id ? Number(id) : null
    setActiveRouterIdState(numId)
    if (numId) {
      localStorage.setItem('activeRouterId', String(numId))
    } else {
      localStorage.removeItem('activeRouterId')
    }
  }, [])

  const refreshRouters = useCallback(async () => {
    try {
      const list = await listRouters()
      setRouters(list)

      // If no active router or active router not in list, select first
      if (list.length > 0) {
        const currentValid = list.some((r) => r.id === activeRouterId)
        if (!currentValid) {
          setActiveRouterId(list[0].id)
        }
      } else {
        setActiveRouterId(null)
      }
    } catch {
      // Not logged in or error
    } finally {
      setLoading(false)
    }
  }, [activeRouterId, setActiveRouterId])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      refreshRouters()
    } else {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeRouter = routers.find((r) => r.id === activeRouterId) || null

  return (
    <RouterContext.Provider
      value={{
        routers,
        activeRouterId,
        activeRouter,
        setActiveRouterId,
        refreshRouters,
        loading,
      }}
    >
      {children}
    </RouterContext.Provider>
  )
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be inside RouterProvider')
  return ctx
}
