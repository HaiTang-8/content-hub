import api from './client'

export const fetchFiles = () => api.get('/files')

// 允许透传 onUploadProgress 以便前端展示实时上传进度；默认保持 multipart 提交头
export const uploadFile = (formData, onUploadProgress) =>
  api.post('/files', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })
// 创建分享链接，payload 允许配置登录要求、指定用户、次数与有效期
export const shareFile = (id, payload = {}) => api.post(`/files/${id}/share`, payload)
export const deleteFile = (id) => api.delete(`/files/${id}`)
// 预览流式获取文件内容，确保携带鉴权头；responseType 留给调用方按需覆写
export const streamFile = (id, options = {}) => api.get(`/files/${id}/stream`, { responseType: 'blob', ...options })
// 以附件形式下载文件，统一透传鉴权头，避免新窗口缺失 Authorization 导致 401
export const downloadFile = (id, options = {}) => api.get(`/files/${id}/download`, { responseType: 'blob', ...options })
