"use client"

import { useState, useRef, useCallback } from "react"
import { format, parseISO } from "date-fns"
import { formatDateInBusinessTimeZone, formatDateTimeInBusinessTimeZone } from "@/lib/business-time"
import { zhCN } from "date-fns/locale"
import {
  Calendar,
  CalendarDays,
  Clock,
  CheckCircle2,
  Circle,
  BarChart3,
  PenLine,
  Loader2,
  Heart,
  Smile,
  Meh,
  Frown,
  Sparkles,
} from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { GoalProgressLabeled } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Goal, GoalMilestone, DiaryEntry } from "@/lib/mock-data"
import type { GoalExecutionLogEntry } from "@/lib/types"
import { splitMilestoneDetailLines } from "@/lib/milestone-text"
import { cn } from "@/lib/utils"

interface GoalDetailSheetProps {
  goal: Goal | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onQuickDiaryEntry?: (entry: Pick<DiaryEntry, "content" | "images" | "goalId" | "mood">) => Promise<void>
}

/** 与 DiaryEntry.mood 一致（必选），避免在运行时使用 TS 工具类型名 */
type QuickRecordMood = "great" | "good" | "neutral" | "bad"

const quickMoodOptions: {
  id: QuickRecordMood
  label: string
  icon: typeof Heart
}[] = [
  { id: "great", label: "超棒", icon: Heart },
  { id: "good", label: "不错", icon: Smile },
  { id: "neutral", label: "一般", icon: Meh },
  { id: "bad", label: "不好", icon: Frown },
]

