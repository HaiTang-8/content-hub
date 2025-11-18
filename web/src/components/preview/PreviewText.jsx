/**
 * 纯文本预览，用预格式化块承载长内容，并允许自动换行以兼顾窄屏阅读。
 */
const PreviewText = ({ content }) => {
  if (!content) return null
  return (
    <pre className="max-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
      {content}
    </pre>
  )
}

export default PreviewText
