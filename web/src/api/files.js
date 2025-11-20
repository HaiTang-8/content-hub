import api from './client'

export const fetchFiles = () => api.get('/files')
export const uploadFile = (formData) => api.post('/files', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const shareFile = (id) => api.post(`/files/${id}/share`)
export const deleteFile = (id) => api.delete(`/files/${id}`)
// 预览流式获取文件内容，确保携带鉴权头；responseType 留给调用方按需覆写
export const streamFile = (id, options = {}) => api.get(`/files/${id}/stream`, { responseType: 'blob', ...options })
