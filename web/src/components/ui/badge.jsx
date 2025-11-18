import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-slate-100 text-slate-700',
        secondary: 'border-transparent bg-slate-900 text-white',
        outline: 'text-slate-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const Badge = ({ className, variant, ...props }) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
)

export { Badge, badgeVariants }
