import { cn } from "@/lib/utils"

/** 品牌主行动：CSS 变量渐变（--primary-from / --primary-to）+ 主色光晕 + 物理反馈 */
export const premiumGradientCtaClassName = cn(
  "inline-flex items-center justify-center gap-2 font-semibold tracking-tight text-white",
  "bg-gradient-to-br from-primary-from to-primary-to",
  "shadow-lg shadow-primary/30",
  "transition-all duration-300 ease-in-out",
  "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 hover:brightness-[1.06]",
  "active:scale-[0.97] active:brightness-[0.98]",
  "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
)

export const premiumGradientCtaDisabledClassNames = cn(
  "disabled:pointer-events-none disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-lg",
  "disabled:hover:brightness-100 disabled:active:scale-100",
)
