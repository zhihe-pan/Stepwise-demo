import { parseGoalPlanFromMessage, inferCategoryFromText } from "@/lib/ai-chat-plan-parse"
import { stripDatesFromTitle } from "@/lib/goal-title-deadline-align"

export type GoalSwitchDetectionInput = {
  userMessage: string
  currentGoalName?: string
  currentCategory?: string
  currentPhase?: string
  milestoneCount?: number
  dailyTaskCount?: number
}

export type GoalSwitchDetectionResult = {
  shouldPrompt: boolean
  nextGoalName: string
  reason: string
}

const STRONG_SWITCH_PATTERNS = [
  /换(?:一个|成|成做)?/,
  /改成/,
  /不做(?:这个|它|这个目标)?了/,
  /重新(?:来|开始|定(?:一个)?目标)/,
  /另一个目标/,
  /先不做/,
  /改做/,
  /更想做/,
]

const NEW_GOAL_INTENT_PATTERNS = [
  /(?:我想|想要|准备|计划|目标是|打算)\s*(.+)/,
  /(?:改成|换成|改做|更想做)\s*(.+)/,
]

const GOAL_FIELD_MENTION_PATTERN =
  /(?:每周|一周|每星期|每个星期|每周投入|投入时间|每周时间|weeklyHours|截止|截止日期|目标日期|完成日期|类别|分类|方向)/iu

const STANDALONE_WEEKLY_HOURS_PATTERN =
  /^(?:大概|大约|约|先|就|那就|改成|调成|调到|增加到|减少到)?\s*(?:每周|一周|每星期|每个星期)?\s*(?:投入|花|用)?\s*(\d{1,2})\s*(?:个)?(?:小时|h)(?:左右|吧)?$/iu

const STANDALONE_DATE_PATTERN =
  /^(?:改成|改到|调到|截止(?:日期)?(?:改成)?|目标日期(?:改成)?|完成日期(?:改成)?)?\s*\d{4}(?:[-/]\d{1,2}[-/]\d{1,2}|年\d{1,2}月\d{1,2}日?)$/u

const STANDALONE_CATEGORY_PATTERN =
  /^(?:改成|换成|类别改成|分类改成|方向改成)?\s*(职业|工作|求职|学习|健康|财务|理财|项目|其他)$/u

function normalizeGoalText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"'‘’《》【】（）()\[\]\s,，。.!！?？:：;；/\\\-]+/g, "")
    .trim()
}

function normalizeStandaloneValue(text: string): string {
  return text.trim().replace(/[。！？!?，,；;、\s]+/g, "")
}

function looksLikeGoalFieldValue(text: string): boolean {
  const normalized = normalizeStandaloneValue(text)
  if (!normalized) return false
  return [
    STANDALONE_WEEKLY_HOURS_PATTERN,
    STANDALONE_DATE_PATTERN,
    STANDALONE_CATEGORY_PATTERN,
  ].some((re) => re.test(normalized))
}

function isLikelyGoalFieldAdjustment(userMessage: string, nextGoalName: string): boolean {
  const parsed = parseGoalPlanFromMessage(userMessage)
  const messageMentionsGoalField = GOAL_FIELD_MENTION_PATTERN.test(userMessage)
  const candidateLooksLikeFieldValue = looksLikeGoalFieldValue(nextGoalName)
  const messageLooksLikeFieldValue = looksLikeGoalFieldValue(userMessage)

  if (candidateLooksLikeFieldValue || messageLooksLikeFieldValue) return true

  if (!messageMentionsGoalField) return false

  const hasStructuredFieldUpdate =
    parsed.weeklyHours != null ||
    Boolean(parsed.deadline) ||
    /(?:类别|分类|方向)/u.test(userMessage)

  if (!nextGoalName.trim() && hasStructuredFieldUpdate) return true
  if (!nextGoalName.trim()) return true

  return false
}

function extractCandidateGoalName(userMessage: string): string {
  const parsed = parseGoalPlanFromMessage(userMessage)
  const direct = stripDatesFromTitle((parsed.title ?? "").trim()).trim()
  if (direct) return direct

  for (const pattern of NEW_GOAL_INTENT_PATTERNS) {
    const match = userMessage.match(pattern)
    const candidate = stripDatesFromTitle((match?.[1] ?? "").trim()).trim()
    if (candidate.length >= 2) return candidate
  }

  const line = stripDatesFromTitle(userMessage.trim().split(/\r?\n/, 1)[0] ?? "").trim()
  if (line.length >= 2 && line.length <= 30) return line
  return ""
}

function categoriesDiffer(a: string, b: string): boolean {
  if (!a || !b) return false
  return a !== b
}

export function detectGoalSwitch(input: GoalSwitchDetectionInput): GoalSwitchDetectionResult {
  const userMessage = input.userMessage.trim()
  const currentGoalName = (input.currentGoalName ?? "").trim()
  if (!userMessage || !currentGoalName) {
    return { shouldPrompt: false, nextGoalName: "", reason: "" }
  }

  const currentNorm = normalizeGoalText(currentGoalName)
  if (!currentNorm) {
    return { shouldPrompt: false, nextGoalName: "", reason: "" }
  }

  const nextGoalName = extractCandidateGoalName(userMessage)
  const nextNorm = normalizeGoalText(nextGoalName)
  const hasStrongSwitchCue = STRONG_SWITCH_PATTERNS.some((re) => re.test(userMessage))
  const currentCategory = (input.currentCategory ?? "").trim()
  const nextCategory = inferCategoryFromText(nextGoalName || userMessage) ?? ""
  const substantivePlanExists =
    (input.milestoneCount ?? 0) > 0 || (input.dailyTaskCount ?? 0) > 0 || input.currentPhase !== "form"

  if (!nextNorm) {
    return {
      shouldPrompt: false,
      nextGoalName: "",
      reason: "",
    }
  }

  if (isLikelyGoalFieldAdjustment(userMessage, nextGoalName)) {
    return { shouldPrompt: false, nextGoalName: "", reason: "" }
  }

  if (
    nextNorm === currentNorm ||
    nextNorm.includes(currentNorm) ||
    currentNorm.includes(nextNorm)
  ) {
    return { shouldPrompt: false, nextGoalName: "", reason: "" }
  }

  if (hasStrongSwitchCue) {
    return {
      shouldPrompt: true,
      nextGoalName,
      reason: "检测到你用了“换一个/改成/不做这个了”之类的明显切换表达。",
    }
  }

  if (substantivePlanExists && categoriesDiffer(currentCategory, nextCategory)) {
    return {
      shouldPrompt: true,
      nextGoalName,
      reason: "当前左侧已经有一套旧规划，而你刚刚提到的新目标与原类别差异很大。",
    }
  }

  return { shouldPrompt: false, nextGoalName: "", reason: "" }
}
