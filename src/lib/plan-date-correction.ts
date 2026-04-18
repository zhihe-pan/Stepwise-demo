import { addYears, format, isAfter, isBefore, parseISO, startOfDay } from "date-fns"

const ISO = /^\d{4}-\d{2}-\d{2}$/

function parseDay(iso: string): Date | null {
  if (!ISO.test(iso)) return null
  try {
    const d = parseISO(`${iso}T12:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

function toStartDay(iso: string): Date | null {
  const d = parseDay(iso)
  return d ? startOfDay(d) : null
}

const MAX_YEAR_BUMP = 8

/**
 * 纠正「目标截止日期」：须在「今天」当日或之后。
 * 若模型/抽取给出过去日期（含去年），优先按「保持月日、逐年 +1 年」推到首个仍 ≥ 今天的日期；
 * 若仍无法满足则退回为今天。
 */
export function correctGoalDeadlineToFuture(deadlineIso: string): string {
  const today = startOfDay(new Date())
  const d = toStartDay(deadlineIso)
  if (!d) return format(today, "yyyy-MM-dd")
  if (!isBefore(d, today)) return deadlineIso.slice(0, 10)

  for (let i = 1; i <= MAX_YEAR_BUMP; i++) {
    const y = startOfDay(addYears(d, i))
    if (!isBefore(y, today)) return format(y, "yyyy-MM-dd")
  }
  return format(today, "yyyy-MM-dd")
}

/**
 * 纠正单条里程碑 targetDate：落在 [今天, 已纠正后的目标截止日]，
 * 对过去日期同样尝试「逐年 +1 年」再钳位。
 */
export function correctMilestoneTargetDate(targetIso: string, goalDeadlineIso: string): string {
  const today = startOfDay(new Date())
  const deadlineStr = correctGoalDeadlineToFuture(goalDeadlineIso)
  const deadlineD = toStartDay(deadlineStr) ?? today
  let high = deadlineD
  if (isBefore(high, today)) high = today

  let x = toStartDay(targetIso) ?? today

  if (isBefore(x, today)) {
    let found: Date | null = null
    for (let i = 1; i <= MAX_YEAR_BUMP; i++) {
      const y = startOfDay(addYears(x, i))
      if (!isBefore(y, today) && !isAfter(y, high)) {
        found = y
        break
      }
    }
    x = found ?? today
  }

  if (isAfter(x, high)) x = high
  if (isBefore(x, today)) x = today

  return format(x, "yyyy-MM-dd")
}

/**
 * 在保持里程碑顺序的前提下：依次保证 targetDate 非递减，且均在 [today, deadline]。
 */
export function correctMilestoneTimelineDates(
  targetDates: string[],
  goalDeadlineIso: string,
): string[] {
  const deadlineStr = correctGoalDeadlineToFuture(goalDeadlineIso)
  const today = startOfDay(new Date())
  const deadline = toStartDay(deadlineStr) ?? today

  const preliminary = targetDates.map((raw) => toStartDay(correctMilestoneTargetDate(raw, deadlineStr))!)

  let prev = today
  return preliminary.map((x) => {
    let y = x
    if (isBefore(y, prev)) y = prev
    if (isAfter(y, deadline)) y = deadline
    prev = y
    return format(y, "yyyy-MM-dd")
  })
}
