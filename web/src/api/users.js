import api from './client'

export const fetchUsers = () => api.get('/admin/users')
export const createUser = (payload) => api.post('/admin/users', payload)
export const deleteUser = (id) => api.delete(`/admin/users/${id}`)
export const resetUserPassword = (id, password) => api.post(`/admin/users/${id}/reset-password`, password ? { password } : {})
export const updateUserRole = (id, role) => api.patch(`/admin/users/${id}/role`, { role })
