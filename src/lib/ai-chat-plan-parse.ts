import { isBefore, parseISO, startOfDay } from "date-fns"
import { inferDeadlineFromGoalTitle } from "@/lib/goal-title-deadline-infer"
import { stripDatesFromTitle } from "@/lib/goal-title-deadline-align"

export type ParsedGoalPlan = {
  title?: string
  deadline?: string
  weeklyHours?: number
  milestoneTitles?: string[]
}

function looksLikeStandaloneScheduleAnswer(text: string): boolean {
  const s = text.trim().replace(/[。！？!?，,；;、\s]+/g, "")
  if (!s) return false
  return [
    /^(?:大概|大约|约)?(?:\d+|[一二两三四五六七八九十半几俩个]+)(?:天|周|星期|个月|月|年)$/u,
    /^(?:大概|大约|约)?(?:\d+|[一二两三四五六七八九十半几俩个]+)(?:个)?(?:小时|h)$/iu,
    /^(?:每周|一周|每星期|每个星期)(?:\d+|[一二两三四五六七八九十半几俩个]+)(?:个)?(?:小时|h)$/iu,
    /^每天(?:\d+|[一二两三四五六七八九十半几俩个]+)(?:个)?(?:小时|h)$/iu,
    /^工作日每天(?:\d+|[一二两三四五六七八九十半几俩个]+)(?:个)?(?:小时|h)$/iu,
    /^周末(?:两天)?(?:每天|各)?(?:\d+|[一二两三四五六七八九十半几俩个]+)(?:个)?(?:小时|h)$/iu,
  ].some((re) => re.test(s))
}

function padDatePart(n: number): string {
  return String(n).padStart(2, "0")
}

/** 归一化为 YYYY-MM-DD；非法则 undefined */
export function normalizeDeadlineCandidate(raw: string): string | undefined {
  const s = raw.trim()
  const loose = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (loose) {
    const candidate = `${loose[1]}-${padDatePart(Number(loose[2]))}-${padDatePart(Number(loose[3]))}`
    return isDeadlineValidForPicker(candidate) ? candidate : undefined
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const m = Number(iso[2])
    const d = Number(iso[3])
    if (m < 1 || m > 12 || d < 1 || d > 31) return undefined
    const candidate = `${iso[1]}-${iso[2]}-${iso[3]}`
    return isDeadlineValidForPicker(candidate) ? candidate : undefined
  }
  const zh = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/)
  if (zh) {
    const y = Number(zh[1])
    const m = Number(zh[2])
    const d = Number(zh[3])
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return undefined
    const candidate = `${y}-${padDatePart(m)}-${padDatePart(d)}`
    return isDeadlineValidForPicker(candidate) ? candidate : undefined
  }
  const slash = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (slash) {
    const y = Number(slash[1])
    const m = Number(slash[2])
    const d = Number(slash[3])
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return undefined
    const candidate = `${y}-${padDatePart(m)}-${padDatePart(d)}`
    return isDeadlineValidForPicker(candidate) ? candidate : undefined
  }
  return undefined
}

/** 与 DatePicker 一致：不可早于今天 */
export function isDeadlineValidForPicker(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false
  try {
    const d = parseISO(`${isoDate}T12:00:00`)
    return !isBefore(startOfDay(d), startOfDay(new Date()))
  } catch {
    return false
  }
}

/** 与创建/编辑目标表单一致的类别取值 */
export type GoalWizardCategory = "career" | "learning" | "health" | "finance" | "project" | "other"

/** 根据目标名称/描述文本推断最匹配的类别；无强关键词时返回 undefined */
export function inferCategoryFromText(text: string): string | undefined {
  const t = text.toLowerCase()
  if (/职业|工作|求职|面试|offer|晋升|跳槽|pm|产品|运营|开发岗|职场/.test(t)) return "career"
  if (
    /学|课程|技能|考试|证书|读书|语言|雅思|托福|考研|公考|培训|入门|刷题/.test(t)
  )
    return "learning"
  if (/健康|运动|健身|减肥|睡眠|饮食|跑步|马拉松|冥想|作息/.test(t)) return "health"
  if (/财务|存钱|投资|理财|房贷|预算|存款|副业收入/.test(t)) return "finance"
  if (/项目|产品上线|mvp|开源|上线|迭代|交付|原型/.test(t)) return "project"
  return undefined
}

/** 有名称则必有类别：无关键词匹配时为「其他」；空名称返回空串不选类 */
export function inferGoalCategoryFromName(name: string): GoalWizardCategory | "" {
  const n = name.trim()
  if (!n) return ""
  return (inferCategoryFromText(n) ?? "other") as GoalWizardCategory
}

