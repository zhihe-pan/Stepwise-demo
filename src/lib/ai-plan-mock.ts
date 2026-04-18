import { addDays, format, isAfter, isBefore, parseISO, startOfDay } from "date-fns"
import { formatDateInBusinessTimeZone, getBusinessTodayIso } from "@/lib/business-time"
import type { Goal, Task } from "@/lib/types"
import { MILESTONE_DETAIL_MAX_CHARS, MILESTONE_TITLE_MAX_CHARS } from "@/lib/milestone-limits"

export interface PlanMilestone {
  id: string
  title: string
  detail?: string
  targetDate: string
}

export interface PlanDailyDraft {
  id: string
  milestoneId: string
  title: string
  duration: number
  spanDays: number
  /** 计划从哪一天开始（YYYY-MM-DD） */
  startDate: string
  criteria: string
  minimumVersion: string
  isEasyFirstStep?: boolean
}

/** 按生成顺序为任务依次安排开始日，且不晚于目标截止日期 */
export function assignSequentialStartDatesToDrafts(
  drafts: Omit<PlanDailyDraft, "startDate">[],
  goalDeadline: string
): PlanDailyDraft[] {
  const today = startOfDay(parseISO(`${getBusinessTodayIso()}T12:00:00`))
  const deadline = startOfDay(parseISO(goalDeadline.length <= 10 ? `${goalDeadline}T12:00:00` : goalDeadline))
  let cursor = today

  return drafts.map((d) => {
    const span = Math.max(1, Math.min(365, Math.floor(d.spanDays)))
    let start = cursor
    if (isBefore(start, today)) start = today
    let endInclusive = addDays(start, span - 1)
    if (isAfter(endInclusive, deadline)) {
      start = addDays(deadline, -(span - 1))
      endInclusive = deadline
    }
    if (isBefore(start, today)) {
      start = today
      endInclusive = addDays(start, span - 1)
      if (isAfter(endInclusive, deadline)) {
        endInclusive = deadline
      }
    }
    const startStr = format(start, "yyyy-MM-dd")
    cursor = addDays(endInclusive, 1)
    return { ...d, startDate: startStr }
  })
}

const CATEGORY_EMOJI: Record<string, string> = {
  career: "💼",
  learning: "📚",
  health: "🏃",
  finance: "💰",
  project: "🚀",
  other: "🎯",
}

