import { z } from "zod"

export const dailyReviewTaskSchema = z.object({
  milestoneId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.number().int().min(5).max(240),
  spanDays: z.number().int().min(1).max(365),
  criteria: z.string().trim().optional(),
  minimumVersion: z.string().trim().optional(),
  isEasyFirstStep: z.boolean().optional(),
})

export const dailyReviewResponseSchema = z.object({
  decision: z.enum(["needs_clarification", "ready"]),
  reasonType: z.enum(["none", "ethics", "too_hard", "too_easy", "other"]).default("other"),
  allowProceedIfUserInsists: z.boolean().default(false),
  reasoning: z.coerce.string(),
  userFacingNote: z.coerce.string(),
  questions: z.array(z.coerce.string()),
})

export type DailyReviewResponse = z.infer<typeof dailyReviewResponseSchema>
