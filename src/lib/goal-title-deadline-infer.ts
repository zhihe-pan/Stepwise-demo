import {
  addDays,
  addMonths,
  addWeeks,
  format,
  lastDayOfMonth,
  startOfDay,
  isBefore,
} from "date-fns"
export type InferredDeadline = { iso: string; source: "explicit" | "relative" }

function validYmd(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  if (dt.getMonth() !== m - 1) return undefined
  return format(dt, "yyyy-MM-dd")
}

/** 无年份的「M月D日」：取下一个不早于 today 的公历日期 */
function nextMonthDayFromToday(today: Date, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
  let y = today.getFullYear()
  let candidate = new Date(y, month - 1, day, 12, 0, 0)
  if (isBefore(startOfDay(candidate), today)) y += 1
  candidate = new Date(y, month - 1, day, 12, 0, 0)
  if (candidate.getMonth() !== month - 1) return undefined
  return format(candidate, "yyyy-MM-dd")
}

/**
 * 「M 月前」= 不晚于 M-1 月最后一日（例如 9 月前 → 8 月 31 日；1 月前 → 上一年 12 月 31 日）。
 * 若得到的日期早于 today，则顺延到下一年同一规则，直到 ≥ today。
 */
function deadlineBeforeMonthM(mTarget: number, today: Date): string {
  let year = today.getFullYear()

  const build = (y: number): Date => {
    if (mTarget <= 1) return new Date(y, 0, 0, 12, 0, 0)
    return lastDayOfMonth(new Date(y, mTarget - 2, 1))
  }

  let d = build(year)
  while (isBefore(startOfDay(d), today)) {
    year += 1
    d = build(year)
  }
  return format(d, "yyyy-MM-dd")
}

function endOfYearNotBefore(today: Date): string {
  let y = today.getFullYear()
  let d = lastDayOfMonth(new Date(y, 11, 1))
  while (isBefore(startOfDay(d), today)) {
    y += 1
    d = lastDayOfMonth(new Date(y, 11, 1))
  }
  return format(d, "yyyy-MM-dd")
}

function endOfFirstHalfNotBefore(today: Date): string {
  let y = today.getFullYear()
  let d = lastDayOfMonth(new Date(y, 5, 1))
  while (isBefore(startOfDay(d), today)) {
    y += 1
    d = lastDayOfMonth(new Date(y, 5, 1))
  }
  return format(d, "yyyy-MM-dd")
}

function quarterEndNotBefore(today: Date, quarter: 1 | 2 | 3 | 4): string {
  const endMonthIdx = quarter * 3 - 1
  let y = today.getFullYear()
  let d = lastDayOfMonth(new Date(y, endMonthIdx, 1))
  while (isBefore(startOfDay(d), today)) {
    y += 1
    d = lastDayOfMonth(new Date(y, endMonthIdx, 1))
  }
  return format(d, "yyyy-MM-dd")
}

/**
 * 从目标名称中推断截止日期（中文常见说法 + 嵌入式公历日期）。
 * 返回 ISO 日期字符串；是否「显式含年」用于决定能否覆盖用户手选的截止日。
 */
