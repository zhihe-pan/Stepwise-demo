import type { Goal } from "@/lib/types"
import {
  correctGoalDeadlineToFuture,
  correctMilestoneTargetDate,
  correctMilestoneTimelineDates,
} from "@/lib/plan-date-correction"

/** 与主项目 `app/actions/app.ts` 中 `withCorrectedGoalDates` 一致：入库前日期纠偏（本地展示用） */
export function withCorrectedGoalDates(goal: Goal): Goal {
  const deadline = correctGoalDeadlineToFuture(goal.deadline)
  const tasks = goal.tasks.map((t) => ({
    ...t,
    startDate: correctMilestoneTargetDate(t.startDate, deadline),
  }))

  if (goal.milestones.length === 0) {
    return {
      ...goal,
      deadline,
      tasks,
      nextMilestoneDate: goal.nextMilestoneDate
        ? correctMilestoneTargetDate(goal.nextMilestoneDate, deadline)
        : goal.nextMilestoneDate,
    }
  }

  const dates = correctMilestoneTimelineDates(
    goal.milestones.map((m) => m.targetDate),
    deadline,
  )
  const milestones = goal.milestones.map((m, i) => ({
    ...m,
    targetDate: dates[i] ?? deadline,
  }))
  const active = milestones.find((m) => !m.achieved) ?? milestones[milestones.length - 1]
  return {
    ...goal,
    deadline,
    milestones,
    tasks,
    nextMilestoneDate: active?.targetDate ?? deadline,
  }
}
