import axios from 'axios'
import { getRequestToken } from '../utils/authStorage'

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

export default api
