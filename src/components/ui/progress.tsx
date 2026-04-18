'use client'

import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'

import { cn } from '@/lib/utils'

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const v = Math.min(100, Math.max(0, Math.round(Number(value ?? 0))))
  const complete = v >= 100

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'h-full w-full flex-1 origin-left rounded-full transition-[transform] duration-500 ease-out',
          complete
            ? 'bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]'
            : 'bg-gradient-to-r from-primary-from to-primary-to shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
        )}
        style={{ transform: `translateX(-${100 - v}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

/** 渐变进度条 + 紧挨数字（大号渐变字） */
function GoalProgressLabeled({
  value,
  className,
  barClassName,
}: {
  value: number
  className?: string
  barClassName?: string
}) {
  const v = Math.min(100, Math.max(0, Math.round(value)))
  const complete = v >= 100

  return (
    <div className={cn('flex w-full min-w-0 items-center gap-2 sm:gap-3', className)}>
      <div
        className={cn(
          'relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]',
          barClassName,
        )}
      >
        <div
          className={cn(
            'h-full min-h-[0.5rem] rounded-full transition-[width] duration-500 ease-out',
            complete
              ? 'bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]'
              : 'bg-gradient-to-r from-primary-from to-primary-to shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
          )}
          style={{ width: `${v}%` }}
        />
      </div>
      <span
        className={cn(
          'w-10 shrink-0 text-right text-xs font-extrabold tabular-nums transition-colors duration-500 sm:w-11 sm:text-sm',
          complete
            ? 'bg-gradient-to-br from-emerald-600 to-emerald-500 bg-clip-text text-transparent'
            : 'text-primary',
        )}
        aria-label={`进度 ${v}%`}
      >
        {v}%
      </span>
    </div>
  )
}

export { Progress, GoalProgressLabeled }
