import { clsx } from 'clsx'

/**
 * 通用下载进度条组件，兼顾桌面与移动端，显示百分比并提供不定长占位。
 */
const DownloadProgress = ({ percent, label = '下载中', className = '' }) => {
  const normalized = typeof percent === 'number' && !Number.isNaN(percent)
    ? Math.min(100, Math.max(0, Math.round(percent)))
    : null

  // 当服务器未返回 Content-Length 时，退化为不定进度条并保持可感知反馈
  const width = normalized !== null ? `${normalized}%` : '28%'
  const barClass = clsx('h-full bg-primary transition-[width] duration-200 ease-out', {
    'animate-pulse': normalized === null,
  })

  return (
    <div className={clsx('w-full space-y-1', className)}>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="tabular-nums">{normalized !== null ? `${normalized}%` : '计算中...'}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={barClass} style={{ width }} />
      </div>
    </div>
  )
}

export default DownloadProgress
