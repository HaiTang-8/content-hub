import * as React from 'react'
import { cn } from '../../lib/utils'

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-card', className)} {...props} />
))
Card.displayName = 'Card'

const CardHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
)
const CardTitle = ({ className, ...props }) => <h3 className={cn('text-xl font-semibold', className)} {...props} />
const CardDescription = ({ className, ...props }) => (
  <p className={cn('text-sm text-slate-500', className)} {...props} />
)
const CardContent = ({ className, ...props }) => <div className={cn('p-6 pt-0', className)} {...props} />
const CardFooter = ({ className, ...props }) => <div className={cn('flex items-center p-6 pt-0', className)} {...props} />

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
