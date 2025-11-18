import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { createUser } from '../api/files'
import { toast } from 'sonner'

const UserManagement = () => {
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })
  const [creating, setCreating] = useState(false)

  const onCreateUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      const { data } = await createUser(newUser)
      // 成功消息通过 toast 告知，兼顾桌面与移动设备
      toast.success('已创建用户', { description: `${data.username}（${data.role}）` })
      setNewUser({ username: '', password: '', role: 'user' })
    } catch (err) {
      toast.error(err.response?.data?.error || err.message, { description: '创建用户失败' })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>用户管理</CardTitle>
          <CardDescription>仅管理员可见，创建新的普通用户或管理员</CardDescription>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UserPlus className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-4" onSubmit={onCreateUser}>
          <Input
            placeholder="用户名"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            required
          />
          <Input
            placeholder="密码"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            required
          />
          <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
            <SelectTrigger>
              <SelectValue placeholder="选择角色" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">普通用户</SelectItem>
              <SelectItem value="admin">管理员</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={creating}>
            {creating ? '创建中...' : '创建用户'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default UserManagement
