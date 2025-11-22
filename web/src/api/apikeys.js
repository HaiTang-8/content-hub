import api from './client'

// 获取 API Key 列表，后台用于管理和审计
export const listApiKeys = () => api.get('/admin/apikeys')

// 创建新的 API Key，返回仅本次展示的明文 key
export const createApiKey = (payload) => api.post('/admin/apikeys', payload)

// 撤销已有的 API Key，软删除保留记录
export const revokeApiKey = (id) => api.delete(`/admin/apikeys/${id}`)

