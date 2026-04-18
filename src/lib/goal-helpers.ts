import { addDays, differenceInCalendarDays, isAfter, isBefore, parseISO, startOfDay } from "date-fns"
import type { Goal, GoalMilestone, Task } from "@/lib/types"
import { getBusinessTodayIso } from "@/lib/business-time"
import { mockGenerateDailyTasks } from "@/lib/ai-plan-mock"

/** 里程碑列表是否一致（顺序、id、标题与日期、达成状态），用于判断编辑页是否需要重算每日任务 */
export function milestonesSnapshotEqual(a: GoalMilestone[], b: GoalMilestone[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x.id !== y.id) return false
    if ((x.title ?? "").trim() !== (y.title ?? "").trim()) return false
    if ((x.detail ?? "").trim() !== (y.detail ?? "").trim()) return false
    if (x.targetDate !== y.targetDate) return false
    if (Boolean(x.achieved) !== Boolean(y.achieved)) return false
    if (Boolean(x.achievedEarly) !== Boolean(y.achievedEarly)) return false
  }
  return true
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function defaultStartDate(t: Task): string {
  if (typeof t.startDate === "string" && ISO_DATE.test(t.startDate)) return t.startDate
  return getBusinessTodayIso()
}

export function normalizedTaskSpanDays(task: Pick<Task, "spanDays">): number {
  const raw = task.spanDays as unknown
  let n = 1
  if (typeof raw === "number" && Number.isFinite(raw)) n = Math.floor(raw)
  else if (typeof raw === "string" && raw.trim() !== "") {
    const v = Number(raw.trim())
    n = Number.isFinite(v) ? Math.floor(v) : 1
  }
  return Math.min(365, Math.max(1, n))
}

/** 解析 progressUnits（兼容字符串序列化、缺省） */
export function readTaskProgressUnits(task: Pick<Task, "progressUnits">): number {
  const raw = task.progressUnits as unknown
  if (raw == null) return 0
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.trunc(raw))
  if (typeof raw === "string" && raw.trim() !== "") {
    const v = Number(raw.trim())
    return Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0
  }
  return 0
}

/** 补全 milestones 与 task.milestoneId（兼容旧数据） */
export function normalizeGoal(g: Goal): Goal {
  if (g.milestones && g.milestones.length > 0) {
    const firstId = g.milestones[0].id
    return {
      ...g,
      executionLogs: g.executionLogs ?? [],
      tasks: g.tasks.map((t) => ({
        ...t,
        milestoneId: t.milestoneId ?? firstId,
        spanDays: normalizedTaskSpanDays(t),
        startDate: defaultStartDate(t),
      })),
    }
  }
  const mid = `m-${g.id}-legacy`
  return {
    ...g,
    executionLogs: g.executionLogs ?? [],
    milestones: [
      {
        id: mid,
        title: g.nextMilestone,
        detail: "",
        targetDate: g.nextMilestoneDate,
        achieved: false,
      },
    ],
    tasks: g.tasks.map((t) => ({
      ...t,
      milestoneId: t.milestoneId ?? mid,
      spanDays: normalizedTaskSpanDays(t),
      startDate: defaultStartDate(t),
    })),
  }
}

export function getActiveMilestone(goal: Goal): GoalMilestone | undefined {
  return goal.milestones.find((m) => !m.achieved)
}

/** 是否视为「已完成的目标」：进度已满或全部里程碑已达成。 */
export function isGoalFullyCompleted(goal: Goal): boolean {
  if (goal.progress >= 100) return true
  const ms = goal.milestones ?? []
  if (ms.length === 0) return false
  return ms.every((m) => m.achieved)
}

/**
 * 任务计划在日历上的覆盖区间是否为 [startDate, startDate + spanDays - 1]（含端点，本地日）。
 */
export function isTaskScheduledOnCalendarDay(task: Task, day: Date): boolean {
  if (!ISO_DATE.test(task.startDate)) return false
  const start = startOfDay(parseISO(`${task.startDate}T12:00:00`))
  const span = normalizedTaskSpanDays(task)
  const end = startOfDay(addDays(parseISO(`${task.startDate}T12:00:00`), span - 1))
  const d = startOfDay(day)
  return !isBefore(d, start) && !isAfter(d, end)
}

/**
 * 甘特条进度 0–100。
 * - 跨天任务：仅按 progressUnits/span；不因 completed 单独视为满格（避免数据不一致时误判 100%）。
 * - 单日任务：completed 即 100%。
 * - spanDays / progressUnits 均做数值解析，与甘特行使用的跨度一致（避免 string span 与 floor 不一致）。
 */
export function taskTimelineProgressPercent(task: Task): number {
  const span = normalizedTaskSpanDays(task)
  const units = Math.max(0, Math.min(span, readTaskProgressUnits(task)))

  if (span <= 1) {
    if (task.completed) return 100
    return Math.min(100, Math.round((units / span) * 100))
  }

  return Math.min(100, Math.round((units / span) * 100))
}

/**
 * 当前日历日 Today 勾选态：序贯完成 — 第 k 天需要 progressUnits > k（k 从 0 计）。
 * 单日任务仅有 completed。跨天任务不以 completed 单独拉满（防止仅完成一日却全日打勾）。
 */
