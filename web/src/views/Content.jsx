import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Filter, RefreshCw, Search, Share2, Trash2, Upload, X, Copy, Eye, DownloadCloud } from 'lucide-react'
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
import { deleteFile, fetchFiles, shareFile, uploadFile } from '../api/files'
import { useAuthStore } from '../store/auth'
import { toast } from 'sonner'
import PreviewDialog from '../components/preview/PreviewDialog'

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

const Content = () => {
	const [files, setFiles] = useState([])
	const [loading, setLoading] = useState(true)
	const [uploadOpen, setUploadOpen] = useState(false)
	const [shareLink, setShareLink] = useState('')
	const [pendingDelete, setPendingDelete] = useState(null)
  // 控制当前正在预览的文件，兼顾移动端全屏弹层体验
  const [previewing, setPreviewing] = useState(null)
	const [search, setSearch] = useState('')
	const [ownerFilter, setOwnerFilter] = useState('all')
	const [typeFilter, setTypeFilter] = useState('all')
	const { user } = useAuthStore()

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

	const apiBase = useMemo(() => import.meta.env.VITE_API_URL || 'http://localhost:8080/api', [])

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

	const onShare = async (id) => {
		try {
			const { data } = await shareFile(id)
			const base = apiBase.replace('/api', '')
			const link = `${base}/share/${data.share_token}`
			setShareLink(link)
			// 优先尝试自动复制，让移动端用户也能一次完成操作
			const copied = await copyToClipboard(link)
			if (copied) {
				toast.success('分享链接已复制到剪贴板', { description: link })
			} else {
				toast('已生成分享链接', {
					description: '若未自动复制，可点击下方复制按钮或手动选中链接',
					action: {
						label: '复制',
						onClick: async () => {
							const ok = await copyToClipboard(link)
							if (ok) {
								toast.success('已复制到剪贴板', { description: link })
							} else {
								toast.error('复制失败，请手动复制')
							}
						},
					},
				})
			}
		} catch (err) {
			setShareLink('')
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

	const owners = useMemo(() => Array.from(new Set(files.map((f) => f.owner))), [files])

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
			<p className="text-sm font-semibold text-slate-900">分享链接</p>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Input value={shareLink} readOnly className="font-mono text-xs sm:text-sm flex-1" />
				<Button variant="outline" size="sm" onClick={copyShareLink} className="gap-2">
					<Copy className="h-4 w-4" />
					复制链接
				</Button>
			</div>
			<p className="text-xs text-slate-500">长按或选中即可复制，顶部通知会提示复制结果。</p>
		</div>
	)}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-slate-500">加载中...</p>
        ) : filtered.length ? (
	          <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6">
            {filtered.map((f) => {
              const type = typeOfFile(f.mime_type, f.filename)
              const canDelete = user?.role === 'admin' || user?.username === f.owner
	            const deleteText = '删除'
              return (
                <Card key={f.id} className="flex h-full flex-col">
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
                          asChild
                          variant="outline"
                          size="sm"
                          className="gap-1 px-3 py-2"
                        >
                          <a
                            href={`${apiBase}/files/${f.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <DownloadCloud className="h-4 w-4" />
                            下载
                          </a>
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
                        <Button type="button" size="sm" onClick={() => onShare(f.id)} className="gap-2 whitespace-nowrap">
                          <Share2 className="h-4 w-4" />
                          分享
                        </Button>
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
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            还没有内容，点击右上角“上传”添加吧。
          </div>
        )}
      </div>
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={loadFiles} />
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
        apiBase={apiBase}
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
