import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { loginApi, getMe } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    getMe(token)
      .then((u) => setUser(u))
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [token, logout])

  const login = async (username, password) => {
    const data = await loginApi(username, password)
    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
    setUser({ username: data.username })
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
