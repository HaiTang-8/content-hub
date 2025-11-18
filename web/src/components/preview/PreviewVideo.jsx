/**
 * 视频预览组件，默认开启控制条与 metadata 预载，避免在移动端加载全部数据。
 */
const PreviewVideo = ({ src }) => {
  if (!src) return null
  return (
    <video
      src={src}
      controls
      className="w-full max-h-[65vh] rounded-xl bg-black"
      preload="metadata"
    />
  )
}

export default PreviewVideo
