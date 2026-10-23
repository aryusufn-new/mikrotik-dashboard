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
export const getTopology = () => http.get('/api/topology').then(r => r.data)

// Legacy config (still used by old ConfigPage)
export const getConfig = () => http.get('/api/config').then(r => r.data)
export const updateConfig = (data) => http.put('/api/config', data).then(r => r.data)
export const testConnection = () => http.post('/api/config/test').then(r => r.data)

// Admin
export const getAuditLogs = () => http.get('/api/admin/logs').then(r => r.data)
export const getAdminUsers = () => http.get('/api/admin/users').then(r => r.data)

// NOC Monitoring
export const getNocOverview = () => http.get('/api/noc/overview').then(r => r.data)
export const getNocHealth = () => http.get('/api/noc/health').then(r => r.data)
export const getNocCpuCores = () => http.get('/api/noc/cpu-cores').then(r => r.data)
export const getNocPorts = () => http.get('/api/noc/ports').then(r => r.data)
export const getNocTopDomains = (limit = 5) => http.get(`/api/noc/top-domains?limit=${limit}`).then(r => r.data)
export const getNocTopTalkers = (limit = 5) => http.get(`/api/noc/top-talkers?limit=${limit}`).then(r => r.data)
export const getNocPing = (host = '8.8.8.8') => http.get(`/api/noc/ping?host=${encodeURIComponent(host)}`).then(r => r.data)
export const getNocIncidentLogs = (limit = 20) => http.get(`/api/noc/incident-logs?limit=${limit}`).then(r => r.data)
export const getNocMultiPing = () => http.get('/api/noc/multi-ping').then(r => r.data)
export const getNocDhcpConntrack = () => http.get('/api/noc/dhcp-conntrack').then(r => r.data)

// OLT & FTTH Customer Monitoring
export const getOlts = () => http.get('/api/olts').then(r => r.data)
export const addOlt = (data) => http.post('/api/olts', data).then(r => r.data)
export const getOlt = (id) => http.get(`/api/olts/${id}`).then(r => r.data)
export const updateOlt = (id, data) => http.put(`/api/olts/${id}`, data).then(r => r.data)
export const deleteOlt = (id) => http.delete(`/api/olts/${id}`).then(r => r.data)
export const testOltConnection = (id) => http.post(`/api/olts/${id}/test`).then(r => r.data)
export const scanOltOnus = (id) => http.get(`/api/olts/${id}/scan`, { timeout: 60000 }).then(r => r.data)

export const getCustomers = (params = {}) => {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.olt_id) query.set('olt_id', params.olt_id)
  const qs = query.toString()
  return http.get(`/api/customers${qs ? `?${qs}` : ''}`).then(r => r.data)
}
export const getCustomerStats = () => http.get('/api/customers/stats').then(r => r.data)
export const getCustomer = (id) => http.get(`/api/customers/${id}`).then(r => r.data)
export const addCustomer = (data) => http.post('/api/customers', data).then(r => r.data)
export const updateCustomer = (id, data) => http.put(`/api/customers/${id}`, data).then(r => r.data)
export const deleteCustomer = (id) => http.delete(`/api/customers/${id}`).then(r => r.data)
export const checkCustomerOptical = (id) => http.post(`/api/customers/${id}/optical`).then(r => r.data)
export const checkAllOptical = (olt_id = null) => http.post(`/api/customers/check-optical-all${olt_id ? `?olt_id=${olt_id}` : ''}`).then(r => r.data)
export const syncPppoe = () => http.post('/api/customers/sync-pppoe').then(r => r.data)
export const autoScanCustomers = (olt_id = null, payload = null, router_id = null) => {
  const params = new URLSearchParams()
  if (olt_id) params.append('olt_id', olt_id)
  const rid = router_id || localStorage.getItem('activeRouterId')
  if (rid) params.append('router_id', rid)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return http.post(`/api/customers/auto-scan${qs}`, payload || {}, { timeout: 60000 }).then(r => r.data)
}
export const getSyncPreview = (olt_id = null, router_id = null) => {
  const params = new URLSearchParams()
  if (olt_id) params.append('olt_id', olt_id)
  const rid = router_id || localStorage.getItem('activeRouterId')
  if (rid) params.append('router_id', rid)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return http.post(`/api/customers/auto-scan${qs}`, { preview: true, sync_only: true }, { timeout: 60000 }).then(r => r.data)
}
export const applySyncBindings = (bindings) => http.post('/api/customers/sync-apply', { bindings }).then(r => r.data)
export const importAllPppoe = () => http.post('/api/customers/import-all-pppoe').then(r => r.data)





