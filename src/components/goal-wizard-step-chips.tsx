"use client"

import {
  ChartGantt,
  Check,
  ClipboardList,
  Flag,
  ListTodo,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS: readonly { step: 0 | 1 | 2 | 3; label: string; Icon: LucideIcon }[] = [
  { step: 0, label: "基本信息", Icon: ClipboardList },
  { step: 1, label: "里程碑", Icon: Flag },
  { step: 2, label: "每日行动", Icon: ListTodo },
  { step: 3, label: "甘特图", Icon: ChartGantt },
] as const

export type WizardChipStep = (typeof STEPS)[number]["step"]

type GoalWizardStepChipsProps = {
  stepIndex: number
  onSelectStep?: (step: WizardChipStep) => void
  showMobileStepHeading?: boolean
}

export function GoalWizardStepChips({
  stepIndex,
  onSelectStep,
  showMobileStepHeading = true,
}: GoalWizardStepChipsProps) {
  const currentStepLabel = STEPS[stepIndex]?.label ?? ""

  return (
    <div className="mb-6">
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {STEPS.map((s, idx) => {
          const isCompleted = stepIndex > s.step
          const isActive = stepIndex === s.step
          const Icon = s.Icon

          return (
            <div key={s.step} className="relative min-w-0">
              {idx < STEPS.length - 1 ? (
                <span
                  className={cn(
                    "pointer-events-none absolute right-[-0.85rem] top-1/2 hidden h-px w-3 -translate-y-1/2 sm:block",
                    isCompleted || isActive ? "bg-primary/35" : "bg-slate-200",
                  )}
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                onClick={() => onSelectStep?.(s.step)}
                disabled={!onSelectStep}
                className={cn(
                  "flex w-full min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-medium transition-all sm:gap-1.5 sm:px-2.5 sm:py-2 sm:text-xs",
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : isCompleted
                      ? "border border-primary/20 bg-white text-primary shadow-sm"
                      : "bg-slate-100 text-slate-400",
                  onSelectStep && "cursor-pointer select-none hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full sm:h-4.5 sm:w-4.5",
                    isActive ? "bg-white/20" : isCompleted ? "bg-primary text-primary-foreground" : "bg-slate-200/80",
                  )}
                >
                  {isCompleted
                    ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden />
                    : <Icon className="h-2.5 w-2.5 shrink-0" aria-hidden />
                  }
                </span>
                <span className="truncate whitespace-nowrap">{s.label}</span>
              </button>
            </div>
          )
        })}
      </div>
      {showMobileStepHeading ? (
        <p className="mt-2 text-center text-xs font-medium text-primary sm:hidden">
          第 {stepIndex + 1} 步：{currentStepLabel}
        </p>
      ) : null}
    </div>
  )
}
