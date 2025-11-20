import { useEffect, useMemo, useState } from 'react'
import { KeyRound, Loader2, Plus, RefreshCw, Trash2, UserPlus, X, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { createUser, deleteUser, fetchUsers, resetUserPassword, updateUserRole } from '../api/users'

const UserManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })
  const [creating, setCreating] = useState(false)
  const [workingUserId, setWorkingUserId] = useState(null)
  const [roleUpdatingId, setRoleUpdatingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [customPassword, setCustomPassword] = useState('')

  // 统一加载用户列表，供新增/删除/更新后复用刷新逻辑。
  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data } = await fetchUsers()
      setUsers(data)
    } catch (err) {
      toast.error(err.response?.data?.error || '获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    if (!keyword.trim()) return users
    return users.filter((u) => u.username.toLowerCase().includes(keyword.trim().toLowerCase()))
  }, [keyword, users])

  const onCreateUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      const { data } = await createUser(newUser)
      toast.success('已创建用户', { description: `${data.username}（${data.role}）` })
      setNewUser({ username: '', password: '', role: 'user' })
      setShowCreatePanel(false)
      loadUsers()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message, { description: '创建用户失败' })
    } finally {
      setCreating(false)
    }
  }

  const onDeleteUser = async () => {
    if (!deleteTarget) return
    setWorkingUserId(deleteTarget.id)
    try {
      await deleteUser(deleteTarget.id)
      toast.success('用户已删除', { description: `${deleteTarget.username}（${deleteTarget.role}）` })
      loadUsers()
    } catch (err) {
      toast.error(err.response?.data?.error || '删除用户失败')
    } finally {
      setWorkingUserId(null)
      setDeleteTarget(null)
    }
  }

  const onResetPassword = async () => {
    if (!resetTarget) return
    setWorkingUserId(resetTarget.id)
    try {
      const { data } = await resetUserPassword(resetTarget.id, customPassword.trim() || undefined)
      toast.success('已重置密码', { description: `${resetTarget.username} 新密码：${data.password}` })
      if (navigator?.clipboard) {
        navigator.clipboard.writeText(data.password).catch(() => {})
      }
      setCustomPassword('')
      setResetTarget(null)
    } catch (err) {
      toast.error(err.response?.data?.error || '重置密码失败')
    } finally {
      setWorkingUserId(null)
    }
  }

  const onUpdateRole = async (userId, role) => {
    setRoleUpdatingId(userId)
    try {
      await updateUserRole(userId, role)
      toast.success('角色已更新')
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
    } catch (err) {
      toast.error(err.response?.data?.error || '更新角色失败')
      loadUsers()
    } finally {
      setRoleUpdatingId(null)
    }
  }

  const formatDate = (value) => new Date(value).toLocaleString('zh-CN', { hour12: false })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>用户管理</CardTitle>
            <CardDescription>浏览用户列表，快速重置密码、调整角色或删除账号</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <Input
              placeholder="搜索用户名"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full md:w-64"
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
                <RefreshCw className="mr-2 h-4 w-4" /> 刷新
              </Button>
              <Button size="sm" className="gap-2" onClick={() => setShowCreatePanel(true)}>
                <Plus className="h-4 w-4" /> 创建用户
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> 正在加载...
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">
                      暂无匹配的用户
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm font-semibold text-slate-900">
                          {user.username}
                          <span className="text-xs font-normal text-slate-500">ID: {user.id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={user.role === 'admin' ? 'secondary' : 'default'}>
                            {user.role === 'admin' ? '管理员' : '普通用户'}
                          </Badge>
                          <Select
                            value={user.role}
                            onValueChange={(value) => onUpdateRole(user.id, value)}
                            disabled={roleUpdatingId === user.id || workingUserId === user.id}
                          >
                            <SelectTrigger className="h-9 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">普通用户</SelectItem>
                              <SelectItem value="admin">管理员</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{formatDate(user.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1 text-sm">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetTarget(user)}
                            disabled={workingUserId === user.id}
                            className="gap-1"
                          >
                            <KeyRound className="h-4 w-4" /> 重置密码
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(user)}
                            disabled={workingUserId === user.id}
                            className="gap-1 text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 className="h-4 w-4" /> 删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 使用 shadcn 风格 Dialog 承载创建表单，替代原生遮罩，移动端以抽屉形式呈现 */}
      <Dialog
        open={showCreatePanel}
        onOpenChange={(open) => {
          setShowCreatePanel(open)
          if (!open) {
            setNewUser({ username: '', password: '', role: 'user' })
          }
        }}
      >
        <DialogContent align="end" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-none pb-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2 text-slate-900">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">创建用户</p>
                  <p className="text-xs text-slate-500">填写基础信息，支持直接赋予管理员角色</p>
                </div>
              </div>
              <DialogClose className="h-9 px-3">关闭</DialogClose>
            </div>
          </DialogHeader>
          <form
            id="create-user-form"
            className="grid gap-3 px-4 pb-4 md:grid-cols-2"
            onSubmit={onCreateUser}
          >
            <Input
              placeholder="用户名"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              required
            />
            <Input
              placeholder="初始密码"
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
          </form>
          <DialogFooter className="border-t border-slate-200">
            <DialogClose>取消</DialogClose>
            <Button type="submit" form="create-user-form" disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {creating ? '创建中...' : '创建用户'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认改用 Dialog，避免浏览器原生 confirm，保持视觉一致性 */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="border-none pb-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="space-y-1 text-sm text-slate-700">
                <DialogTitle>确认删除用户？</DialogTitle>
                <DialogDescription>
                  操作不可撤销，{deleteTarget?.username} 的所有上传记录将被移除。
                </DialogDescription>
              </div>
              <DialogClose className="h-9 w-9 rounded-full">
                <X className="h-4 w-4" />
              </DialogClose>
            </div>
          </DialogHeader>
          <DialogFooter className="border-t border-slate-200">
            <DialogClose>取消</DialogClose>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={onDeleteUser}
              disabled={deleteTarget ? workingUserId === deleteTarget.id : false}
            >
              {deleteTarget && workingUserId === deleteTarget.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 密码重置也通过 Dialog 呈现，提供统一的无阻塞交互 */}
      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null)
            setCustomPassword('')
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader className="border-none pb-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1 text-sm text-slate-700">
                <DialogTitle>重置密码</DialogTitle>
                <DialogDescription>
                  为 {resetTarget?.username} 设置新密码；留空时系统将自动生成随机安全密码。
                </DialogDescription>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <Input
                    placeholder="输入自定义密码（可留空）"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                  />
                  <Badge variant="secondary" className="justify-center text-xs">
                    支持剪贴板自动复制
                  </Badge>
                </div>
              </div>
              <DialogClose className="h-9 w-9 rounded-full">
                <X className="h-4 w-4" />
              </DialogClose>
            </div>
          </DialogHeader>
          <DialogFooter className="border-t border-slate-200">
            <DialogClose>取消</DialogClose>
            <Button
              className="gap-2"
              onClick={onResetPassword}
              disabled={resetTarget ? workingUserId === resetTarget.id : false}
            >
              {resetTarget && workingUserId === resetTarget.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default UserManagement
