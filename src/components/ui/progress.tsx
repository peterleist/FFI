import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
}

function Progress({ className, value = 0, max = 100, style, ...props }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-secondary',
        className
      )}
      style={style}
      {...props}
    >
      <div
        className="h-full w-full flex-1 rounded-full transition-all"
        style={{
          transform: `translateX(-${100 - percentage}%)`,
          backgroundColor:
            (style as React.CSSProperties & { '--progress-color'?: string })?.['--progress-color'] ||
            '#94a3b8',
        }}
      />
    </div>
  )
}

export { Progress }
