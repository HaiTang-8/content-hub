import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock3, Copy, KeyRound, Loader2, Plus, RefreshCw, Shield, Trash2, UserCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { createApiKey, listApiKeys, revokeApiKey } from '../api/apikeys'
import { fetchUsers } from '../api/users'

const ApiKeyManage = () => {
  const [keys, setKeys] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [revokingId, setRevokingId] = useState(null)
  // plainKey 仅在成功创建后展示一次，便于提醒用户立即保存
  const [plainKey, setPlainKey] = useState('')
  const [form, setForm] = useState({ name: '', boundUserId: '', expiresInDays: '30', uploadScope: true })

  // 拉取用户列表供绑定上传归属，避免匿名上传造成审计缺口
  const loadUsers = async () => {
    try {
      const { data } = await fetchUsers()
      setUsers(data)
    } catch (err) {
      toast.error(err.response?.data?.error || '获取用户列表失败')
    }
  }

  const loadKeys = async () => {
    setLoading(true)
    try {
      const { data } = await listApiKeys()
      setKeys(data || [])
    } catch (err) {
      toast.error(err.response?.data?.error || '获取 API Key 列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    loadKeys()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('请填写名称')
      return
    }
    if (!form.boundUserId) {
      toast.error('请选择绑定的归属用户')
      return
    }
    if (!form.uploadScope) {
      toast.error('至少需要勾选上传权限')
      return
    }

    setCreating(true)
    setPlainKey('')
    try {
      const payload = {
        name: form.name.trim(),
        bound_user_id: Number(form.boundUserId),
        scopes: ['files:upload'],
        expires_in_days: form.expiresInDays ? Number(form.expiresInDays) : undefined,
      }
      const { data } = await createApiKey(payload)
      setPlainKey(data.plain_key)
      toast.success('已生成 API Key', { description: '请立即复制保存，后续不会再显示完整密钥' })
      setForm((prev) => ({ ...prev, name: '' }))
      loadKeys()
    } catch (err) {
      toast.error(err.response?.data?.error || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id) => {
    setRevokingId(id)
    try {
      await revokeApiKey(id)
      toast.success('已撤销 API Key')
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked: true } : k)))
    } catch (err) {
      toast.error(err.response?.data?.error || '撤销失败')
    } finally {
      setRevokingId(null)
    }
  }

  const copyKey = async (value) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('已复制到剪贴板')
    } catch (err) {
      toast.error('复制失败，请手动保存')
    }
  }

  const rows = useMemo(() => keys, [keys])

  const formatDate = (value) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—')

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5 text-primary" /> API Key 管理
            </CardTitle>
            <CardDescription>为外部集成生成可控密钥，绑定归属用户以便审计与配额统计。</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadKeys} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> 刷新
          </Button>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>密钥名称</Label>
                <Input
                  placeholder="用于标记用途，如 CI 上传"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>绑定归属用户</Label>
                <Select
                  value={String(form.boundUserId)}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, boundUserId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择用户" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.username}（{u.role}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">上传产生的文件归属该用户，便于统一管理与删除。</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>权限范围</Label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.uploadScope}
                    onChange={(e) => setForm((prev) => ({ ...prev, uploadScope: e.target.checked }))}
                    className="h-4 w-4 accent-slate-700"
                  />
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>files:upload（允许匿名上传）</span>
                  </div>
                </label>
                <p className="text-xs text-slate-500">后续可扩展更多接口，当前仅开放上传权限。</p>
              </div>

              <div className="space-y-2">
                <Label>过期天数（可选）</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="默认永久有效"
                  value={form.expiresInDays}
                  onChange={(e) => setForm((prev) => ({ ...prev, expiresInDays: e.target.value }))}
                />
                <p className="text-xs text-slate-500">设置后到期自动失效，留空表示长期有效。</p>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <AlertCircle className="h-4 w-4 text-amber-500" /> 密钥仅在创建时展示一次，请务必复制保存。
              </div>
              <Button type="submit" disabled={creating} className="gap-2">
                <Plus className="h-4 w-4" /> {creating ? '生成中...' : '生成 API Key'}
              </Button>
            </div>

            {plainKey && (
              <div className="md:col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="break-all font-mono text-sm">{plainKey}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyKey(plainKey)} className="gap-2">
                      <Copy className="h-4 w-4" /> 复制
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-emerald-700">关闭页面后将无法再次获取该明文，请安全保存。</p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" /> 已创建的 Key
          </CardTitle>
          <CardDescription>查看启用状态、绑定用户与最近使用时间，可随时撤销。</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称 / 片段</TableHead>
                  <TableHead>绑定用户</TableHead>
                  <TableHead>权限</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>到期</TableHead>
                  <TableHead>最近使用</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> 正在加载...
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">
                      暂无 API Key
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((k) => (
                    <TableRow key={k.id} className={k.revoked ? 'opacity-60' : ''}>
                      <TableCell className="space-y-1">
                        <p className="font-semibold text-slate-900">{k.name}</p>
                        <p className="text-xs text-slate-500 break-all">{k.key_preview}</p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <UserCircle2 className="h-4 w-4 text-slate-500" />
                          {k.bound_user?.username || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">{(k.scopes || []).join(', ')}</TableCell>
                      <TableCell>
                        {k.revoked ? (
                          <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-600">已撤销</span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-600">启用</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700 whitespace-nowrap">{formatDate(k.expires_at)}</TableCell>
                      <TableCell className="text-sm text-slate-700 whitespace-nowrap">{formatDate(k.last_used_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => revoke(k.id)}
                          disabled={k.revoked || revokingId === k.id}
                        >
                          <Trash2 className="h-4 w-4" /> {revokingId === k.id ? '撤销中' : '撤销'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          {/* 移动端使用卡片列表，保证信息可阅读且操作按钮可触达 */}
          <div className="space-y-3 p-4 md:hidden">
            {loading && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" /> 正在加载...
              </div>
            )}
            {!loading && rows.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                暂无 API Key
              </div>
            )}
            {!loading &&
              rows.map((k) => (
                <div key={k.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{k.name}</p>
                      <p className="text-xs text-slate-500">{k.key_preview}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs ${k.revoked ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {k.revoked ? '已撤销' : '启用'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-slate-500" />
                      <span>{(k.scopes || []).join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserCircle2 className="h-4 w-4 text-slate-500" />
                      <span>{k.bound_user?.username || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="h-4 w-4" /> 到期 {formatDate(k.expires_at)} · 使用 {formatDate(k.last_used_at)}
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700"
                      onClick={() => revoke(k.id)}
                      disabled={k.revoked || revokingId === k.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> {revokingId === k.id ? '撤销中' : '撤销'}
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ApiKeyManage
