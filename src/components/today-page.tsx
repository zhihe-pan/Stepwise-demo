"use client"

import { useMemo, useOptimistic, useState, useTransition } from "react"
import { format, parseISO } from "date-fns"
import { AIPlanBanner } from "./ai-plan-banner"
import { UnifiedInsightCard } from "./unified-insight-card"
import { GoalTaskCard } from "./goal-task-card"
import { MissedTaskDialog } from "./missed-task-dialog"
import { TodayEmptyState } from "./today-empty-state"
import type { Goal } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import {
  isTaskCheckedOnCalendarDay,
  normalizedTaskSpanDays,
  readTaskProgressUnits,
  tasksForActiveMilestoneOnCalendarDay,
} from "@/lib/goal-helpers"
import { buildTodayAiPlanSummary } from "@/lib/today-plan-summary"
import {
  carryOverTodayTaskAction,
  logIncompleteOpenEditGoalAction,
  updateTaskStatusAction,
} from "@/app/actions/app"
import type { TaskIncompleteReason } from "./missed-task-dialog"

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]
  const weekday = weekdays[date.getDay()]
  return `${year}年${month}月${day}日 ${weekday}`
}

interface TodayPageProps {
  goals: Goal[]
  onEditGoal?: (goal: Goal) => void
  onAddGoal?: () => void
  onDataRefresh?: () => void
}

type ToggleTaskPayload = { taskId: string; completed: boolean }

function TodayMetricCell({
  label,
  value,
  dotClass,
  ariaLabel,
}: {
  label: string
  value: number
  dotClass: string
  ariaLabel: string
}) {
  return (
    <div className="min-w-0 px-1 py-2 sm:px-4 sm:py-4" role="group" aria-label={ariaLabel}>
      <div className="mx-auto flex min-w-0 max-w-[9rem] flex-col items-center justify-center text-center">
        <div className="mb-0.5 flex items-center justify-center gap-0.5 sm:mb-1 sm:gap-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2", dotClass)} aria-hidden />
          <p className="truncate text-[9px] font-medium text-slate-500 sm:text-xs">{label}</p>
        </div>
        <p className="text-lg font-bold tabular-nums leading-none tracking-tight text-slate-900 sm:text-2xl">{value}</p>
      </div>
    </div>
  )
}

