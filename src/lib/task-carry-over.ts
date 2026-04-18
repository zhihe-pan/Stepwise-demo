import { addDays, format, parseISO, startOfDay } from "date-fns"

/** 跨日任务顺延后单次投入分钟上限（加倍后封顶，避免数值失控） */
const MAX_DURATION_MINUTES = 24 * 60

/**
 * 「今天未完成 → 推迟到明天」：把今日应做部分并入明日，而非整条计划整体后移。
 * - 单日任务：开始日改为「日历日」的次日（不再出现在当天）。
 * - 跨多天任务：开始日与跨度不变，将建议投入时长（duration）加倍，体现「次日时间加倍」。
 */
export function applyCarryOverTodayToTomorrow(params: {
  startDate: Date
  spanDays: number
  duration: number
  /** 用户眼中的「今天」，yyyy-MM-dd */
  calendarDay: string
}): { startDate: Date; spanDays: number; duration: number } {
  const ISO = /^\d{4}-\d{2}-\d{2}$/
  if (!ISO.test(params.calendarDay)) {
    throw new Error("INVALID_CALENDAR_DAY")
  }
  const span = Math.min(365, Math.max(1, Math.floor(params.spanDays)))
  const baseDur = Math.max(1, Math.floor(params.duration))
  const cal = startOfDay(parseISO(`${params.calendarDay}T12:00:00`))
  const start = startOfDay(params.startDate)
  const end = addDays(start, span - 1)
  if (cal < start || cal > end) {
    throw new Error("TASK_NOT_ON_CALENDAR_DAY")
  }

  if (span <= 1) {
    const next = addDays(cal, 1)
    return {
      startDate: parseISO(`${format(next, "yyyy-MM-dd")}T12:00:00`),
      spanDays: 1,
      duration: baseDur,
    }
  }

  const doubled = Math.min(MAX_DURATION_MINUTES, baseDur * 2)
  return {
    startDate: params.startDate,
    spanDays: span,
    duration: doubled,
  }
}