export function isTaskCheckedOnCalendarDay(task: Task, day: Date): boolean {
  const span = normalizedTaskSpanDays(task)
  if (span <= 1) return task.completed
  if (!ISO_DATE.test(task.startDate)) return false
  const start = startOfDay(parseISO(`${task.startDate.slice(0, 10)}T12:00:00`))
  const d = startOfDay(day)
  const dayIndex = differenceInCalendarDays(d, start)
  if (dayIndex < 0 || dayIndex >= span) return false
  const units = readTaskProgressUnits(task)
  if (units >= span) return true
  return units > dayIndex
}

/**
 * 与 Today 一致：所有未达成里程碑下的任务，且「这天」落在任务的计划日区间内。
 * （仅「第一个进行中里程碑」会漏掉同日截止的后续里程碑任务，故用全部未达成里程碑。）
 */
export function tasksForActiveMilestoneOnCalendarDay(
  goal: Goal,
  day: Date,
  opts?: { includeCompleted?: boolean },
): Task[] {
  return tasksForActiveMilestone(goal, opts).filter((t) => isTaskScheduledOnCalendarDay(t, day))
}

/** 所有未达成里程碑下的任务；无非达成里程碑时行为与往日「无进行中阶段」一致。 */
export function tasksForActiveMilestone(
  goal: Goal,
  opts?: { includeCompleted?: boolean },
): Task[] {
  const includeCompleted = opts?.includeCompleted ?? false
  const openIds = new Set(goal.milestones.filter((m) => !m.achieved).map((m) => m.id))
  if (openIds.size === 0) {
    if (includeCompleted) return [...goal.tasks]
    return goal.tasks.filter((t) => !t.completed)
  }
  return goal.tasks.filter((t) => {
    if (!includeCompleted && t.completed) return false
    const mid = t.milestoneId ?? goal.milestones[0]?.id
    return openIds.has(mid)
  })
}

export function goalProgressFromMilestones(milestones: GoalMilestone[]): number {
  if (!milestones.length) return 0
  const done = milestones.filter((m) => m.achieved).length
  return Math.round((done / milestones.length) * 100)
}

/**
 * 目标总进度 0–100：每个里程碑占均等权重；已达成计 100%；
 * 未达成则取该里程碑下任务的 taskTimelineProgressPercent 平均值（无任务记 0）。
 * 用于列表展示，避免「Today 已勾任务但里程碑未标记达成」时进度条一直为 0。
 */
export function goalProgressFromTasksAndMilestones(milestones: GoalMilestone[], tasks: Task[]): number {
  if (milestones.length === 0) {
    if (tasks.length === 0) return 0
    let sum = 0
    for (const t of tasks) {
      sum += taskTimelineProgressPercent(t)
    }
    return Math.round(sum / tasks.length)
  }
  const firstId = milestones[0]!.id
  let acc = 0
  for (const m of milestones) {
    if (m.achieved) {
      acc += 100
      continue
    }
    const msTasks = tasks.filter((t) => (t.milestoneId ?? firstId) === m.id)
    if (msTasks.length === 0) continue
    let sum = 0
    for (const t of msTasks) {
      sum += taskTimelineProgressPercent(t)
    }
    acc += sum / msTasks.length
  }
  return Math.min(100, Math.round(acc / milestones.length))
}

export function syncGoalPhaseFields(goal: Goal): Pick<Goal, "currentPhase" | "nextMilestone" | "nextMilestoneDate" | "progress"> {
  const active = getActiveMilestone(goal)
  const last = goal.milestones[goal.milestones.length - 1]
  const progress = goalProgressFromMilestones(goal.milestones)
  if (!active) {
    return {
      currentPhase: "全部里程碑已完成",
      nextMilestone: last?.title ?? goal.nextMilestone,
      nextMilestoneDate: last?.targetDate ?? goal.nextMilestoneDate,
      progress: progress >= 100 ? 100 : progress,
    }
  }
  const phase =
    active.title.length > 18 ? active.title.slice(0, 18) + "…" : active.title
  return {
    currentPhase: phase,
    nextMilestone: active.title,
    nextMilestoneDate: active.targetDate,
    progress,
  }
}

/** 为未达成的里程碑重新生成每日级任务；已达成里程碑下的任务保留 */
export function mockRegenerateTasksForOpenMilestones(
  goal: Goal,
  milestones: GoalMilestone[],
  weeklyHours: number = 5
): Task[] {
  const openMs = milestones.filter((m) => !m.achieved)
  const kept = goal.tasks.filter((t) => {
    const ms = milestones.find((x) => x.id === t.milestoneId)
    return ms?.achieved === true
  })
  if (openMs.length === 0) return kept

  const hours = Number.isFinite(weeklyHours) ? Math.min(40, Math.max(1, weeklyHours)) : 5
  const drafts = mockGenerateDailyTasks(
    openMs.map((m) => ({ id: m.id, title: m.title, detail: m.detail ?? "", targetDate: m.targetDate })),
    goal.name,
    hours,
    goal.deadline
  )
  const newTasks: Task[] = drafts.map((d, i) => ({
    id: `t-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
    milestoneId: d.milestoneId,
    title: d.title,
    duration: d.duration,
    spanDays: typeof d.spanDays === "number" && d.spanDays >= 1 ? Math.min(365, Math.floor(d.spanDays)) : 1,
    startDate: ISO_DATE.test(d.startDate) ? d.startDate : getBusinessTodayIso(),
    criteria: d.criteria,
    minimumVersion: d.minimumVersion,
    isEasyFirstStep: d.isEasyFirstStep ?? false,
    completed: false,
  }))
  return [...kept, ...newTasks]
}
