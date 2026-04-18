import { z } from "zod"
import { MILESTONE_DETAIL_MAX_CHARS, MILESTONE_TITLE_MAX_CHARS } from "@/lib/milestone-limits"

export const milestoneReviewItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(MILESTONE_TITLE_MAX_CHARS),
  detail: z.string().trim().max(MILESTONE_DETAIL_MAX_CHARS).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const milestonesReviewResponseSchema = z.object({
  decision: z.enum(["needs_clarification", "ready"]),
  /** none: 通过；ethics: 伦理/合法性；too_hard: 时间安排过难；too_easy: 时间安排过松；other: 其它 */
  reasonType: z.enum(["none", "ethics", "too_hard", "too_easy", "other"]).default("other"),
  /** 仅在非伦理问题下可为 true，表示用户若坚持可放行 */
  allowProceedIfUserInsists: z.boolean().default(false),
  reasoning: z.coerce.string(),
  userFacingNote: z.coerce.string(),
  questions: z.array(z.coerce.string()),
})

export type MilestonesReviewResponse = z.infer<typeof milestonesReviewResponseSchema>
