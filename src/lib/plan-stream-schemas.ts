import { z } from "zod"
import { MILESTONE_DETAIL_MAX_CHARS, MILESTONE_TITLE_MAX_CHARS } from "@/lib/milestone-limits"

export const milestonesFromGoalEasyStepSchema = z.object({
  title: z.string().min(1).describe("轻松第一步：立刻能做的超小动作"),
  duration: z.number().int().min(5).max(120).describe("建议专注时长（分钟）"),
  criteria: z.string().min(1).describe("完成标准"),
  minimumVersion: z.string().min(1).describe("最低可接受版本"),
})

/** 模型在 JSON 里可能用数字类型标题、字符串分钟数、省略字段；与 streamObject / useObject 两端共用，减少「流成功但 Zod 失败→落模板」 */
export const planIsoDateSchema = z
  .string()
  .transform((raw) => {
    const s = raw.trim()
    const m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/)
    if (m) {
      const [, y, mo, d] = m
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
    }
    return s
  })
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))

export const milestonesFromGoalMilestoneSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(MILESTONE_TITLE_MAX_CHARS)
    .describe(`里程碑名称，具体可衡量；不超过 ${MILESTONE_TITLE_MAX_CHARS} 字`),
  detail: z
    .string()
    .optional()
    .transform((v) => (v == null ? undefined : v.trim()))
    .pipe(z.string().max(MILESTONE_DETAIL_MAX_CHARS).optional())
    .describe(
      `三行标签：分别以「具体细节：」「验收标准：」「参考资料：」开头，JSON 内用换行；不超过 ${MILESTONE_DETAIL_MAX_CHARS} 字`,
    ),
  targetDate: planIsoDateSchema.describe("该里程碑目标完成日，须不晚于总 deadline"),
})

const milestonesStreamEasyFirstInner = z.object({
  title: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1))
    .optional(),
  duration: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === "string" ? Number(v.trim()) : v
      return Number.isFinite(n) ? Math.round(n) : undefined
    })
    .pipe(z.number().int().min(5).max(120).optional()),
  criteria: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1))
    .optional(),
  minimumVersion: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1))
    .optional(),
})

/**
 * 模型常把「轻松第一步」写成一句字符串而非对象；先归一化再交给 Zod。
 */
export function coerceEasyFirstStepFromLooseModelValue(val: unknown): unknown {
  if (val == null) return val
  if (typeof val === "string") {
    const t = val.trim()
    if (!t) return undefined
    const title = t.length > 200 ? `${t.slice(0, 197)}…` : t
    const criteria = t.length > 500 ? `${t.slice(0, 497)}…` : t
    return {
      title,
      duration: 25,
      criteria,
      minimumVersion: "完成最小可感知进展即可",
    }
  }
  return val
}

/** 与 /api/plan/milestones-from-goal 流式输出一致，供客户端 useObject / streamObject 校验 */
export const milestonesFromGoalResponseSchema = z.object({
  milestones: z.array(milestonesFromGoalMilestoneSchema).min(1).max(8),
  easyFirstStep: z.preprocess(
    coerceEasyFirstStepFromLooseModelValue,
    z.union([milestonesStreamEasyFirstInner, z.null()]).optional(),
  ).transform((v) => (v == null ? undefined : v)),
  /** 用户表达夸奖/感谢时由模型生成一句致谢，供界面单独展示；无则勿输出此键 */
  praiseAcknowledgement: z.string().trim().max(80).optional(),
})

export const dailyPlanEasyStepSchema = z.object({
  title: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1))
    .describe("轻松第一步：立刻能做、阻力极小的动作"),
  duration: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === "string" ? Number(v.trim()) : v
      return Number.isFinite(n) ? Math.round(n) : NaN
    })
    .pipe(z.number().int().min(5).max(120))
    .describe("建议专注时长（分钟）"),
  criteria: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1))
    .describe("完成标准，可自检是否达到"),
  minimumVersion: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1))
    .describe("最低可接受版本，再小也算完成"),
})

