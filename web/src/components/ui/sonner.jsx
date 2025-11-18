import { Toaster as SonnerToaster } from 'sonner'

/**
 * 统一的全局通知容器，使用 shadcn/ui 推荐的 Sonner。
 * - 限制最大宽度，保证移动端也不会被遮挡。
 * - 开启 richColors 与关闭按钮，提升可读性与可操作性。
 */
export function Toaster(props) {
  return (
    <SonnerToaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group border border-slate-200 bg-white/90 backdrop-blur shadow-lg max-w-[min(420px,calc(100vw-32px))]',
          description: 'text-slate-600',
          actionButton: 'bg-primary text-primary-foreground hover:bg-primary/90',
          cancelButton: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
        },
      }}
      {...props}
    />
  )
}