function DailyProgressRing({
  completed,
  total,
  embedded,
  embeddedRingSize,
}: {
  completed: number
  total: number
  embedded?: boolean
  embeddedRingSize?: number
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const clamped = Math.max(0, Math.min(100, pct))
  const size = embedded ? (embeddedRingSize ?? 64) : 72
  const stroke = embedded ? (size <= 56 ? 5 : 6) : 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (clamped / 100) * c

  const inner = (
    <>
      <div className="mb-0.5 flex items-center justify-center gap-0.5 sm:mb-1.5 sm:gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary sm:h-2 sm:w-2" aria-hidden />
        <p className="truncate text-[9px] font-medium text-slate-500 sm:text-xs">完成度</p>
      </div>
      <div className="flex items-center justify-center">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(226 232 240)" strokeWidth={stroke} fill="none" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="currentColor"
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
              className={cn(
                "transition-all duration-500 ease-out",
                completed > 0 ? "text-primary" : "text-slate-400",
              )}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-slate-900 sm:text-xs">
            {clamped}%
          </div>
        </div>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div
        className="flex min-w-0 flex-col items-center justify-center bg-transparent px-0.5 py-2 sm:px-2 sm:py-4"
        role="group"
        aria-label={`今日完成度 ${clamped}%`}
      >
        {inner}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-2.5 py-2.5 shadow-sm shadow-slate-200/35">
      {inner}
    </div>
  )
}

function TodaySummaryPanel({
  message,
  total,
  completed,
  pending,
}: {
  message: string
  total: number
  completed: number
  pending: number
}) {
  return (
    <UnifiedInsightCard
      ariaLabel="今日概览"
      metricsAriaLabel="今日任务与完成度"
      ai={<AIPlanBanner message={message} embedded unifiedWithMetrics className="p-0 sm:p-0" />}
      metrics={
        <div className="grid min-w-0 grid-cols-4 divide-x divide-slate-100/90 bg-transparent">
          <TodayMetricCell
            label="今日任务"
            value={total}
            dotClass="bg-primary"
            ariaLabel={`今日任务共 ${total} 项`}
          />
          <TodayMetricCell
            label="已完成"
            value={completed}
            dotClass="bg-emerald-500"
            ariaLabel={`已完成 ${completed} 项`}
          />
          <TodayMetricCell
            label="待办"
            value={pending}
            dotClass="bg-amber-400"
            ariaLabel={`待办 ${pending} 项`}
          />
          <DailyProgressRing
            completed={completed}
            total={total}
            embedded
            embeddedRingSize={52}
          />
        </div>
      }
    />
  )
}

export function TodayPage({ goals, onEditGoal, onAddGoal, onDataRefresh }: TodayPageProps) {
  const [missedTaskId, setMissedTaskId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  const [optimisticGoals, markTaskOptimistic] = useOptimistic(
    goals,
    (g: Goal[], { taskId, completed }: ToggleTaskPayload) =>
      g.map((goal) => ({
        ...goal,
        tasks: goal.tasks.map((t) => {
          if (t.id !== taskId) return t
          const span = normalizedTaskSpanDays(t)
          const units = readTaskProgressUnits(t)
          if (span <= 1) {
            return { ...t, completed, progressUnits: completed ? 1 : 0 }
          }
          if (completed) {
            const next = Math.min(span, units + 1)
            return { ...t, progressUnits: next, completed: next >= span }
          }
          const next = Math.max(0, units - 1)
          return { ...t, progressUnits: next, completed: false }
        }),
      })),
  )

  const currentDate = new Date()
  const calendarDateStr = format(currentDate, "yyyy-MM-dd")

  const handleToggleTaskComplete = (taskId: string, completed: boolean) => {
    setPendingTaskIds((current) => (current.includes(taskId) ? current : [...current, taskId]))
    startTransition(() => {
      markTaskOptimistic({ taskId, completed })
    })
    void (async () => {
      try {
        await updateTaskStatusAction(taskId, completed, calendarDateStr)
      } finally {
        setPendingTaskIds((current) => current.filter((id) => id !== taskId))
        startTransition(() => {
          onDataRefresh?.()
        })
      }
    })()
  }

  const handleMissTask = (taskId: string) => {
    setMissedTaskId(taskId)
    setDialogOpen(true)
  }

  const handlePostponeMissedToTomorrow = (reason: TaskIncompleteReason) => {
    const id = missedTaskId
    if (!id) return
    void (async () => {
      await carryOverTodayTaskAction({
        taskId: id,
        reasonCode: reason.reasonCode,
        reasonLabel: reason.reasonLabel,
        calendarDate: calendarDateStr,
      })
      setMissedTaskId(null)
      setDialogOpen(false)
      startTransition(() => {
        onDataRefresh?.()
      })
    })()
  }

  const handleEditGoalForMissed = (reason: TaskIncompleteReason) => {
    const id = missedTaskId
    if (!id || !onEditGoal) return
    const g = optimisticGoals.find((goal) => goal.tasks.some((t) => t.id === id))
    void (async () => {
      await logIncompleteOpenEditGoalAction({
        taskId: id,
        reasonCode: reason.reasonCode,
        reasonLabel: reason.reasonLabel,
        calendarDate: calendarDateStr,
      })
      if (g) onEditGoal(g)
      setMissedTaskId(null)
      setDialogOpen(false)
      startTransition(() => {
        onDataRefresh?.()
      })
    })()
  }

  const missedTask = missedTaskId
    ? optimisticGoals.flatMap((g) => g.tasks).find((t) => t.id === missedTaskId)
    : null

  const allTasks = optimisticGoals.flatMap((g) =>
    tasksForActiveMilestoneOnCalendarDay(g, currentDate, { includeCompleted: true }),
  )
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter((t) => isTaskCheckedOnCalendarDay(t, currentDate)).length
  const pendingTasks = Math.max(0, totalTasks - completedTasks)
  const aiPlanMessage = buildTodayAiPlanSummary(optimisticGoals, currentDate)
  const focusTaskId = allTasks.find((t) => !isTaskCheckedOnCalendarDay(t, currentDate))?.id

  /** 今日仍有未勾选任务的目标置顶；今日已全部完成或今日无任务的目标沉底（组内保持原顺序） */
  const sortedGoalsForToday = useMemo(() => {
    const day = parseISO(`${calendarDateStr}T12:00:00`)
    const decorated = optimisticGoals.map((goal, index) => {
      const tasks = tasksForActiveMilestoneOnCalendarDay(goal, day, { includeCompleted: true })
      const doneForToday =
        tasks.length === 0 || tasks.every((t) => isTaskCheckedOnCalendarDay(t, day))
      return { goal, index, doneForToday }
    })
    decorated.sort((a, b) => {
      if (a.doneForToday !== b.doneForToday) return a.doneForToday ? 1 : -1
      return a.index - b.index
    })
    return decorated.map((d) => d.goal)
  }, [optimisticGoals, calendarDateStr])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-transparent">
      <header className="hidden shrink-0 border-b border-slate-200 bg-white/40 backdrop-blur-sm md:block">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-8 md:py-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">今日</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{formatDate(currentDate)}</p>
        </div>
      </header>

      <main className="app-main-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="mx-auto box-border min-w-0 max-w-5xl space-y-8 px-4 py-4 md:px-8 md:py-8">
          <TodaySummaryPanel
            message={aiPlanMessage}
            total={totalTasks}
            completed={completedTasks}
            pending={pendingTasks}
          />

          {allTasks.length > 0 ? (
            <section className="min-w-0 pb-2" aria-label="按目标分组的今日任务">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-800">今日任务</h2>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
                {sortedGoalsForToday.map((goal) => (
                  <GoalTaskCard
                    key={goal.id}
                    goal={goal}
                    calendarDay={currentDate}
                    tasks={tasksForActiveMilestoneOnCalendarDay(goal, currentDate, {
                      includeCompleted: true,
                    })}
                    onToggleTaskComplete={handleToggleTaskComplete}
                    onMissTask={handleMissTask}
                    disabledTaskIds={pendingTaskIds}
                    focusTaskId={focusTaskId}
                  />
                ))}
              </div>
            </section>
          ) : (
            <TodayEmptyState onNewGoal={() => onAddGoal?.()} />
          )}
        </div>
      </main>

      <MissedTaskDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setMissedTaskId(null)
        }}
        taskTitle={missedTask?.title || ""}
        disabled={isPending}
        onPostponeToTomorrow={handlePostponeMissedToTomorrow}
        onEditGoal={handleEditGoalForMissed}
      />
    </div>
  )
}
