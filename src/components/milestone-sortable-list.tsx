"use client"

import { useState } from "react"
import { GripVertical, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GoalDeadlinePicker } from "@/components/goal-deadline-picker"
import { RequiredFieldMark } from "@/components/goal-form-shared"
import { cn } from "@/lib/utils"
import { MILESTONE_DETAIL_MAX_CHARS, MILESTONE_TITLE_MAX_CHARS } from "@/lib/milestone-limits"
import { MilestoneIndexBadge } from "@/components/milestone-index-badge"

const CARD_BORDER = "#E5E7EB"
const BODY_TEXT = "#6B7280"
const PRIMARY = "#4F46E5"

export type MilestoneSortableRow = {
  id: string
  title: string
  detail?: string
  targetDate: string
  achieved?: boolean
}

export type MilestoneTaskProgress = { completed: number; total: number }

interface MilestoneSortableListProps {
  items: MilestoneSortableRow[]
  onReorder: (next: MilestoneSortableRow[]) => void
  onUpdate: (id: string, patch: Partial<Pick<MilestoneSortableRow, "title" | "detail" | "targetDate">>) => void
  onRemove: (id: string) => void
  minItems?: number
  variant?: "create" | "edit"
  onMarkAchieved?: (id: string) => void
  onUnmarkAchieved?: (id: string) => void
  /** 若该里程碑下已有每日任务，用于展示完成进度 */
  taskProgressForMilestone?: (milestoneId: string) => MilestoneTaskProgress | undefined
}

export function MilestoneSortableList({
  items,
  onReorder,
  onUpdate,
  onRemove,
  minItems = 1,
  variant = "create",
  onMarkAchieved,
  onUnmarkAchieved,
  taskProgressForMilestone,
}: MilestoneSortableListProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, id: string) => {
    const row = items.find((m) => m.id === id)
    if (variant === "edit" && row?.achieved) {
      e.preventDefault()
      return
    }
    setDraggingId(id)
    e.dataTransfer.setData("text/plain", id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData("text/plain")
    setDraggingId(null)
    if (!sourceId || sourceId === targetId) return
    const si = items.findIndex((m) => m.id === sourceId)
    const ti = items.findIndex((m) => m.id === targetId)
    if (si < 0 || ti < 0) return
    const next = [...items]
    const [removed] = next.splice(si, 1)
    next.splice(ti, 0, removed)
    onReorder(next)
  }

  const handleDragEnd = () => setDraggingId(null)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 font-sans">
      {items.map((milestone, index) => {
        const locked = variant === "edit" && milestone.achieved
        const isDragging = draggingId === milestone.id
        const headline = milestone.title ?? ""
        const detail = milestone.detail ?? ""
        const progress = taskProgressForMilestone?.(milestone.id)
        const showProgress = progress != null && progress.total > 0
        const pct = showProgress ? Math.min(100, Math.round((progress!.completed / progress!.total) * 100)) : 0

        return (
          <div
            key={milestone.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, milestone.id)}
            className={cn(
              "group relative flex flex-col rounded-2xl border bg-white p-6 transition-[box-shadow,opacity] duration-200",
              "shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_14px_rgba(15,23,42,0.06)]",
              isDragging && "opacity-65",
              locked && "bg-slate-50/90",
            )}
            style={{ borderColor: CARD_BORDER }}
          >
            {/* Header */}
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
                <MilestoneIndexBadge order={index + 1} />
                {variant === "edit" && milestone.achieved ? (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    已达成
                  </span>
                ) : null}
                <div
                  draggable={!locked}
                  onDragStart={(e) => handleDragStart(e, milestone.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "-m-1 flex shrink-0 cursor-grab touch-none rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing",
                    locked && "cursor-not-allowed opacity-30",
                  )}
                  title={locked ? "已达成里程碑不可排序" : "拖动排序"}
                  role="button"
                  tabIndex={0}
                  aria-label="拖动以调整里程碑顺序"
                >
                  <GripVertical className="h-4 w-4" />
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {variant === "edit" && !milestone.achieved ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 border-[#E5E7EB] text-xs font-medium text-slate-700 shadow-none"
                    onClick={() => onMarkAchieved?.(milestone.id)}
                  >
                    标记已达成
                  </Button>
                ) : null}
                {variant === "edit" && milestone.achieved ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 text-xs text-muted-foreground"
                    onClick={() => onUnmarkAchieved?.(milestone.id)}
                  >
                    撤销达成
                  </Button>
                ) : null}
                <GoalDeadlinePicker
                  id={`milestone-deadline-${milestone.id}`}
                  value={milestone.targetDate}
                  onChange={(iso) => onUpdate(milestone.id, { targetDate: iso })}
                  disabled={locked}
                  placeholder="截止日期"
                  className={cn(
                    "!h-9 !w-auto min-h-0 min-w-[9rem] max-w-[11rem] shrink-0 justify-center gap-1.5 rounded-lg border px-2.5 py-0 text-xs font-medium shadow-none sm:text-sm",
                    "border-[#E5E7EB] bg-white text-slate-800 hover:bg-slate-50",
                    locked && "pointer-events-none opacity-60",
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600",
                    "opacity-100 focus-visible:opacity-100 md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100",
                  )}
                  onClick={() => onRemove(milestone.id)}
                  disabled={items.length <= minItems}
                  aria-label="删除里程碑"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Title + detail hierarchy */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-1.5 text-xs font-medium text-slate-500">
                <span>阶段目标</span>
                <RequiredFieldMark />
              </div>
              <Input
                value={headline}
                maxLength={MILESTONE_TITLE_MAX_CHARS}
                onChange={(e) =>
                  onUpdate(milestone.id, {
                    title: e.target.value.replace(/\r?\n/g, "").slice(0, MILESTONE_TITLE_MAX_CHARS),
                  })
                }
                placeholder="例如：掌握 Python 基础语法"
                disabled={locked}
                className={cn(
                  "h-auto min-h-[2.75rem] border-0 bg-transparent px-0 py-1 text-sm font-bold tracking-tight text-slate-900 shadow-none sm:text-lg",
                  "focus-visible:ring-0 focus-visible:ring-offset-0",
                  "placeholder:font-normal placeholder:text-slate-400",
                  locked && "pointer-events-none opacity-60",
                )}
                aria-required
              />
              <p className="mt-0.5 text-right text-[10px] tabular-nums text-slate-400">
                {headline.length}/{MILESTONE_TITLE_MAX_CHARS}
              </p>
            </div>

            <div className="mt-4 space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-slate-500">阶段说明</p>
                <span className="text-[10px] tabular-nums text-slate-400">
                  {detail.length}/{MILESTONE_DETAIL_MAX_CHARS}
                </span>
              </div>
              <Textarea
                value={detail}
                maxLength={MILESTONE_DETAIL_MAX_CHARS}
                onChange={(e) =>
                  onUpdate(milestone.id, {
                    detail: e.target.value.slice(0, MILESTONE_DETAIL_MAX_CHARS),
                  })
                }
                placeholder={"- 具体细节：\n- 验收标准：\n- 参考资料："}
                rows={3}
                disabled={locked}
                className={cn(
                  "min-h-[5rem] resize-y border-0 bg-transparent px-0 py-0 text-xs leading-relaxed shadow-none",
                  "focus-visible:ring-0 focus-visible:ring-offset-0",
                  "placeholder:text-[#9CA3AF]",
                  locked && "pointer-events-none opacity-60",
                )}
                style={{ color: BODY_TEXT }}
              />
            </div>

            {showProgress ? (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">任务进度</span>
                  <span className="tabular-nums">
                    {progress!.completed}/{progress!.total} 已完成
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: PRIMARY,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