function getDaysUntil(dateString: string): number {
  const target = new Date(dateString)
  const today = new Date()
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function milestoneTaskProgress(goal: Goal, m: GoalMilestone): { pct: number; done: number; total: number } {
  const ts = goal.tasks.filter((t) => t.milestoneId === m.id)
  if (m.achieved) return { pct: 100, done: ts.length, total: Math.max(ts.length, 1) }
  if (ts.length === 0) return { pct: 0, done: 0, total: 0 }
  const done = ts.filter((t) => t.completed).length
  return { pct: Math.round((done / ts.length) * 100), done, total: ts.length }
}

function executionLogActionLabel(action: string): string {
  switch (action) {
    case "goal_created":
      return "创建目标"
    case "postpone_carryover":
      return "推迟并入明日"
    case "incomplete_open_edit_goal":
      return "进入修改目标"
    case "plan_saved":
      return "保存规划"
    default:
      return "记录"
  }
}

function goalCreatedLogEntry(goal: Goal): GoalExecutionLogEntry | null {
  const raw = goal.createdAt?.trim()
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  const iso = d.toISOString()
  const cal = formatDateInBusinessTimeZone(d)
  return {
    id: `__goal_created__${goal.id}`,
    createdAt: iso,
    action: "goal_created",
    reasonCode: "system",
    reasonLabel: "",
    calendarDate: cal,
    summary: `已创建目标「${goal.name}」，之后的推进与调整会陆续记在这里。`,
    taskId: null,
  }
}

export function GoalDetailSheet({ goal, open, onOpenChange, onQuickDiaryEntry }: GoalDetailSheetProps) {
  const [tab, setTab] = useState("overview")
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickContent, setQuickContent] = useState("")
  const [quickMood, setQuickMood] = useState<QuickRecordMood>("good")
  const [quickSubmitting, setQuickSubmitting] = useState(false)
  const quickSubmittingRef = useRef(false)

  const handleQuickSubmit = useCallback(async () => {
    if (!goal || !quickContent.trim() || !onQuickDiaryEntry) return
    if (quickSubmittingRef.current) return
    quickSubmittingRef.current = true
    setQuickSubmitting(true)
    try {
      await onQuickDiaryEntry({
        content: quickContent.trim(),
        images: [],
        goalId: goal.id,
        mood: quickMood,
      })
      setQuickOpen(false)
      setQuickContent("")
      setQuickMood("good")
    } finally {
      quickSubmittingRef.current = false
      setQuickSubmitting(false)
    }
  }, [goal, quickContent, quickMood, onQuickDiaryEntry])

  if (!goal) return null

  const createdEntry = goalCreatedLogEntry(goal)
  const historyEntries: GoalExecutionLogEntry[] =
    createdEntry != null ? [...(goal.executionLogs ?? []), createdEntry] : [...(goal.executionLogs ?? [])]

  const daysLeft = getDaysUntil(goal.deadline)
  const completedTasks = goal.tasks.filter((t) => t.completed).length
  const totalTasks = goal.tasks.length

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) setTab("overview")
      }}
    >
      <SheetContent
        className={cn(
          "flex w-full max-w-[100vw] max-h-[100dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl",
          "data-[state=open]:duration-500 data-[state=closed]:duration-300",
          "[&>button]:z-20 [&>button]:text-white [&>button]:opacity-90 [&>button]:hover:bg-white/15 [&>button]:hover:text-white [&>button]:hover:opacity-100",
        )}
      >
        {/* 抽屉封面：品牌渐变 + 纹理感 */}
        <div className="relative h-32 shrink-0 overflow-hidden bg-gradient-to-br from-primary-from via-primary-to to-slate-900 pr-14 pt-4">
          <div
            className="absolute inset-0 opacity-40"
            style={{
                    backgroundImage: `radial-gradient(circle at 20% 80%, rgba(255,255,255,0.35) 0%, transparent 45%),
                      radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 40%)`,
                  }}
            aria-hidden
          />
          <div className="relative flex h-full items-end gap-4 px-6 pb-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl shadow-lg ring-2 ring-white/30 backdrop-blur-md">
              {goal.emoji}
            </div>
            <div className="min-w-0 flex-1 text-left text-white pr-1">
              <SheetTitle className="break-words text-xl font-bold leading-snug tracking-tight text-white">
                {goal.name}
              </SheetTitle>
              <SheetDescription className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-white/85">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs backdrop-blur-sm">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  还剩 {daysLeft} 天
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{goal.currentPhase}</span>
                </span>
              </SheetDescription>
            </div>
          </div>
        </div>

        {onQuickDiaryEntry ? (
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-6 py-3">
            <Button
              type="button"
              variant="premiumCta"
              className="h-11 w-full sm:h-10"
              disabled={quickSubmitting}
              onClick={() => setQuickOpen(true)}
            >
              <PenLine className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate sm:whitespace-normal">快捷记录日志</span>
            </Button>
          </div>
        ) : null}

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 min-w-0 flex-1 flex-col gap-0">
          <div className="shrink-0 overflow-x-auto overscroll-x-contain px-4 pt-4 [-webkit-overflow-scrolling:touch] sm:px-6">
            <TabsList className="inline-flex h-10 w-max min-w-0 bg-slate-100/80">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="milestones">里程碑</TabsTrigger>
              <TabsTrigger value="history">执行记录</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="overview"
            className="m-0 mt-0 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 data-[state=inactive]:hidden sm:px-6"
          >
            <div className="space-y-6 pb-8">
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_16px_-4px_rgba(59,130,246,0.08)]">
                  <h3 className="font-medium text-slate-800">整体进度</h3>
                  <GoalProgressLabeled value={goal.progress} className="mt-3" barClassName="h-2.5" />
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-semibold text-foreground">{daysLeft}</p>
                      <p className="text-xs text-muted-foreground">剩余天数</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-semibold text-foreground">{completedTasks}</p>
                      <p className="text-xs text-muted-foreground">已完成任务</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-semibold text-foreground">{totalTasks}</p>
                      <p className="text-xs text-muted-foreground">任务总数</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_16px_-4px_rgba(59,130,246,0.08)]">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <h3 className="font-medium text-slate-800">统计数据</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">本周完成率</span>
                      <span className="font-medium text-foreground">85%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">连续打卡天数</span>
                      <span className="font-medium text-foreground">4 天</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">AI 重新规划次数</span>
                      <span className="font-medium text-foreground">2 次</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">累计完成任务</span>
                      <span className="font-medium text-foreground">18 个</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_16px_-4px_rgba(59,130,246,0.08)]">
                  <h3 className="font-medium text-slate-800">全部任务</h3>
                  <div className="mt-4 space-y-3">
                    {goal.tasks.map((task) => (
                      <div key={task.id} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                        {task.completed ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                        ) : (
                          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-sm font-medium",
                              task.completed ? "text-muted-foreground line-through" : "text-foreground"
                            )}
                          >
                            {task.title}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3 shrink-0" />
                              {task.duration} 分钟
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3 shrink-0" />
                              {task.spanDays >= 1 ? task.spanDays : 1} 天
                            </span>
                            {task.startDate && /^\d{4}-\d{2}-\d{2}$/.test(task.startDate) ? (
                              <span className="tabular-nums">
                                {format(parseISO(`${task.startDate}T12:00:00`), "M月d日", { locale: zhCN })} 起
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
          </TabsContent>

          <TabsContent
            value="milestones"
            className="m-0 mt-0 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 data-[state=inactive]:hidden sm:px-6"
          >
              <div className="space-y-4 pb-8">
                {goal.milestones.map((milestone, index) => {
                  const { pct, total } = milestoneTaskProgress(goal, milestone)
                  const showBar = total > 0 && !milestone.achieved && pct > 0
                  const detailLines = splitMilestoneDetailLines(milestone.detail ?? "")
                  return (
                    <div
                      key={milestone.id}
                      className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_14px_-4px_rgba(15,23,42,0.06)]"
                    >
                      {index < goal.milestones.length - 1 && (
                        <div
                          className="absolute left-[29px] top-[72px] z-0 h-[calc(100%-24px)] w-0.5 bg-border"
                          aria-hidden
                        />
                      )}
                      <div className="relative z-[1] flex items-start gap-4">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            milestone.achieved
                              ? "bg-success text-success-foreground"
                              : pct > 0
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {milestone.achieved ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <span className="text-sm font-medium">{index + 1}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="break-words font-medium leading-snug text-foreground">
                                {milestone.title}
                              </h4>
                              <p className="mt-1 text-sm text-muted-foreground">截止日期：{milestone.targetDate}</p>
                              {detailLines.length > 0 && (
                                <ul className="mt-3 space-y-1.5 text-sm leading-6 text-muted-foreground">
                                  {detailLines.map((line, detailIndex) => (
                                    <li key={`${milestone.id}-detail-${detailIndex}`} className="flex gap-2">
                                      <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                                      <span className="break-words">{line}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              {milestone.achieved && (
                                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                                  已完成
                                </span>
                              )}
                              {!milestone.achieved && total > 0 && !showBar && (
                                <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                                  进行中 {pct}%
                                </span>
                              )}
                            </div>
                          </div>
                          {showBar && (
                            <GoalProgressLabeled value={pct} className="mt-3" barClassName="h-1.5" />
                          )}
                          {!milestone.achieved && total === 0 && (
                            <p className="mt-2 text-xs text-muted-foreground">尚未分配每日任务，可在编辑目标中生成。</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
          </TabsContent>

          <TabsContent
            value="history"
            className="m-0 mt-0 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 data-[state=inactive]:hidden sm:px-6"
          >
              <div className="space-y-3 pb-8">
                {historyEntries.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-muted-foreground">
                    暂无执行记录。在 Today 标记未完成并选择推迟或修改目标、或保存目标规划后，会出现在这里。
                  </p>
                ) : (
                  historyEntries.map((entry) => {
                    const dt = formatDateTimeInBusinessTimeZone(entry.createdAt)
                    const cal = entry.calendarDate
                    const label = executionLogActionLabel(entry.action)
                    const isCreated = entry.action === "goal_created"
                    return (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                                isCreated ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-600",
                              )}
                            >
                              {isCreated ? <Sparkles className="h-5 w-5" aria-hidden /> : <Clock className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground tabular-nums">{dt}</p>
                              <p className="text-sm font-medium text-foreground">
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                  {label}
                                </span>
                                {!isCreated ? (
                                  <span className="ml-2 tabular-nums text-muted-foreground">关联日 {cal}</span>
                                ) : null}
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
                          {entry.summary}
                        </p>
                      </div>
                    )
                  })
                )}
              </div>
          </TabsContent>
        </Tabs>

        <Dialog
          open={quickOpen}
          onOpenChange={(v) => {
            if (!v && quickSubmittingRef.current) return
            setQuickOpen(v)
            if (!v) {
              setQuickContent("")
              setQuickMood("good")
            }
          }}
        >
          <DialogContent className="sm:max-w-md" showCloseButton>
            <DialogHeader>
              <DialogTitle>快捷记录日志</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">关联目标：{goal.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Textarea
                placeholder="今天为这个目标推进了什么？"
                value={quickContent}
                onChange={(e) => setQuickContent(e.target.value)}
                disabled={quickSubmitting}
                className="min-h-[120px] resize-y"
              />
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">心情</p>
                <div className="flex flex-wrap gap-2">
                  {quickMoodOptions.map((m) => {
                    const Icon = m.icon
                    const active = quickMood === m.id
                    return (
                      <Button
                        key={m.id}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        className="gap-1.5"
                        disabled={quickSubmitting}
                        onClick={() => setQuickMood(m.id)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {m.label}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setQuickOpen(false)} disabled={quickSubmitting}>
                取消
              </Button>
              <Button
                type="button"
                disabled={!quickContent.trim() || quickSubmitting}
                className="gap-2"
                onClick={() => void handleQuickSubmit()}
              >
                {quickSubmitting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
                {quickSubmitting ? "发布中..." : "提交记录"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  )
}
