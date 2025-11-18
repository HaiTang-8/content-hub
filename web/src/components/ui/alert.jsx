import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { forwardRef } from 'react'

const alertVariants = cva('relative w-full rounded-xl border px-4 py-3 text-sm', {
	variants: {
		variant: {
			default: 'border-slate-200 bg-white text-slate-700 shadow-sm',
			success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
			destructive: 'border-rose-200 bg-rose-50 text-rose-700',
			info: 'border-primary/30 bg-primary/5 text-slate-700',
		},
	},
	defaultVariants: {
		variant: 'default',
	},
})

const Alert = forwardRef(({ className, variant, ...props }, ref) => (
	<div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
))

Alert.displayName = 'Alert'

const AlertTitle = ({ className, ...props }) => (
	<p className={cn('text-sm font-semibold leading-none tracking-tight', className)} {...props} />
)

const AlertDescription = ({ className, ...props }) => (
	<div className={cn('text-sm text-inherit [&_p]:leading-relaxed', className)} {...props} />
)

export { Alert, AlertTitle, AlertDescription }
