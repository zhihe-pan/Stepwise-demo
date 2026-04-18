"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { missedReasons } from "@/lib/mock-data"

export interface TaskIncompleteReason {
  reasonCode: string
  reasonLabel: string
}

interface MissedTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskTitle: string
  disabled?: boolean
  onPostponeToTomorrow: (reason: TaskIncompleteReason) => void | Promise<void>
  onEditGoal: (reason: TaskIncompleteReason) => void | Promise<void>
}

export function MissedTaskDialog({
  open,
  onOpenChange,
  taskTitle,
  disabled = false,
  onPostponeToTomorrow,
  onEditGoal,
}: MissedTaskDialogProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [reason, setReason] = useState<TaskIncompleteReason | null>(null)

  useEffect(() => {
    if (open) {
      setStep(1)
      setReason(null)
    }
  }, [open])

  const goReason = (id: string, label: string) => {
    setReason({ reasonCode: id, reasonLabel: label })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>今天未完成该任务</DialogTitle>
          <DialogDescription className="text-muted-foreground">{taskTitle}</DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <>
            <p className="text-sm text-muted-foreground">先说下原因，便于记录在目标的执行记录里：</p>
            <div className="flex flex-wrap gap-2 py-2">
              {missedReasons.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => goReason(r.id, r.label)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                    reason?.reasonCode === r.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" disabled={disabled} onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="button" disabled={disabled || !reason} onClick={() => setStep(2)}>
                下一步
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              原因：{reason ? <span className="font-medium text-foreground">{reason.reasonLabel}</span> : "—"}
            </p>
            <p className="text-sm text-muted-foreground">再选择处理方式：</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">推迟到明天</span>：把今日这部分并入明日。
              </li>
              <li>
                <span className="font-medium text-foreground">修改目标</span>：进入编辑流程，调整里程碑或每日任务。
              </li>
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button type="button" variant="outline" disabled={disabled} onClick={() => setStep(1)}>
                上一步
              </Button>
              <Button type="button" variant="outline" disabled={disabled} onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || !reason}
                className="border-2 border-slate-300 bg-background shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-900/40"
                onClick={() => reason && void onEditGoal(reason)}
              >
                修改目标
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || !reason}
                className="border-2 border-slate-300 bg-background shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-900/40"
                onClick={() => reason && void onPostponeToTomorrow(reason)}
              >
                推迟到明天
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