/** 根据目标图标反推类别（用于编辑目标时对齐创建流程） */
export function inferCategoryFromEmoji(emoji: string): string {
  const found = (Object.entries(CATEGORY_EMOJI) as [string, string][]).find(([, e]) => e === emoji)
  return found?.[0] ?? "other"
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** 在「今天 → 截止日期」之间按比例取日期 YYYY-MM-DD */
function dateBetween(deadlineIso: string, t: number): string {
  const end = new Date(deadlineIso + "T12:00:00").getTime()
  const start = parseISO(`${getBusinessTodayIso()}T12:00:00`).getTime()
  const clamped = Math.min(0.98, Math.max(0.05, t))
  const ms = start + (end - start) * clamped
  return formatDateInBusinessTimeZone(ms)
}

/**
 * 模拟 AI：根据目标信息生成里程碑（前端演示，可替换为真实 API）
 */
export function mockGenerateMilestones(input: {
  goalName: string
  deadline: string
  category: string
  weeklyHours: number
}): PlanMilestone[] {
  const g = input.goalName.trim() || "本目标"
  const short = g.length > 14 ? g.slice(0, 14) + "…" : g

  const titles = [
    {
      title: `厘清现状与成功标准：围绕「${short}」对齐预期`,
      detail:
        "- 具体细节：梳理现状、目标范围与成功判断依据\n- 验收标准：产出一份包含现状与目标对比的文档\n- 参考资料：《SMART原则应用指南》",
    },
    {
      title: "关键路径设计：拆解主要依赖与风险",
      detail:
        "- 具体细节：拆出关键依赖、潜在阻塞点与应对优先级\n- 验收标准：完成风险清单及对应策略\n- 参考资料：相关技术或项目管理框架",
    },
    {
      title: "集中执行期：推进核心交付与练习",
      detail:
        "- 具体细节：安排核心任务推进节奏并保留复盘缓冲\n- 验收标准：完成核心功能或达到练习指标\n- 参考资料：番茄工作法介绍",
    },
    {
      title: `复盘与冲刺：检验成果并收尾「${short}」`,
      detail:
        "- 具体细节：对照目标查漏补缺，并整理收尾动作\n- 验收标准：产出最终复盘文档\n- 参考资料：《复盘：对过去的事情做思维演练》",
    },
  ]

  return titles.map((item, i) => ({
    id: newId("m"),
    title: item.title.slice(0, MILESTONE_TITLE_MAX_CHARS),
    detail: item.detail.slice(0, MILESTONE_DETAIL_MAX_CHARS),
    targetDate: dateBetween(input.deadline, 0.22 + i * 0.2),
  }))
}

/**
 * 模拟 AI：为每个里程碑生成 2～3 个「一天能完成」的小任务
 */
export function mockGenerateDailyTasks(
  milestones: PlanMilestone[],
  goalName: string,
  weeklyHours: number,
  goalDeadline: string
): PlanDailyDraft[] {
  const g = goalName.trim() || "目标"
  const baseMin = Math.max(20, Math.min(45, Math.round((weeklyHours * 60) / (weeklyHours + 8))))

  const templateGroups: [string, string, string][][] = [
    [
      [
        `写下「${g}」的完成定义与 3 条衡量标准`,
        "文档或笔记中可复述完成定义，列出可验证标准",
        "只写 1 条完成定义 + 1 条标准",
      ],
      [
        "列出当前资源、约束与缺口（各至少 2 条）",
        "表格或列表形式，缺口对应可能的补齐方式",
        "先列资源与约束各 1 条",
      ],
      [
        "与目标相关的 30 分钟信息搜集并保存 3 条链接/要点",
        "标注每条对你下一步行动的帮助",
        "只完成 15 分钟搜集 + 1 条要点",
      ],
    ],
    [
      [
        "画出从现状到目标的主路径（3～5 个里程碑）",
        "每个里程碑写一句「完成时是什么样」",
        "先画 3 个里程碑草稿",
      ],
      [
        "标出主路径上最大的 2 个风险与应对思路",
        "每个风险一句话描述 + 一条缓解动作",
        "先写 1 个风险",
      ],
    ],
    [
      [
        "执行一项与里程碑直接相关的核心动作（≥25 分钟专注）",
        "记录开始/结束时间与产出物（哪怕很粗糙）",
        "先做 15 分钟专注块",
      ],
      [
        "根据产出做一次 10 分钟复盘：下一步调整 1 件事",
        "写下一行「明天首要动作」",
        "只写复盘中的首要动作一句",
      ],
      [
        "整理本周与目标相关的投入时长与完成情况",
        "诚实记录即可，不评判",
        "只记两天的大致投入",
      ],
    ],
    [
      [
        "对照初始成功标准自检：哪些已达成、哪些差一步",
        "列表勾选或简短段落",
        "先对 1 条标准做自检",
      ],
      [
        "列出收尾清单（交付、文档、归档）并划掉已完成项",
        "至少处理清单中 1 项",
        "只写清单不写执行",
      ],
    ],
  ]

  const drafts: Omit<PlanDailyDraft, "startDate">[] = []

  milestones.forEach((ms, idx) => {
    const group = templateGroups[idx % templateGroups.length]
    const count = group.length === 2 ? 2 : 3
    for (let j = 0; j < Math.min(count, group.length); j++) {
      const [title, criteria, minV] = group[j]
      drafts.push({
        id: newId("d"),
        milestoneId: ms.id,
        title,
        duration: baseMin + j * 5,
        spanDays: (j % 3) + 1,
        criteria,
        minimumVersion: minV,
        isEasyFirstStep: j === 0,
      })
    }
  })

  return assignSequentialStartDatesToDrafts(drafts, goalDeadline)
}

export function buildGoalFromPlan(input: {
  goalName: string
  deadline: string
  category: string
  milestones: PlanMilestone[]
  dailyTasks: PlanDailyDraft[]
}): Goal {
  const emoji = CATEGORY_EMOJI[input.category] ?? "🎯"
  const first = input.milestones[0]
  const phaseShort =
    first?.title && first.title.length > 16 ? first.title.slice(0, 16) + "…" : first?.title || "已启动"

  const milestones = input.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    detail: m.detail ?? "",
    targetDate: m.targetDate,
    achieved: false,
  }))

  const tasks: Task[] = input.dailyTasks.map((d) => ({
    id: newId("t"),
    milestoneId: d.milestoneId,
    title: d.title,
    duration: d.duration,
    spanDays: typeof d.spanDays === "number" && d.spanDays >= 1 ? Math.min(365, Math.floor(d.spanDays)) : 1,
    startDate:
      typeof d.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.startDate)
        ? d.startDate
        : getBusinessTodayIso(),
    criteria: d.criteria,
    minimumVersion: d.minimumVersion,
    isEasyFirstStep: d.isEasyFirstStep ?? false,
    completed: false,
  }))

  return {
    id: newId("goal"),
    name: input.goalName.trim(),
    emoji,
    currentPhase: phaseShort,
    deadline: input.deadline,
    progress: 0,
    nextMilestone: first?.title ?? "第一个里程碑",
    nextMilestoneDate: first?.targetDate ?? input.deadline,
    milestones,
    tasks,
    executionLogs: [],
  }
}
