/**
 * 图片预览组件，限制高度并保持等比缩放，便于移动端/桌面端查看。
 */
const PreviewImage = ({ src, alt }) => {
  if (!src) return null
  return <img src={src} alt={alt} className="mx-auto max-h-[65vh] w-full rounded-xl object-contain" />
}

export default PreviewImage
