import { create } from 'zustand'
import api from '../api/client'
import { clearAuthStorage, loadStoredAuth, persistAuth } from '../utils/authStorage'

// 初始化时读取有效的登录凭证，避免组件层重复处理过期逻辑
const initialAuth = loadStoredAuth()

export const useAuthStore = create((set) => ({
  token: initialAuth.token,
  user: initialAuth.user,
  isAuthenticated: !!initialAuth.token,
  setAuth: ({ token, user, remember }) => {
    // 根据“自动登录”选项选择存储介质，记住时保存 30 天，否则仅在当前会话保留
    persistAuth({ token, user, remember })
    set({ token, user, isAuthenticated: true })
  },
  logout: () => {
    clearAuthStorage()
    set({ token: '', user: null, isAuthenticated: false })
  },
}))

export const login = async (username, password, remember = false) => {
  const { data } = await api.post('/login', { username, password })
  useAuthStore.getState().setAuth({ token: data.token, user: data.user, remember })
  return data
}
