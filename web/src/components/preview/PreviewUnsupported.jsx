import { DownloadCloud } from 'lucide-react'
import { Button } from '../ui/button'
import DownloadProgress from '../DownloadProgress'

/**
 * 不支持在线渲染的文件统一走提示组件，方便扩展新的类型。
 */
const PreviewUnsupported = ({ onDownload, filename, downloading, percent }) => (
  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
    <p>该文件类型暂不支持在线预览，可直接下载查看。</p>
    <Button
      variant="outline"
      className="w-full justify-center gap-2"
      onClick={onDownload}
      disabled={downloading}
    >
      <DownloadCloud className="h-4 w-4" />
      <span className="ml-1">{downloading ? '下载中...' : `下载 ${filename}`}</span>
    </Button>
    {downloading && (
      <DownloadProgress
        percent={percent}
        label={percent === 100 ? '下载完成' : '下载中'}
      />
    )}
  </div>
)

export default PreviewUnsupported
