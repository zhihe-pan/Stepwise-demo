import { z } from "zod"

export const goalBasicsCategorySchema = z.enum([
  "career",
  "learning",
  "health",
  "finance",
  "project",
  "other",
])

export const goalBasicsReviewFormSchema = z.object({
  goalName: z.coerce.string().trim().pipe(z.string().min(1)),
  deadline: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  category: goalBasicsCategorySchema,
  weeklyHours: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === "string" ? Number(v.trim()) : v
      return Number.isFinite(n) ? Math.round(n) : NaN
    })
    .pipe(z.number().int().min(1).max(40)),
})

/** 模型偶发与约定不一致时由前端兜底：仅当 decision===ready 且 form 非 null 才自动填表 */
export const goalBasicsReviewResponseSchema = z.object({
  decision: z.enum(["needs_clarification", "ready"]),
  reasoning: z.coerce.string(),
  userFacingNote: z.coerce.string(),
  questions: z.array(z.coerce.string()),
  form: goalBasicsReviewFormSchema.nullable(),
})

export type GoalBasicsReviewResponse = z.infer<typeof goalBasicsReviewResponseSchema>
