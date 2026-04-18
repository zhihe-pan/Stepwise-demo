import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns"
import { getBusinessTodayIso } from "@/lib/business-time"
import { correctGoalDeadlineToFuture, correctMilestoneTimelineDates } from "@/lib/plan-date-correction"
import { stripDatesFromTitle } from "@/lib/goal-title-deadline-align"

const GOAL_CATEGORIES = ["career", "learning", "health", "finance", "project", "other"] as const
export type ShowcaseGoalCategory = (typeof GOAL_CATEGORIES)[number]

/** 离线展示：用户发任意一条对话后写入左侧的「默认结构化计划」说明文案 */
export const SHOWCASE_CHAT_STUB_INTRO =
  "当前为离线展示环境，未接入真实模型。下面已用内置示例计划填充 JSON（含里程碑与轻松第一步），你可直接在左侧修改后点「下一步」继续。"

const DEFAULT_TITLE = "三个月内学会自由泳 25 米连贯换气"
const DEFAULT_CATEGORY: ShowcaseGoalCategory = "health"
const DEFAULT_WEEKLY_HOURS = 8
const DEFAULT_WEEKLY_RATIONALE =
  "按每周约 8 小时估算：含往返泳馆、水中练习与课后放松；左侧可改成你真实可投入的小时数。"

const DEFAULT_MILESTONE_BLUEPRINT: readonly { title: string; detail: string }[] = [
  {
    title: "水感与呼吸：池边练习与闷水换气",
    detail:
      "具体细节：在浅水区完成闷水、吐纳与池边打腿，建立对水压与节奏的体感。\n验收标准：能连续完成 10 次「闷水—抬头换气」且心率恢复平稳。\n参考资料：《游泳入门：呼吸与漂浮》公开教学摘要。",
  },
  {
    title: "漂浮与打腿：身体成直线、推进感稳定",
    detail:
      "具体细节：扶板打自由泳腿，关注髋发力与脚尖延伸，减少「沉腰」与抬头过高。\n验收标准：25 米打腿一趟可不停顿完成，且换气时身体轴线基本稳定。\n参考资料：国家体总《游泳技术练习要点》节选。",
  },
  {
    title: "连贯换气与 25 米一趟：可重复、可放松",
    detail:
      "具体细节：配合划手节奏完成侧头换气，控制划频；以「能连续游完」优先于速度。\n验收标准：25 米自由泳至少完成 2 趟，换气不呛水、动作可复述。\n参考资料：教练常见纠错清单（肩髋一体、入水点）。",
  },
]

const DEFAULT_EASY_FIRST_STEP = {
  title: "用 10 分钟把两次「去游泳馆」写进日历，并把泳镜泳帽放进包侧袋",
  duration: 25,
  criteria: "日历里出现两次固定时段；运动包内泳具齐全可拎包出发。",
  minimumVersion: "只在日历写下一次时段也算完成。",
}

function normalizeCategory(raw: string): ShowcaseGoalCategory {
  const v = raw.trim().toLowerCase()
  return (GOAL_CATEGORIES as readonly string[]).includes(v) ? (v as ShowcaseGoalCategory) : DEFAULT_CATEGORY
}

function milestoneTargetDates(deadlineIso: string): string[] {
  const todayIso = getBusinessTodayIso()
  const start = parseISO(`${todayIso}T12:00:00`)
  const end = parseISO(`${deadlineIso}T12:00:00`)
  const span = Math.max(21, differenceInCalendarDays(end, start))
  const raw = [
    format(addDays(start, Math.max(3, Math.floor(span * 0.28))), "yyyy-MM-dd"),
    format(addDays(start, Math.max(5, Math.floor(span * 0.55))), "yyyy-MM-dd"),
    deadlineIso,
  ]
  return correctMilestoneTimelineDates(raw, deadlineIso)
}

