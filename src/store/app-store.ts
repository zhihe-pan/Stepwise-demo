import { format } from "date-fns"
import { create } from "zustand"
import { applyCarryOverTodayToTomorrow } from "@/lib/task-carry-over"
import type { AppUser, DiaryEntry, Goal, GoalExecutionLogEntry } from "@/lib/types"
import { mockDiaryEntries, mockGoals } from "@/lib/mock-data"
import { normalizeGoal, normalizedTaskSpanDays, syncGoalPhaseFields } from "@/lib/goal-helpers"
import { withCorrectedGoalDates } from "@/lib/showcase-goal-dates"

const TASK_PROGRESS_DONE_ACTION = "task_progress_done"

function sortGoalsForClient(goals: Goal[]) {
  return goals
    .map((goal, index) => ({ goal, index }))
    .sort((a, b) => {
      const deadlineDiff =
        new Date(`${a.goal.deadline}T12:00:00`).getTime() - new Date(`${b.goal.deadline}T12:00:00`).getTime()
      if (deadlineDiff !== 0) return deadlineDiff
      return a.index - b.index
    })
    .map(({ goal }) => goal)
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function prepareGoals(goals: Goal[]) {
  return sortGoalsForClient(
    goals.map((g) => normalizeGoal(withCorrectedGoalDates(structuredClone(g)))),
  )
}

const initialUser: AppUser = {
  id: "showcase-user",
  name: "Stepwise 用户",
  email: "you@example.com",
  image: null,
  hasPassword: true,
}

type AppState = {
  isAuthenticated: boolean
  user: AppUser
  goals: Goal[]
  diaryEntries: DiaryEntry[]
  signInDemo: (input: { email: string; password: string }) => void
  registerDemo: (
    input: { name: string; email: string; password: string },
  ) => { ok: true; message: string } | { ok: false; message: string }
  logout: () => void
  resetAfterAccountDeletion: () => void
  setUser: (user: AppUser) => void
  setGoals: (goals: Goal[]) => void
  setDiaryEntries: (entries: DiaryEntry[]) => void
  createGoal: (goal: Goal) => void
  updateGoal: (goal: Goal) => void
  updateGoalIcon: (goalId: string, emoji: string) => void
  deleteGoal: (goalId: string) => void
  updateTaskStatus: (taskId: string, completed: boolean, calendarDate?: string) => void
  carryOverTodayTask: (input: {
    taskId: string
    reasonCode: string
    reasonLabel: string
    calendarDate: string
  }) => void
  logIncompleteOpenEditGoal: (input: {
    taskId: string
    reasonCode: string
    reasonLabel: string
    calendarDate: string
  }) => void
  createDiaryEntry: (payload: Pick<DiaryEntry, "content" | "images" | "goalId" | "mood">) => void
  updateDiaryEntry: (entryId: string, payload: Pick<DiaryEntry, "content" | "images" | "goalId" | "mood">) => void
  deleteDiaryEntry: (entryId: string) => void
  updateProfile: (input: { name: string; image: string | null }) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // 演示站首次进入默认展示登录页
  isAuthenticated: false,
  user: initialUser,
  goals: prepareGoals(mockGoals),
  diaryEntries: structuredClone(mockDiaryEntries),

  signInDemo: ({ email, password }) => {
    void password
    const nextEmail = email.trim().toLowerCase()
    set({
      isAuthenticated: true,
      user: {
        ...get().user,
        email: nextEmail || get().user.email,
      },
    })
  },

  registerDemo: ({ name, email, password }) => {
    if (password.length < 8) {
      return { ok: false, message: "密码至少需要 8 位字符。" }
    }
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail.includes("@")) {
      return { ok: false, message: "请输入有效的邮箱地址。" }
    }
    set({
      isAuthenticated: true,
      user: {
        id: "showcase-user",
        name: name.trim() || "Stepwise 用户",
        email: trimmedEmail,
        image: null,
        hasPassword: true,
      },
    })
    return { ok: true, message: "注册成功，现在可以直接登录。" }
  },

  logout: () => set({ isAuthenticated: false }),

  resetAfterAccountDeletion: () =>
    set({
      isAuthenticated: false,
      user: { ...initialUser },
      goals: prepareGoals(mockGoals),
      diaryEntries: structuredClone(mockDiaryEntries),
    }),

  setUser: (user) => set({ user }),
  setGoals: (goals) => set({ goals: prepareGoals(goals) }),
  setDiaryEntries: (entries) => set({ diaryEntries: entries }),

  createGoal: (goal) => {
    const g = normalizeGoal(withCorrectedGoalDates(structuredClone(goal)))
    set({ goals: sortGoalsForClient([g, ...get().goals]) })
  },

  updateGoal: (goal) => {
    const g = normalizeGoal(withCorrectedGoalDates(structuredClone(goal)))
    set({
      goals: sortGoalsForClient(get().goals.map((item) => (item.id === g.id ? g : item))),
    })
  },

  updateGoalIcon: (goalId, emoji) => {
    set({
      goals: get().goals.map((g) => (g.id === goalId ? { ...g, emoji } : g)),
    })
  },

  deleteGoal: (goalId) => {
    set({
      goals: get().goals.filter((g) => g.id !== goalId),
      diaryEntries: get().diaryEntries.filter((e) => e.goalId !== goalId),
    })
  },

  updateTaskStatus: (taskId, completed, calendarDate) => {
    set({
      goals: get().goals.map((goal) => {
        const taskIndex = goal.tasks.findIndex((t) => t.id === taskId)
        if (taskIndex === -1) return goal
        const task = goal.tasks[taskIndex]!
        const span = normalizedTaskSpanDays(task)
        const tasks = [...goal.tasks]
        let executionLogs = [...goal.executionLogs]

        if (span <= 1) {
          tasks[taskIndex] = {
            ...task,
            completed,
            progressUnits: completed ? 1 : 0,
          }
        } else if (calendarDate && /^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) {
          const exists = executionLogs.some(
            (l) =>
              l.taskId === taskId &&
              l.action === TASK_PROGRESS_DONE_ACTION &&
              l.calendarDate === calendarDate,
          )
          if (completed) {
            if (!exists) {
              executionLogs.push({
                id: newId("log"),
                createdAt: new Date().toISOString(),
                action: TASK_PROGRESS_DONE_ACTION,
                reasonCode: "progress",
                reasonLabel: "完成 1 天进度",
                calendarDate,
                summary: `跨天任务完成 1 天进度：${task.title}`,
                taskId,
              })
            }
          } else {
            executionLogs = executionLogs.filter(
              (l) =>
                !(
                  l.taskId === taskId &&
                  l.action === TASK_PROGRESS_DONE_ACTION &&
                  l.calendarDate === calendarDate
                ),
            )
          }
          const progressDays = executionLogs.filter(
            (l) => l.taskId === taskId && l.action === TASK_PROGRESS_DONE_ACTION,
          ).length
          const progressUnits = Math.max(0, Math.min(span, progressDays))
          const done = progressUnits >= span
          tasks[taskIndex] = { ...task, progressUnits, completed: done }
        } else {
          let progressUnits = task.progressUnits ?? 0
          if (completed) progressUnits = Math.min(span, progressUnits + 1)
          else progressUnits = Math.max(0, progressUnits - 1)
          const done = progressUnits >= span
          tasks[taskIndex] = { ...task, progressUnits, completed: done }
        }

        const nextGoal: Goal = { ...goal, tasks, executionLogs }
        return { ...nextGoal, ...syncGoalPhaseFields(nextGoal) }
      }),
    })
  },

  carryOverTodayTask: ({ taskId, reasonCode, reasonLabel, calendarDate }) => {
    set({
      goals: get().goals.map((goal) => {
        const taskIndex = goal.tasks.findIndex((t) => t.id === taskId)
        if (taskIndex === -1) return goal
        const task = goal.tasks[taskIndex]!
        try {
          const next = applyCarryOverTodayToTomorrow({
            startDate: new Date(`${task.startDate.slice(0, 10)}T12:00:00`),
            spanDays: task.spanDays,
            duration: task.duration,
            calendarDay: calendarDate,
          })
          const startDateStr = format(next.startDate, "yyyy-MM-dd")
          const summary = `${calendarDate} 未完成任务「${task.title}」，原因：${reasonLabel}。已选择推迟到明天。`
          const log: GoalExecutionLogEntry = {
            id: newId("log"),
            createdAt: new Date().toISOString(),
            action: "postpone_carryover",
            reasonCode,
            reasonLabel,
            calendarDate,
            summary,
            taskId,
          }
          const tasks = [...goal.tasks]
          tasks[taskIndex] = {
            ...task,
            startDate: startDateStr,
            spanDays: next.spanDays,
            duration: next.duration,
            progressUnits: 0,
            completed: false,
          }
          const nextGoal: Goal = { ...goal, tasks, executionLogs: [...goal.executionLogs, log] }
          return { ...nextGoal, ...syncGoalPhaseFields(nextGoal) }
        } catch {
          return goal
        }
      }),
    })
  },

  logIncompleteOpenEditGoal: ({ taskId, reasonCode, reasonLabel, calendarDate }) => {
    set({
      goals: get().goals.map((goal) => {
        const task = goal.tasks.find((t) => t.id === taskId)
        if (!task) return goal
        const summary = `${calendarDate} 未完成任务「${task.title}」，原因：${reasonLabel}。用户选择进入修改目标流程。`
        const log: GoalExecutionLogEntry = {
          id: newId("log"),
          createdAt: new Date().toISOString(),
          action: "incomplete_open_edit_goal",
          reasonCode,
          reasonLabel,
          calendarDate,
          summary,
          taskId,
        }
        return { ...goal, executionLogs: [...goal.executionLogs, log] }
      }),
    })
  },

  createDiaryEntry: (payload) => {
    const goal = payload.goalId ? get().goals.find((g) => g.id === payload.goalId) : undefined
    const entry: DiaryEntry = {
      id: newId("diary"),
      content: payload.content,
      images: payload.images ?? [],
      goalId: goal?.id ?? payload.goalId ?? null,
      goalName: goal?.name ?? null,
      createdAt: new Date().toISOString(),
      mood: payload.mood,
    }
    set({ diaryEntries: [entry, ...get().diaryEntries] })
  },

  updateDiaryEntry: (entryId, payload) => {
    const goal = payload.goalId ? get().goals.find((g) => g.id === payload.goalId) : undefined
    set({
      diaryEntries: get().diaryEntries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              content: payload.content,
              images: payload.images ?? [],
              goalId: goal?.id ?? payload.goalId ?? null,
              goalName: goal?.name ?? null,
              mood: payload.mood,
            }
          : e,
      ),
    })
  },

  deleteDiaryEntry: (entryId) => {
    set({ diaryEntries: get().diaryEntries.filter((e) => e.id !== entryId) })
  },

  updateProfile: (input) => {
    set({
      user: {
        ...get().user,
        name: input.name,
        image: input.image,
      },
    })
  },
}))

export function useAppStoreApi() {
  return useAppStore
}
