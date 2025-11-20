import { createContext, useContext, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'

// Dialog 组件：用 Tailwind 构建的可控弹层，替代原生 alert/prompt，统一桌面与移动端的遮罩体验。
const DialogContext = createContext()

const useDialog = () => {
  const ctx = useContext(DialogContext)
  if (!ctx) {
    throw new Error('Dialog components must be used within <Dialog>')
  }
  return ctx
}

export const Dialog = ({ open, onOpenChange, children }) => (
  <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
)

export const DialogContent = ({
  align = 'center',
  className,
  overlayClassName,
  children,
  role = 'dialog',
  ariaLabel,
}) => {
  const { open, onOpenChange } = useDialog()
  const contentRef = useRef(null)

  // 锁定滚动，保证移动端底部抽屉不会导致页面抖动。
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  // 支持 Esc 快捷关闭，匹配桌面端的键盘操作习惯。
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && open) {
        onOpenChange?.(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  if (!open) return null

  const containerClass =
    align === 'center'
      ? 'items-center justify-center'
      : 'items-end sm:items-center sm:justify-center'

  return createPortal(
    <div className={cn('fixed inset-0 z-50 flex px-4 py-6 sm:px-6', containerClass)}>
      <div
        className={cn('absolute inset-0 bg-black/40 backdrop-blur-sm', overlayClassName)}
        onClick={() => onOpenChange?.(false)}
      />
      <div
        ref={contentRef}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          'relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition',
          align === 'center' ? 'max-w-lg sm:max-w-xl' : 'max-w-xl sm:max-w-lg sm:rounded-2xl',
          align !== 'center' && 'rounded-t-3xl sm:rounded-2xl',
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

export const DialogHeader = ({ className, children }) => (
  <div className={cn('flex flex-col gap-2 border-b border-slate-200 px-4 pb-3 pt-4', className)}>
    {children}
  </div>
)

export const DialogTitle = ({ className, children }) => (
  <h3 className={cn('text-base font-semibold text-slate-900', className)}>{children}</h3>
)

export const DialogDescription = ({ className, children }) => (
  <p className={cn('text-sm text-slate-600 leading-relaxed', className)}>{children}</p>
)

export const DialogFooter = ({ className, children }) => (
  <div className={cn('flex flex-col gap-2 px-4 pb-4 pt-3 sm:flex-row sm:justify-end', className)}>
    {children}
  </div>
)

export const DialogClose = ({ className, children }) => {
  const { onOpenChange } = useDialog()
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100',
        className
      )}
      onClick={() => onOpenChange?.(false)}
    >
      {children}
    </button>
  )
}
