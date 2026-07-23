import axios from 'axios'

const _host = import.meta.env.VITE_API_HOST || window.location.hostname
const _port = window.location.port
const _proto = window.location.protocol
const _wsProto = _proto === 'https:' ? 'wss:' : 'ws:'

const isProd = import.meta.env.PROD || _port === '' || _port === '80' || _port === '443'

const API_BASE = import.meta.env.VITE_API_BASE || (isProd ? '' : `http://${_host}:8000`)
export const WS_BASE = import.meta.env.VITE_WS_BASE || (isProd ? `${_wsProto}//${window.location.host}` : `ws://${_host}:8000`)

const http = axios.create({ baseURL: API_BASE, timeout: 10000 })

// Attach JWT token and router_id to every request
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  const routerId = localStorage.getItem('activeRouterId')
  if (routerId) config.headers['X-Router-Id'] = routerId
  return config
})

// Auto-logout on 401
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

// Auth
export const loginApi = (username, password) => {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  return http.post('/api/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).then(r => r.data)
}
export const registerApi = (username, password) =>
  http.post('/api/auth/register', { username, password }).then(r => r.data)
export const changePasswordApi = (currentPassword, newPassword) =>
  http.put('/api/auth/password', { current_password: currentPassword, new_password: newPassword }).then(r => r.data)
export const getMe = (token) =>
  http.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.data)

// Helper: get current token for WS
export const getToken = () => localStorage.getItem('token') || ''

// Helper: get active router id for WS
export const getActiveRouterId = () => localStorage.getItem('activeRouterId') || ''

// Router CRUD
export const listRouters = () => http.get('/api/routers').then(r => r.data)
export const addRouter = (data) => http.post('/api/routers', data).then(r => r.data)
export const getRouter = (id) => http.get(`/api/routers/${id}`).then(r => r.data)
export const updateRouter = (id, data) => http.put(`/api/routers/${id}`, data).then(r => r.data)
export const deleteRouter = (id) => http.delete(`/api/routers/${id}`).then(r => r.data)
export const testRouterConnection = (id) => http.post(`/api/routers/${id}/test`).then(r => r.data)

// Monitoring endpoints
export const getSystemResource = () => http.get('/api/system/resource').then(r => r.data)
export const getInterfaces = () => http.get('/api/interfaces').then(r => r.data)
export const getPppStats = () => http.get('/api/ppp/stats').then(r => r.data)
export const getHotspotStats = () => http.get('/api/hotspot/stats').then(r => r.data)
export const getInterfacesSummary = () => http.get('/api/interfaces/summary').then(r => r.data)
export const getPppActive = () => http.get('/api/ppp/active').then(r => r.data)
export const getPppSecrets = () => http.get('/api/ppp/secrets').then(r => r.data)
export const getHotspotActive = () => http.get('/api/hotspot/active').then(r => r.data)
export const getHotspotUsers = () => http.get('/api/hotspot/users').then(r => r.data)

// Legacy config (still used by old ConfigPage)
export const getConfig = () => http.get('/api/config').then(r => r.data)
export const updateConfig = (data) => http.put('/api/config', data).then(r => r.data)
export const testConnection = () => http.post('/api/config/test').then(r => r.data)