/** 从用户或 AI 的一段对话文本中抽取目标名、截止日与里程碑草稿标题 */
export function parseGoalPlanFromMessage(text: string): ParsedGoalPlan {
  const result: ParsedGoalPlan = {}
  const trimmedText = text.trim()

  const titlePatterns = [
    /(?:^|[\s])目标(?:名称|标题)?[：:]\s*([^\n]+)/i,
    /(?:^|[\s])标题[：:]\s*([^\n]+)/i,
    /(?:^|[\s])我的目标[：:]\s*([^\n]+)/i,
    /(?:确认|建议|整理如下)[：:\s]*\n?\s*「([^」]{2,120})」/,
    /「([^」]{2,120})」/,
  ]
  for (const re of titlePatterns) {
    const m = text.match(re)
    if (m?.[1]?.trim()) {
      result.title = m[1].trim()
      break
    }
  }

  if (!result.title) {
    const normalized = trimmedText
      .replace(/[。！？!?]+$/g, "")
      .replace(/^(?:我(?:目前)?(?:想|想要|希望|准备|打算|计划)|目标是|我这段时间想|我最近想)\s*/u, "")
      .replace(/^(?:先)?(?:想|希望|准备|打算|计划)\s*/u, "")
      .trim()

    const cutoffPatterns = [
      /\s*[，,。；;]\s*/,
      /\s*(?:，|,)?\s*(?:计划|打算|准备|希望|争取)?在.+$/,
      /\s*(?:，|,)?\s*(?:截止|截止日期|目标日期|完成日期).+$/,
      /\s*(?:，|,)?\s*(?:每周|一周|每星期|每个星期).+$/,
      /\s*(?:，|,)?\s*(?:目前|现在|现阶段|已有基础|基础是|背景是).+$/,
      /\s*(?:，|,)?\s*(?:如果|但|不过|然后|再).+$/,
    ]

    let candidate = normalized
    for (const pattern of cutoffPatterns) {
      candidate = candidate.replace(pattern, "").trim()
    }

    candidate = stripDatesFromTitle(candidate)
      .replace(/^(?:把|将)\s*/u, "")
      .replace(/\s*(?:这个|这件事|这项目|这件项目)$/u, "")
      .trim()

    if (candidate.length >= 2 && candidate.length <= 60 && !looksLikeStandaloneScheduleAnswer(candidate)) {
      result.title = candidate
    }
  }

  const dateExtractors: Array<(t: string) => string | undefined> = [
    (t) => {
      const m = t.match(/(?:截止|截止日期|目标日期|完成日期|请于)[：:\s]*(?:（?\s*)?(\d{4}-\d{2}-\d{2})/i)
      return m?.[1] ? normalizeDeadlineCandidate(m[1]) : undefined
    },
    (t) => {
      const m = t.match(
        /(?:截止|截止日期|目标日期|完成日期)[：:\s]*(?:（?\s*)?(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})(?:日)?/i
      )
      return m?.[1] && m?.[2] && m?.[3]
        ? normalizeDeadlineCandidate(`${m[1]}-${m[2]}-${m[3]}`)
        : undefined
    },
    (t) => {
      const m = t.match(/\b(\d{4}-\d{2}-\d{2})\b/)
      return m?.[1] ? normalizeDeadlineCandidate(m[1]) : undefined
    },
  ]
  for (const ex of dateExtractors) {
    const candidate = ex(text)
    if (candidate) {
      result.deadline = candidate
      break
    }
  }

  if (!result.deadline) {
    const fromMsg = inferDeadlineFromGoalTitle(text)
    const fromTitle = result.title ? inferDeadlineFromGoalTitle(result.title) : undefined
    const hit = fromMsg ?? fromTitle
    if (hit) result.deadline = hit.iso
  }

  const weeklyHoursExtractors: Array<(t: string) => number | undefined> = [
    (t) => {
      const m = t.match(/(?:每周|一周|每星期|每个星期)\s*(?:大概|大约|约|能|可以)?\s*(投入|花|用)?\s*(\d{1,2})\s*小时/i)
      return m?.[2] ? Number(m[2]) : undefined
    },
    (t) => {
      const m = t.match(/(?:每周|一周|每星期|每个星期)\s*(?:能|可以|大概|大约|约)?\s*(投入|花|用)?\s*(\d{1,2})\s*(?:个)?h\b/i)
      return m?.[2] ? Number(m[2]) : undefined
    },
    (t) => {
      const m = t.match(/每天\s*(\d{1,2}(?:\.\d)?)\s*小时(?:左右)?/i)
      return m?.[1] ? Math.round(Number(m[1]) * 7) : undefined
    },
    (t) => {
      const m = t.match(/工作日每天\s*(\d{1,2}(?:\.\d)?)\s*小时(?:左右)?/i)
      return m?.[1] ? Math.round(Number(m[1]) * 5) : undefined
    },
    (t) => {
      const m = t.match(/周末每天\s*(\d{1,2}(?:\.\d)?)\s*小时(?:左右)?/i)
      return m?.[1] ? Math.round(Number(m[1]) * 2) : undefined
    },
    (t) => {
      const m = t.match(/周末(?:两天)?\s*(?:各|每天)?\s*(\d{1,2}(?:\.\d)?)\s*小时(?:左右)?/i)
      return m?.[1] ? Math.round(Number(m[1]) * 2) : undefined
    },
  ]
  for (const ex of weeklyHoursExtractors) {
    const candidate = ex(text)
    if (candidate && Number.isFinite(candidate)) {
      result.weeklyHours = Math.min(40, Math.max(1, Math.round(candidate)))
      break
    }
  }

  let scan = text
  const msHeading = text.match(/里程碑[：:\s]*(?:\n|$)/i)
  if (msHeading) {
    const idx = msHeading.index ?? 0
    scan = text.slice(idx + msHeading[0].length)
  }

  const milestoneLines = scan.split(/\r?\n/).map((l) => l.trim())
  const milestones: string[] = []
  const seen = new Set<string>()
  for (const line of milestoneLines) {
    if (!line || line.length > 160) continue
    const bullet = line.match(/^[-*•·]\s*(.+)$/)
    const ordered = line.match(/^\d{1,2}[.、）)]\s*(.+)$/)
    const raw = bullet?.[1] ?? ordered?.[1]
    if (!raw) continue
    const title = raw.trim().replace(/[。.]$/, "")
    if (title.length < 2) continue
    if (seen.has(title)) continue
    seen.add(title)
    milestones.push(title)
    if (milestones.length >= 12) break
  }

  if (milestones.length > 0) result.milestoneTitles = milestones

  return result
}
