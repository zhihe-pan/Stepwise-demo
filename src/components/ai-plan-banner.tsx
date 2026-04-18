"use client"

import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface AIPlanBannerProps {
  message: string
  className?: string
  embedded?: boolean
  unifiedWithMetrics?: boolean
}

export function AIPlanBanner({
  message,
  className,
  embedded = false,
  unifiedWithMetrics = false,
}: AIPlanBannerProps) {
  const trimmed = message.trim()
  const line = (
    <>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:rounded-xl",
          embedded ? "h-9 w-9 sm:h-10 sm:w-10" : "h-10 w-10 rounded-xl ring-1 ring-slate-200",
        )}
      >
        <Sparkles
          className={cn("ai-sparkle-icon shrink-0", embedded ? "h-4 w-4 sm:h-5 sm:w-5" : "h-5 w-5")}
          strokeWidth={2}
          aria-hidden
        />
      </div>
      <p
        className="min-w-0 flex-1 text-sm leading-snug text-slate-700 line-clamp-1 max-sm:text-xs max-sm:leading-snug"
        title={trimmed ? `今日规划 · ${trimmed}` : "今日规划"}
      >
        <span className="font-semibold text-slate-900">今日规划</span>
        {trimmed ? (
          <>
            <span className="font-normal text-slate-400"> · </span>
            <span className="font-normal">{trimmed}</span>
          </>
        ) : null}
      </p>
    </>
  )

  if (embedded && unifiedWithMetrics) {
    return (
      <div className={cn("relative px-4 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5", className)}>
        <div className="flex items-center gap-3 pl-2 sm:gap-4 sm:pl-3">{line}</div>
      </div>
    )
  }

  if (embedded) {
    return (
      <div
        className={cn(
          "relative border-b border-slate-100/90 px-4 py-4 sm:px-5 sm:py-5",
          "bg-gradient-to-br from-[#EEF2FF]/75 via-white to-[#F0F9FF]/80",
          className,
        )}
      >
        <div className="absolute left-0 top-0 h-full w-[3px] bg-primary" aria-hidden />
        <div className="flex items-center gap-3 pl-2 sm:gap-4 sm:pl-3">{line}</div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-200/80 p-4 shadow-sm shadow-slate-200/50 sm:p-5",
        "bg-gradient-to-br from-[#EEF2FF] to-[#F0F9FF]",
        "border-l-[3px] border-l-primary",
        className,
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">{line}</div>
    </div>
  )
}
