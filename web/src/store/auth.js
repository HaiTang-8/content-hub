import { create } from 'zustand'
import api from '../api/client'

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('token') || '',
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isAuthenticated: !!localStorage.getItem('token'),
  setAuth: ({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, user, isAuthenticated: true })
  },
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ token: '', user: null, isAuthenticated: false })
  },
}))

export const login = async (username, password) => {
  const { data } = await api.post('/login', { username, password })
  useAuthStore.getState().setAuth({ token: data.token, user: data.user })
  return data
}
