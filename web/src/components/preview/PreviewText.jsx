import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Check, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button'

/**
 * 纯文本预览：在窄屏采用纵向排版，在桌面提供横向布局，并内置复制按钮方便分享内容。
 */
const PreviewText = ({ content }) => {
  const [copyStatus, setCopyStatus] = useState('idle') // idle | copied | error
  const displayText = useMemo(() => content ?? '', [content])

  /**
   * 复制逻辑需要兼顾移动端 Safari，缺少 Clipboard API 时退回到 document.execCommand。
   */
  const handleCopy = useCallback(async () => {
    if (!displayText) return
    try {
      if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(displayText)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = displayText
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const success = document.execCommand('copy')
        document.body.removeChild(textarea)
        if (!success) throw new Error('execCommand copy failed')
      }
      setCopyStatus('copied')
    } catch (err) {
      console.error('复制失败', err)
      setCopyStatus('error')
    }
  }, [displayText])

  useEffect(() => {
    if (copyStatus === 'idle') return () => {}
    const timer = setTimeout(() => setCopyStatus('idle'), 2200)
    return () => clearTimeout(timer)
  }, [copyStatus])

  if (!displayText) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">纯文本可直接复制使用</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1 self-start sm:self-auto"
          onClick={handleCopy}
        >
          {copyStatus === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copyStatus === 'copied' ? '已复制' : '复制内容'}
        </Button>
      </div>
      {copyStatus === 'error' && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600" role="status">
          <AlertTriangle className="h-4 w-4" />
          复制失败，请手动选择文本
        </div>
      )}
      <pre className="max-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
        {displayText}
      </pre>
    </div>
  )
}

export default PreviewText