export function readShowcaseChatWizardHints(body: unknown): {
  goalName: string
  deadline: string
  category: string
  weeklyHours: number | null
} {
  if (body == null || typeof body !== "object") {
    return { goalName: "", deadline: "", category: "", weeklyHours: null }
  }
  const g = (body as { goalWizardContext?: unknown }).goalWizardContext
  if (g == null || typeof g !== "object") {
    return { goalName: "", deadline: "", category: "", weeklyHours: null }
  }
  const o = g as Record<string, unknown>
  const goalName = typeof o.goalName === "string" ? o.goalName.trim() : ""
  const deadline = typeof o.deadline === "string" ? o.deadline.trim() : ""
  const category = typeof o.category === "string" ? o.category.trim() : ""
  const wh = o.weeklyHours
  const weeklyHours =
    typeof wh === "number" && Number.isFinite(wh) ? Math.floor(wh) : typeof wh === "string" && Number.isFinite(Number(wh)) ? Math.floor(Number(wh)) : null
  return { goalName, deadline, category, weeklyHours }
}

export type ShowcaseExtractGoalPlanParsedInput = {
  title: string
  deadline: string
  weeklyHours: number
  weeklyHoursRationale: string
  category: ShowcaseGoalCategory
}

export type ShowcaseExtractGoalPlanToolOutput = ShowcaseExtractGoalPlanParsedInput & {
  milestones: { title: string; detail: string; targetDate: string }[]
  easyFirstStep: {
    title: string
    duration: number
    criteria: string
    minimumVersion: string
  }
}

/**
 * 构造与线上一致的 extract_goal_plan 工具入参/出参（出参含示例里程碑与轻松第一步），
 * 供离线 /api/chat 占位流写入左侧表单。
 */
export function buildShowcaseExtractGoalPlanPayload(hints: ReturnType<typeof readShowcaseChatWizardHints>): {
  parsedInput: ShowcaseExtractGoalPlanParsedInput
  toolOutput: ShowcaseExtractGoalPlanToolOutput
} {
  const todayIso = getBusinessTodayIso()

  const titleRaw = hints.goalName.length >= 2 ? hints.goalName : DEFAULT_TITLE
  const deadlineGuess = format(addDays(parseISO(`${todayIso}T12:00:00`), 92), "yyyy-MM-dd")
  const deadlineRaw =
    /^\d{4}-\d{2}-\d{2}$/.test(hints.deadline) ? hints.deadline : deadlineGuess

  const category = hints.category ? normalizeCategory(hints.category) : DEFAULT_CATEGORY
  const weeklyHours =
    hints.weeklyHours != null && hints.weeklyHours >= 1 && hints.weeklyHours <= 40
      ? hints.weeklyHours
      : DEFAULT_WEEKLY_HOURS

  const parsedInput: ShowcaseExtractGoalPlanParsedInput = {
    title: titleRaw.trim(),
    deadline: deadlineRaw,
    weeklyHours,
    weeklyHoursRationale: DEFAULT_WEEKLY_RATIONALE,
    category,
  }

  const titleStripped = stripDatesFromTitle(parsedInput.title.trim()).trim() || parsedInput.title.trim()
  const deadlineFixed = correctGoalDeadlineToFuture(parsedInput.deadline)
  const dates = milestoneTargetDates(deadlineFixed)

  const milestones = DEFAULT_MILESTONE_BLUEPRINT.map((m, i) => ({
    title: m.title,
    detail: m.detail,
    targetDate: dates[i] ?? deadlineFixed,
  }))

  const toolOutput: ShowcaseExtractGoalPlanToolOutput = {
    title: titleStripped,
    deadline: deadlineFixed,
    weeklyHours: parsedInput.weeklyHours,
    weeklyHoursRationale: parsedInput.weeklyHoursRationale,
    category: parsedInput.category,
    milestones,
    easyFirstStep: { ...DEFAULT_EASY_FIRST_STEP },
  }

  return { parsedInput, toolOutput }
}
