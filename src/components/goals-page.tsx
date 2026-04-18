"use client"

import { useMemo, useState, useTransition, useOptimistic } from "react"
import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns"
import { zhCN } from "date-fns/locale"
import {
  Check,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Target,
  Pencil,
  Eye,
  Trash2,
  BarChart3,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { getActiveMilestone, isGoalFullyCompleted } from "@/lib/goal-helpers"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Goal, DiaryEntry, GoalMilestone } from "@/lib/mock-data"
import { IconPicker } from "@/components/icon-picker"
import { GoalDetailSheet } from "@/components/goal-detail-sheet"
import { DeleteGoalDialog } from "@/components/delete-goal-dialog"
import { GoalGanttChart } from "@/components/goal-gantt-chart"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GoalProgressLabeled } from "@/components/ui/progress"
import { createDiaryEntryAction, deleteGoalAction, updateGoalIconAction } from "@/app/actions/app"

function getDaysUntil(dateString: string): number {
  const target = new Date(dateString)
  const today = new Date()
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/** 里程碑 / 目标上的日期字段可能是 yyyy-MM-dd 或 ISO 字符串，统一取日期部分以便计算剩余天数 */
function normalizeIsoDateOnly(raw: string | null | undefined): string | undefined {
  if (raw == null || typeof raw !== "string") return undefined
  const s = raw.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined
}

/** 与总览 / 今日一致的白底卡片 */
const surfaceCard = cn(
  "rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
)

/** 里程碑 target 与「今天」的日历日差（与日期字符串语义一致，避免纯毫秒差一天） */
function calendarDaysUntilIso(iso: string): number {
  const target = startOfDay(parseISO(`${iso.slice(0, 10)}T12:00:00`))
  return differenceInCalendarDays(target, startOfDay(new Date()))
}

/** 里程碑目标日：右侧「剩余/今日截止/逾期」文案与样式（与卡片顶部天数胶囊语义一致） */
function milestoneDaysRemainingPill(iso: string | null | undefined): { label: string; className: string } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = calendarDaysUntilIso(iso)
  const base = "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums sm:text-[11px]"
  if (d > 0) {
    return {
      label: `还剩 ${d} 天`,
      className: cn(base, "bg-primary/8 text-primary ring-1 ring-primary/15"),
    }
  }
  if (d === 0) {
    return { label: "今日截止", className: cn(base, "bg-primary/8 text-primary ring-1 ring-primary/15") }
  }
  return {
    label: `逾期 ${Math.abs(d)} 天`,
    className: cn(base, "border border-rose-200/60 bg-rose-50 text-rose-800"),
  }
}

/** 从创建日到截止日展示计划区间（无 createdAt 时用最早里程碑目标日） */
/** 目标截止日展示（与总览卡片一致） */
function formatGoalDeadlineLabel(deadline: string): string {
  if (deadline && /^\d{4}-\d{2}-\d{2}/.test(deadline)) {
    return format(parseISO(`${deadline.slice(0, 10)}T12:00:00`), "yyyy年M月d日", { locale: zhCN })
  }
  return deadline?.trim() || "—"
}

function goalPlanRangeLabel(goal: Goal): string {
  const end =
    normalizeIsoDateOnly(goal.deadline) ??
    (goal.deadline.length >= 10 ? goal.deadline.trim().slice(0, 10) : "")
  let start: string
  if (goal.createdAt && goal.createdAt.length >= 10) {
    start = goal.createdAt.slice(0, 10)
  } else {
    const dates = (goal.milestones ?? [])
      .map((m) => m.targetDate.trim().slice(0, 10))
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
      .sort()
    start = dates[0] ?? end
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return /^\d{4}-\d{2}-\d{2}$/.test(start) ? `${start} 起` : "—"
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) start = end
  const a = parseISO(`${start}T12:00:00`)
  const b = parseISO(`${end}T12:00:00`)
  return `${format(a, "yyyy年M月d日", { locale: zhCN })} — ${format(b, "yyyy年M月d日", { locale: zhCN })}`
}