export function inferDeadlineFromGoalTitle(
  title: string,
  referenceDate: Date = new Date(),
): InferredDeadline | undefined {
  const today = startOfDay(referenceDate)
  const raw = title.trim()
  if (!raw) return undefined

  // ---------- 显式绝对日期（含年） ----------
  const isoWord = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (isoWord) {
    const p = isoWord[1].split("-").map(Number) as [number, number, number]
    const v = validYmd(p[0], p[1], p[2])
    if (v) return { iso: v, source: "explicit" }
  }

  const zhFull = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/)
  if (zhFull) {
    const v = validYmd(Number(zhFull[1]), Number(zhFull[2]), Number(zhFull[3]))
    if (v) return { iso: v, source: "explicit" }
  }

  const slashFull = raw.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:日)?/)
  if (slashFull) {
    const v = validYmd(Number(slashFull[1]), Number(slashFull[2]), Number(slashFull[3]))
    if (v) return { iso: v, source: "explicit" }
  }

  // ---------- 月日（无年）：下一个未过的 occurrence（不与「YYYY年M月D日」重叠）----------
  const md = raw.match(
    /(?:截至|截止到|最迟|不晚于|要在)?\s*(?<!\d{4}年)(\d{1,2})月(\d{1,2})日(?!\s*前)/,
  )
  if (md) {
    const mo = Number(md[1])
    const da = Number(md[2])
    const inferred = nextMonthDayFromToday(today, mo, da)
    if (inferred) return { iso: inferred, source: "explicit" }
  }

  // ---------- 相对：M 月前 ----------
  const beforeMonth = raw.match(/(?<![\d年月])(\d{1,2})月前/)
  if (beforeMonth) {
    const m = Number(beforeMonth[1])
    if (m >= 1 && m <= 12) return { iso: deadlineBeforeMonthM(m, today), source: "relative" }
  }

  // ---------- 年底 / 月末 / 季度 ----------
  if (
    /今年年底|今年末|年底前|年底完成|年末前|年底|年末/.test(raw) ||
    /本年度末|本年末/.test(raw)
  ) {
    return { iso: endOfYearNotBefore(today), source: "relative" }
  }

  if (/明年年底|明年末|明年底前/.test(raw)) {
    const y = today.getFullYear() + 1
    return { iso: format(lastDayOfMonth(new Date(y, 11, 1)), "yyyy-MM-dd"), source: "relative" }
  }

  if (/本月底|本月(底|末)|月末前|这个月(底|末)/.test(raw)) {
    return { iso: format(lastDayOfMonth(today), "yyyy-MM-dd"), source: "relative" }
  }

  if (/下月底|下个月(底|末)/.test(raw)) {
    return { iso: format(lastDayOfMonth(addMonths(today, 1)), "yyyy-MM-dd"), source: "relative" }
  }

  if (/下个月|下月(?!底|末)/.test(raw)) {
    const endNext = lastDayOfMonth(addMonths(today, 1))
    return { iso: format(endNext, "yyyy-MM-dd"), source: "relative" }
  }

  const nextYearMonth = raw.match(/明年\s*(\d{1,2})月/)
  if (nextYearMonth) {
    const mo = Number(nextYearMonth[1])
    if (mo >= 1 && mo <= 12) {
      const y = today.getFullYear() + 1
      return { iso: format(lastDayOfMonth(new Date(y, mo - 1, 1)), "yyyy-MM-dd"), source: "relative" }
    }
  }

  if (/上半年|H1/i.test(raw) && !/下半年/.test(raw)) {
    return { iso: endOfFirstHalfNotBefore(today), source: "relative" }
  }

  if (/下半年|H2/i.test(raw)) {
    return { iso: endOfYearNotBefore(today), source: "relative" }
  }

  if (/第?[一二1]季度|Q1\b/i.test(raw)) return { iso: quarterEndNotBefore(today, 1), source: "relative" }
  if (/第?[二2]季度|Q2\b/i.test(raw)) return { iso: quarterEndNotBefore(today, 2), source: "relative" }
  if (/第?[三3]季度|Q3\b/i.test(raw)) return { iso: quarterEndNotBefore(today, 3), source: "relative" }
  if (/第?[四4]季度|Q4\b/i.test(raw)) return { iso: quarterEndNotBefore(today, 4), source: "relative" }

  // ---------- 几天后 / 几周后 / 几个月后 ----------
  const daysLater = raw.match(/(\d{1,3})\s*天后/)
  if (daysLater) {
    const n = Math.min(3650, Math.max(1, Number(daysLater[1])))
    return { iso: format(addDays(today, n), "yyyy-MM-dd"), source: "relative" }
  }

  const weeksLater = raw.match(/(\d{1,2})\s*周后/)
  if (weeksLater) {
    const n = Math.min(520, Math.max(1, Number(weeksLater[1])))
    return { iso: format(addWeeks(today, n), "yyyy-MM-dd"), source: "relative" }
  }

  const monthsLater = raw.match(/(\d{1,2})\s*个月后/)
  if (monthsLater) {
    const n = Math.min(120, Math.max(1, Number(monthsLater[1])))
    return { iso: format(startOfDay(addMonths(today, n)), "yyyy-MM-dd"), source: "relative" }
  }

  const halfYear = raw.match(/半年后|半年内完成/)
  if (halfYear) {
    return { iso: format(startOfDay(addMonths(today, 6)), "yyyy-MM-dd"), source: "relative" }
  }

  const oneYear = raw.match(/一年内完成|一年以内|一年内/)
  if (oneYear) {
    return { iso: format(startOfDay(addMonths(today, 12)), "yyyy-MM-dd"), source: "relative" }
  }

  return undefined
}
