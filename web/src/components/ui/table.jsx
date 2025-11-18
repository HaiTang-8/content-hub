import * as React from 'react'
import { cn } from '../../lib/utils'

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto">
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
))
Table.displayName = 'Table'

const TableHeader = ({ className, ...props }) => (
  <thead className={cn('[&_tr]:border-b border-slate-100', className)} {...props} />
)

const TableBody = ({ className, ...props }) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
)

const TableRow = ({ className, ...props }) => (
  <tr className={cn('border-b border-slate-100 transition hover:bg-slate-50/80', className)} {...props} />
)

const TableHead = ({ className, ...props }) => (
  <th
    className={cn('h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-slate-500', className)}
    {...props}
  />
)

const TableCell = ({ className, ...props }) => (
  <td className={cn('p-4 align-middle text-slate-700', className)} {...props} />
)

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell }
