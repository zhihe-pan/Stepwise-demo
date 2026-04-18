"use client"

import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Clock, CalendarDays, MoreHorizontal, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { isTaskCheckedOnCalendarDay } from "@/lib/goal-helpers"
import type { Goal, Task } from "@/lib/mock-data"

/** 与总览页目标卡一致 */
const surfaceCard = cn(
  "rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
)

interface GoalTaskCardProps {
  goal: Goal
  tasks?: Task[]
  /** Today 页的「当天」，用于跨天任务勾选态 */
  calendarDay: Date
  onToggleTaskComplete: (taskId: string, completed: boolean) => void
  onMissTask: (taskId: string) => void
  disabledTaskIds?: string[]
  focusTaskId?: string
}

function TaskRow({
  task,
  calendarDay,
  onToggleComplete,
  onMiss,
  disabled,
  isFocus,
}: {
  task: Task
  calendarDay: Date
  onToggleComplete: (completed: boolean) => void
  onMiss: () => void
  disabled?: boolean
  isFocus?: boolean
}) {
  const spanDays = task.spanDays >= 1 ? task.spanDays : 1
  const startLabel =
    task.startDate && /^\d{4}-\d{2}-\d{2}$/.test(task.startDate)
      ? format(parseISO(`${task.startDate}T12:00:00`), "M月d日", { locale: zhCN })
      : null
  const checkedToday = isTaskCheckedOnCalendarDay(task, calendarDay)
  const isDone = checkedToday

  return (
    <div
      className={cn(
        "transition-opacity duration-300 ease-out",
        isDone && "opacity-60",
      )}
    >
      <div
        className={cn(
          "rounded-lg border border-slate-100/90 border-l-[3px] py-2.5 pl-2.5 pr-2 transition-colors duration-300 ease-out sm:py-3 sm:pl-3 sm:pr-2.5",
          isDone ? "border-l-slate-200 bg-slate-50/40" : "border-l-primary/45 bg-white",
          isFocus && !isDone && "border-l-primary bg-primary/[0.04] shadow-[0_0_0_1px_rgba(79,110,247,0.12)]",
        )}
      >
        <div className="flex items-start gap-2.5 sm:gap-3">
          <Checkbox
            checked={checkedToday}
            onCheckedChange={(v) => onToggleComplete(v === true)}
            disabled={disabled}
            className={cn(
              "mt-0.5 size-[1.125rem] shrink-0 rounded-full border-[1.5px] transition-all duration-300 ease-out",
              "border-slate-300/90 bg-white shadow-none",
              "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:shadow-sm",
              isFocus && !checkedToday && "border-primary/70",
              "[&_[data-slot=checkbox-indicator]_svg]:size-2.5 [&_[data-slot=checkbox-indicator]_svg]:stroke-[2.75]",
            )}
            aria-label={checkedToday ? "撤销完成，标记为未完成" : "标记为已完成"}
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <h4
                  className={cn(
                    "min-w-0 text-sm font-semibold leading-snug tracking-tight text-slate-900 transition-[color,opacity] duration-300 ease-out",
                    isDone && "text-slate-400 line-through",
                  )}
                >
                  {isFocus && !isDone ? (
                    <span className="mr-2 inline-flex translate-y-[-0.5px] rounded-full bg-primary/10 px-2 py-0.5 align-middle text-[10px] font-semibold text-primary ring-1 ring-primary/20">
                      建议先做
                    </span>
                  ) : null}
                  {task.title}
                </h4>
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs transition-colors duration-300",
                    isDone ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-90" aria-hidden />
                    <span className="tabular-nums text-slate-600">{task.duration} 分钟</span>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-90" aria-hidden />
                    <span className="tabular-nums">{spanDays} 天</span>
                  </span>
                  {startLabel ? (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="tabular-nums">{startLabel} 起</span>
                    </>
                  ) : null}
                </div>
              </div>

              {!isDone ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-100/80 hover:text-slate-600"
                      disabled={disabled}
                      aria-label="更多操作"
                    >
                      <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      className="text-sm"
                      onSelect={() => onMiss()}
                      disabled={disabled}
                    >
                      今天未完成…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>

            <div className="space-y-1.5 transition-all duration-300 ease-out">
              <p className={cn("text-[11px] font-medium text-slate-500", isDone && "text-slate-400/80")}>完成标准</p>
              <p
                className={cn(
                  "text-xs leading-relaxed text-slate-600 transition-all duration-300 ease-out",
                  isDone && "text-slate-400 line-through",
                )}
              >
                {task.criteria}
              </p>
            </div>

            {task.minimumVersion.trim() ? (
              <div
                className={cn(
                  "rounded-lg border border-primary/15 bg-primary/[0.06] p-2.5 transition-all duration-300 sm:p-3",
                  isDone && "border-slate-200/70 bg-slate-100/40",
                )}
              >
                <div className="flex flex-wrap items-start gap-x-2 gap-y-1 leading-snug">
                  <Sparkles
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0 text-primary opacity-90",
                      isDone && "text-slate-400 opacity-80",
                    )}
                    aria-hidden
                  />
                  <span className={cn("text-xs font-semibold text-primary", isDone && "text-slate-500")}>
                    轻松第一步
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-xs leading-relaxed text-slate-700",
                      isDone && "text-slate-400 line-through",
                    )}
                  >
                    {task.minimumVersion}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function GoalTaskCard({
  goal,
  tasks: tasksOverride,
  calendarDay,
  onToggleTaskComplete,
  onMissTask,
  disabledTaskIds = [],
  focusTaskId,
}: GoalTaskCardProps) {
  const tasks = tasksOverride ?? goal.tasks
  const disabledTaskIdSet = useMemo(() => new Set(disabledTaskIds), [disabledTaskIds])

  const { pending, done } = useMemo(() => {
    const p: Task[] = []
    const d: Task[] = []
    for (const t of tasks) {
      if (isTaskCheckedOnCalendarDay(t, calendarDay)) d.push(t)
      else p.push(t)
    }
    return { pending: p, done: d }
  }, [tasks, calendarDay])

  const totalDuration = tasks.reduce((acc, task) => acc + task.duration, 0)

  if (tasks.length === 0) return null

  return (
    <div
      className={cn(
        surfaceCard,
        "flex flex-col p-4 transition-shadow sm:p-5",
        "hover:shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]",
      )}
    >
      <div className="flex min-w-0 gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-xl leading-none ring-1 ring-slate-100">
          {goal.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <h3 className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-slate-900">
              {goal.name}
            </h3>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200/80">
              {goal.currentPhase}
            </span>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <span className="tabular-nums text-slate-600">合计约 {totalDuration} 分钟</span>
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="space-y-4">
          {pending.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              calendarDay={calendarDay}
              onToggleComplete={(c) => onToggleTaskComplete(task.id, c)}
              onMiss={() => onMissTask(task.id)}
              disabled={disabledTaskIdSet.has(task.id)}
              isFocus={task.id === focusTaskId}
            />
          ))}

          {done.length > 0 ? (
            <>
              <div className="flex items-center gap-3 py-1" role="separator" aria-label="已完成任务">
                <div className="h-px flex-1 bg-slate-200/90" />
                <span className="shrink-0 text-xs font-medium tracking-wide text-slate-400">已完成</span>
                <div className="h-px flex-1 bg-slate-200/90" />
              </div>
              {done.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  calendarDay={calendarDay}
                  onToggleComplete={(markDone) => onToggleTaskComplete(task.id, markDone)}
                  onMiss={() => onMissTask(task.id)}
                  disabled={disabledTaskIdSet.has(task.id)}
                />
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
