const TOKEN_KEY = 'token'
const USER_KEY = 'user'
const TOKEN_EXPIRES_AT_KEY = 'token_expires_at'
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// 统一清理，确保退出或超期后端到未登录状态
export const clearAuthStorage = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}

const parseUser = (value) => {
  try {
    return value ? JSON.parse(value) : null
  } catch (error) {
    // 存储数据异常时退回未登录状态，避免 JSON 解析阻断初始化
    clearAuthStorage()
    return null
  }
}

// 读取登录信息并处理超期逻辑，保证初始化时的凭证状态可信
export const loadStoredAuth = () => {
  const now = Date.now()
  const token = localStorage.getItem(TOKEN_KEY)
  const expiresAt = localStorage.getItem(TOKEN_EXPIRES_AT_KEY)
  if (token && expiresAt) {
    const expireTime = Number(expiresAt)
    if (expireTime > now) {
      return { token, user: parseUser(localStorage.getItem(USER_KEY)) }
    }
    // 超期后清除存档，避免无效 token 干扰请求
    clearAuthStorage()
  }

  const sessionToken = sessionStorage.getItem(TOKEN_KEY)
  if (sessionToken) {
    return { token: sessionToken, user: parseUser(sessionStorage.getItem(USER_KEY)) }
  }

  return { token: '', user: null }
}

// 持久化登录状态：可选 30 天自动登录，否则仅在当前会话保留
export const persistAuth = ({ token, user, remember }) => {
  if (remember) {
    const expiresAt = Date.now() + THIRTY_DAYS_MS
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(expiresAt))
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    return
  }

  // 不记住登录时仅存储到 sessionStorage，关闭页面即失效
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
}

// 提供请求拦截器获取的最新有效 token
export const getRequestToken = () => {
  const { token } = loadStoredAuth()
  return token
}
