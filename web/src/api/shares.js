import api from './client'

// 获取分享预览元信息，后端会做权限校验
export const getShareMeta = (token) => api.get(`/shares/${token}`)

// 以内联方式获取分享文件内容，用于预览展示；保留 responseType 以便按需渲染
export const streamShare = (token, options = {}) =>
  api.get(`/shares/${token}/stream`, { responseType: 'blob', ...options })

