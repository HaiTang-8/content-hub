import axios from 'axios'
import { clearAuthStorage, getRequestToken } from '../utils/authStorage'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
})

api.interceptors.request.use((config) => {
  // 通过统一入口获取当前有效 token，保证 30 天自动登录与会话态都能透传
  const token = getRequestToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.error

    // 当后端返回 invalid token 时，视为鉴权失效：清理本地凭证并跳转登录页，附带原路径便于登录后返回
    if (status === 401 && typeof message === 'string' && message.toLowerCase().includes('invalid token')) {
      clearAuthStorage()
      const current = `${window.location.pathname}${window.location.search}` || '/'
      if (!current.startsWith('/login')) {
        window.location.replace(`/login?redirect=${encodeURIComponent(current)}`)
      }
    }

    return Promise.reject(error)
  }
)

export default api
