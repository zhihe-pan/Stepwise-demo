import { z } from "zod"
import type { DiaryEntry, Goal } from "@/lib/types"
import { DELETE_ACCOUNT_CONFIRM_PHRASE } from "@/lib/delete-account"
import { useAppStore } from "@/store/app-store"

const taskIncompletePayloadSchema = z.object({
  taskId: z.string().min(1),
  reasonCode: z.string().min(1),
  reasonLabel: z.string().min(1),
  calendarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const diaryPayloadSchema = z
  .object({
    content: z.string().default(""),
    images: z.array(z.string()).default([]),
    goalId: z.string().nullable().optional(),
    mood: z.enum(["great", "good", "neutral", "bad"]).optional(),
  })
  .transform((raw) => ({
    content: raw.content.trim(),
    images: raw.images,
    goalId: raw.goalId ?? null,
    mood: raw.mood ?? null,
  }))
  .superRefine((val, ctx) => {
    if (val.content.length === 0 && val.images.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "日记正文与图片至少需要一项",
      })
    }
  })

const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "用户名至少 1 个字符").max(40),
  image: z.union([z.string().max(5_000_000), z.null()]),
})

export type DeleteAccountResult = { ok: true } | { ok: false; message: string }

export async function createGoalAction(goal: Goal): Promise<void> {
  useAppStore.getState().createGoal(goal)
}

export async function updateGoalAction(goal: Goal): Promise<void> {
  useAppStore.getState().updateGoal(goal)
}

export async function updateGoalIconAction(goalId: string, emoji: string): Promise<void> {
  useAppStore.getState().updateGoalIcon(goalId, emoji)
}

export async function deleteGoalAction(goalId: string): Promise<void> {
  useAppStore.getState().deleteGoal(goalId)
}

export async function updateTaskStatusAction(
  taskId: string,
  completed: boolean,
  calendarDate?: string,
): Promise<void> {
  useAppStore.getState().updateTaskStatus(taskId, completed, calendarDate)
}

export async function deleteTaskAction(_taskId: string): Promise<void> {
  /* 展示模式未实现删除单任务 */
}

export async function carryOverTodayTaskAction(input: z.infer<typeof taskIncompletePayloadSchema>): Promise<void> {
  const parsed = taskIncompletePayloadSchema.safeParse(input)
  if (!parsed.success) throw new Error("INVALID_TASK_INCOMPLETE_PAYLOAD")
  useAppStore.getState().carryOverTodayTask(parsed.data)
}

export async function logIncompleteOpenEditGoalAction(
  input: z.infer<typeof taskIncompletePayloadSchema>,
): Promise<void> {
  const parsed = taskIncompletePayloadSchema.safeParse(input)
  if (!parsed.success) throw new Error("INVALID_TASK_INCOMPLETE_PAYLOAD")
  useAppStore.getState().logIncompleteOpenEditGoal(parsed.data)
}

export async function createDiaryEntryAction(
  payload: Pick<DiaryEntry, "content" | "images" | "goalId" | "mood">,
): Promise<void> {
  const parsed = diaryPayloadSchema.safeParse(payload)
  if (!parsed.success) throw new Error("INVALID_DIARY_PAYLOAD")
  const d = parsed.data
  useAppStore.getState().createDiaryEntry({
    content: d.content,
    images: d.images,
    goalId: d.goalId,
    mood: d.mood ?? undefined,
  })
}

export async function updateDiaryEntryAction(
  entryId: string,
  payload: Pick<DiaryEntry, "content" | "images" | "goalId" | "mood">,
): Promise<void> {
  const parsed = diaryPayloadSchema.safeParse(payload)
  if (!parsed.success) throw new Error("INVALID_DIARY_PAYLOAD")
  const d = parsed.data
  useAppStore.getState().updateDiaryEntry(entryId, {
    content: d.content,
    images: d.images,
    goalId: d.goalId,
    mood: d.mood ?? undefined,
  })
}

export async function deleteDiaryEntryAction(entryId: string): Promise<void> {
  useAppStore.getState().deleteDiaryEntry(entryId)
}

export async function updateProfileAction(input: { name: string; image: string | null }): Promise<void> {
  const parsed = profileUpdateSchema.safeParse(input)
  if (!parsed.success) throw new Error("INVALID_PROFILE")
  useAppStore.getState().updateProfile(parsed.data)
}

export async function deleteAccountAction(input: {
  confirmation: string
  password?: string
}): Promise<DeleteAccountResult> {
  if (input.confirmation !== DELETE_ACCOUNT_CONFIRM_PHRASE) {
    return { ok: false, message: "确认语不正确，请按提示完整输入。" }
  }
  const { user } = useAppStore.getState()
  if (user.hasPassword) {
    const password = input.password?.trim() ?? ""
    if (password.length < 8) {
      return { ok: false, message: "请输入当前登录密码以确认删除。" }
    }
  }
  useAppStore.getState().resetAfterAccountDeletion()
  return { ok: true }
}
