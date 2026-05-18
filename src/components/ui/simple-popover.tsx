'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SimplePopoverContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const SimplePopoverContext = React.createContext<SimplePopoverContextValue>({
  open: false,
  setOpen: () => {},
})

function SimplePopover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

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
    <SimplePopoverContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SimplePopoverContext.Provider>
  )
}

function SimplePopoverTrigger({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen } = React.useContext(SimplePopoverContext)
  return (
    <button type="button" onClick={() => setOpen(!open)} className={className} {...props}>
      {children}
    </button>
  )
}

function SimplePopoverContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { open } = React.useContext(SimplePopoverContext)
  if (!open) return null
  return (
    <div
      className={cn(
        'absolute top-full left-0 z-50 mt-1 shadow-xl',
        className
      )}
    >
      {children}
    </div>
  )
}

export { SimplePopover, SimplePopoverTrigger, SimplePopoverContent }
