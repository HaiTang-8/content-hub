import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { login } from '../store/auth'
import { toast } from 'sonner'

const Login = () => {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(username, password)
      // 登录结果用 toast 呈现，避免在移动端撑开布局
      toast.success('登录成功')
      navigate('/')
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
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" required />
            </div>
            <div className="space-y-2">
              <Label>密码</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="******" required />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
            <p className="text-xs text-slate-500">默认管理员 admin / admin123（可在后端环境变量覆盖）</p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Login
