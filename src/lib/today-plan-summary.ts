import type { Goal } from "@/lib/types"
import { isTaskCheckedOnCalendarDay, tasksForActiveMilestoneOnCalendarDay } from "@/lib/goal-helpers"

export function buildTodayAiPlanSummary(goals: Goal[], day: Date = new Date()): string {
  const rows = goals
    .map((g) => ({
      goal: g,
      tasks: tasksForActiveMilestoneOnCalendarDay(g, day, { includeCompleted: true }),
    }))
    .filter((r) => r.tasks.length > 0)

  const flat = rows.flatMap((r) => r.tasks)
  const total = flat.length
  const pending = flat.filter((t) => !isTaskCheckedOnCalendarDay(t, day)).length
  const activeGoals = rows.length
  const hasEasyPending = flat.some((t) => t.isEasyFirstStep && !isTaskCheckedOnCalendarDay(t, day))

  if (total === 0) {
    return "今日空白，慢慢来"
  }

  if (pending === 0) {
    return "全部搞定，真棒！"
  }

  if (pending === 1) {
    if (hasEasyPending) return "就1项，轻松一步，加油！"
    return "快完成了，加油！"
  }

  if (pending <= 3) {
    if (hasEasyPending) return `还有${pending}项，先做轻松的`
    if (activeGoals >= 2) return `还有${pending}项，先顾一头`
    return `还有${pending}项，加油！`
  }

  if (pending <= 6) {
    if (hasEasyPending) return `${pending}项不少，先做轻松的`
    if (activeGoals >= 2) return `${pending}项，一步一步来`
    return `${pending}项，慢慢来`
  }

  return `${pending}项，别急，一步一步来`
}
