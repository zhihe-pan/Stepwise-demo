import {
  addDays,
  differenceInCalendarDays,
  isValid,
  min as dateMin,
  parseISO,
  startOfDay,
} from "date-fns"
import { isDeadlineValidForPicker } from "@/lib/ai-chat-plan-parse"
import { getBusinessTodayIso } from "@/lib/business-time"
import { correctGoalDeadlineToFuture } from "@/lib/plan-date-correction"
import type { PlanDailyDraft, PlanMilestone } from "@/lib/ai-plan-mock"
import type { DailyPlanStreamResult } from "@/lib/plan-stream-schemas"
import type { Task } from "@/lib/types"

export type DailyPlanAiEasyStep = {
  title: string
  duration: number
  criteria: string
  minimumVersion: string
}

export type DailyPlanAiTask = {
  milestoneId: string
  title: string
  duration: number
  estimatedDays: number
  criteria: string
  minimumVersion: string
}

export type DailyPlanAiResponse = {
  easyFirstStep: DailyPlanAiEasyStep
  tasks: DailyPlanAiTask[]
  /** 模型对用户夸奖的简短致谢，可选 */
  praiseAcknowledgement?: string
}

/** 将流式 schema（criteria / minimumVersion 可缺省）规范为落库用的完整结构 */
export function dailyStreamResultToAiResponse(data: DailyPlanStreamResult): DailyPlanAiResponse {
  const praise = data.praiseAcknowledgement?.trim()
  return {
    easyFirstStep: {
      title: data.easyFirstStep.title,
      duration: data.easyFirstStep.duration,
      criteria: data.easyFirstStep.criteria ?? "",
      minimumVersion: data.easyFirstStep.minimumVersion ?? "",
    },
    tasks: data.tasks.map((t) => ({
      milestoneId: t.milestoneId,
      title: t.title,
      duration: t.duration,
      estimatedDays: t.estimatedDays,
      criteria: (t.criteria ?? "").trim(),
      minimumVersion: (t.minimumVersion ?? "").trim(),
    })),
    ...(praise ? { praiseAcknowledgement: praise } : {}),
  }
}

/**
 * 任务日历区间为 [startDate, startDate + spanDays - 1]；最后一日不得晚于里程碑 targetDate 与总 deadline。
 */
function clampSpanDaysToMilestoneEnd(
  startDateStr: string,
  spanDays: number,
  milestoneTarget: string,
  goalDeadline: string,
): number {
  const span = Math.max(1, Math.min(365, Math.floor(spanDays)))
  const start = startOfDay(parseISO(`${startDateStr}T12:00:00`))
  const msEnd = startOfDay(parseISO(`${milestoneTarget}T12:00:00`))
  const gEnd = startOfDay(parseISO(`${goalDeadline}T12:00:00`))
  const capEnd = dateMin([msEnd, gEnd])
  if (!isValid(start) || !isValid(capEnd) || start > capEnd) {
    return 1
  }
  const lastInclusive = addDays(start, span - 1)
  if (lastInclusive <= capEnd) {
    return span
  }
  const maxSpan = differenceInCalendarDays(capEnd, start) + 1
  return Math.max(1, Math.min(span, maxSpan))
}

function clampStartDateInWindow(
  raw: string,
  goalDeadline: string,
  milestoneTarget: string,
  todayStr: string,
  windowStartStr: string,
): string {
  const today = startOfDay(parseISO(`${todayStr}T12:00:00`))
  const deadline = startOfDay(parseISO(`${goalDeadline}T12:00:00`))
  const msEnd = startOfDay(parseISO(`${milestoneTarget}T12:00:00`))
  const windowStartRaw = startOfDay(parseISO(`${windowStartStr}T12:00:00`))
  const upper = dateMin([deadline, msEnd])
  const windowStart = windowStartRaw > upper ? upper : windowStartRaw
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayStr
  let d = startOfDay(parseISO(`${iso}T12:00:00`))
  if (!isValid(d)) d = today
  if (d < today) d = today
  if (d < windowStart) d = windowStart
  if (d > upper) d = upper
  const out = getBusinessTodayIso(d)
  if (!isDeadlineValidForPicker(out)) return todayStr
  return out
}

function newDraftId(prefix: string, i: number) {
  return `${prefix}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`
}

function normalizeEstimatedDays(v: number): number {
  return Math.min(365, Math.max(1, Math.round(Number(v) || 1)))
}

