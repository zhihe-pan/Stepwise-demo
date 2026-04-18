"use client"

import { cn } from "@/lib/utils"

export function TodayTaskMetrics({
  total,
  completed,
  pending,
  className,
}: {
  total: number
  completed: number
  pending: number
  className?: string
}) {
  const items = [
    { label: "今日任务", value: total, dot: "bg-primary" },
    { label: "已完成", value: completed, dot: "bg-emerald-500" },
    { label: "待办", value: pending, dot: "bg-amber-400" },
  ]

  return (
    <div className={cn("grid w-full grid-cols-3 gap-2 sm:gap-3", className)} role="group" aria-label="今日任务统计">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-slate-200 bg-white px-2 py-2 sm:px-2.5 sm:py-2.5 shadow-sm shadow-slate-200/35">
          <div className="mb-1 flex items-center gap-1.5 sm:mb-1.5">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", it.dot)} aria-hidden />
            <p className="truncate text-[0.6rem] font-medium uppercase tracking-wide text-slate-400">{it.label}</p>
          </div>
          <p className="text-lg font-bold leading-none tabular-nums tracking-tight text-slate-900 sm:text-2xl">
            {it.value}
          </p>
        </div>
      ))}
    </div>
  )
}
