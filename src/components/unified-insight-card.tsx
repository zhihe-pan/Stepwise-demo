import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** 与总览 / 今日摘要区一致的外层卡片 */
const surfaceCard = cn(
  "rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
)

export type UnifiedInsightCardProps = {
  /** 整块区域的无障碍名称 */
  ariaLabel: string
  /** 顶部 AI / 建议叙事区（不要再包一层渐变卡片） */
  ai: ReactNode
  /** 底部数据区（格线、数字等） */
  metrics: ReactNode
  /** 数据区无障碍名称（仅供读屏，界面不出现额外标题） */
  metricsAriaLabel?: string
}

/**
 * 总览 / 今日共用：同一主色竖条、连续渐变背景；
 * AI 与指标仅以轻分割线和半透明底衔接，避免「多一块标签/多一张子卡」的割裂感。
 */
export function UnifiedInsightCard({
  ariaLabel,
  ai,
  metrics,
  metricsAriaLabel = "关键指标",
}: UnifiedInsightCardProps) {
  return (
    <section className={cn(surfaceCard, "relative overflow-hidden")} aria-label={ariaLabel}>
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-[1] w-[3px] bg-primary" aria-hidden />

      <div
        className={cn(
          "relative z-0 min-w-0",
          "bg-gradient-to-b from-[#EEF2FF]/48 via-white to-[#F1F5F9]/90",
        )}
      >
        <div className="min-w-0 px-4 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5">{ai}</div>

        <div
          className={cn(
            "border-t border-slate-200/40",
            "bg-gradient-to-b from-white/35 to-white/80",
          )}
          role="region"
          aria-label={metricsAriaLabel}
        >
          {metrics}
        </div>
      </div>
    </section>
  )
}
