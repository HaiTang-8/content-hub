import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Filter,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
  Copy,
  Eye,
  DownloadCloud,
  ShieldCheck,
  Clock,
  Lock,
  Users,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { deleteFile, downloadFile, fetchFiles, shareFile, uploadFile } from '../api/files'
import { fetchUsers } from '../api/users'
import { useAuthStore } from '../store/auth'
import { toast } from 'sonner'
import PreviewDialog from '../components/preview/PreviewDialog'
import DownloadProgress from '../components/DownloadProgress'

const typeOfFile = (mime, filename = '') => {
  if (!mime) return 'other'
  const lower = filename.toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('text/') || mime.includes('markdown') || lower.endsWith('.md')) return 'text'
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf'
  if (mime.includes('spreadsheet') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'sheet'
  return 'file'
}

const formatSize = (size) => {
  if (!size) return '0 B'
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB']
  let value = size
  let idx = -1
  do {
    value /= 1024
    idx++
  } while (value >= 1024 && idx < units.length - 1)
  return `${value.toFixed(1)} ${units[idx]}`
}

const UploadModal = ({ open, onClose, onUploaded }) => {
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  // 统一封装文件选择逻辑，供点击选择和拖拽两种方式复用
  const assignFile = (nextFile) => {
    if (!nextFile) return
    setFile(nextFile)
    toast.success('已选中文件', { description: nextFile.name })
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingFile(true)
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingFile(false)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingFile(false)
    const droppedFile = event.dataTransfer?.files?.[0]
    if (droppedFile) {
      assignFile(droppedFile)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file && !text) {
      // 提示必须填充内容，移动端同样能看到
      toast.error('请选择文件或输入文字', { description: '上传前需要至少提供一种内容来源' })
      return
    }
    setUploading(true)
    const form = new FormData()
    if (file) form.append('file', file)
    if (text) form.append('text', text)
    if (description) form.append('description', description)
    try {
      await uploadFile(form)
      setFile(null)
      setText('')
      setDescription('')
      toast.success('上传成功', {
        description: file ? `文件 ${file.name} 已加入列表` : '文字内容已保存',
      })
      onUploaded?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message, {
        description: '上传失败，请稍后重试',
      })
    } finally {
      setUploading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-base font-semibold text-slate-900">上传内容</p>
            <p className="text-sm text-slate-500">支持文件或直接输入文字</p>
          </div>
          <button className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <form className="space-y-4 px-6 py-5" onSubmit={handleUpload}>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-slate-500">上传文件</Label>
            <label
              className={`flex h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-sm transition ${
                isDraggingFile ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-primary hover:bg-primary/5'
              }`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input type="file" className="hidden" onChange={(e) => assignFile(e.target.files[0])} />
              <Upload className="mb-2 h-6 w-6 text-primary" />
              {file ? <span className="font-medium text-slate-700">{file.name}</span> : <span>点击或拖入文件</span>}
            </label>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-slate-500">文字内容</Label>
            <Textarea rows={3} placeholder="若不选文件，可直接输入文字" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <Input placeholder="描述 (可选)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? '上传中...' : '上传'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

const ConfirmDialog = ({ open, title, description, confirmText = '确认', onConfirm, onCancel }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="space-y-3 px-6 py-5">
          <p className="text-base font-semibold text-slate-900">{title}</p>
          {description && <p className="text-sm text-slate-600 leading-relaxed">{description}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel} className="whitespace-nowrap">
              取消
            </Button>
            <Button variant="destructive" onClick={onConfirm} className="whitespace-nowrap">
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}


const ShareDialog = ({ open, file, onClose, onCreate, isAdmin }) => {
  const [requireLogin, setRequireLogin] = useState(true)
  const [allowUsername, setAllowUsername] = useState('')
  const [maxViews, setMaxViews] = useState('20')
  const [expiresInDays, setExpiresInDays] = useState('7')
  const [submitting, setSubmitting] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    if (open) {
      // 打开弹窗时重置默认值，保证配置可重复使用
      setRequireLogin(true)
      setAllowUsername('')
      setMaxViews('20')
      setExpiresInDays('7')
      setUserSearch('')
      if (isAdmin) {
        loadUsers()
      }
    }
  }, [open, file?.id])

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const { data } = await fetchUsers()
      setUsers(data || [])
    } catch (err) {
      toast.error(err.response?.data?.error || err.message, { description: '无法获取用户列表' })
    } finally {
      setLoadingUsers(false)
    }
  }

  if (!open || !file) return null

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        require_login: requireLogin,
        allow_username: isAdmin ? allowUsername.trim() || undefined : undefined,
        max_views: maxViews ? Number(maxViews) : undefined,
        expires_in_days: Number(expiresInDays),
      }
      await onCreate(payload)
    } catch (err) {
      // 下沉到父级统一 toast，避免重复提示
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-card md:w-[80vw] lg:w-[70vw]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> 创建安全分享
            </p>
            <p className="text-sm text-slate-500">链接将打开预览页，而不是直接下载。</p>
          </div>
          <button className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <form className="grid gap-4 px-6 py-5 lg:grid-cols-2" onSubmit={submit}>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">分享文件</p>
              <p className="text-xs text-slate-500">{file.filename}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-500">访问有效期</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 天内仅可访问</SelectItem>
                  <SelectItem value="7">7 天内仅可访问</SelectItem>
                  <SelectItem value="30">30 天内仅可访问</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-500">访问次数</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
                placeholder="最多可查看次数 (可为空代表不限)"
              />
              <p className="text-xs text-slate-500">留空表示不限次数，1-1000 之间将强制限制。</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-500">是否需要登录</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3 transition hover:border-primary/80 ${
                  requireLogin ? 'border-primary/80 ring-2 ring-primary/10' : 'border-slate-200'
                }`}>
                  <input
                    type="radio"
                    name="share-login"
                    value="need"
                    checked={requireLogin}
                    onChange={() => setRequireLogin(true)}
                    className="mt-1 h-4 w-4 text-primary focus:ring-primary"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-800">需要登录</p>
                    <p className="text-xs text-slate-500 leading-relaxed">适合敏感内容，访问者需先登录系统。</p>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3 transition hover:border-primary/80 ${
                  !requireLogin ? 'border-primary/80 ring-2 ring-primary/10' : 'border-slate-200'
                }`}>
                  <input
                    type="radio"
                    name="share-login"
                    value="noneed"
                    checked={!requireLogin}
                    onChange={() => setRequireLogin(false)}
                    className="mt-1 h-4 w-4 text-primary focus:ring-primary"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-800">无需登录</p>
                    <p className="text-xs text-slate-500 leading-relaxed">适合公开素材，请酌情使用。</p>
                  </div>
                </label>
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-slate-500">限定接收人 (管理员可选)</Label>
                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <Input
                    placeholder="筛选用户名"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full"
                  />
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50">
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-white">
                      <input
                        type="radio"
                        name="allow-user"
                        value=""
                        checked={!allowUsername}
                        onChange={() => setAllowUsername('')}
                        className="h-4 w-4 text-primary"
                      />
                      不限定接收人
                    </label>
                    {loadingUsers ? (
                      <p className="px-3 py-2 text-xs text-slate-500">加载用户...</p>
                    ) : (
                      users
                        .filter((u) => u.username.toLowerCase().includes(userSearch.toLowerCase()))
                        .map((u) => (
                          <label
                            key={u.id}
                            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-white"
                          >
                            <input
                              type="radio"
                              name="allow-user"
                              value={u.username}
                              checked={allowUsername === u.username}
                              onChange={() => setAllowUsername(u.username)}
                              className="h-4 w-4 text-primary"
                            />
                            <span className="font-medium">{u.username}</span>
                            <Badge variant="secondary" className="text-[11px]">{u.role}</Badge>
                          </label>
                        ))
                    )}
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Users className="h-4 w-4" /> 仅管理员可指定接收人，选择后将强制登录校验。
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> 访问时间范围：可选 1/7/30 天</span>
              <span className="flex items-center gap-1"><Lock className="h-4 w-4" /> 推荐保留“需要登录”保证安全</span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={onClose} className="whitespace-nowrap">
                取消
              </Button>
              <Button type="submit" disabled={submitting} className="whitespace-nowrap">
                {submitting ? '生成中...' : '生成预览链接'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

const Content = () => {
	const [files, setFiles] = useState([])
	const [loading, setLoading] = useState(true)
	const [uploadOpen, setUploadOpen] = useState(false)
	const [shareLink, setShareLink] = useState('')
	const [shareTarget, setShareTarget] = useState(null)
	const [shareDialogOpen, setShareDialogOpen] = useState(false)
	const [pendingDelete, setPendingDelete] = useState(null)
  // 控制当前正在预览的文件，兼顾移动端全屏弹层体验
  const [previewing, setPreviewing] = useState(null)
	// 记录正在下载的文件 ID，防止重复点击导致多次请求或误判未登录
	const [downloadingId, setDownloadingId] = useState(null)
  // 按文件记录下载百分比，给出实时反馈；对象结构便于多文件并发下载
  const [downloadProgress, setDownloadProgress] = useState({})
	const [search, setSearch] = useState('')
	const [ownerFilter, setOwnerFilter] = useState('all')
	const [typeFilter, setTypeFilter] = useState('all')
	const { user } = useAuthStore()
	const isAdmin = user?.role === 'admin'

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

	const loadFiles = async () => {
		setLoading(true)
		try {
			const { data } = await fetchFiles()
			setFiles(data)
			setShareLink('')
		} catch (err) {
			console.error(err)
		} finally {
			setLoading(false)
		}
	}

  useEffect(() => {
    loadFiles()
  }, [])

	const startShare = (file) => {
		setShareTarget(file)
		setShareDialogOpen(true)
	}

	const handleCreateShare = async (options) => {
		if (!shareTarget) return
		try {
			const { data } = await shareFile(shareTarget.id, options)
			const link = `${window.location.origin}${data.preview_path}`
			setShareLink(link)
			setShareDialogOpen(false)
			const copied = await copyToClipboard(link)
			if (copied) {
				toast.success('已生成预览链接并复制', { description: link })
			} else {
				toast.success('已生成预览链接', { description: '未自动复制时可点复制按钮' })
			}
		} catch (err) {
			toast.error(err.response?.data?.error || err.message, { description: '生成分享链接失败' })
		}
	}

	// 独立的复制动作，便于用户在移动端/桌面端重复复制分享链接
	const copyShareLink = async () => {
		if (!shareLink) return
		const ok = await copyToClipboard(shareLink)
		if (ok) {
			toast.success('已复制到剪贴板', { description: shareLink })
		} else {
			toast.error('复制失败，请长按或手动选择链接')
		}
	}

  // 过滤空值，防止 SelectItem 出现空字符串导致 Radix 抛错
	const owners = useMemo(
    () => Array.from(new Set(files.map((f) => f.owner).filter(Boolean))),
    [files]
  )

	// 通过 axios 下载文件，确保带上 Authorization 头，避免新标签页丢失鉴权导致 401
	const handleDownload = async (file) => {
		if (!file) return
		setDownloadingId(file.id)
		// 下载开始时将进度重置为 0，后续根据 Content-Length 逐步更新
		setDownloadProgress((prev) => ({ ...prev, [file.id]: 0 }))
		let success = false
		try {
			const { data } = await downloadFile(file.id, {
				responseType: 'blob',
        // 利用浏览器进度事件回调，展示精确百分比；若无 total 则跳过
        onDownloadProgress: (event) => {
          const total = event?.total || file.size
          if (!total) return
          const percent = Math.min(100, Math.round((event.loaded / total) * 100))
          setDownloadProgress((prev) => ({ ...prev, [file.id]: percent }))
        },
			})
			const url = URL.createObjectURL(data)
			const anchor = document.createElement('a')
			anchor.href = url
			anchor.download = file.filename
			anchor.style.display = 'none'
			document.body.appendChild(anchor)
			anchor.click()
			document.body.removeChild(anchor)
			URL.revokeObjectURL(url)
			success = true
		} catch (err) {
			const status = err.response?.status
			if (status === 401) {
				toast.error('需要登录后才能下载', { description: '请重新登录后重试' })
			} else if (status === 403) {
				toast.error('无权下载该文件', { description: '请联系文件所有者授权' })
			} else if (status === 404) {
				toast.error('文件不存在或已删除')
			} else {
				toast.error('下载失败', { description: err.response?.data?.error || err.message })
			}
		} finally {
			setDownloadingId(null)
			if (success) {
				// 确保进度条收尾到 100%，短暂展示后再清理状态，避免界面闪烁
				setDownloadProgress((prev) => ({ ...prev, [file.id]: 100 }))
				setTimeout(() => {
					setDownloadProgress((prev) => {
						const next = { ...prev }
						delete next[file.id]
						return next
					})
				}, 500)
			} else {
				// 失败时直接移除进度记录，避免误导用户
				setDownloadProgress((prev) => {
					const next = { ...prev }
					delete next[file.id]
					return next
				})
			}
		}
	}

	const handleDelete = async (file) => {
		const isAdmin = user?.role === 'admin'
		const isOwner = user?.username === file.owner
		if (!isAdmin && !isOwner) {
			toast.error('没有权限删除该内容')
			return
		}
		try {
			await deleteFile(file.id)
			toast.success('删除成功', {
				description: isAdmin ? '已立即从存储中清理。' : '删除申请已提交，内容已被隐藏。',
			})
			await loadFiles()
		} catch (err) {
			toast.error(err.response?.data?.error || err.message, { description: '删除失败，请稍后再试' })
		} finally {
			setPendingDelete(null)
		}
	}

  const filtered = useMemo(() => {
    return files.filter((f) => {
      const keyword = search.trim().toLowerCase()
      if (keyword) {
        const hay = `${f.filename} ${f.description || ''} ${f.owner}`.toLowerCase()
        if (!hay.includes(keyword)) return false
      }
      if (ownerFilter !== 'all' && f.owner !== ownerFilter) return false
      if (typeFilter !== 'all') {
        const t = typeOfFile(f.mime_type, f.filename)
        if (typeFilter === 'text' && t !== 'text') return false
        if (typeFilter === 'image' && t !== 'image') return false
        if (typeFilter === 'file' && (t === 'text' || t === 'image')) return false
      }
      return true
    })
  }, [files, search, ownerFilter, typeFilter])

	const confirmConfig = useMemo(() => {
		if (!pendingDelete) return { open: false }
		const isAdmin = user?.role === 'admin'
	return {
		open: true,
		title: '删除确认',
		description: isAdmin
			? `删除后「${pendingDelete.filename}」将立即从存储中清理，且不可恢复。`
			: `删除后「${pendingDelete.filename}」将被隐藏，由管理员彻底清理。是否继续？`,
		confirmText: '删除',
	}
	}, [pendingDelete, user?.role])

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-700">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-semibold">筛选内容</span>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="搜索文件名 / 描述 / 上传者"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="image">图片</SelectItem>
            <SelectItem value="text">文字</SelectItem>
            <SelectItem value="file">其他文件</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="上传者" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有人</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" onClick={loadFiles} disabled={loading} className="gap-2">
          <RefreshCw className="h-4 w-4" /> 刷新
        </Button>
        <Button onClick={() => setUploadOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" /> 上传
        </Button>
      </div>

	{shareLink && (
		<div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			<p className="text-sm font-semibold text-slate-900">预览分享链接</p>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Input value={shareLink} readOnly className="font-mono text-xs sm:text-sm flex-1" />
				<Button variant="outline" size="sm" onClick={copyShareLink} className="gap-2">
					<Copy className="h-4 w-4" />
					复制链接
				</Button>
			</div>
			<p className="text-xs text-slate-500">打开后进入预览界面，遵循登录/次数/时间等限制。</p>
		</div>
	)}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-slate-500">加载中...</p>
        ) : filtered.length ? (
          <>
            {/* 使用 grid 固定列数，保证桌面端一行四个卡片，避免列数因高度变化而折行 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filtered.map((f) => {
                const type = typeOfFile(f.mime_type, f.filename)
                const canDelete = isAdmin || user?.username === f.owner
                const canShare = isAdmin || user?.username === f.owner
                const deleteText = '删除'
                return (
                  <div key={f.id} className="h-full">
                    <Card className="flex h-full flex-col w-full shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <CardTitle
                          className="text-lg leading-tight truncate"
                          title={f.filename}
                        >
                          {f.filename}
                        </CardTitle>
                        <CardDescription className="truncate" title={f.description || '无描述'}>
                          {f.description || '无描述'}
                        </CardDescription>
                      </div>
                      {/* 将类型徽章固定在卡片右侧，避免随标题长度波动导致布局抖动 */}
                      <Badge variant="secondary" className="flex-shrink-0 self-start">
                        {getTypeLabel(type)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-slate-600 flex flex-wrap gap-3">
                      <span>上传者：{f.owner}</span>
                      <span>时间：{dayjs(f.created_at).format('MM/DD HH:mm')}</span>
                    </div>
                    <div className="text-sm text-slate-600">大小：{formatSize(f.size)}</div>
                    <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
                      <div className="flex flex-wrap gap-2 min-w-max">
                        {/* 使用同一 Button 体系包裹链接并补充统一图标，确保下载操作与预览弹窗的下载样式保持一致 */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 px-3 py-2"
                          onClick={() => handleDownload(f)}
                          disabled={downloadingId === f.id}
                        >
                          <DownloadCloud className="h-4 w-4" />
                          {downloadingId === f.id ? '下载中...' : '下载'}
                        </Button>
                        {/* 触发授权预览弹窗，阻止未认证访问器直接命中流接口 */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 px-3 py-2"
                          onClick={() => setPreviewing(f)}
                        >
                          <Eye className="h-4 w-4" />
                          预览
                        </Button>
                      </div>
                      <div className="flex gap-2 flex-nowrap flex-shrink-0">
	                        {canShare && (
	                          <Button type="button" size="sm" onClick={() => startShare(f)} className="gap-2 whitespace-nowrap">
		                        <Share2 className="h-4 w-4" />
		                        分享
	                          </Button>
	                        )}
                        {canDelete && (
                          <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => setPendingDelete(f)}
                            className="gap-2 whitespace-nowrap"
                          >
                            <Trash2 className="h-4 w-4" />
                            {deleteText}
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* 有进度时补充百分比提示，移动端同样可见 */}
                    {downloadProgress[f.id] !== undefined && (
                      <DownloadProgress
                        percent={downloadProgress[f.id]}
                        label={downloadProgress[f.id] === 100 ? '下载完成' : '下载中'}
                        className="mt-2"
                      />
                    )}
                    </CardContent>
                  </Card>
                  </div>
              )
            })}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            还没有内容，点击右上角“上传”添加吧。
          </div>
		)}
	</div>
	<UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={loadFiles} />
	<ShareDialog
		open={shareDialogOpen}
		file={shareTarget}
		onClose={() => setShareDialogOpen(false)}
		onCreate={handleCreateShare}
		isAdmin={isAdmin}
	/>
	<ConfirmDialog
		open={confirmConfig.open}
		title={confirmConfig.title}
        description={confirmConfig.description}
        confirmText={confirmConfig.confirmText}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => handleDelete(pendingDelete)}
      />
      {/* 复用弹窗组件承载多类型内容预览，移动端同样全屏占位 */}
      <PreviewDialog
        open={!!previewing}
        file={previewing}
        onClose={() => setPreviewing(null)}
      />
    </>
  )
}

export default Content
const fileTypeLabels = {
  text: '文字',
  image: '图片',
  video: '视频',
  pdf: 'PDF',
  sheet: '表格',
  file: '文件',
  other: '文件',
}

const getTypeLabel = (type) => fileTypeLabels[type] || '文件'