function CompletedGoalBentoCard({
  goal,
  isPending,
  onEdit,
  onViewDetail,
  onDelete,
}: {
  goal: Goal
  isPending: boolean
  onEdit: (g: Goal) => void
  onViewDetail: (g: Goal) => void
  onDelete: (g: Goal) => void
}) {
  const [milestonesOpen, setMilestonesOpen] = useState(false)
  const milestones = [...(goal.milestones ?? [])].sort((a, b) => a.targetDate.localeCompare(b.targetDate))

  return (
    <div
      className={cn(
        surfaceCard,
        "group box-border min-w-0 max-w-full overflow-x-hidden p-4 transition-shadow sm:p-5",
        "hover:shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div
          className="min-w-0 flex-1 cursor-pointer rounded-lg py-0.5 outline-none transition-colors hover:bg-slate-50/90"
          onClick={() => onViewDetail(goal)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onViewDetail(goal)
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`查看「${goal.name}」详情`}
        >
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-xl leading-none ring-1 ring-slate-100">
              {goal.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 gap-y-1">
                <h4 className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-slate-900 break-words transition-colors group-hover:text-primary/90">
                  {goal.name}
                </h4>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
                  已达成
                </span>
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 break-words text-slate-600">{goalPlanRangeLabel(goal)}</span>
              </p>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-100/80 hover:text-slate-600"
              disabled={isPending}
              aria-label="更多操作"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onEdit(goal)}>
              <Pencil className="mr-2 h-4 w-4" />
              编辑目标
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewDetail(goal)}>
              <Eye className="mr-2 h-4 w-4" />
              查看详情
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(goal)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              删除目标
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Collapsible open={milestonesOpen} onOpenChange={setMilestonesOpen}>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full min-w-0 items-center justify-between gap-3 rounded-lg py-1 text-left transition-colors hover:bg-slate-50/80"
              aria-expanded={milestonesOpen}
            >
              <span className="text-[11px] font-medium text-slate-500">里程碑记录</span>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600">
                <span className="tabular-nums text-slate-500">共 {milestones.length} 个</span>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", milestonesOpen && "rotate-180")}
                  aria-hidden
                />
              </span>
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="data-[state=closed]:animate-none">
          <ul className="mt-2 max-h-[min(40vh,20rem)] space-y-2 overflow-y-auto border-t border-slate-100/90 pt-3">
            {milestones.map((m) => {
              const d = normalizeIsoDateOnly(m.targetDate) ?? m.targetDate.slice(0, 10)
              return (
                <li
                  key={m.id}
                  className="flex min-w-0 items-start justify-between gap-2 rounded-lg border border-slate-100/90 bg-slate-50/50 px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium leading-snug text-slate-900">{m.title}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-slate-500">{d}</p>
                  </div>
                  {m.achieved ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
                      <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                      已达成
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function goalStatusBadge(goal: { progress: number; deadline: string }) {
  if (goal.progress >= 100) {
    return { label: "已达成", className: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100" }
  }
  const d = getDaysUntil(goal.deadline)
  if (d < 0) {
    return { label: "已逾期", className: "bg-rose-50 text-rose-800 ring-1 ring-rose-200/60" }
  }
  return {
    label: "进行中",
    className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
  }
}

function CurrentMilestoneSection({
  activeMilestone,
  msTitle,
  msTargetDateIso,
  onViewDetail,
}: {
  activeMilestone: GoalMilestone | undefined
  msTitle: string | undefined | null
  /** 里程碑 targetDate（yyyy-MM-dd），用于计算「剩余 xx 天」 */
  msTargetDateIso: string | null | undefined
  onViewDetail: () => void
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const detailText = activeMilestone?.detail?.trim() ?? ""
  const daysPill = milestoneDaysRemainingPill(msTargetDateIso ?? undefined)

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="border-l-2 border-primary/35 pl-3">
        <div className="flex items-center justify-between gap-2 py-0.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Target className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            当前里程碑
          </p>
          {daysPill ? (
            <span className={daysPill.className}>{daysPill.label}</span>
          ) : (
            <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-400 sm:text-[11px]">—</span>
          )}
        </div>

        {detailText ? (
          <Collapsible open={detailOpen} onOpenChange={setDetailOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="mt-2 flex w-full min-w-0 items-start gap-1.5 rounded-md py-0.5 text-left transition-colors hover:bg-slate-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
                aria-expanded={detailOpen}
                aria-label={detailOpen ? "收起阶段说明" : "展开阶段说明"}
              >
                <span className="mt-0.5 inline-flex shrink-0 text-slate-400" aria-hidden>
                  {detailOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                  {msTitle}
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=closed]:animate-none">
              <p className="mt-2 ml-[calc(1rem+0.375rem)] whitespace-pre-wrap break-words border-l border-slate-200/90 pl-2.5 text-xs leading-relaxed text-slate-600">
                {detailText}
              </p>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div
            className="mt-2 cursor-pointer rounded-md py-0.5 outline-none transition-colors hover:bg-slate-50/80 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
            onClick={onViewDetail}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onViewDetail()
              }
            }}
            role="button"
            tabIndex={0}
          >
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{msTitle}</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface GoalsPageProps {
  goals: Goal[]
  onEditGoal: (goal: Goal) => void
  onAddDiaryEntry?: (entry: Pick<DiaryEntry, "content" | "images" | "goalId" | "mood">) => Promise<void>
  onDataRefresh?: () => void
}

type GoalsOptimisticAction =
  | { type: "icon"; goalId: string; emoji: string }
  | { type: "remove"; goalId: string }

function reduceGoalsOptimistic(goalsList: Goal[], action: GoalsOptimisticAction): Goal[] {
  if (action.type === "icon") {
    return goalsList.map((g) => (g.id === action.goalId ? { ...g, emoji: action.emoji } : g))
  }
  return goalsList.filter((g) => g.id !== action.goalId)
}

export function GoalsPage({ goals, onEditGoal, onAddDiaryEntry, onDataRefresh }: GoalsPageProps) {
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [ganttGoal, setGanttGoal] = useState<Goal | null>(null)
  const [mountedGanttGoal, setMountedGanttGoal] = useState<Goal | null>(null)
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [optimisticGoals, patchGoalsOptimistic] = useOptimistic(goals, reduceGoalsOptimistic)

  const { activeGoals, completedGoals } = useMemo(() => {
    const active: Goal[] = []
    const done: Goal[] = []
    for (const g of optimisticGoals) {
      if (isGoalFullyCompleted(g)) done.push(g)
      else active.push(g)
    }
    return { activeGoals: active, completedGoals: done }
  }, [optimisticGoals])

  const handleEditGoal = (goal: Goal) => {
    onEditGoal(goal)
  }

  const handleIconChange = (goalId: string, newIcon: string) => {
    startTransition(() => {
      patchGoalsOptimistic({ type: "icon", goalId, emoji: newIcon })
    })
    void (async () => {
      try {
        await updateGoalIconAction(goalId, newIcon)
      } finally {
        startTransition(() => {
          onDataRefresh?.()
        })
      }
    })()
  }

  const handleViewDetail = (goal: Goal) => {
    setSelectedGoal(goal)
    setDetailSheetOpen(true)
  }

  const handleDeleteGoal = (goal: Goal) => {
    setSelectedGoal(goal)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = (goalId: string) => {
    startTransition(() => {
      patchGoalsOptimistic({ type: "remove", goalId })
      setDeleteDialogOpen(false)
      setDetailSheetOpen(false)
      setSelectedGoal((g) => (g?.id === goalId ? null : g))
      setGanttGoal((g) => (g?.id === goalId ? null : g))
      setMountedGanttGoal((g) => (g?.id === goalId ? null : g))
    })
    void (async () => {
      try {
        await deleteGoalAction(goalId)
      } finally {
        startTransition(() => {
          onDataRefresh?.()
        })
      }
    })()
  }

  const chartGoal = ganttGoal
    ? (optimisticGoals.find((g) => g.id === ganttGoal.id) ?? ganttGoal)
    : mountedGanttGoal
      ? (optimisticGoals.find((g) => g.id === mountedGanttGoal.id) ?? mountedGanttGoal)
      : null

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      <header className="hidden shrink-0 border-b border-slate-200 bg-white/40 backdrop-blur-sm md:block">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-8 md:py-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">目标</h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">管理你的长期目标与里程碑</p>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain overflow-x-hidden">
        <div className="mx-auto box-border min-w-0 max-w-5xl space-y-8 px-4 py-4 md:px-8 md:py-8">
          {optimisticGoals.length > 0 ? (
            <>
              <section className="min-w-0 pb-2" aria-label="进行中的目标">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-slate-800">进行中的目标</h2>
                </div>
                {activeGoals.length === 0 ? (
                  <div className={cn(surfaceCard, "flex items-start gap-3 p-4 sm:p-5")}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <Target className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">暂无进行中的目标</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        当前目标均已完成，或通过侧栏 / 底部「+」新建目标以开始新挑战。
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
                    {activeGoals.map((goal) => {
                      const daysLeft = getDaysUntil(goal.deadline)
                      const completedTasks = goal.tasks.filter((t) => t.completed).length
                      const totalTasks = goal.tasks.length
                      const status = goalStatusBadge(goal)
                      const activeMs = getActiveMilestone(goal)
                      const msTitle = activeMs?.title ?? goal.nextMilestone
                      const msTargetDateIso = normalizeIsoDateOnly(
                        activeMs?.targetDate ?? goal.nextMilestoneDate ?? null,
                      )
                      const msList = goal.milestones ?? []
                      const msDone = msList.filter((m) => m.achieved).length
                      const msTotal = msList.length
                      const deadlineLabel = formatGoalDeadlineLabel(goal.deadline)

                      return (
                        <div
                          key={goal.id}
                          className={cn(
                            surfaceCard,
                            "group relative flex flex-col p-4 transition-shadow sm:p-5",
                            "hover:shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]",
                          )}
                        >
                          {/* 1. 身份：图标 + 名称 + 状态 + 菜单 */}
                          <div className="flex min-w-0 gap-3">
                            <div
                              className="shrink-0"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <IconPicker icon={goal.emoji} onIconChange={(icon) => handleIconChange(goal.id, icon)}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-11 w-11 shrink-0 rounded-2xl bg-slate-50 p-0 text-xl leading-none ring-1 ring-slate-100 hover:bg-slate-100/90"
                                  aria-label="更改目标图标"
                                >
                                  {goal.emoji}
                                </Button>
                              </IconPicker>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div
                                  className="min-w-0 flex-1 cursor-pointer"
                                  onClick={() => handleViewDetail(goal)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault()
                                      handleViewDetail(goal)
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <div className="flex flex-wrap items-center gap-2 gap-y-1">
                                    <h3 className="line-clamp-2 min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-slate-900 transition-colors group-hover:text-primary">
                                      {goal.name}
                                    </h3>
                                    <span
                                      className={cn(
                                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                        status.className,
                                      )}
                                    >
                                      {status.label}
                                    </span>
                                  </div>
                                  {/* 2. 时间上下文：截止日 + 剩余天数（与总览一致的一条） */}
                                  <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                                    <span className="inline-flex items-center gap-1">
                                      <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                                      <span className="tabular-nums text-slate-600">{deadlineLabel}</span>
                                    </span>
                                    <span className="text-slate-300">·</span>
                                    <span className="tabular-nums">
                                      {daysLeft > 0
                                        ? `剩 ${daysLeft} 天`
                                        : daysLeft === 0
                                          ? "今日截止"
                                          : `逾期 ${Math.abs(daysLeft)} 天`}
                                    </span>
                                  </p>
                                </div>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-100/80 hover:text-slate-600"
                                      disabled={isPending}
                                      aria-label="更多操作"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => handleEditGoal(goal)}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      编辑目标
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleViewDetail(goal)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      查看详情
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => {
                                        setMountedGanttGoal(goal)
                                        setGanttGoal(goal)
                                      }}
                                    >
                                      <BarChart3 className="mr-2 h-4 w-4" />
                                      甘特图
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteGoal(goal)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      删除目标
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>

                          {/* 3. 整体进度（先看清完成度，再进入当前阶段） */}
                          <div
                            className="mt-4 w-full min-w-0 cursor-pointer"
                            onClick={() => handleViewDetail(goal)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                handleViewDetail(goal)
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                              <span className="text-[11px] font-medium text-slate-500">进度</span>
                              {msTotal > 0 ? (
                                <span className="text-[11px] tabular-nums text-slate-400">
                                  里程碑 {msDone}/{msTotal}
                                </span>
                              ) : null}
                            </div>
                            <GoalProgressLabeled value={goal.progress} barClassName="h-2 min-h-[8px]" />
                          </div>

                          {/* 4. 当前阶段（操作焦点） */}
                          <CurrentMilestoneSection
                            activeMilestone={activeMs}
                            msTitle={msTitle}
                            msTargetDateIso={msTargetDateIso}
                            onViewDetail={() => handleViewDetail(goal)}
                          />

                          {/* 5. 辅助：执行面统计 + 低频工具 */}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            <p className="text-xs text-slate-500">
                              任务完成{" "}
                              <span className="font-semibold tabular-nums text-slate-700">{completedTasks}</span>
                              <span className="tabular-nums"> / {totalTasks}</span>
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 gap-1 px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              onClick={() => {
                                setMountedGanttGoal(goal)
                                setGanttGoal(goal)
                              }}
                            >
                              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
                              甘特图
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {completedGoals.length > 0 ? (
                <section className="min-w-0 pb-2" aria-label="已完成的目标">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-800">已完成的目标</h2>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
                    {completedGoals.map((goal) => (
                      <CompletedGoalBentoCard
                        key={goal.id}
                        goal={goal}
                        isPending={isPending}
                        onEdit={handleEditGoal}
                        onViewDetail={handleViewDetail}
                        onDelete={handleDeleteGoal}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center md:py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/8 ring-1 ring-primary/15 md:h-20 md:w-20">
                <Target className="h-8 w-8 text-primary md:h-10 md:w-10" aria-hidden />
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-900 md:mt-5">还没有目标</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                在侧栏或底部点「+ 新建目标」，创建后会出现在总览与今日中。
              </p>
            </div>
          )}
        </div>
      </main>

      <GoalDetailSheet
        goal={
          selectedGoal ? (optimisticGoals.find((g) => g.id === selectedGoal.id) ?? selectedGoal) : null
        }
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onQuickDiaryEntry={async (entry) => {
          if (onAddDiaryEntry) {
            await onAddDiaryEntry(entry)
          } else {
            await createDiaryEntryAction(entry)
          }
          onDataRefresh?.()
        }}
      />

      <DeleteGoalDialog
        goal={selectedGoal}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
      />

      <Dialog open={!!ganttGoal} onOpenChange={(v) => !v && setGanttGoal(null)}>
        <DialogContent
          forceMount
          className={cn(
            "flex max-h-[96vh] w-full max-w-[98vw] flex-col gap-0 p-0 sm:max-w-[96vw] sm:rounded-2xl",
            "max-sm:inset-x-0 max-sm:top-0 max-sm:left-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0",
            "max-sm:[&_[data-slot=dialog-close]]:top-[calc(0.75rem+env(safe-area-inset-top))] max-sm:[&_[data-slot=dialog-close]]:right-[max(0.75rem,env(safe-area-inset-right))]",
          )}
        >
          <DialogHeader className="shrink-0 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
            <DialogTitle className="flex items-center gap-2 pr-10 text-base sm:text-xl">
              <BarChart3 className="h-5 w-5 shrink-0 text-primary sm:h-5.5 sm:w-5.5" />
              项目进度甘特图
            </DialogTitle>
            <DialogDescription className="sr-only">按时间查看该目标下里程碑与任务的整体进度。</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(2.25rem,env(safe-area-inset-bottom))] sm:px-4 md:px-8 md:pb-10">
            {chartGoal && (
              <GoalGanttChart
                goalName={chartGoal.name}
                deadline={chartGoal.deadline}
                milestones={chartGoal.milestones}
                tasks={chartGoal.tasks}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
