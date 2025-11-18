import { DownloadCloud } from 'lucide-react'

/**
 * 不支持在线渲染的文件统一走提示组件，方便扩展新的类型。
 */
const PreviewUnsupported = ({ downloadUrl, filename }) => (
  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
    <p>该文件类型暂不支持在线预览，可直接下载查看。</p>
    <a className="btn-outline inline-flex w-full justify-center" href={downloadUrl} target="_blank" rel="noreferrer">
      <DownloadCloud className="h-4 w-4" />
      <span className="ml-2">下载 {filename}</span>
    </a>
  </div>
)

export default PreviewUnsupported
