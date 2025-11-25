import api from './client'

// 获取分享预览元信息，后端会做权限校验
export const getShareMeta = (token) => api.get(`/shares/${token}`)

// 以内联方式获取分享文件内容，用于预览展示；保留 responseType 以便按需渲染
export const streamShare = (token, options = {}) =>
  api.get(`/shares/${token}/stream`, { responseType: 'blob', ...options })

// 以附件形式下载分享文件，后端会计入同一套浏览/下载次数限制
export const downloadShare = (token, options = {}) =>
  api.get(`/shares/${token}/download`, { responseType: 'blob', ...options })

// 管理端：列出所有分享（仅管理员可调用）
export const listShares = () => api.get('/admin/shares')

// 管理端：撤销某个分享
export const revokeShare = (token) => api.delete(`/admin/shares/${token}`)

// 管理端：批量清理分享（过期 / 文件缺失 / 次数耗尽）
export const cleanShares = (payload) => api.post('/admin/shares/cleanup', payload)
