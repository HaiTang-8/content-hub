import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { AlertTriangle, Copy, Lock, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { listShares, revokeShare } from '../api/shares'
import { toast } from 'sonner'

dayjs.extend(relativeTime)

const ShareManage = () => {
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState('')
  const [copying, setCopying] = useState('')
  const [error, setError] = useState('')
  const shareBase = useMemo(() => (typeof window !== 'undefined' ? window.location.origin : ''), [])

  // 通用复制工具，兼容桌面端与移动端的异步剪贴板及回退方案
  const copyToClipboard = async (value) => {
    if (!value || typeof navigator === 'undefined') return false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
        return true
      }
    } catch (err) {
      console.warn('Clipboard API copy failed', err)
    }
    try {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch (err) {
      console.warn('Fallback clipboard copy failed', err)
      return false
    }
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await listShares()
      setShares(data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const revoke = async (token) => {
    setRevoking(token)
    try {
      await revokeShare(token)
      toast.success('已撤销分享')
      setShares((prev) => prev.filter((s) => s.token !== token))
    } catch (err) {
      toast.error(err.response?.data?.error || err.message, { description: '撤销失败，请稍后再试' })
    } finally {
      setRevoking('')
    }
  }

  // 构造预览地址并复制，提供快捷“复制链接”操作，方便后台一键分发
  const copyShareLink = async (token) => {
    if (!token || !shareBase) return
    setCopying(token)
    const link = `${shareBase}/preview/${token}`
    const ok = await copyToClipboard(link)
    setCopying('')
    if (ok) {
      toast.success('已复制分享链接', { description: link })
    } else {
      toast.error('复制失败，请手动选择链接', { description: link })
    }
  }

  const rows = useMemo(() => shares, [shares])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> 分享管理
        </h1>
        <p className="text-sm text-slate-500">仅超级管理员可见，可撤销失效或违规的分享链接。</p>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> 刷新
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>文件</TableHead>
              <TableHead>分享者</TableHead>
              <TableHead>接收限制</TableHead>
              <TableHead>登录</TableHead>
              <TableHead>次数</TableHead>
              <TableHead>有效期</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" /> 加载中...
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500">
                  暂无分享记录
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s.token}>
                  <TableCell className="space-y-1">
                    <p className="font-medium text-slate-900 break-words">{s.filename}</p>
                    <p className="text-xs text-slate-500 break-all">Token: {s.token}</p>
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">{s.creator}</TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {s.allow_username ? (
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" /> 仅 {s.allow_username}
                      </Badge>
                    ) : (
                      <span className="text-slate-500">未指定</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1">
                      <Lock className={`h-3 w-3 ${s.require_login ? 'text-emerald-600' : 'text-slate-400'}`} />
                      {s.require_login ? '需登录' : '可匿名'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {s.max_views ? `${s.view_count}/${s.max_views} 次` : `${s.view_count} 次 (不限)`}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {s.expires_at ? (
                      <span className="whitespace-nowrap">
                        {dayjs(s.expires_at).format('MM/DD HH:mm')} · {dayjs(s.expires_at).fromNow()}
                      </span>
                    ) : (
                      '默认 7 天'
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700 whitespace-nowrap">
                    {dayjs(s.created_at).format('MM/DD HH:mm')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                        onClick={() => copyShareLink(s.token)}
                        disabled={copying === s.token}
                      >
                        <Copy className="h-4 w-4" />
                        {copying === s.token ? '复制中' : '复制链接'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        onClick={() => revoke(s.token)}
                        disabled={revoking === s.token}
                      >
                        <Trash2 className="h-4 w-4" />
                        {revoking === s.token ? '撤销中' : '撤销'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default ShareManage
