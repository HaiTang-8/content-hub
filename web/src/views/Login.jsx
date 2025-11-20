import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { login } from '../store/auth'
import { toast } from 'sonner'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  // 默认勾选 30 天自动登录，减少频繁输入凭证
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const redirect = new URLSearchParams(location.search).get('redirect')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      // remember = true 时会触发 30 天自动登录持久化
      await login(username, password, remember)
      // 登录结果用 toast 呈现，避免在移动端撑开布局
      toast.success('登录成功')
      // 登录后优先回跳到 redirect，方便从分享预览等受限页面返回
      navigate(redirect || '/')
    } catch (err) {
      toast.error(err.response?.data?.error || err.message, { description: '请检查用户名或密码' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white font-semibold">CH</div>
          <CardTitle>内容空间登录</CardTitle>
          <CardDescription>请使用管理员或普通用户账号登录</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 开启表单自动填充，便于浏览器密码管理器识别并提示保存 */}
          <form className="space-y-4" onSubmit={submit} autoComplete="on">
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>密码</Label>
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
              />
            </div>
            {/* 自动登录选项：移动端单列，桌面分栏，保持易点击面积 */}
            <div className="space-y-2">
              <Label>自动登录</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition hover:border-primary/80 ${
                  !remember ? 'border-primary/80 ring-2 ring-primary/10' : 'border-slate-200'
                }`}>
                  <input
                    type="radio"
                    name="auto-login"
                    value="session"
                    checked={!remember}
                    onChange={() => setRemember(false)}
                    className="mt-1 h-4 w-4 text-primary focus:ring-primary"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-800">仅本次会话</p>
                    <p className="text-xs text-slate-500 leading-relaxed">适用于公共设备，关闭页面后自动退出。</p>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition hover:border-primary/80 ${
                  remember ? 'border-primary/80 ring-2 ring-primary/10' : 'border-slate-200'
                }`}>
                  <input
                    type="radio"
                    name="auto-login"
                    value="30days"
                    checked={remember}
                    onChange={() => setRemember(true)}
                    className="mt-1 h-4 w-4 text-primary focus:ring-primary"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-800">30 天内自动登录</p>
                    <p className="text-xs text-slate-500 leading-relaxed">保存登录凭证 30 天，减少频繁登录操作。</p>
                  </div>
                </label>
              </div>
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Login
