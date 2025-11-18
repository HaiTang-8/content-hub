/**
 * PDF 预览：使用 iframe 承载 blob 链接，移动端初始化为接近全屏高度。
 */
const PreviewPdf = ({ src }) => {
  if (!src) return null
  return (
    <iframe
      src={src}
      title="PDF 预览"
      className="h-[65vh] w-full rounded-xl border border-slate-200 bg-slate-50"
    />
  )
}

export default PreviewPdf
