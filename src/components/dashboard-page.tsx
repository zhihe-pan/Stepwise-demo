"use client"

import { Target, Calendar, Sparkles, ArrowRight } from "lucide-react"
import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { GoalProgressLabeled } from "@/components/ui/progress"
import { UnifiedInsightCard } from "@/components/unified-insight-card"
import type { Goal } from "@/lib/mock-data"
import {
  isGoalFullyCompleted,
  isTaskCheckedOnCalendarDay,
  tasksForActiveMilestoneOnCalendarDay,
} from "@/lib/goal-helpers"
import { cn } from "@/lib/utils"

function getGreetingWithEmoji(): { phrase: string; emoji: string } {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return { phrase: "早上好", emoji: "🌅" }
  if (hour >= 12 && hour < 14) return { phrase: "中午好", emoji: "☀️" }
  if (hour >= 14 && hour < 18) return { phrase: "下午好", emoji: "🌤️" }
  return { phrase: "晚上好", emoji: "🌙" }
}

function formatGreetingWho(username: string | undefined): string {
  const { phrase, emoji } = getGreetingWithEmoji()
  const name = username?.trim()
  return name ? `${phrase}，${name} ${emoji}` : `${phrase} ${emoji}`
}

function getDaysUntil(dateString: string): number {
  const target = new Date(dateString)
  const today = new Date()
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function calendarDaysUntilMilestone(iso: string | undefined | null): number | null {
  if (iso == null || typeof iso !== "string") return null
  const s = iso.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const target = startOfDay(parseISO(`${s}T12:00:00`))
  return differenceInCalendarDays(target, startOfDay(new Date()))
}

function formatMilestoneDaysLeft(d: number): string {
  if (d > 0) return `还剩 ${d} 天`
  if (d === 0) return "今天截止"
  return `逾期 ${Math.abs(d)} 天`
}

const surfaceCard = cn(
  "rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
)

function countTodayPendingTasks(goals: Goal[], day: Date): number {
  let n = 0
  for (const g of goals) {
    const ts = tasksForActiveMilestoneOnCalendarDay(g, day, { includeCompleted: true })
    for (const t of ts) {
      if (!isTaskCheckedOnCalendarDay(t, day)) n++
    }
  }
  return n
}

function goalNeedsDeadlineAttention(g: Goal): boolean {
  const d = calendarDaysUntilMilestone(g.nextMilestoneDate)
  if (d == null) return false
  return d < 0 || d <= 3
}

function recommendedTaskTitle(goal: Goal, day: Date): string | null {
  const ts = tasksForActiveMilestoneOnCalendarDay(goal, day, { includeCompleted: true })
  const next = ts.find((t) => !isTaskCheckedOnCalendarDay(t, day))
  return next?.title?.trim() || null
}

type StructuredBriefing = {
  focusGoalLine: string
  bestActionLine: string
  riskLine: string | null
  summaryLine: string
}

function clipBriefLabel(s: string, max: number): string {
  const t = s.trim()
  if (!t) return ""
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(1, max - 1))}…`
}

function generateStructuredBriefing(goals: Goal[]): StructuredBriefing {
  if (goals.length === 0) {
    return {
      focusGoalLine: "暂无进行中目标",
      bestActionLine: "先创建一个可在本周内验证的小目标。",
      riskLine: null,
      summaryLine: "不急，从小目标开始",
    }
  }

  const scored = goals.map((goal) => ({
    goal,
    ms: calendarDaysUntilMilestone(goal.nextMilestoneDate),
  }))
  const overdue = scored
    .filter((x) => x.ms != null && x.ms < 0)
    .sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0))[0]
  const fastest = [...goals].sort((a, b) => b.progress - a.progress)[0]
  const lagging = [...goals].sort((a, b) => a.progress - b.progress)[0]
  const spread =
    goals.length >= 2 ? Math.max(...goals.map((g) => g.progress)) - Math.min(...goals.map((g) => g.progress)) : 0

  if (overdue) {
    const days = Math.abs(overdue.ms ?? 0)
    const gn = clipBriefLabel(overdue.goal.name, 8)
    return {
      focusGoalLine: `「${overdue.goal.name}」`,
      bestActionLine: `处理逾期里程碑：${overdue.goal.nextMilestone}`,
      riskLine: `该目标里程碑已逾期 ${days} 天，建议优先安排固定时段推进。`,
      summaryLine: `要抓紧了·「${gn}」逾期${days}天`,
    }
  }

  if (spread > 35 && lagging && fastest && lagging.id !== fastest.id) {
    const ln = clipBriefLabel(lagging.name, 8)
    return {
      focusGoalLine: `「${lagging.name}」相对落后`,
      bestActionLine: `完成一项推动「${lagging.nextMilestone}」的今日任务。`,
      riskLine: "多目标进度差较大，注意别长期只推进单一目标。",
      summaryLine: `慢慢来·先补「${ln}」`,
    }
  }

  const g0 = fastest ?? goals[0]!
  const gn = clipBriefLabel(g0.name, 8)
  const ms = clipBriefLabel(g0.nextMilestone, 10)
  const daysLeft = calendarDaysUntilMilestone(g0.nextMilestoneDate)
  const hurry = daysLeft != null && daysLeft >= 0 && daysLeft <= 3
  const tone = hurry ? "要抓紧了" : "慢慢来"
  const core = ms ? `主抓「${ms}」` : `主抓「${gn}」`
  return {
    focusGoalLine: `「${g0.name}」`,
    bestActionLine: `继续围绕「${g0.nextMilestone}」落实今日动作。`,
    riskLine: null,
    summaryLine: `${tone}·${core}`,
  }
}

function SummaryMetricCell({
  label,
  value,
  caption,
  dotClass,
  ariaLabel,
}: {
  label: string
  value: string
  caption?: string
  dotClass: string
  ariaLabel: string
}) {
  return (
    <div
      className="min-w-0 px-2 py-3 sm:px-4 sm:py-5"
      role="group"
      aria-label={ariaLabel}
    >
      <div className="mx-auto flex max-w-[9rem] flex-col items-center text-center sm:mx-0 sm:max-w-none sm:items-start sm:text-left md:mx-auto md:items-center md:text-center">
        <div className="mb-1 flex items-center justify-center gap-1.5 sm:justify-start sm:gap-2 md:justify-center">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2", dotClass)} aria-hidden />
          <p className="text-[10px] font-medium text-slate-500 sm:text-xs">{label}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none tracking-tight text-slate-900 sm:text-3xl">{value}</p>
        {caption ? (
          <p className="mt-1 text-[10px] leading-snug text-slate-400 sm:text-[11px]">{caption}</p>
        ) : null}
      </div>
    </div>
  )
}

function ConsolidatedInsightPanel({
  briefing,
  totalActive,
  pendingToday,
  riskAttentionCount,
}: {
  briefing: StructuredBriefing
  totalActive: number
  pendingToday: number
  riskAttentionCount: number
}) {
  const detailTitle = [briefing.focusGoalLine, briefing.bestActionLine, briefing.riskLine]
    .filter((s) => (s ?? "").trim())
    .join(" ")
  return (
    <UnifiedInsightCard
      ariaLabel="今日摘要与建议"
      metricsAriaLabel="关键指标"
      ai={
        <div className="flex items-center gap-3 pl-2 sm:gap-4 sm:pl-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-10 sm:w-10 sm:rounded-xl">
            <Sparkles className="h-4 w-4 ai-sparkle-icon sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
          </div>
          <p
            className="min-w-0 flex-1 text-sm leading-snug text-slate-700 line-clamp-1 max-sm:text-xs max-sm:leading-snug"
            title={detailTitle ? `今日建议：${detailTitle}` : "今日建议"}
          >
            <span className="font-semibold text-slate-900">今日建议</span>
            {briefing.summaryLine ? (
              <>
                <span className="font-normal text-slate-400"> · </span>
                <span className="font-normal">{briefing.summaryLine}</span>
              </>
            ) : null}
          </p>
        </div>
      }
      metrics={
        <div className="grid min-w-0 grid-cols-3 divide-x divide-slate-100/90 bg-transparent">
          <SummaryMetricCell
            label="进行中"
            value={String(totalActive)}
            caption="个目标"
            dotClass="bg-primary"
            ariaLabel={`进行中目标 ${totalActive} 个`}
          />
          <SummaryMetricCell
            label="今日待办"
            value={String(pendingToday)}
            caption={pendingToday > 0 ? "项待勾选" : "已清空"}
            dotClass="bg-slate-400"
            ariaLabel={`今日待完成 ${pendingToday} 项`}
          />
          <SummaryMetricCell
            label="里程碑关注"
            value={String(riskAttentionCount)}
            caption={riskAttentionCount > 0 ? "个目标待留意" : "暂无紧迫项"}
            dotClass={riskAttentionCount > 0 ? "bg-amber-500" : "bg-slate-300"}
            ariaLabel={`有里程碑临近或已逾期的目标 ${riskAttentionCount} 个`}
          />
        </div>
      }
    />
  )
}

function desktopSubline(
  username: string | undefined,
  pendingToday: number,
  activeCount: number,
): { who: string; tail1: string; line2?: string } {
  const who = formatGreetingWho(username)
  if (activeCount === 0) {
    return {
      who,
      tail1: "。还没有进行中的目标。",
      line2: "新建目标后，这里会汇总进度与下一步。",
    }
  }
  if (pendingToday > 0) {
    return { who, tail1: `。今日还有 ${pendingToday} 项任务待处理。` }
  }
  return { who, tail1: "你想要，你得到！" }
}

interface DashboardPageProps {
  goals: Goal[]
  username?: string
  onGoToday?: () => void
}

export function DashboardPage({ goals, username, onGoToday }: DashboardPageProps) {
  const calendarDay = new Date()
  const activeGoals = goals.filter((g) => !isGoalFullyCompleted(g))
  const pendingToday = countTodayPendingTasks(activeGoals, calendarDay)
  const riskAttentionCount = activeGoals.filter(goalNeedsDeadlineAttention).length
  const totalActive = activeGoals.length
  const structuredBriefing = generateStructuredBriefing(activeGoals)
  const sub = desktopSubline(username, pendingToday, totalActive)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-transparent">
      <header className="hidden shrink-0 border-b border-slate-200 bg-white/40 backdrop-blur-sm md:block">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-8 md:py-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">总览</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{sub.tail1}</p>
        </div>
      </header>

      <main className="app-main-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        <div className="mx-auto box-border min-w-0 max-w-5xl space-y-8 px-4 py-4 md:px-8 md:py-8">
          <p className="hidden text-[1.125rem] font-semibold leading-snug tracking-tight text-slate-900 md:block">
            {sub.who}
          </p>
          <p className="text-lg font-semibold leading-snug tracking-tight text-slate-900 sm:text-xl md:hidden">
            {formatGreetingWho(username)}
          </p>

          <ConsolidatedInsightPanel
            briefing={structuredBriefing}
            totalActive={totalActive}
            pendingToday={pendingToday}
            riskAttentionCount={riskAttentionCount}
          />

          <section className="min-w-0 pb-2" aria-label="进行中的目标">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-800">我的目标</h2>
              {onGoToday ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 gap-1 rounded-md border border-slate-200/95 bg-white px-2.5",
                    "text-[11px] font-medium text-slate-600 shadow-sm",
                    "hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800",
                    "active:bg-slate-100",
                  )}
                  onClick={() => onGoToday()}
                >
                  <Calendar className="h-3 w-3 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
                  看今日
                  <ArrowRight className="h-2.5 w-2.5 shrink-0 text-slate-400" aria-hidden />
                </Button>
              ) : null}
            </div>

            {activeGoals.length === 0 ? (
              <div className={cn(surfaceCard, "flex items-start gap-3 p-4 sm:p-5")}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Target className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">还没有进行中的目标</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    在电脑端可通过侧栏、在手机端可点底部「+」创建目标，创建后会在这里看到进度与下一步建议。
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
                {activeGoals.map((goal) => {
                  const daysLeft = getDaysUntil(goal.deadline)
                  const msDays = calendarDaysUntilMilestone(goal.nextMilestoneDate)
                  const rec = recommendedTaskTitle(goal, calendarDay)
                  const ms = goal.milestones ?? []
                  const msDone = ms.filter((m) => m.achieved).length
                  const msTotal = ms.length
                  const deadlineLabel =
                    goal.deadline && /^\d{4}-\d{2}-\d{2}/.test(goal.deadline)
                      ? format(parseISO(`${goal.deadline.slice(0, 10)}T12:00:00`), "yyyy年M月d日", { locale: zhCN })
                      : goal.deadline

                  let statusBadge = { label: "进行中", className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80" }
                  if (msDays != null && msDays < 0) {
                    statusBadge = {
                      label: "里程碑逾期",
                      className: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80",
                    }
                  } else if (msDays != null && msDays <= 3) {
                    statusBadge = {
                      label: "即将截止",
                      className: "bg-indigo-50 text-primary ring-1 ring-indigo-100",
                    }
                  }

                  return (
                    <div
                      key={goal.id}
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
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                statusBadge.className,
                              )}
                            >
                              {statusBadge.label}
                            </span>
                          </div>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                              <span className="tabular-nums text-slate-600">{deadlineLabel}</span>
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="tabular-nums">剩 {daysLeft} 天</span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <span className="text-[11px] font-medium text-slate-500">进度</span>
                          {msTotal > 0 ? (
                            <span className="text-[11px] tabular-nums text-slate-400">里程碑 {msDone}/{msTotal}</span>
                          ) : null}
                        </div>
                        <GoalProgressLabeled value={goal.progress} barClassName="h-2 min-h-[8px]" />
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <div className="border-l-2 border-primary/35 pl-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                              <Target className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                              当前里程碑
                            </p>
                            {msDays != null ? (
                              <span
                                className={cn(
                                  "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums sm:text-[11px]",
                                  msDays < 0
                                    ? "bg-amber-100/90 text-amber-900"
                                    : msDays === 0
                                      ? "bg-primary/10 text-primary"
                                      : "bg-slate-100 text-slate-600",
                                )}
                                title="相对当前里程碑截止日"
                              >
                                {formatMilestoneDaysLeft(msDays)}
                              </span>
                            ) : (
                              <span className="shrink-0 text-[10px] text-slate-400 sm:text-[11px]">—</span>
                            )}
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-snug text-slate-900">{goal.nextMilestone}</p>
                          {rec ? (
                            <p className="mt-2 text-xs leading-relaxed text-slate-600">
                              <span className="text-slate-500">可先：</span>
                              {rec}
                            </p>
                          ) : (
                            <p className="mt-2 text-xs text-slate-500">今日无排期任务，可在「今日」页查看其它安排。</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
