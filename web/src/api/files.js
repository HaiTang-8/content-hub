import api from './client'

export const fetchFiles = () => api.get('/files')
export const uploadFile = (formData) => api.post('/files', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
// 创建分享链接，payload 允许配置登录要求、指定用户、次数与有效期
export const shareFile = (id, payload = {}) => api.post(`/files/${id}/share`, payload)
export const deleteFile = (id) => api.delete(`/files/${id}`)
// 预览流式获取文件内容，确保携带鉴权头；responseType 留给调用方按需覆写
export const streamFile = (id, options = {}) => api.get(`/files/${id}/stream`, { responseType: 'blob', ...options })
