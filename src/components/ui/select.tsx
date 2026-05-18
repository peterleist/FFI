'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  labels: Map<string, string>
  setLabel: (value: string, label: string) => void
}

const SelectContext = React.createContext<SelectContextValue>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
  labels: new Map(),
  setLabel: () => {},
})

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  disabled?: boolean
}

function Select({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  children,
}: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const [labels, setLabels] = React.useState<Map<string, string>>(new Map())
  const containerRef = React.useRef<HTMLDivElement>(null)
  const value = controlledValue ?? internalValue

  const setLabel = React.useCallback((v: string, label: string) => {
    setLabels((prev) => {
      if (prev.get(v) === label) return prev
      const next = new Map(prev)
      next.set(v, label)
      return next
    })
  }, [])

  const handleValueChange = (v: string) => {
    setInternalValue(v)
    onValueChange?.(v)
    setOpen(false)
  }

  React.useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, open, setOpen, labels, setLabel }}>
      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  const { open, setOpen } = React.useContext(SelectContext)

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        'flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <span className="truncate flex-1 text-left">{children}</span>
      <ChevronDown className={cn('h-4 w-4 ml-2 shrink-0 opacity-50 transition-transform', open && 'rotate-180')} />
    </button>
  )
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value, labels } = React.useContext(SelectContext)
  const label = labels.get(value)

  return (
    <span className={cn('truncate', !label && 'text-muted-foreground')}>
      {label !== undefined ? label : placeholder || ''}
    </span>
  )
}

interface SelectContentProps {
  className?: string
  children: React.ReactNode
}

function SelectContent({ className, children }: SelectContentProps) {
  const { open } = React.useContext(SelectContext)

  if (!open) return null

  return (
    <div
      className={cn(
        'absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg',
        className
      )}
    >
      {children}
    </div>
  )
}

interface SelectItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  children: React.ReactNode
}

function SelectItem({ value, children, className, ...props }: SelectItemProps) {
  const ctx = React.useContext(SelectContext)
  const isSelected = ctx.value === value

  // Register label on mount
  const textContent = React.useMemo(() => {
    if (typeof children === 'string') return children
    // Try to extract text from simple JSX
    return ''
  }, [children])

  React.useEffect(() => {
    ctx.setLabel(value, textContent || value)
  }, [value, textContent])

  return (
    <button
      type="button"
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent/50 font-medium',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function SelectSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />
}

function SelectLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', className)} {...props} />
  )
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
}