/** 将模型返回的每日计划转为可编辑草稿，并修正里程碑 id、日期边界 */
export function dailyPlanResponseToDrafts(
  data: DailyPlanAiResponse,
  milestones: PlanMilestone[],
  goalDeadline: string,
): PlanDailyDraft[] {
  if (milestones.length === 0) return []

  const goalDeadlineFixed = correctGoalDeadlineToFuture(goalDeadline)
  const todayStr = getBusinessTodayIso()
  const idSet = new Set(milestones.map((m) => m.id))
  const firstId = milestones[0].id
  const msById = new Map(milestones.map((m) => [m.id, m]))
  const fixMilestoneId = (mid: string) => (idSet.has(mid) ? mid : firstId)
  const milestoneOrderWithWindow = [...milestones]
    .map((m, idx) => ({ ...m, _idx: idx }))
    .sort((a, b) => {
      const d = a.targetDate.localeCompare(b.targetDate)
      if (d !== 0) return d
      return a._idx - b._idx
    })
    .map((m, idx, arr) => {
      if (idx === 0) {
        return {
          id: m.id,
          targetDate: m.targetDate,
          windowStart: todayStr,
        }
      }
      const prevTarget = arr[idx - 1]?.targetDate ?? todayStr
      const rawWindowStart = getBusinessTodayIso(addDays(parseISO(`${prevTarget}T12:00:00`), 1))
      const windowStartDate = startOfDay(parseISO(`${rawWindowStart}T12:00:00`))
      const targetDate = startOfDay(parseISO(`${m.targetDate}T12:00:00`))
      return {
        id: m.id,
        targetDate: m.targetDate,
        // 若相邻里程碑同日，则允许同日排期，避免出现空时间窗。
        windowStart: windowStartDate > targetDate ? m.targetDate : rawWindowStart,
      }
    })

  const easy = data.easyFirstStep
  const firstWindowMilestoneId = milestoneOrderWithWindow[0]?.id ?? firstId
  const firstWindowMilestone = msById.get(firstWindowMilestoneId)
  const firstTarget = firstWindowMilestone?.targetDate ?? goalDeadlineFixed
  const easyDraft: PlanDailyDraft = {
    id: newDraftId("easy", 0),
    milestoneId: firstWindowMilestoneId,
    title: easy.title?.trim() || "轻松第一步",
    duration: Math.min(120, Math.max(5, Math.round(Number(easy.duration)) || 25)),
    spanDays: 1,
    startDate: todayStr,
    criteria: easy.criteria ?? "",
    minimumVersion: easy.minimumVersion ?? "",
    isEasyFirstStep: true,
  }
  easyDraft.spanDays = clampSpanDaysToMilestoneEnd(
    easyDraft.startDate,
    easyDraft.spanDays,
    firstTarget,
    goalDeadlineFixed,
  )

  const tasksByMilestone = new Map<string, DailyPlanAiTask[]>()
  for (const rawTask of data.tasks ?? []) {
    const mid = fixMilestoneId(rawTask.milestoneId)
    const arr = tasksByMilestone.get(mid) ?? []
    arr.push({ ...rawTask, milestoneId: mid })
    tasksByMilestone.set(mid, arr)
  }
  const rest: PlanDailyDraft[] = []
  let seq = 1
  for (const msWindow of milestoneOrderWithWindow) {
    const mid = msWindow.id
    const ms = msById.get(mid)
    const target = ms?.targetDate ?? goalDeadlineFixed
    const milestoneTasks = tasksByMilestone.get(mid) ?? []
    let milestoneCursor = msWindow.windowStart
    for (const t of milestoneTasks) {
      const startDate = clampStartDateInWindow(
        milestoneCursor,
        goalDeadlineFixed,
        target,
        todayStr,
        msWindow.windowStart,
      )
      let spanDays = normalizeEstimatedDays(t.estimatedDays)
      spanDays = clampSpanDaysToMilestoneEnd(startDate, spanDays, target, goalDeadlineFixed)
      const nextStart = getBusinessTodayIso(addDays(parseISO(`${startDate}T12:00:00`), spanDays))
      milestoneCursor = nextStart
      rest.push({
        id: newDraftId("d", seq),
        milestoneId: mid,
        title: (t.title ?? "").trim() || `任务 ${seq}`,
        duration: Math.min(240, Math.max(5, Math.round(Number(t.duration)) || 25)),
        spanDays,
        startDate,
        criteria: t.criteria ?? "",
        minimumVersion: t.minimumVersion ?? "",
        isEasyFirstStep: false,
      })
      seq += 1
    }
  }

  return [easyDraft, ...rest]
}

export function planDailyDraftsToTasks(drafts: PlanDailyDraft[]): Task[] {
  return drafts.map((d) => ({
    id: d.id,
    milestoneId: d.milestoneId,
    title: d.title,
    duration: d.duration,
    spanDays:
      typeof d.spanDays === "number" && d.spanDays >= 1 ? Math.min(365, Math.floor(d.spanDays)) : 1,
    startDate: d.startDate,
    criteria: d.criteria,
    minimumVersion: d.minimumVersion,
    isEasyFirstStep: d.isEasyFirstStep ?? false,
    completed: false,
  }))
}
