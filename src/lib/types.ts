export type DiaryMood = "great" | "good" | "neutral" | "bad"

export interface Task {
  id: string
  title: string
  duration: number
  spanDays: number
  startDate: string
  criteria: string
  minimumVersion: string
  isEasyFirstStep: boolean
  completed: boolean
  /** 跨天任务在 Today 每次勾选 +1，满 spanDays 则 completed；单日任务为 0/1 */
  progressUnits?: number
  milestoneId?: string
}

export interface GoalMilestone {
  id: string
  title: string
  detail?: string
  targetDate: string
  achieved: boolean
  achievedEarly?: boolean
}

export interface GoalExecutionLogEntry {
  id: string
  createdAt: string
  action: string
  reasonCode: string
  reasonLabel: string
  /** 用户操作时对应的「今日」日历日 */
  calendarDate: string
  summary: string
  taskId: string | null
}

export interface Goal {
  id: string
  name: string
  emoji: string
  category?: string
  weeklyHours?: number
  /** 目标创建时间（ISO），用于展示计划时间区间起点 */
  createdAt?: string
  currentPhase: string
  deadline: string
  progress: number
  nextMilestone: string
  nextMilestoneDate: string
  milestones: GoalMilestone[]
  tasks: Task[]
  executionLogs: GoalExecutionLogEntry[]
}

export interface DiaryEntry {
  id: string
  content: string
  images: string[]
  goalId: string | null
  goalName: string | null
  createdAt: string
  mood?: DiaryMood
}

export interface AppUser {
  id: string
  name: string | null
  email: string | null
  image?: string | null
  /** 是否设定了邮箱密码（相对仅 OAuth 而言） */
  hasPassword: boolean
}
