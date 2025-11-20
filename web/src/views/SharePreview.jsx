import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { AlertTriangle, ArrowLeft, Clock, Eye, Lock, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { useAuthStore } from '../store/auth'
import { getShareMeta, streamShare } from '../api/shares'
import { toast } from 'sonner'

dayjs.extend(relativeTime)

const detectType = (mime = '', filename = '') => {
  const lower = filename.toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('text/') || mime.includes('markdown') || lower.endsWith('.md')) return 'text'
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf'
  return 'other'
}

const SharePreview = () => {
  const { token } = useParams()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [meta, setMeta] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [textContent, setTextContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState(null)

  // 拉取元信息：受限于登录或指定用户会返回对应错误
  const fetchMeta = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await getShareMeta(token)
      setMeta(data)
    } catch (err) {
      const status = err.response?.status
      if (status === 401) {
        setError('该分享需要登录后查看')
      } else if (status === 403) {
        setError('您不是被允许的访问者，无法查看该分享')
      } else if (status === 410 || status === 404) {
        setError('分享已失效或不存在')
      } else {
        setError(err.response?.data?.error || err.message)
      }
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }

  // 获取预览流并生成 blob URL，附带鉴权头避免被浏览器直接下载
  const fetchPreview = async () => {
    if (!meta) return
    setPreviewLoading(true)
    setTextContent('')
    try {
      const { data } = await streamShare(token, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      setPreviewUrl(url)

      // 文本类文件直接解码为字符串，移动端也方便查看与复制
      if (detectType(meta.mime_type, meta.filename) === 'text') {
        const text = await data.text()
        setTextContent(text)
      }
    } catch (err) {
      const status = err.response?.status
      if (status === 401) {
        setError('该分享需要登录后查看')
      } else if (status === 403) {
        setError('您不是被允许的访问者，无法查看该分享')
      } else if (status === 410) {
        setError('分享已失效或次数已用尽')
      } else {
        setError(err.response?.data?.error || err.message)
      }
      setPreviewUrl('')
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    fetchMeta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuthenticated])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (meta) {
      fetchPreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta])

  const gotoLogin = () => {
    navigate(`/login?redirect=/preview/${token}`)
  }

  const renderPreview = () => {
    if (!meta) return null
    const fileType = detectType(meta.mime_type, meta.filename)

    if (!previewUrl) {
      return <p className="text-sm text-slate-500">点击下方重试或稍后再试。</p>
    }

    if (fileType === 'image') {
      return <img src={previewUrl} alt={meta.filename} className="max-h-[60vh] w-full rounded-xl object-contain" />
    }
    if (fileType === 'video') {
      return (
        <video controls className="max-h-[60vh] w-full rounded-xl bg-black">
          <source src={previewUrl} type={meta.mime_type} />
        </video>
      )
    }
    if (fileType === 'pdf') {
      return <iframe title="pdf-preview" src={previewUrl} className="h-[60vh] w-full rounded-xl border" />
    }
    if (fileType === 'text' && textContent) {
      return (
        <pre className="h-[60vh] overflow-auto whitespace-pre-wrap break-words break-all rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800">
          {textContent}
        </pre>
      )
    }
    return (
      <div className="h-[200px] w-full rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        暂不支持此类型的在线预览，可联系分享人调整文件格式。
      </div>
    )
  }

  const securityItems = [
    meta?.requires_login ? '访问需要登录' : '允许未登录访问',
    meta?.allow_username ? `仅 ${meta.allow_username} 可查看` : '未限制接收人',
    meta?.max_views ? `剩余 ${meta.remaining_views ?? 0}/${meta.max_views} 次浏览` : '浏览次数不限',
    meta?.expires_at ? `有效期至 ${dayjs(meta.expires_at).format('YYYY-MM-DD HH:mm')}` : '默认 7 天有效',
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <p className="text-sm text-slate-500">分享预览 · Token {token}</p>
        </div>

        {loading ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> 正在加载分享信息</CardTitle>
              <CardDescription>请稍候，这不会触发下载。</CardDescription>
            </CardHeader>
          </Card>
        ) : error ? (
          <Card className="border-rose-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="h-5 w-5" /> 无法打开分享
              </CardTitle>
              <CardDescription className="text-rose-500">{error}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {error.includes('登录') && (
                <Button onClick={gotoLogin} className="gap-2">
                  <Lock className="h-4 w-4" /> 去登录后查看
                </Button>
              )}
              <Button variant="outline" onClick={fetchMeta} className="gap-2">
                <RefreshCw className="h-4 w-4" /> 重试
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <Card className="h-full">
              <CardHeader className="flex flex-col gap-2">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <ShieldCheck className="h-5 w-5 text-primary" /> {meta.filename}
                </CardTitle>
                <CardDescription className="flex flex-wrap gap-3 text-sm text-slate-600">
                  <span>分享者：{meta.owner}</span>
                  <span>大小：{(meta.size / 1024).toFixed(1)} KB</span>
                  <span>类型：{meta.mime_type}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                    <Clock className="mr-1 h-3 w-3" /> {meta.expires_at ? `有效期 ${dayjs(meta.expires_at).fromNow()}` : '默认 7 天'}
                  </Badge>
                  {meta.max_views && (
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                      <Eye className="mr-1 h-3 w-3" /> 剩余 {meta.remaining_views ?? 0}/{meta.max_views} 次
                    </Badge>
                  )}
                  {meta.allow_username && (
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                      <Users className="mr-1 h-3 w-3" /> 仅 {meta.allow_username}
                    </Badge>
                  )}
                  {meta.requires_login && (
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                      <Lock className="mr-1 h-3 w-3" /> 需登录
                    </Badge>
                  )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {previewLoading ? (
                    <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> 正在加载预览...
                    </div>
                  ) : (
                    renderPreview()
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">安全约束</CardTitle>
                <CardDescription>以下规则由分享者设置，确保内容可控。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                {securityItems.map((item) => (
                  <div key={item} className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={async () => {
                    try {
                      await navigator?.clipboard?.writeText(window.location.href)
                      toast.success('链接已复制')
                    } catch (err) {
                      toast.error('复制失败', { description: '请手动选择地址复制' })
                    }
                  }}
                >
                  <CopyIcon /> 复制当前链接
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5a2 2 0 012-2h7a2 2 0 012 2v11a2 2 0 01-2 2h-7a2 2 0 01-2-2V5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 9a2 2 0 012-2h7" />
  </svg>
)

export default SharePreview
