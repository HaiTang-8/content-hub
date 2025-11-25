import { useEffect, useMemo, useState } from 'react'
import { X, DownloadCloud } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { downloadFile, streamFile } from '../../api/files'
import { toast } from 'sonner'
import PreviewImage from './PreviewImage'
import PreviewVideo from './PreviewVideo'
import PreviewMarkdown from './PreviewMarkdown'
import PreviewText from './PreviewText'
import PreviewUnsupported from './PreviewUnsupported'
import PreviewPdf from './PreviewPdf'
import PreviewSpreadsheet from './PreviewSpreadsheet'
import DownloadProgress from '../DownloadProgress'

/**
 * 根据文件 MIME 与文件名判断可渲染的类型，兼顾移动端与桌面端的表现。
 */
const detectPreviewKind = (file) => {
  const mime = (file?.mime_type || '').toLowerCase()
  const name = (file?.filename || '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (mime.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'spreadsheet'
  if (mime.includes('markdown') || name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown'
  if (mime.startsWith('text/')) return 'text'
  return 'binary'
}

const previewLabelMap = {
  image: '图片',
  video: '视频',
  pdf: 'PDF',
  spreadsheet: '表格',
  markdown: 'Markdown',
  text: '文字',
  binary: '文件',
}

const emptyPreview = { kind: null, text: '', url: '', mime: '', buffer: null }

const PreviewDialog = ({ open, file, onClose }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(emptyPreview)
  // 独立的下载加载态，避免重复点击导致多次请求或缺失鉴权头
  const [downloading, setDownloading] = useState(false)
  // 记录下载百分比，便于大文件场景向用户提供及时反馈
  const [downloadPercent, setDownloadPercent] = useState(null)

  const kind = useMemo(() => detectPreviewKind(file), [file])

  useEffect(() => {
    if (!open || !file) return () => {}
    let revokedUrl = ''
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      setPreview(emptyPreview)
      try {
        // 直接走授权 API 的流式接口，避免公开暴露资源地址
        const wantsArrayBuffer = kind === 'spreadsheet'
        const { data, headers } = await streamFile(file.id, { responseType: wantsArrayBuffer ? 'arraybuffer' : 'blob' })
        if (cancelled) return
        const mime = data.type || headers['content-type'] || file.mime_type || ''

        if (wantsArrayBuffer) {
          setPreview({ kind, buffer: data, url: '', text: '', mime })
          return
        }

        if (kind === 'image' || kind === 'video' || kind === 'binary' || kind === 'pdf') {
          const blobUrl = URL.createObjectURL(data)
          revokedUrl = blobUrl
          setPreview({ kind, url: blobUrl, text: '', mime })
          return
        }

        // 文本与 Markdown 需要读取字符串
        const textContent = await data.text()
        if (cancelled) return
        setPreview({ kind, text: textContent, url: '', mime })
      } catch (err) {
        // 记录详细错误方便排查 token 等问题
        const message = err.response?.data?.error || err.message || '预览加载失败'
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    // 清理 URL 等资源，避免桌面端多次打开产生内存泄漏
    return () => {
      cancelled = true
      if (revokedUrl) URL.revokeObjectURL(revokedUrl)
    }
  }, [open, file, kind])

  // 通过授权 API 下载文件，确保携带 Bearer 头，避免新窗口 401
  const handleDownload = async () => {
    if (!file) return
    setDownloading(true)
    setDownloadPercent(0)
    let success = false
    try {
      const { data } = await downloadFile(file.id, {
        responseType: 'blob',
        // 若后端返回 Content-Length，则实时计算进度；否则回退为不定进度
        onDownloadProgress: (event) => {
          const total = event?.total || file.size
          if (!total) return
          const percent = Math.min(100, Math.round((event.loaded / total) * 100))
          setDownloadPercent(percent)
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
        toast.error('需要登录后才能下载', { description: '会话过期时请重新登录' })
      } else if (status === 403) {
        toast.error('无权下载该文件', { description: '请联系文件拥有者授权' })
      } else if (status === 404) {
        toast.error('文件不存在或已被删除')
      } else {
        toast.error('下载失败', { description: err.response?.data?.error || err.message })
      }
    } finally {
      setDownloading(false)
      if (success) {
        // 完成时强制补足 100%，延时清空避免 UI 抖动
        setDownloadPercent(100)
        setTimeout(() => setDownloadPercent(null), 600)
      } else {
        setDownloadPercent(null)
      }
    }
  }

  if (!open || !file) return null

  const renderBody = () => {
    if (loading) return <p className="text-sm text-slate-500">预览加载中，请稍候...</p>
    if (error) return <p className="text-sm text-red-500">加载失败：{error}</p>
    if (!preview.kind) return null

    if (preview.kind === 'image') {
      return <PreviewImage src={preview.url} alt={file.filename} />
    }
    if (preview.kind === 'video') {
      return <PreviewVideo src={preview.url} />
    }
    if (preview.kind === 'pdf') {
      return <PreviewPdf src={preview.url} />
    }
    if (preview.kind === 'spreadsheet') {
      return <PreviewSpreadsheet buffer={preview.buffer} filename={file.filename} />
    }
    if (preview.kind === 'markdown') {
      return <PreviewMarkdown content={preview.text} />
    }
    if (preview.kind === 'text') {
      return <PreviewText content={preview.text} />
    }
    return (
      <PreviewUnsupported
        onDownload={handleDownload}
        downloading={downloading}
        percent={downloadPercent}
        filename={file.filename}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="relative flex w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="space-y-2 border-b border-slate-100 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900 truncate" title={file.filename}>
                {file.filename}
              </p>
              <p className="text-xs text-slate-500">类型：{file.mime_type || '未知'} · 上传者：{file.owner}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* 类型徽标与下载按钮保持一致高度，避免顶部操作区在不同屏宽下错位 */}
              <Badge
                variant="secondary"
                className="flex h-9 items-center rounded-xl px-4 text-sm font-semibold"
              >
                {previewLabelMap[kind] || '文件'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-4"
                onClick={handleDownload}
                disabled={downloading}
              >
                <DownloadCloud className="h-4 w-4" />
                {downloading ? '下载中...' : '下载'}
              </Button>
              <button
                type="button"
                aria-label="关闭预览"
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          {downloadPercent !== null && (
            <DownloadProgress
              percent={downloadPercent}
              label={downloadPercent === 100 ? '下载完成' : '下载中'}
              className="w-full sm:w-80"
            />
          )}
        </div>
        <div className="max-h-[78vh] overflow-auto px-5 py-4">{renderBody()}</div>
      </div>
    </div>
  )
}

export default PreviewDialog
