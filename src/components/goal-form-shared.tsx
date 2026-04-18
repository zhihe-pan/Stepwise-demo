"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

/** 字段 Label：小字号加粗、深灰 */
export const gfLabel = "text-sm font-semibold text-slate-800"

/** 表单必填项标签后缀 */
export function RequiredFieldMark() {
  return (
    <span className="ml-1 text-red-500" aria-hidden="true">
      *
    </span>
  )
}

/** Input / 数字输入：h-12、轻边框与白底、聚焦品牌光晕 */
export const gfInput =
  "h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm transition-[box-shadow,border-color] placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"

/** 多行：同系列质感，略增高 */
export const gfTextarea =
  "min-h-[5.5rem] rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm transition-[box-shadow,border-color] placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"

/** SelectTrigger 全宽时用 */
export const gfSelectTrigger =
  "h-12 w-full rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-white focus-visible:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary/40"

/** 日期 Popover 触发按钮 */
export const gfDateButton =
  "h-12 w-full justify-start gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-normal shadow-sm transition-[box-shadow,border-color] hover:bg-white focus-visible:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"

export function GoalFormSection({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-2xl bg-slate-50/50 p-5 sm:p-6", className)}>
      <header className="mb-5">
        <h2 className="text-sm font-semibold tracking-tight text-slate-800">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

export function EasyFirstStepField({
  value,
  onChange,
  id,
  "aria-invalid": ariaInvalid,
}: {
  value: string
  onChange: (v: string) => void
  id?: string
  "aria-invalid"?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/5 via-white to-white p-4 shadow-sm transition-shadow sm:p-5",
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">轻松第一步</p>
        <p className="text-xs leading-relaxed text-slate-600">
          写下小到不可能失败的第一步，降低启动阻力；完成它不需要「准备好」。
        </p>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="一句话描述你今天就能完成的超小行动…"
        aria-invalid={ariaInvalid}
        className={cn(
          "mt-3 min-h-[5.25rem] resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-gray-500 dark:placeholder:text-gray-400 shadow-sm transition-[box-shadow,border-color] focus-visible:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
        )}
      />
    </div>
  )
}