/** 流式阶段可省略较长字段以提速；空串在落库前由 dailyPlanResponseToDrafts 兜底 */
export const dailyPlanStreamTaskSchema = z.object({
  milestoneId: z.string().min(1).describe("必须等于输入里程碑中的 id 之一"),
  title: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1))
    .describe("单日可完成的小任务标题"),
  duration: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === "string" ? Number(v.trim()) : v
      return Number.isFinite(n) ? Math.round(n) : NaN
    })
    .pipe(z.number().int().min(5).max(180))
    .describe("单次投入分钟数"),
  estimatedDays: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === "string" ? Number(v.trim()) : v
      return Number.isFinite(n) ? Math.floor(n) : NaN
    })
    .pipe(z.number().int().min(1).max(365))
    .describe("该任务预计所需天数（正整数），具体起始日期与跨度由系统日期引擎计算"),
  criteria: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => String(v).trim())
    .pipe(z.string().optional())
    .describe("完成标准，可一两句概括，省略则由界面稍后补全"),
  minimumVersion: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => String(v).trim())
    .pipe(z.string().optional())
    .describe("降级版完成定义，可省略"),
})

/** 与 /api/plan/daily-from-milestones 流式输出一致 */
export const dailyPlanStreamResponseSchema = z.object({
  easyFirstStep: z.preprocess(coerceEasyFirstStepFromLooseModelValue, dailyPlanEasyStepSchema),
  tasks: z.array(dailyPlanStreamTaskSchema).min(1).max(36),
  /** 用户表达夸奖/感谢时由模型生成一句致谢，供界面单独展示；无则勿输出此键 */
  praiseAcknowledgement: z.string().trim().max(80).optional(),
})

export const dailyPlanMilestoneObjectSchema = z.object({
  easyFirstStep: z.preprocess(
    coerceEasyFirstStepFromLooseModelValue,
    z.union([dailyPlanEasyStepSchema, z.null()]).optional(),
  ).transform((v) => (v == null ? undefined : v)),
  tasks: z.array(dailyPlanStreamTaskSchema).min(1).max(8),
  praiseAcknowledgement: z.string().trim().max(80).optional(),
})

export const dailyPlanParallelMilestoneResultSchema = z.object({
  milestoneId: z.string().min(1),
  status: z.enum(["success", "failed", "timeout"]),
  tasks: z.array(dailyPlanStreamTaskSchema).optional(),
  easyFirstStep: dailyPlanEasyStepSchema.optional(),
  praiseAcknowledgement: z.string().trim().max(80).optional(),
  errorMessage: z.string().optional(),
  retryCount: z.number().int().min(0).max(10).optional(),
  latencyMs: z.number().int().min(0).optional(),
})

export const dailyPlanParallelFinalResponseSchema = z.object({
  result: z.enum(["success", "partial_success", "failed"]),
  easyFirstStep: dailyPlanEasyStepSchema.optional(),
  tasks: z.array(dailyPlanStreamTaskSchema),
  praiseAcknowledgement: z.string().trim().max(80).optional(),
  milestoneResults: z.array(dailyPlanParallelMilestoneResultSchema),
  aggregate: z.object({
    totalMilestones: z.number().int().min(0),
    successMilestones: z.number().int().min(0),
    failedMilestones: z.number().int().min(0),
    coverageRate: z.number().min(0).max(1),
    totalTasks: z.number().int().min(0),
  }),
})

export const dailyPlanParallelEventSchema = z.object({
  type: z.enum([
    "daily_plan.parallel.started",
    "daily_plan.milestone.started",
    "daily_plan.milestone.succeeded",
    "daily_plan.milestone.failed",
    "daily_plan.parallel.completed",
  ]),
  milestoneId: z.string().optional(),
  done: z.number().int().min(0).optional(),
  total: z.number().int().min(0).optional(),
  payload: z.unknown().optional(),
})

export type MilestonesFromGoalStreamResult = z.infer<typeof milestonesFromGoalResponseSchema>
export type DailyPlanStreamResult = z.infer<typeof dailyPlanStreamResponseSchema>
export type DailyPlanParallelFinalResponse = z.infer<typeof dailyPlanParallelFinalResponseSchema>
export type DailyPlanParallelMilestoneResult = z.infer<typeof dailyPlanParallelMilestoneResultSchema>
export type DailyPlanParallelEvent = z.infer<typeof dailyPlanParallelEventSchema>
