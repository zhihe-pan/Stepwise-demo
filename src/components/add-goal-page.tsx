"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type { DragEvent as ReactDragEvent } from "react"
import { useChat, experimental_useObject } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useForm, Controller } from "react-hook-form"
import {
  ArrowLeft,
  Send,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ChevronRight,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import type { Goal } from "@/lib/mock-data"
import {
  mockGenerateMilestones,
  mockGenerateDailyTasks,
  buildGoalFromPlan,
  type PlanMilestone,
  type PlanDailyDraft,
} from "@/lib/ai-plan-mock"
import {
  dailyPlanResponseToDrafts,
  dailyStreamResultToAiResponse,
  type DailyPlanAiResponse,
} from "@/lib/daily-plan-response"
import {
  milestonesFromGoalResponseSchema,
  dailyPlanParallelFinalResponseSchema,
  type DailyPlanParallelFinalResponse,
  dailyPlanStreamResponseSchema,
  type DailyPlanStreamResult,
  type MilestonesFromGoalStreamResult,
} from "@/lib/plan-stream-schemas"
import { MILESTONE_DETAIL_MAX_CHARS, MILESTONE_TITLE_MAX_CHARS } from "@/lib/milestone-limits"
import {
  correctGoalDeadlineToFuture,
  correctMilestoneTimelineDates,
} from "@/lib/plan-date-correction"
import { alignGoalTitleWithDeadline, stripDatesFromTitle } from "@/lib/goal-title-deadline-align"
import { splitMilestoneDetailLines } from "@/lib/milestone-text"
import { inferDeadlineFromGoalTitle } from "@/lib/goal-title-deadline-infer"
import { MilestoneSortableList } from "@/components/milestone-sortable-list"
import { GoalGanttChart } from "@/components/goal-gantt-chart"
import { GoalDeadlinePicker } from "@/components/goal-deadline-picker"
import { inferGoalCategoryFromName } from "@/lib/ai-chat-plan-parse"
import {
  GOAL_WIZARD_MAX_USER_TEXT_CHARS,
  type GoalWizardContextPayload,
} from "@/lib/goal-wizard-chat"
import type { GoalBasicsReviewResponse } from "@/lib/goal-basics-review-schema"
import type { MilestonesReviewResponse } from "@/lib/milestones-review-schema"
import type { DailyReviewResponse } from "@/lib/daily-review-schema"
import {
  EasyFirstStepField,
  gfInput,
  gfLabel,
  gfSelectTrigger,
  gfTextarea,
  GoalFormSection,
  RequiredFieldMark,
} from "@/components/goal-form-shared"
import { ChatMarkdown } from "@/components/chat-markdown"
import { DraggableMobileAiFab } from "@/components/draggable-mobile-ai-fab"
import { GoalWizardStepChips, type WizardChipStep } from "@/components/goal-wizard-step-chips"
import { MilestoneIndexBadge } from "@/components/milestone-index-badge"
import { getBusinessTodayIso } from "@/lib/business-time"
import { detectGoalSwitch, type GoalSwitchDetectionResult } from "@/lib/goal-switch-detect"
import { showcaseApiFetch } from "@/lib/showcase-api-fetch"

/** 新建目标会话首条助手消息：欢迎并引导描述目标（会作为对话历史发给模型） */
const GOAL_WIZARD_WELCOME_ID = "stepwise-goal-wizard-welcome"

const GOAL_WIZARD_WELCOME_TEXT = `你好，我是 **Stepwise 的目标拆解助手**！✨

很高兴陪你开启一个新目标。

先用一两句话说说**你想做成什么吧**！
比如这件事对你的意义，或是你期待达成的状态。

接下来我会一步步陪你拆解，帮你落地成清晰可行的每日计划。`

const goalWizardInitialMessages: UIMessage[] = [
  {
    id: GOAL_WIZARD_WELCOME_ID,
    role: "assistant",
    parts: [{ type: "text", text: GOAL_WIZARD_WELCOME_TEXT }],
  },
]

function milestoneReviewSnapshot(ms: PlanMilestone[]): string {
  return JSON.stringify(
    ms.map((m) => ({
      title: (m.title ?? "").trim(),
      detail: (m.detail ?? "").trim(),
      targetDate: (m.targetDate ?? "").trim(),
    })),
  )
}

function dailyReviewSnapshot(tasks: PlanDailyDraft[]): string {
  return JSON.stringify(
    tasks.map((t) => ({
      milestoneId: (t.milestoneId ?? "").trim(),
      title: (t.title ?? "").trim(),
      startDate: (t.startDate ?? "").trim(),
      duration: Number.isFinite(t.duration) ? Math.max(5, Math.round(t.duration)) : 25,
      spanDays: Number.isFinite(t.spanDays) ? Math.max(1, Math.round(t.spanDays)) : 1,
      criteria: (t.criteria ?? "").trim(),
      minimumVersion: (t.minimumVersion ?? "").trim(),
      isEasyFirstStep: Boolean(t.isEasyFirstStep),
    })),
  )
}

interface AddGoalPageProps {
  onBack: () => void
  onGoalCreated: (goal: Goal) => void | Promise<void>
}

const categories = [
  { value: "career", label: "职业发展" },
  { value: "learning", label: "学习提升" },
  { value: "health", label: "健康生活" },
  { value: "finance", label: "财务规划" },
  { value: "project", label: "项目开发" },
  { value: "other", label: "其他" },
]

type WizardPhase =
  | "form"
  | "generating_milestones"
  | "milestones"
  | "generating_daily"
  | "daily"
  | "gantt"

type GoalBasicsForm = {
  goalName: string
  deadline: string
  category: string
  weeklyHours?: number
}

type PendingGoalSwitch = {
  userMessage: string
  nextGoalName: string
  reason: string
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** 与里程碑列表内容一一对应，用于判断返回里程碑后是否需重算每日行动 */
function planMilestonesSnapshotKey(ms: PlanMilestone[]): string {
  return [...ms]
    .map((m) => `${m.id}\t${(m.title ?? "").trim()}\t${(m.detail ?? "").trim()}\t${(m.targetDate ?? "").trim()}`)
    .sort((a, b) => a.localeCompare(b))
    .join("|")
}

/** 用于判断「基本信息」是否与当前里程碑生成时所依据的一致 */
function goalBasicsSnapshotKey(v: {
  goalName?: string
  deadline?: string
  category?: string
  weeklyHours?: number
}): string {
  return [
    (v.goalName ?? "").trim(),
    (v.deadline ?? "").trim(),
    (v.category ?? "").trim(),
    String(v.weeklyHours ?? ""),
  ].join("\x1e")
}

/** 与生成里程碑后写入表单的对齐规则一致，避免只为纠错日期/标题就误判为「已改目标」 */
function normalizedGoalBasicsKeyFromForm(vals: GoalBasicsForm): string {
  const rawDl = (vals.deadline ?? "").trim()
  const deadline =
    rawDl && /^\d{4}-\d{2}-\d{2}$/.test(rawDl) ? correctGoalDeadlineToFuture(rawDl) : rawDl
  const name = alignGoalTitleWithDeadline((vals.goalName ?? "").trim(), deadline)
  return goalBasicsSnapshotKey({
    goalName: name,
    deadline,
    category: (vals.category ?? "").trim(),
    weeklyHours: vals.weeklyHours,
  })
}

/** 与「是否需重新走 AI 基本信息校验」对应：含补充说明，避免只改说明却沿用旧通过状态 */
function goalBasicsReviewGateKey(vals: GoalBasicsForm, supplement: string): string {
  return `${normalizedGoalBasicsKeyFromForm(vals)}\x1f${supplement.trim()}`
}

/** 与 /api/plan/daily-from-milestones 的 feedback 上限一致 */
const MAX_PLAN_FEEDBACK_CHARS = 2000

/**
 * 「补充说明」在向导中全程保留；与「重新生成 / 太难 / 太简单」等单次操作说明合并后交给每日拆解接口。
 */
function mergeSupplementWithPlanFeedback(supplement: string, operationFeedback?: string): string | undefined {
  const s = supplement.trim()
  const o = (operationFeedback ?? "").trim()
  if (!s && !o) return undefined
  if (!o) return s.slice(0, MAX_PLAN_FEEDBACK_CHARS)
  if (!s) return o.slice(0, MAX_PLAN_FEEDBACK_CHARS)
  const merged = `【补充说明（创建目标 · 基本信息，全程有效）】\n${s}\n\n【本次操作说明】\n${o}`
  return merged.slice(0, MAX_PLAN_FEEDBACK_CHARS)
}

type ExtractedPlan = {
  title: string
  deadline: string
  category: GoalBasicsForm["category"]
  milestones: PlanMilestone[]
  easyFirstStep: {
    title: string
    duration: number
    criteria: string
    minimumVersion: string
  } | null
}

type DailyPlanMode = "initial" | "regenerate" | "easier" | "harder"
type DailyParallelPhaseStatus =
  | "idle"
  | "starting"
  | "running"
  | "partial_ready"
  | "success"
  | "partial_success"
  | "failed"
type DailyMilestoneUiStatus = "loading" | "success" | "failed"

type PreviousDailyPlanPayload = {
  easyFirstStep: {
    title: string
    duration: number
    criteria: string
    minimumVersion: string
  }
  tasks: Array<{
    milestoneId: string
    title: string
    duration: number
    estimatedDays: number
    criteria: string
    minimumVersion: string
  }>
}

/** 里程碑流里 easyFirstStep 允许缺字段，合并进表单前补全 */
function normalizeMilestoneStreamEasyFirst(
  raw:
    | Partial<{
        title: string
        duration: number
        criteria: string
        minimumVersion: string
      }>
    | undefined,
): ExtractedPlan["easyFirstStep"] {
  if (!raw) return null
  const title = String(raw.title ?? "").trim()
  const criteria = String(raw.criteria ?? "").trim()
  const minimumVersion = String(raw.minimumVersion ?? "").trim()
  const dRaw = raw.duration
  const duration =
    typeof dRaw === "number" && Number.isFinite(dRaw)
      ? Math.min(120, Math.max(5, Math.round(dRaw)))
      : 25
  if (!title && !criteria && !minimumVersion && dRaw == null) return null
  return {
    title: title || "轻松第一步",
    duration,
    criteria: criteria || "完成一小步即可自检",
    minimumVersion: minimumVersion || "最低可行版本也算完成",
  }
}

function buildPreviousDailyPlanPayload(
  dailyTasks: PlanDailyDraft[],
  easyFallback?: ExtractedPlan["easyFirstStep"] | null,
): PreviousDailyPlanPayload | undefined {
  const easyTask = dailyTasks.find((t) => t.isEasyFirstStep)
  const easySource = easyTask
    ? {
        title: easyTask.title,
        duration: easyTask.duration,
        criteria: easyTask.criteria,
        minimumVersion: easyTask.minimumVersion,
      }
    : easyFallback ?? null
  if (!easySource) return undefined

  const title = String(easySource.title ?? "").trim()
  const criteria = String(easySource.criteria ?? "").trim()
  const minimumVersion = String(easySource.minimumVersion ?? "").trim()
  const durationRaw = Number(easySource.duration)
  const easy = {
    title: title || "轻松第一步",
    duration: Number.isFinite(durationRaw) ? Math.min(120, Math.max(5, Math.round(durationRaw))) : 25,
    criteria: criteria || "完成最小可感知进展即可",
    minimumVersion: minimumVersion || "先做完一个最小动作",
  }

  const tasks = dailyTasks
    .filter((t) => !t.isEasyFirstStep)
    .map((t) => ({
      milestoneId: String(t.milestoneId ?? "").trim(),
      title: String(t.title ?? "").trim(),
      duration:
        typeof t.duration === "number" && Number.isFinite(t.duration)
          ? Math.min(240, Math.max(5, Math.round(t.duration)))
          : 25,
      estimatedDays:
        typeof t.spanDays === "number" && Number.isFinite(t.spanDays)
          ? Math.min(365, Math.max(1, Math.floor(t.spanDays)))
          : 1,
      criteria: String(t.criteria ?? "").trim(),
      minimumVersion: String(t.minimumVersion ?? "").trim(),
    }))
    .filter((t) => t.milestoneId && t.title)

  if (tasks.length === 0) return undefined
  return { easyFirstStep: easy, tasks }
}

/** useObject 流结束校验失败（含 TypeValidationError / Value: undefined）时的可读说明 */
function planStreamValidationUserHint(raw: string): string {
  const t = raw.trim()
  if (/Cannot connect to API|getaddrinfo ENOTFOUND|ENOTFOUND|ECONNREFUSED|ECONNRESET|fetch failed/i.test(t)) {
    return "AI 服务当前不可达（网络 / DNS / 网关地址异常），已自动为您加载预设模板。"
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(t)) {
    return "AI 服务请求超时，已自动为您加载预设模板。"
  }
  if (/429|rate limit|too many requests/i.test(t)) {
    return "AI 服务当前限流，已自动为您加载预设模板。"
  }
  if (/401|403|Unauthorized|Forbidden|invalid api key|incorrect api key/i.test(t)) {
    return "AI 服务鉴权失败，请检查模型网关密钥配置；已自动为您加载预设模板。"
  }
  if (/Value:\s*undefined/i.test(t)) {
    return "AI 响应内容为空（可能受网络或模型风控影响），已自动为您加载预设模板。"
  }
  if (!t) {
    return "AI 返回结构不完整，已自动为您加载预设模板。"
  }
  return `AI 输出未通过校验（${t.slice(0, 200)}${t.length > 200 ? "…" : ""}），已自动为您加载预设模板。`
}

function chatErrorUserHint(raw: string): string {
  const t = raw.trim()
  if (!t) return "AI 助手暂时没有成功返回内容，请再试一次。"
  if (/No object generated|did not match schema|response did not match schema|TypeValidationError/i.test(t)) {
    return "AI 助手刚才整理结构化计划时格式不稳定，请直接继续描述目标、时间或投入安排，我会继续帮你整理。"
  }
  if (/401|Unauthorized/i.test(t)) {
    return "当前登录状态已失效，请重新登录后再试。"
  }
  if (/403|Forbidden|invalid api key|incorrect api key|api key.*invalid/i.test(t)) {
    return "模型接口鉴权失败：请检查 OPENAI_API_KEY 是否为当前服务商（如 DeepSeek）的有效密钥，以及 OPENAI_BASE_URL 是否写对。"
  }
  if (/402|insufficient|balance|quota|billing|credits?|欠费|余额不足/i.test(t)) {
    return "模型服务商返回额度或计费相关错误（常见为余额不足或套餐限制），请到对应平台充值或更换密钥后再试。"
  }
  if (/429|rate limit|too many requests/i.test(t)) {
    return "模型接口触发限流，请稍等片刻再试，或换用负载更低的模型。"
  }
  if (/json_schema|response_format|structured output|不支持.*schema|unsupported.*format/i.test(t)) {
    return "当前模型或网关不支持本应用使用的「结构化 JSON」调用方式；可换用 OpenAI 兼容且支持 json_schema 的模型，或暂时改回官方 OpenAI 端点。"
  }
  if (/model.*not found|does not exist|invalid model|unknown model/i.test(t)) {
    return "OPENAI_MODEL 配置的模型名不被当前接口识别，请核对服务商文档中的模型 ID（如 deepseek-chat）。"
  }
  if (/OPENAI_API_KEY|ENV_OPENAI_KEY|Missing OPENAI/i.test(t)) {
    return "AI 服务当前未正确配置，请稍后再试。"
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(t)) {
    return "AI 服务响应超时，请稍后再试。"
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(t)) {
    return "AI 服务当前不可达，请稍后再试。"
  }
  if (/Unexpected token|JSON|parse|Failed to parse/i.test(t)) {
    return "前端解析模型响应失败（常为网关返回了非 JSON 或错误页）。请检查 OPENAI_BASE_URL 是否指向正确的 OpenAI 兼容地址（DeepSeek 一般为 https://api.deepseek.com/v1）。"
  }
  const clip = t.length > 220 ? `${t.slice(0, 220)}…` : t
  return `AI 助手暂时出错了：${clip} 若持续失败，请查看本机运行 next dev 的终端里 [ai.chat.error] 的完整日志。`
}

/** 去掉可能的 markdown 围栏；useObject 的 parsePartialJson 偶发拿不到对象但整段 body 已是合法 JSON */
function stripAiJsonFences(text: string): string {
  const t = text.trim()
  const m = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t)
  if (m) return m[1].trim()
  return t
}

function tryParseJsonValueFromStreamText(raw: string): unknown {
  let t = stripAiJsonFences(raw)
  if (!t) return undefined
  const i = t.indexOf("{")
  if (i > 0) t = t.slice(i)
  try {
    return JSON.parse(t)
  } catch {
    return undefined
  }
}

function tryRecoverMilestonesFromStreamRaw(raw: string): MilestonesFromGoalStreamResult | null {
  const parsed = tryParseJsonValueFromStreamText(raw)
  if (parsed == null || typeof parsed !== "object") return null
  const r = milestonesFromGoalResponseSchema.safeParse(parsed)
  return r.success ? r.data : null
}

function tryRecoverDailyFromStreamRaw(raw: string): DailyPlanStreamResult | null {
  const parsed = tryParseJsonValueFromStreamText(raw)
  if (parsed == null || typeof parsed !== "object") return null
  const r = dailyPlanStreamResponseSchema.safeParse(parsed)
  return r.success ? r.data : null
}

/** 去日期后若为空则保留用户原文，避免「里程碑页返回基本信息」时主目标被清空 */
function goalNameAfterStripDates(raw: string): string {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return ""
  const stripped = stripDatesFromTitle(trimmed).trim()
  return stripped || trimmed
}

/** 与工具 / 正文 JSON 对齐的松散载荷 */
type ToolPlanPayload = {
  title?: string
  deadline?: string
  weeklyHours?: number
  weeklyHoursRationale?: string
  category?: GoalBasicsForm["category"]
  milestones?: { title?: string; detail?: string; targetDate?: string }[] | null
  easyFirstStep?: ExtractedPlan["easyFirstStep"]
}

function isExtractGoalPlanToolPart(part: { type?: string; toolName?: string }): boolean {
  if (part.type === "tool-extract_goal_plan") return true
  if (part.type === "dynamic-tool" && part.toolName === "extract_goal_plan") return true
  return false
}

function readToolPlanPayload(part: {
  state?: string
  input?: unknown
  output?: unknown
}): ToolPlanPayload | null {
  const st = part.state
  if (st === "output-error" || st === "output-denied") return null

  const raw =
    part.output != null ? part.output : part.input != null ? part.input : null
  if (raw == null || typeof raw !== "object") return null
  return raw as ToolPlanPayload
}

/** 助手消息是否已落地 extract_goal_plan 工具结果（可展示「已识别」提示） */
function messageHasFinalExtractGoalPlan(msg: UIMessage): boolean {
  for (const part of msg.parts ?? []) {
    if (!isExtractGoalPlanToolPart(part as { type?: string; toolName?: string })) continue
    const p = part as { state?: string; output?: unknown }
    if (p.state === "output-available" || p.output != null) return true
  }
  return false
}

function AiThinkingDots() {
  return (
    <span className="ai-chat-thinking-dots" aria-label="正在思考">
      <span className="ai-chat-thinking-dot" />
      <span className="ai-chat-thinking-dot" />
      <span className="ai-chat-thinking-dot" />
    </span>
  )
}

function AddGoalAiAssistantBody({
  phase: _phase,
  messages,
  status,
  error,
  chatInput,
  setChatInput,
  onSend,
  onQuickRegenerate,
  onQuickTooHard,
  onQuickTooEasy,
  dailyTasksLength: _dailyTasksLength,
}: {
  phase: WizardPhase
  messages: UIMessage[]
  status: string
  error: Error | undefined
  chatInput: string
  setChatInput: (v: string) => void
  onSend: () => void
  onQuickRegenerate: () => void
  onQuickTooHard: () => void
  onQuickTooEasy: () => void
  dailyTasksLength: number
}) {
  /** error 状态下也应允许输入与重试；新一轮发送会进入 submitted 并清除 error */
  const chatMayType = status === "ready" || status === "error"
  const chatBusy = status === "submitted" || status === "streaming"
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const chatBottomRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ block: "end", behavior })
      return
    }
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom("auto")
  }, [scrollToBottom])

  useEffect(() => {
    const smooth = status === "streaming" || status === "submitted"
    scrollToBottom(smooth ? "smooth" : "auto")
  }, [messages.length, status, scrollToBottom])

  return (
    <>
      <div className="shrink-0 border-b border-slate-200/50 px-4 py-3 sm:px-6 sm:py-4 bg-primary/[0.04] border-b-primary/15">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shadow-inner">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-slate-800">AI 助手</span>
        </div>
      </div>

      <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-6">
        <div className="space-y-4">
          {messages.map((msg) => {
            const text = msg.parts
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n\n")

            const isLastMessage = messages.length > 0 && msg.id === messages[messages.length - 1]?.id
            const balanceIncomplete =
              msg.role === "assistant" && status === "streaming" && isLastMessage

            const planApplied =
              msg.role === "assistant" && messageHasFinalExtractGoalPlan(msg)
            const emeraldStatusHint =
              msg.role === "assistant" && msg.id.startsWith("stepwise-hint-emerald-")
            const showTypingInAssistantBubble =
              chatBusy &&
              msg.role === "assistant" &&
              isLastMessage &&
              !planApplied &&
              !emeraldStatusHint &&
              !text.trim()

            const assistantBubbleClass =
              "max-w-[88%] px-5 py-4 text-sm leading-relaxed sm:px-6 sm:py-5 rounded-2xl rounded-bl-md border border-slate-100 bg-white text-slate-700 shadow-sm"

            if (msg.role === "user") {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div
                    className={cn(
                      "max-w-[88%] px-5 py-4 text-sm leading-relaxed sm:px-6 sm:py-5",
                      "rounded-2xl rounded-br-md bg-primary text-primary-foreground shadow-md",
                    )}
                  >
                    {text ? (
                      <ChatMarkdown content={text} variant="user" balanceIncomplete={false} />
                    ) : null}
                  </div>
                </div>
              )
            }

            if (planApplied) {
              return (
                <div key={msg.id} className="flex flex-col gap-4">
                  <div className="flex">
                    <div className={assistantBubbleClass}>
                      {text ? (
                        <ChatMarkdown
                          content={text}
                          variant="assistant"
                          balanceIncomplete={balanceIncomplete}
                        />
                      ) : null}
                      <div
                        className={cn("rounded-xl bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-800", text && "mt-2")}
                      >
                        <p className="font-medium text-emerald-900">
                          已识别出结构化目标计划，左侧表单已自动填充。
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex">
                    <div className={assistantBubbleClass}>
                      <ChatMarkdown content="你觉得这个计划怎么样？" variant="assistant" balanceIncomplete={false} />
                    </div>
                  </div>
                </div>
              )
            }

            if (emeraldStatusHint) {
              return (
                <div key={msg.id} className="flex">
                  <div className={assistantBubbleClass}>
                    {text ? (
                      <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-800">
                        <p className="font-medium text-emerald-900">{text}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            }

            return (
              <div key={msg.id} className="flex">
                <div className={assistantBubbleClass}>
                  {text ? (
                    <ChatMarkdown
                      content={text}
                      variant="assistant"
                      balanceIncomplete={balanceIncomplete}
                    />
                  ) : null}
                  {showTypingInAssistantBubble ? (
                    <div className={text ? "mt-2" : ""}>
                      <AiThinkingDots />
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
          {chatBusy && messages.length > 0 && messages[messages.length - 1]?.role === "user" ? (
            <div className="flex">
              <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-slate-100 bg-white px-5 py-4 text-slate-700 shadow-sm sm:px-6 sm:py-5">
                <AiThinkingDots />
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm text-rose-600">AI 请求失败：{chatErrorUserHint(error.message)}</p> : null}
          <div ref={chatBottomRef} className="h-0 w-full" aria-hidden />
        </div>
      </div>

      <div
        className="shrink-0 border-t border-slate-200/50 p-3 sm:p-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-2 space-y-1.5">
          <p className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">快捷回复</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 rounded-full border-[1.5px] border-slate-300 bg-white px-3 text-xs font-normal text-slate-700 shadow-sm hover:border-primary hover:bg-primary/5"
              disabled={!chatMayType}
              onClick={() => onQuickRegenerate()}
            >
              重新生成
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 rounded-full border-[1.5px] border-slate-300 bg-white px-3 text-xs font-normal text-slate-700 shadow-sm hover:border-primary hover:bg-primary/5"
              disabled={!chatMayType}
              onClick={() => onQuickTooHard()}
            >
              😓 太难了
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 rounded-full border-[1.5px] border-slate-300 bg-white px-3 text-xs font-normal text-slate-700 shadow-sm hover:border-primary hover:bg-primary/5"
              disabled={!chatMayType}
              onClick={() => onQuickTooEasy()}
            >
              😎 太简单了
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-2 py-1.5 shadow-md shadow-slate-900/10 backdrop-blur-xl transition-shadow">
          <Input
            placeholder="描述你的目标..."
            value={chatInput}
            maxLength={GOAL_WIZARD_MAX_USER_TEXT_CHARS}
            onChange={(e) => setChatInput(e.target.value.slice(0, GOAL_WIZARD_MAX_USER_TEXT_CHARS))}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            className="min-h-10 flex-1 border-0 bg-transparent text-sm leading-relaxed shadow-none placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-h-9 dark:placeholder:text-gray-400"
            disabled={!chatMayType}
          />
          <Button
            type="button"
            className="h-10 w-10 shrink-0 rounded-full bg-primary shadow-md hover:bg-primary/90 hover:shadow-[0_4px_14px_rgba(79,110,247,0.40)] transition-all sm:h-9 sm:w-9"
            onClick={onSend}
            disabled={!chatInput.trim() || !chatMayType}
          >
            {chatBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </>
  )
}

export function AddGoalPage({ onBack, onGoalCreated }: AddGoalPageProps) {
  const [phase, setPhase] = useState<WizardPhase>("form")
  /** 供埋点读取当前阶段（避免部分回调闭包滞后） */
  const phaseLiveRef = useRef<WizardPhase>(phase)
  phaseLiveRef.current = phase
  const pageEnteredAtRef = useRef<number>(Date.now())
  const retryCountRef = useRef(0)
  const exitedRef = useRef(false)
  const finishedRef = useRef(false)
  /** useChat 与 WizardPhase 衔接：表单阶段用户发言次数（仅 phase=form） */
  const formUserChatCountRef = useRef(0)
  /** 用户是否在左侧表单做过「实质填写」（与纯聊天区分） */
  const formEverSubstantiveRef = useRef(false)
  /** 是否曾进入过「有内容的里程碑」页（用于里程碑后流失分析） */
  const sawMilestonesWithContentRef = useRef(false)
  /** 是否已发起每日计划生成（requestDailyPlan 成功进入） */
  const dailyPlanFlowStartedRef = useRef(false)
  const dailyTasksCountRef = useRef(0)
  const prevPhaseBridgeRef = useRef<WizardPhase>(phase)
  const cohesionSnapshotRef = useRef({
    phase: "form" as WizardPhase,
    milestone_count: 0,
    daily_task_count: 0,
  })
  const { control, setValue, watch, getValues, reset } = useForm<GoalBasicsForm>({
    defaultValues: {
      goalName: "",
      deadline: "",
      category: "",
      weeklyHours: undefined,
    },
    shouldUnregister: false,
  })
  const goalName = watch("goalName")
  const deadline = watch("deadline")
  const category = watch("category")
  const weeklyHoursW = watch("weeklyHours")
  /** AI/部分模型可能写入非完整字段，避免对 undefined 调 trim */
  const goalNameSafe = goalName ?? ""
  const deadlineSafe = deadline ?? ""
  const categorySafe = category ?? ""
  const [chatInput, setChatInput] = useState("")
  const [mobileAiOpen, setMobileAiOpen] = useState(false)
  const [dailyDraggingId, setDailyDraggingId] = useState<string | null>(null)
  const [finishSubmitting, setFinishSubmitting] = useState(false)
  const [milestones, setMilestones] = useState<PlanMilestone[]>([])
  const [dailyTasks, setDailyTasks] = useState<PlanDailyDraft[]>([])
  const [dailyPlanFallbackNotice, setDailyPlanFallbackNotice] = useState<string | null>(null)
  const [milestoneStreamHint, setMilestoneStreamHint] = useState("")
  const [dailyStreamHint, setDailyStreamHint] = useState("")
  const [dailyParallelStatus, setDailyParallelStatus] = useState<DailyParallelPhaseStatus>("idle")
  const [dailyParallelDone, setDailyParallelDone] = useState(0)
  const [dailyParallelTotal, setDailyParallelTotal] = useState(0)
  const [dailyMilestoneStatuses, setDailyMilestoneStatuses] = useState<Record<string, DailyMilestoneUiStatus>>({})
  const [basicsReviewExtra, setBasicsReviewExtra] = useState("")
  const [basicsReviewLoading, setBasicsReviewLoading] = useState(false)
  const [pendingGoalSwitch, setPendingGoalSwitch] = useState<PendingGoalSwitch | null>(null)
  /** 最近一次「AI 校验通过」或「对话工具写入表单」时的门控 key；与当前表单+补充说明一致时可跳过重复校验 */
  const basicsReviewPassedGateKeyRef = useRef<string | null>(null)
  const basicsReviewExtraRef = useRef(basicsReviewExtra)
  const [extractedPlan, setExtractedPlan] = useState<ExtractedPlan | null>(null)
  const appliedToolCallIds = useRef<Set<string>>(new Set())
  const wizardContextRef = useRef<GoalWizardContextPayload>({
    step: "form",
    goalName: "",
    deadline: "",
    category: "",
    weeklyHours: 0,
    milestones: [],
    dailyTasks: [],
  })
  /** 生成每日行动时对应的里程碑快照；返回里程碑未改时可跳过重复请求 */
  const dailyBuiltForMilestoneKeyRef = useRef<string | null>(null)
  /** 最近一次里程碑生成（或聊天抽计划）所依据的基本信息快照；若用户回退修改表单后不一致则需重算 */
  const milestonesFromBasicsKeyRef = useRef<string | null>(null)
  /** 用户曾在下拉框中手动选过类别后，不再用名称推断覆盖 */
  const categoryUserLockedRef = useRef(false)
  /** AI 工具刚写入表单时，避免名称防抖推断覆盖工具给出的类别 */
  const categoryAiAppliedRef = useRef(false)
  /** 用户是否用手选过截止日；为 true 时仅「名称里的相对时间」不自动改截止日，显式日期仍覆盖 */
  const deadlineUserPickedRef = useRef(false)
  /** 快捷按钮：对话框显示短文案，本条请求送给模型的完整指令放这里（由 /api/chat 读一次后清空） */
  const lastUserModelContentOverrideRef = useRef<string | null>(null)

  useEffect(() => {
    basicsReviewExtraRef.current = basicsReviewExtra
  }, [basicsReviewExtra])

  const { messages, sendMessage, setMessages, status, error } = useChat({
    messages: goalWizardInitialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: showcaseApiFetch,
      body: () => {
        const override = lastUserModelContentOverrideRef.current
        lastUserModelContentOverrideRef.current = null
        return {
          goalWizardContext: wizardContextRef.current,
          ...(override ? { lastUserModelContentOverride: override } : {}),
        }
      },
    }),
  })

  const postBehaviorEvent = useCallback(
    (payload: {
      stepName: string
      eventName: "step_enter" | "step_success" | "step_fail" | "step_exit"
      latencyMs?: number
      retryIndex?: number
      abandonReason?: string
      eventPayload?: Record<string, unknown>
    }) => {
      void showcaseApiFetch("/api/ops/behavior-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
    },
    [],
  )

  const recordFormPhaseUserMessage = useCallback(
    (extra: Record<string, unknown>) => {
      if (phaseLiveRef.current !== "form") return
      formUserChatCountRef.current += 1
      postBehaviorEvent({
        stepName: "wizard.chat_phase_bridge",
        eventName: "step_success",
        eventPayload: {
          action: "form_phase_user_message",
          message_index: formUserChatCountRef.current,
          form_substantive: formEverSubstantiveRef.current,
          ...extra,
        },
      })
    },
    [postBehaviorEvent],
  )

  const trackExit = useCallback((abandonReason: string, payload?: Record<string, unknown>) => {
    if (exitedRef.current || finishedRef.current) return
    exitedRef.current = true
    const ph = phaseLiveRef.current
    const snap = cohesionSnapshotRef.current
    const cohesion = {
      phase: ph,
      form_user_chat_count: formUserChatCountRef.current,
      form_substantive: formEverSubstantiveRef.current,
      saw_milestones_with_content: sawMilestonesWithContentRef.current,
      daily_plan_flow_started: dailyPlanFlowStartedRef.current,
      milestone_count: snap.milestone_count,
      daily_task_count: snap.daily_task_count,
    }

    let resolvedReason = abandonReason
    if (abandonReason === "unmount_leave") {
      if (ph === "milestones" && sawMilestonesWithContentRef.current && !dailyPlanFlowStartedRef.current) {
        resolvedReason = "unmount_milestone_churn_before_daily"
      } else if (ph === "form" && formUserChatCountRef.current > 0 && !formEverSubstantiveRef.current) {
        resolvedReason = "unmount_form_chat_without_substantive_form"
      } else if (ph === "generating_milestones") {
        resolvedReason = "unmount_during_milestone_generation"
      } else if (ph === "generating_daily") {
        resolvedReason = "unmount_during_daily_generation"
      }
    } else if (abandonReason === "manual_back") {
      if (ph === "milestones" && sawMilestonesWithContentRef.current && !dailyPlanFlowStartedRef.current) {
        resolvedReason = "manual_back_milestone_churn_before_daily"
      }
    }

    const body = JSON.stringify({
      stepName: "wizard.ui",
      eventName: "step_exit",
      latencyMs: Math.max(0, Date.now() - pageEnteredAtRef.current),
      abandonReason: resolvedReason,
      eventPayload: {
        phase: ph,
        cohesion,
        original_abandon_reason: abandonReason,
        ...payload,
      },
    })
    void showcaseApiFetch("/api/ops/behavior-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body,
      keepalive: true,
    })
  }, [])

  const handleExitBack = useCallback(() => {
    trackExit("manual_back")
    onBack()
  }, [onBack, trackExit])

  useEffect(() => {
    postBehaviorEvent({
      stepName: "wizard.ui",
      eventName: "step_enter",
      eventPayload: { entry: "add_goal_page" },
    })
  }, [postBehaviorEvent])

  useEffect(() => {
    return () => {
      if (!finishedRef.current) {
        trackExit("unmount_leave")
      }
    }
  }, [trackExit])

  useEffect(() => {
    wizardContextRef.current = {
      step: phase,
      goalName: goalNameSafe.trim(),
      deadline: deadlineSafe.trim(),
      category: (categorySafe || "other").trim(),
      weeklyHours:
        typeof weeklyHoursW === "number" && Number.isFinite(weeklyHoursW)
          ? Math.min(40, Math.max(1, Math.floor(weeklyHoursW)))
          : 0,
      milestones: milestones.map((m) => ({
        id: m.id,
        title: (m.title ?? "").trim(),
        detail: (m.detail ?? "").trim(),
        targetDate: (m.targetDate ?? "").trim(),
      })),
      dailyTasks: dailyTasks
        .filter((t) => (t.title ?? "").trim())
        .slice(0, 32)
        .map((t) => ({
          milestoneId: t.milestoneId,
          title: (t.title ?? "").trim(),
          startDate: (t.startDate ?? "").trim(),
          duration: typeof t.duration === "number" && t.duration >= 0 ? t.duration : 25,
          spanDays:
            typeof t.spanDays === "number" && t.spanDays >= 1 ? Math.min(365, Math.floor(t.spanDays)) : 1,
        })),
    }
  }, [phase, goalNameSafe, deadlineSafe, categorySafe, weeklyHoursW, milestones, dailyTasks])

  useEffect(() => {
    cohesionSnapshotRef.current = {
      phase,
      milestone_count: milestones.length,
      daily_task_count: dailyTasks.length,
    }
    dailyTasksCountRef.current = dailyTasks.length
  }, [phase, milestones.length, dailyTasks.length])

  /** 左侧表单「实质填写」：用于区分纯聊天与真正进入表单流程 */
  useEffect(() => {
    if (phase !== "form") return
    const gn = goalNameSafe.trim().length >= 2
    const dl = /^\d{4}-\d{2}-\d{2}$/.test(deadlineSafe.trim())
    const cat = categorySafe.trim().length > 0
    const extra = basicsReviewExtra.trim().length > 0
    if (gn || dl || cat || extra) formEverSubstantiveRef.current = true
  }, [phase, goalNameSafe, deadlineSafe, categorySafe, basicsReviewExtra])

  useEffect(() => {
    if (phase === "milestones" && milestones.length > 0) {
      sawMilestonesWithContentRef.current = true
    }
  }, [phase, milestones.length])

  useEffect(() => {
    if (phase !== "form") return

    const t = window.setTimeout(() => {
      if (categoryUserLockedRef.current || categoryAiAppliedRef.current) return
      const trimmed = goalNameSafe.trim()
      if (!trimmed) {
        setValue("category", "", { shouldDirty: false })
        return
      }
      const next = inferGoalCategoryFromName(trimmed)
      if (next) setValue("category", next, { shouldDirty: false })
    }, 400)
    return () => window.clearTimeout(t)
  }, [goalNameSafe, phase, setValue])

  useEffect(() => {
    if (phase !== "form") return

    const t = window.setTimeout(() => {
      const trimmed = goalNameSafe.trim()
      if (!trimmed) return

      const parsed = inferDeadlineFromGoalTitle(trimmed)
      if (!parsed) return

      const fixed = correctGoalDeadlineToFuture(parsed.iso)
      const currentRaw = (getValues("deadline") ?? "").trim()
      const currentFixed =
        currentRaw && /^\d{4}-\d{2}-\d{2}$/.test(currentRaw) ? correctGoalDeadlineToFuture(currentRaw) : ""

      if (parsed.source === "relative" && deadlineUserPickedRef.current) return

      if (fixed === currentFixed) return

      setValue("deadline", fixed, { shouldDirty: true })
      // stripDatesFromTitle 会把「仅由日期构成」的标题删成空串，导致输入框被清空，用户误以为要再输一遍
      const strippedTitle = stripDatesFromTitle(trimmed)
      const nextTitle = strippedTitle.trim() ? strippedTitle : trimmed
      if (nextTitle !== trimmed) {
        setValue("goalName", nextTitle, { shouldDirty: true })
      }
      deadlineUserPickedRef.current = false
    }, 480)
    return () => window.clearTimeout(t)
  }, [goalNameSafe, phase, setValue, getValues])

  const appendAssistantHint = useCallback(
    (body: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `stepwise-hint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          parts: [{ type: "text", text: body }],
        },
      ])
    },
    [setMessages],
  )

  /** 与「已识别出结构化目标计划…」绿条同款的规划状态提示，单独成泡 */
  const appendAssistantEmeraldHint = useCallback(
    (body: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `stepwise-hint-emerald-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          parts: [{ type: "text", text: body }],
        },
      ])
    },
    [setMessages],
  )

  /** 点击「下一步」前：未通过门控则调用 AI 校验；不通过时在右侧对话中提示 */
  const runBasicsReviewGate = useCallback(async (): Promise<boolean> => {
    const gn = goalNameSafe.trim()
    const dl = deadlineSafe.trim()
    const cat = (categorySafe || "").trim()
    if (!gn || !cat || !/^\d{4}-\d{2}-\d{2}$/.test(dl)) {
      appendAssistantHint(
        "我先帮你把基本信息补完整：请先填写目标名称、选择类别并设置有效截止日期；如果你愿意，也可以在右侧告诉我你的目标背景，我来帮你整理成可执行版本。",
      )
      return false
    }

    const vals = getValues()
    const wh =
      typeof weeklyHoursW === "number" && Number.isFinite(weeklyHoursW)
        ? Math.min(40, Math.max(1, Math.floor(weeklyHoursW)))
        : undefined
    if (wh == null) {
      appendAssistantHint("请先填写每周可投入时长（1-40 小时/周），再继续生成里程碑。")
      return false
    }

    const gateKey = goalBasicsReviewGateKey(
      {
        goalName: vals.goalName ?? "",
        deadline: vals.deadline ?? "",
        category: vals.category ?? "",
        weeklyHours: vals.weeklyHours ?? wh,
      },
      basicsReviewExtra,
    )
    if (gateKey === basicsReviewPassedGateKeyRef.current) {
      return true
    }

    setBasicsReviewLoading(true)
    try {
      const res = await showcaseApiFetch("/api/plan/goal-basics-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          goalName: gn,
          category: cat,
          deadline: dl,
          weeklyHours: wh,
          ...(basicsReviewExtra.trim() ? { userMessage: basicsReviewExtra.trim().slice(0, 2000) } : {}),
        }),
      })
      const raw = await res.text()
      if (!res.ok) {
        let msg = "基本信息检查失败，请稍后重试。"
        if (res.status === 429) {
          msg = "当前 AI 校验服务触发额度/限流，请稍后重试，或切换可用模型后再继续。"
        }
        try {
          const j = JSON.parse(raw) as { error?: string }
          if (typeof j.error === "string" && j.error.trim()) msg = j.error.trim()
        } catch {
          /* ignore */
        }
        appendAssistantHint(msg)
        return false
      }

      const data = JSON.parse(raw) as GoalBasicsReviewResponse
      if (data.decision === "ready" && data.form) {
        const f = data.form
        const deadlineFixed = correctGoalDeadlineToFuture(f.deadline)
        const nameAligned = alignGoalTitleWithDeadline(f.goalName.trim(), deadlineFixed)
        setValue("goalName", nameAligned, { shouldDirty: true })
        setValue("deadline", deadlineFixed, { shouldDirty: true })
        setValue("category", f.category, { shouldDirty: true })
        setValue(
          "weeklyHours",
          Math.min(40, Math.max(1, Math.floor(Number(f.weeklyHours)) || wh)),
          { shouldDirty: true },
        )
        categoryUserLockedRef.current = true
        categoryAiAppliedRef.current = true
        deadlineUserPickedRef.current = true
        const after = getValues()
        basicsReviewPassedGateKeyRef.current = goalBasicsReviewGateKey(
          {
            goalName: after.goalName ?? "",
            deadline: after.deadline ?? "",
            category: after.category ?? "",
            weeklyHours: after.weeklyHours ?? wh,
          },
          basicsReviewExtra,
        )
        return true
      }

      const note = data.userFacingNote.trim() || "建议先补充或调整左侧基本信息后再继续。"
      const qs = (data.questions ?? []).map((q) => q.trim()).filter(Boolean)
      const detail =
        qs.length > 0 ? `${note}\n\n你可以先考虑：\n${qs.map((q) => `• ${q}`).join("\n")}` : note
      const noteLower = note.toLowerCase()
      const isSafetyBlocked =
        /不支持|不可执行|违法|犯罪|伦理|有害|伤害|危险|总统/.test(note) ||
        /illegal|harm|unsafe|ethic|crime/.test(noteLower)
      const isFeasibilityRisk =
        /难度|时间不够|投入|不匹配|不现实|来不及|风险|是否继续|高难度/.test(note)
      const title = isSafetyBlocked
        ? "【目标不符合规范】"
        : isFeasibilityRisk
          ? "【目标难度需确认】"
          : "【基本信息需完善】"
      appendAssistantHint(`${title}${detail}`)
      return false
    } catch (e) {
      appendAssistantHint(e instanceof Error ? e.message : "网络错误，请重试。")
      return false
    } finally {
      setBasicsReviewLoading(false)
    }
  }, [
    goalNameSafe,
    deadlineSafe,
    categorySafe,
    weeklyHoursW,
    basicsReviewExtra,
    setValue,
    getValues,
    appendAssistantHint,
  ])

  const runMilestonesReviewGate = useCallback(async (): Promise<boolean> => {
    const vals = getValues()
    const goalName = (vals.goalName ?? "").trim()
    const deadline = (vals.deadline ?? "").trim()
    const category = (vals.category ?? "").trim()
    const weeklyHours =
      typeof vals.weeklyHours === "number" && Number.isFinite(vals.weeklyHours)
        ? Math.min(40, Math.max(1, Math.floor(vals.weeklyHours)))
        : undefined
    if (weeklyHours == null) {
      appendAssistantHint("请先填写每周可投入时长（1-40 小时/周），再继续拆解每日行动。")
      return false
    }

    if (!goalName || !category || !/^\d{4}-\d{2}-\d{2}$/.test(deadline) || milestones.length === 0) {
      appendAssistantHint("请先补全目标基本信息并至少保留一个里程碑，再继续拆解每日行动。")
      return false
    }

    const currentMilestoneSnapshot = milestoneReviewSnapshot(milestones)
    if (milestoneReviewBaselineRef.current && currentMilestoneSnapshot === milestoneReviewBaselineRef.current) {
      return true
    }

    try {
      const res = await showcaseApiFetch("/api/plan/milestones-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          goalName,
          deadline,
          weeklyHours,
          category,
          milestones: milestones.map((m) => ({
            id: m.id,
            title: (m.title ?? "").trim().slice(0, MILESTONE_TITLE_MAX_CHARS),
            detail: (m.detail ?? "").trim().slice(0, MILESTONE_DETAIL_MAX_CHARS),
            targetDate: m.targetDate,
          })),
          ...(basicsReviewExtra.trim() ? { feedback: basicsReviewExtra.trim().slice(0, 2000) } : {}),
        }),
      })
      const raw = await res.text()
      if (!res.ok) {
        appendAssistantHint(raw || "里程碑审核失败，请稍后重试。")
        return false
      }
      const data = JSON.parse(raw) as MilestonesReviewResponse
      if (data.decision === "ready") {
        milestoneReviewBaselineRef.current = currentMilestoneSnapshot
        return true
      }
      const lastUserText = [...messages]
        .reverse()
        .find((m) => m.role === "user")
        ?.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n\n")
        .trim()
      const insistText = `${basicsReviewExtra}\n${lastUserText ?? ""}`
      const userInsistsProceed = /(坚持|继续|就按这个|按当前|照这个|我接受|我能接受|继续拆解|继续吧)/.test(
        insistText,
      )

      if (data.reasonType !== "ethics" && data.allowProceedIfUserInsists && userInsistsProceed) {
        appendAssistantHint("你已明确要按当前计划继续，我会继续拆解每日任务。")
        milestoneReviewBaselineRef.current = currentMilestoneSnapshot
        return true
      }

      const note = data.userFacingNote.trim() || "里程碑安排暂不合理，请先调整后再继续。"
      const qs = (data.questions ?? []).map((q) => q.trim()).filter(Boolean)
      const detail =
        qs.length > 0 ? `${note}\n\n建议你先改：\n${qs.map((q) => `• ${q}`).join("\n")}` : note
      const title =
        data.reasonType === "ethics"
          ? "【里程碑存在伦理/合法性问题】"
          : data.reasonType === "too_hard"
            ? "【里程碑时间安排过难】"
            : data.reasonType === "too_easy"
              ? "【里程碑时间安排过松】"
              : "【里程碑需调整】"
      const insistHint =
        data.reasonType !== "ethics" && data.allowProceedIfUserInsists
          ? "\n\n若你坚持按当前计划继续，可直接回复「我坚持继续当前计划」。"
          : ""
      appendAssistantHint(`${title}${detail}${insistHint}`)
      return false
    } catch (e) {
      appendAssistantHint(e instanceof Error ? e.message : "里程碑审核失败，请稍后重试。")
      return false
    }
  }, [getValues, milestones, basicsReviewExtra, appendAssistantHint, messages])

  const runDailyReviewGate = useCallback(async (): Promise<boolean> => {
    const vals = getValues()
    const goalName = (vals.goalName ?? "").trim()
    const deadline = (vals.deadline ?? "").trim()
    const category = (vals.category ?? "").trim()
    const weeklyHours =
      typeof vals.weeklyHours === "number" && Number.isFinite(vals.weeklyHours)
        ? Math.min(40, Math.max(1, Math.floor(vals.weeklyHours)))
        : undefined
    if (weeklyHours == null) {
      appendAssistantHint("请先填写每周可投入时长（1-40 小时/周），再进入甘特图。")
      return false
    }

    if (!goalName || !category || !/^\d{4}-\d{2}-\d{2}$/.test(deadline) || dailyTasks.length === 0) {
      appendAssistantHint("请先补全每日任务后再进入甘特图。")
      return false
    }

    const currentDailySnapshot = dailyReviewSnapshot(dailyTasks)
    if (dailyReviewBaselineRef.current && currentDailySnapshot === dailyReviewBaselineRef.current) {
      return true
    }

    try {
      const res = await showcaseApiFetch("/api/plan/daily-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          goalName,
          deadline,
          weeklyHours,
          category,
          milestones: milestones.map((m) => ({
            id: m.id,
            title: (m.title ?? "").trim().slice(0, MILESTONE_TITLE_MAX_CHARS),
            detail: (m.detail ?? "").trim().slice(0, MILESTONE_DETAIL_MAX_CHARS),
            targetDate: m.targetDate,
          })),
          dailyTasks: dailyTasks.map((t) => ({
            milestoneId: t.milestoneId,
            title: (t.title ?? "").trim(),
            startDate: t.startDate,
            duration: Math.max(5, Math.round(t.duration || 25)),
            spanDays: Math.max(1, Math.round(t.spanDays || 1)),
            criteria: (t.criteria ?? "").trim(),
            minimumVersion: (t.minimumVersion ?? "").trim(),
            isEasyFirstStep: Boolean(t.isEasyFirstStep),
          })),
          ...(basicsReviewExtra.trim() ? { feedback: basicsReviewExtra.trim().slice(0, 2000) } : {}),
        }),
      })
      const raw = await res.text()
      if (!res.ok) {
        appendAssistantHint(raw || "每日任务审核失败，请稍后重试。")
        return false
      }

      const data = JSON.parse(raw) as DailyReviewResponse
      if (data.decision === "ready") {
        dailyReviewBaselineRef.current = currentDailySnapshot
        return true
      }
      const lastUserText = [...messages]
        .reverse()
        .find((m) => m.role === "user")
        ?.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n\n")
        .trim()
      const insistText = `${basicsReviewExtra}\n${lastUserText ?? ""}`
      const userInsistsProceed = /(坚持|继续|就按这个|按当前|照这个|我接受|我能接受|继续吧|继续进入)/.test(
        insistText,
      )

      if (data.reasonType !== "ethics" && data.allowProceedIfUserInsists && userInsistsProceed) {
        appendAssistantHint("你已明确要按当前每日任务继续，我会进入甘特图。")
        dailyReviewBaselineRef.current = currentDailySnapshot
        return true
      }

      const note = data.userFacingNote.trim() || "每日任务安排暂不合理，请先调整后再继续。"
      const qs = (data.questions ?? []).map((q) => q.trim()).filter(Boolean)
      const detail = qs.length > 0 ? `${note}\n\n建议你先改：\n${qs.map((q) => `• ${q}`).join("\n")}` : note
      const title =
        data.reasonType === "ethics"
          ? "【每日任务存在伦理/合法性问题】"
          : data.reasonType === "too_hard"
            ? "【每日任务时间安排过难】"
            : data.reasonType === "too_easy"
              ? "【每日任务时间安排过松】"
              : "【每日任务需调整】"
      const insistHint =
        data.reasonType !== "ethics" && data.allowProceedIfUserInsists
          ? "\n\n若你坚持按当前计划继续，可直接回复「我坚持继续当前计划」。"
          : ""
      appendAssistantHint(`${title}${detail}${insistHint}`)
      return false
    } catch (e) {
      appendAssistantHint(e instanceof Error ? e.message : "每日任务审核失败，请稍后重试。")
      return false
    }
  }, [getValues, dailyTasks, milestones, basicsReviewExtra, appendAssistantHint, messages])

  type GoalStreamPlanCtx = {
    goalNameTrim: string
    deadlineVal: string
    categoryVal: GoalBasicsForm["category"]
    weeklyHours: number
    recordBasicsKeyAfter: (deadlineFixed: string, nameAligned: string) => void
  }

  type DailyStreamPlanCtx = {
    goalName: string
    deadlineVal: string
    weeklyHours: number
    categoryVal: GoalBasicsForm["category"]
    milestones: PlanMilestone[]
  }

  const phaseRef = useRef<WizardPhase>(phase)
  const lastPhaseForAutoCloseRef = useRef<WizardPhase>(phase)
  const milestonesRef = useRef<PlanMilestone[]>(milestones)
  const extractedPlanRef = useRef(extractedPlan)
  const goalStreamCtxRef = useRef<GoalStreamPlanCtx | null>(null)
  const dailyStreamCtxRef = useRef<DailyStreamPlanCtx | null>(null)
  const prefetchedDailyRef = useRef<{ snap: string; data: DailyPlanAiResponse } | null>(null)
  const prefetchDailySnapRef = useRef<string | null>(null)
  const needDailyFinalizeRef = useRef(false)
  const appendAssistantHintRef = useRef(appendAssistantHint)
  const appendAssistantEmeraldHintRef = useRef(appendAssistantEmeraldHint)
  /** 里程碑写入 state 后，再在下一帧展示成功提示，避免左侧尚未切换/列表未渲染时右侧先弹出话术 */
  const pendingMilestoneReadyHintRef = useRef(false)
  /** 模型对用户夸奖的致谢，在成功提示前单独插入一条气泡 */
  const pendingMilestonePraiseAckRef = useRef<string | null>(null)
  const milestoneStreamRawTextRef = useRef("")
  const dailyStreamRawTextRef = useRef("")
  const milestoneReviewBaselineRef = useRef<string>("")
  const dailyReviewBaselineRef = useRef<string>("")
  const autoCloseAiDuringMilestoneFlowRef = useRef(false)
  const inlineAiPanelRef = useRef<HTMLDivElement | null>(null)
  const mobileAiAutoCloseTimerRef = useRef<number | null>(null)
  const lastAutoPopupAssistantMessageIdRef = useRef<string | null>(null)
  const scheduleMobileAiCloseRef = useRef<(delayMs: number) => void>(() => {})
  const hasAutoOpenedAiOnSingleColumnFormRef = useRef(false)

  const shouldUseMobileAiSheet = useCallback(() => {
    if (typeof window === "undefined") return false
    if (phase === "gantt") return false
    const panel = inlineAiPanelRef.current
    if (!panel) return window.matchMedia("(max-width: 1023px)").matches
    const style = window.getComputedStyle(panel)
    return style.display === "none"
  }, [phase])

  const scheduleMobileAiClose = useCallback(
    (delayMs: number) => {
      if (typeof window === "undefined") return
      if (!shouldUseMobileAiSheet()) return
      if (mobileAiAutoCloseTimerRef.current != null) {
        window.clearTimeout(mobileAiAutoCloseTimerRef.current)
      }
      mobileAiAutoCloseTimerRef.current = window.setTimeout(() => {
        setMobileAiOpen(false)
        mobileAiAutoCloseTimerRef.current = null
      }, delayMs)
    },
    [shouldUseMobileAiSheet],
  )

  useEffect(() => {
    scheduleMobileAiCloseRef.current = scheduleMobileAiClose
  }, [scheduleMobileAiClose])

  useEffect(() => {
    if (!shouldUseMobileAiSheet()) return
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
    if (!lastAssistant) return
    if (lastAutoPopupAssistantMessageIdRef.current == null) {
      lastAutoPopupAssistantMessageIdRef.current = lastAssistant.id
      return
    }
    if (lastAutoPopupAssistantMessageIdRef.current === lastAssistant.id) return
    lastAutoPopupAssistantMessageIdRef.current = lastAssistant.id
    setMobileAiOpen(true)
  }, [messages, shouldUseMobileAiSheet])

  useEffect(() => {
    if (phase !== "form") return
    if (!shouldUseMobileAiSheet()) return
    if (hasAutoOpenedAiOnSingleColumnFormRef.current) return
    hasAutoOpenedAiOnSingleColumnFormRef.current = true
    setMobileAiOpen(true)
  }, [phase, shouldUseMobileAiSheet])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    const prev = prevPhaseBridgeRef.current
    if (prev === phase) return
    prevPhaseBridgeRef.current = phase

    const basePayload = {
      action: "phase_transition",
      from: prev,
      to: phase,
      form_user_chat_count: formUserChatCountRef.current,
      form_substantive: formEverSubstantiveRef.current,
      milestone_count: milestonesRef.current.length,
      daily_task_count: dailyTasksCountRef.current,
    }

    if (prev === "form" && phase === "generating_milestones") {
      postBehaviorEvent({
        stepName: "wizard.chat_phase_bridge",
        eventName: "step_success",
        eventPayload: { ...basePayload, bridge: "form_to_generating_milestones" },
      })
    }
    if (prev === "generating_milestones" && phase === "milestones") {
      postBehaviorEvent({
        stepName: "wizard.chat_phase_bridge",
        eventName: "step_success",
        eventPayload: { ...basePayload, bridge: "milestone_generation_to_panel" },
      })
    }
    if (prev === "form" && phase === "milestones") {
      postBehaviorEvent({
        stepName: "wizard.chat_phase_bridge",
        eventName: "step_success",
        eventPayload: { ...basePayload, bridge: "form_to_milestones_short_circuit" },
      })
    }
    if (prev === "milestones" && phase === "generating_daily") {
      postBehaviorEvent({
        stepName: "wizard.chat_phase_bridge",
        eventName: "step_success",
        eventPayload: { ...basePayload, bridge: "milestones_to_generating_daily" },
      })
    }
    if (prev === "milestones" && phase === "form") {
      postBehaviorEvent({
        stepName: "wizard.chat_phase_bridge",
        eventName: "step_success",
        eventPayload: { ...basePayload, bridge: "milestones_to_form_back" },
      })
    }
  }, [phase, postBehaviorEvent])

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return
      if (mobileAiAutoCloseTimerRef.current != null) {
        window.clearTimeout(mobileAiAutoCloseTimerRef.current)
        mobileAiAutoCloseTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!shouldUseMobileAiSheet()) return
    const prev = lastPhaseForAutoCloseRef.current
    if (
      (prev === "generating_milestones" && phase === "milestones") ||
      (prev === "generating_daily" && phase === "daily")
    ) {
      setMobileAiOpen(false)
      autoCloseAiDuringMilestoneFlowRef.current = false
    }
    lastPhaseForAutoCloseRef.current = phase
  }, [phase, shouldUseMobileAiSheet])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!autoCloseAiDuringMilestoneFlowRef.current) return
    if (!shouldUseMobileAiSheet()) return
    if (phase !== "generating_milestones" && phase !== "milestones") return

    const t = window.setTimeout(() => {
      setMobileAiOpen(false)
      if (phase === "milestones") autoCloseAiDuringMilestoneFlowRef.current = false
    }, 3000)
    return () => window.clearTimeout(t)
  }, [phase, shouldUseMobileAiSheet])

  /** 从里程碑等页回到基本信息时，若主目标被误写成空串，从最近一次规划上下文或 extractedPlan 还原 */
  useEffect(() => {
    if (phase !== "form") return
    const g = (getValues("goalName") ?? "").trim()
    if (g) return
    const fromCtx = goalStreamCtxRef.current?.goalNameTrim?.trim()
    if (fromCtx) {
      setValue("goalName", goalNameAfterStripDates(fromCtx), { shouldDirty: false })
      return
    }
    const fromPlan = extractedPlanRef.current?.title?.trim()
    if (fromPlan) setValue("goalName", fromPlan, { shouldDirty: false })
  }, [phase, getValues, setValue])

  useEffect(() => {
    milestonesRef.current = milestones
  }, [milestones])

  useEffect(() => {
    extractedPlanRef.current = extractedPlan
  }, [extractedPlan])

  useEffect(() => {
    appendAssistantHintRef.current = appendAssistantHint
  }, [appendAssistantHint])

  useEffect(() => {
    appendAssistantEmeraldHintRef.current = appendAssistantEmeraldHint
  }, [appendAssistantEmeraldHint])

  const milestonePlanAccumulatingFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    milestoneStreamRawTextRef.current = ""
    const res = await showcaseApiFetch(input, init)
    if (!res.ok || !res.body) return res
    const dec = new TextDecoder()
    let acc = ""
    const stream = res.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          acc += dec.decode(chunk, { stream: true })
          milestoneStreamRawTextRef.current = acc
          controller.enqueue(chunk)
        },
        flush() {
          acc += dec.decode()
          milestoneStreamRawTextRef.current = acc
        },
      }),
    )
    return new Response(stream, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    })
  }, [])

  const dailyPlanAccumulatingFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    dailyStreamRawTextRef.current = ""
    const res = await showcaseApiFetch(input, init)
    if (!res.ok || !res.body) return res
    const dec = new TextDecoder()
    let acc = ""
    const stream = res.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          acc += dec.decode(chunk, { stream: true })
          dailyStreamRawTextRef.current = acc
          controller.enqueue(chunk)
        },
        flush() {
          acc += dec.decode()
          dailyStreamRawTextRef.current = acc
        },
      }),
    )
    return new Response(stream, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    })
  }, [])

  const applyMilestoneMockFromCtx = useCallback((ctx: GoalStreamPlanCtx) => {
    const deadlineFixed = correctGoalDeadlineToFuture(ctx.deadlineVal)
    const nameForForm = goalNameAfterStripDates(ctx.goalNameTrim)
    const ms = mockGenerateMilestones({
      goalName: ctx.goalNameTrim,
      deadline: deadlineFixed,
      category: ctx.categoryVal,
      weeklyHours: ctx.weeklyHours,
    })
    setMilestones(ms)
    milestoneReviewBaselineRef.current = milestoneReviewSnapshot(ms)
    setValue("deadline", deadlineFixed, { shouldDirty: true })
    setValue("goalName", nameForForm, { shouldDirty: true })
    deadlineUserPickedRef.current = false
    // 勿在模板兜底时写入 milestonesFromBasicsKeyRef，否则用户再度点「下一步」会误走缓存分支、永远不再请求 AI
    setPhase("milestones")
  }, [setValue, setMilestones])

  const finalizeMilestonesFromStream = useCallback(
    (object: MilestonesFromGoalStreamResult, ctx: GoalStreamPlanCtx) => {
      const deadlineFixed = correctGoalDeadlineToFuture(ctx.deadlineVal)
      const datesFixed = correctMilestoneTimelineDates(
        object.milestones.map((m) => m.targetDate),
        deadlineFixed,
      )
      const nameForForm = goalNameAfterStripDates(ctx.goalNameTrim)
      const ms: PlanMilestone[] = object.milestones.map((m, i) => ({
        id: `m-ai-${Date.now()}-${i}`,
        title: (m.title ?? "").trim().slice(0, MILESTONE_TITLE_MAX_CHARS),
        detail: (m.detail ?? "").trim().slice(0, MILESTONE_DETAIL_MAX_CHARS),
        targetDate: datesFixed[i] ?? deadlineFixed,
      }))
      setMilestones(ms)
      milestoneReviewBaselineRef.current = milestoneReviewSnapshot(ms)
      setExtractedPlan({
        title: nameForForm,
        deadline: deadlineFixed,
        category: ctx.categoryVal,
        milestones: ms,
        easyFirstStep: normalizeMilestoneStreamEasyFirst(object.easyFirstStep),
      })
      setValue("deadline", deadlineFixed, { shouldDirty: true })
      setValue("goalName", nameForForm, { shouldDirty: true })
      deadlineUserPickedRef.current = false
      ctx.recordBasicsKeyAfter(deadlineFixed, nameForForm)
      setPhase("milestones")
      pendingMilestonePraiseAckRef.current = object.praiseAcknowledgement?.trim() || null
      pendingMilestoneReadyHintRef.current = true
    },
    [setValue, setMilestones, setExtractedPlan],
  )

  useEffect(() => {
    if (phase === "form") {
      pendingMilestoneReadyHintRef.current = false
      pendingMilestonePraiseAckRef.current = null
    }
  }, [phase])

  useEffect(() => {
    if (!pendingMilestoneReadyHintRef.current) return
    if (phase !== "milestones") return
    if (milestones.length === 0) return
    pendingMilestoneReadyHintRef.current = false
    const praise = pendingMilestonePraiseAckRef.current?.trim()
    pendingMilestonePraiseAckRef.current = null
    if (praise) {
      appendAssistantHintRef.current(praise)
    }
    appendAssistantEmeraldHintRef.current(
      "里程碑已生成并写入左侧列表，可展开核对日期与各阶段说明。",
    )
    appendAssistantHintRef.current("你觉得这个规划怎么样？")
    scheduleMobileAiCloseRef.current(2000)
  }, [phase, milestones])

  const runDailyMockFromCtx = useCallback((ctx: DailyStreamPlanCtx) => {
    const drafts = mockGenerateDailyTasks(ctx.milestones, ctx.goalName, ctx.weeklyHours, ctx.deadlineVal)
    const easy = extractedPlanRef.current?.easyFirstStep
    const nextDrafts = (() => {
      if (!easy) return drafts
      return [
        {
          id: `easy-${Date.now()}`,
          milestoneId: ctx.milestones[0]?.id ?? drafts[0]?.milestoneId ?? "",
          title: easy.title ?? "",
          duration: easy.duration,
          spanDays: 1,
          startDate: getBusinessTodayIso(),
          criteria: easy.criteria ?? "",
          minimumVersion: easy.minimumVersion ?? "",
          isEasyFirstStep: true,
        },
        ...drafts,
      ]
    })()
    setDailyTasks(nextDrafts)
    dailyReviewBaselineRef.current = dailyReviewSnapshot(nextDrafts)
    setDailyPlanFallbackNotice("AI 拆解暂不可用，已换用本地模板生成，可在下方手动调整。")
    setDailyParallelStatus("failed")
    dailyBuiltForMilestoneKeyRef.current = planMilestonesSnapshotKey(ctx.milestones)
    setPhase("daily")
    appendAssistantEmeraldHintRef.current(
      "每日任务已填入（含兜底模板时请再核对）。左侧展开里程碑检查后，可进入甘特图。",
    )
    appendAssistantHintRef.current("你觉得这个计划怎么样？")
  }, [setDailyTasks])

  const finalizeDailyFromAi = useCallback((ctx: DailyStreamPlanCtx, data: DailyPlanAiResponse) => {
    const drafts = dailyPlanResponseToDrafts(data, ctx.milestones, ctx.deadlineVal)
    setDailyTasks(drafts)
    dailyReviewBaselineRef.current = dailyReviewSnapshot(drafts)
    dailyBuiltForMilestoneKeyRef.current = planMilestonesSnapshotKey(ctx.milestones)
    setExtractedPlan((prev) =>
      prev
        ? { ...prev, easyFirstStep: data.easyFirstStep }
        : {
            title: ctx.goalName,
            deadline: ctx.deadlineVal,
            category: ctx.categoryVal,
            milestones: ctx.milestones.map((m) => ({ ...m })),
            easyFirstStep: data.easyFirstStep,
          },
    )
    setPhase("daily")
    setDailyPlanFallbackNotice(null)
    setDailyParallelStatus("success")
    const praiseDaily = data.praiseAcknowledgement?.trim()
    if (praiseDaily) {
      appendAssistantHintRef.current(praiseDaily)
    }
    appendAssistantEmeraldHintRef.current(
      "每日行动已生成。左侧可展开各里程碑核对日期与「轻松第一步」，然后点「下一步：查看甘特图」。",
    )
    appendAssistantHintRef.current("你觉得这个计划怎么样？")
  }, [setDailyTasks, setExtractedPlan])

  const milestonePlanStream = experimental_useObject({
    api: "/api/plan/milestones-from-goal",
    schema: milestonesFromGoalResponseSchema,
    id: "stepwise-add-goal-milestones",
    credentials: "include",
    fetch: milestonePlanAccumulatingFetch,
    onFinish: ({ object, error }) => {
      const ctx = goalStreamCtxRef.current
      if (!ctx) return
      if (error || !object?.milestones?.length) {
        const recovered = tryRecoverMilestonesFromStreamRaw(milestoneStreamRawTextRef.current)
        if (recovered?.milestones?.length) {
          finalizeMilestonesFromStream(recovered, ctx)
          return
        }
        const raw =
          error instanceof Error ? error.message : error ? String(error) : ""
        appendAssistantHintRef.current(
          raw ? planStreamValidationUserHint(raw) : "未收到有效里程碑结构，已自动为您加载预设模板。",
        )
        applyMilestoneMockFromCtx(ctx)
        return
      }
      finalizeMilestonesFromStream(object, ctx)
    },
    onError: (err) => {
      const ctx = goalStreamCtxRef.current
      if (!ctx) return
      const raw = err instanceof Error ? err.message : String(err)
      if (/401|Unauthorized/i.test(raw)) {
        appendAssistantHintRef.current(
          "需要登录后才能调用 AI（401），已自动为您加载预设模板。",
        )
      } else if (/OPENAI_API_KEY|ENV_OPENAI_KEY|Missing OPENAI/i.test(raw)) {
        appendAssistantHintRef.current(
          "服务端未配置 OPENAI_API_KEY，已自动为您加载预设模板。",
        )
      } else {
        appendAssistantHintRef.current(planStreamValidationUserHint(raw))
      }
      applyMilestoneMockFromCtx(ctx)
    },
  })

  const dailyPlanStream = experimental_useObject({
    api: "/api/plan/daily-from-milestones",
    schema: dailyPlanStreamResponseSchema,
    id: "stepwise-add-goal-daily",
    credentials: "include",
    fetch: dailyPlanAccumulatingFetch,
    onFinish: ({ object, error }) => {
      const ctx = dailyStreamCtxRef.current
      if (!ctx) return
      const snap = planMilestonesSnapshotKey(ctx.milestones)

      if (error || !object) {
        const recovered = tryRecoverDailyFromStreamRaw(dailyStreamRawTextRef.current)
        if (recovered?.tasks?.length) {
          const data = dailyStreamResultToAiResponse(recovered)
          prefetchedDailyRef.current = { snap, data }
          if (phaseRef.current === "generating_daily" && needDailyFinalizeRef.current) {
            if (snap !== planMilestonesSnapshotKey(milestonesRef.current)) {
              needDailyFinalizeRef.current = false
              return
            }
            needDailyFinalizeRef.current = false
            finalizeDailyFromAi(ctx, data)
          }
          return
        }
        if (prefetchDailySnapRef.current === snap) {
          prefetchedDailyRef.current = null
        }
        if (phaseRef.current === "generating_daily" && needDailyFinalizeRef.current) {
          needDailyFinalizeRef.current = false
          const raw =
            error instanceof Error ? error.message : error ? String(error) : ""
          appendAssistantHintRef.current(
            raw ? planStreamValidationUserHint(raw) : "每日行动计划生成失败，已自动为您加载预设模板。",
          )
          runDailyMockFromCtx(ctx)
        }
        return
      }

      const data = dailyStreamResultToAiResponse(object)
      prefetchedDailyRef.current = { snap, data }

      if (phaseRef.current === "generating_daily" && needDailyFinalizeRef.current) {
        if (snap !== planMilestonesSnapshotKey(milestonesRef.current)) {
          needDailyFinalizeRef.current = false
          return
        }
        needDailyFinalizeRef.current = false
        finalizeDailyFromAi(ctx, data)
      }
    },
    onError: (err) => {
      const ctx = dailyStreamCtxRef.current
      if (!ctx) return
      const snap = planMilestonesSnapshotKey(ctx.milestones)
      if (prefetchDailySnapRef.current === snap) {
        prefetchedDailyRef.current = null
      }
      if (phaseRef.current === "generating_daily" && needDailyFinalizeRef.current) {
        needDailyFinalizeRef.current = false
        const raw = err instanceof Error ? err.message : String(err)
        if (/401|Unauthorized/i.test(raw)) {
          appendAssistantHintRef.current(
            "需要登录后才能生成每日行动（401），已自动为您加载预设模板。",
          )
        } else if (/OPENAI_API_KEY|ENV_OPENAI_KEY|Missing OPENAI/i.test(raw)) {
          appendAssistantHintRef.current(
            "服务端未配置 OPENAI_API_KEY，已自动为您加载预设模板。",
          )
        } else {
          appendAssistantHintRef.current(planStreamValidationUserHint(raw))
        }
        runDailyMockFromCtx(ctx)
      }
    },
  })

  useEffect(() => {
    if (phase !== "generating_milestones") {
      setMilestoneStreamHint("")
      return
    }
    setMilestoneStreamHint("正在根据您的每周投入时间对齐截止日与里程碑节奏…")
    const tid = window.setTimeout(() => {
      setMilestoneStreamHint((h) => (h ? "正在逐条写出里程碑，左侧列表会随生成进度更新…" : h))
    }, 1500)
    return () => window.clearTimeout(tid)
  }, [phase])

  useEffect(() => {
    if (phase !== "generating_milestones") return
    if ((milestonePlanStream.object?.milestones?.length ?? 0) > 0) {
      setMilestoneStreamHint("已连接模型，正在逐条弹出里程碑…")
    }
  }, [phase, milestonePlanStream.object?.milestones?.length])

  useEffect(() => {
    if (phase !== "generating_milestones") return
    const ctx = goalStreamCtxRef.current
    if (!ctx) return
    const list = milestonePlanStream.object?.milestones
    if (!list?.length) return
    const deadlineFixed = correctGoalDeadlineToFuture(ctx.deadlineVal)
    const datesRaw = list.map((m) =>
      m?.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(m.targetDate) ? m.targetDate : deadlineFixed,
    )
    const datesFixed = correctMilestoneTimelineDates(datesRaw, deadlineFixed)
    setMilestones(
      list.map((m, i) => ({
        id: `m-stream-${i}`,
        title: String(m?.title ?? "")
          .trim()
          .slice(0, MILESTONE_TITLE_MAX_CHARS),
        detail: String(m?.detail ?? "")
          .trim()
          .slice(0, MILESTONE_DETAIL_MAX_CHARS),
        targetDate: datesFixed[i] ?? deadlineFixed,
      })),
    )
  }, [phase, milestonePlanStream.object])

  useEffect(() => {
    if (phase !== "generating_daily") {
      setDailyStreamHint("")
      return
    }
    setDailyStreamHint("正在按里程碑拆解每日行动，并校对任务日期是否落在各阶段截止日之前…")
    const tid = window.setTimeout(() => {
      setDailyStreamHint("正在写入「每日行动」和「轻松第一步」…")
    }, 1600)
    return () => window.clearTimeout(tid)
  }, [phase])

  useEffect(() => {
    if (phase !== "generating_daily") return
    if (dailyParallelDone > 0) {
      setDailyStreamHint(`已完成 ${dailyParallelDone}/${Math.max(dailyParallelTotal, milestones.length)} 个里程碑，正在继续生成…`)
    }
  }, [phase, dailyParallelDone, dailyParallelTotal, milestones.length])

  const dispatchUserChatMessage = useCallback(
    (rawUserMessage: string, phaseForParse: WizardPhase) => {
      const userMessage = rawUserMessage.trim().slice(0, GOAL_WIZARD_MAX_USER_TEXT_CHARS)
      if (!userMessage) return
      if (phaseForParse === "form") {
        recordFormPhaseUserMessage({ source: "composer" })
      }
      setChatInput("")
      sendMessage({ text: userMessage })
    },
    [recordFormPhaseUserMessage, sendMessage],
  )

  const resetWizardForNewGoal = useCallback(
    (nextGoalName: string) => {
      const nextName = goalNameAfterStripDates(nextGoalName)
      const nextCategory = inferGoalCategoryFromName(nextName)
      setPhase("form")
      reset({
        goalName: nextName,
        deadline: "",
        category: nextCategory || "",
        weeklyHours: undefined,
      })
      setChatInput("")
      setMobileAiOpen(false)
      setFinishSubmitting(false)
      setMilestones([])
      setDailyTasks([])
      milestoneReviewBaselineRef.current = ""
      dailyReviewBaselineRef.current = ""
      autoCloseAiDuringMilestoneFlowRef.current = false
      setDailyPlanFallbackNotice(null)
      setMilestoneStreamHint("")
      setDailyStreamHint("")
      setDailyParallelStatus("idle")
      setDailyParallelDone(0)
      setDailyParallelTotal(0)
      setDailyMilestoneStatuses({})
      setBasicsReviewExtra("")
      setBasicsReviewLoading(false)
      setExtractedPlan(null)
      hasAutoOpenedAiOnSingleColumnFormRef.current = false
      setMessages([
        ...goalWizardInitialMessages,
        {
          id: `stepwise-goal-switch-${Date.now()}`,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `已切换到新目标「${nextName || "未命名目标"}」，我们从头开始规划。`,
            },
          ],
        },
      ])

      basicsReviewPassedGateKeyRef.current = null
      basicsReviewExtraRef.current = ""
      appliedToolCallIds.current = new Set()
      wizardContextRef.current = {
        step: "form",
        goalName: nextName,
        deadline: "",
        category: (nextCategory || "").trim(),
        weeklyHours: 0,
        milestones: [],
        dailyTasks: [],
      }
      dailyBuiltForMilestoneKeyRef.current = null
      milestonesFromBasicsKeyRef.current = null
      categoryUserLockedRef.current = false
      categoryAiAppliedRef.current = false
      deadlineUserPickedRef.current = false
      lastUserModelContentOverrideRef.current = null
      goalStreamCtxRef.current = null
      dailyStreamCtxRef.current = null
      prefetchedDailyRef.current = null
      prefetchDailySnapRef.current = null
      needDailyFinalizeRef.current = false
      pendingMilestoneReadyHintRef.current = false
      pendingMilestonePraiseAckRef.current = null
      milestoneStreamRawTextRef.current = ""
      dailyStreamRawTextRef.current = ""
      formUserChatCountRef.current = 0
      formEverSubstantiveRef.current = false
      sawMilestonesWithContentRef.current = false
      dailyPlanFlowStartedRef.current = false
      prevPhaseBridgeRef.current = "form"
      cohesionSnapshotRef.current = { phase: "form", milestone_count: 0, daily_task_count: 0 }
      retryCountRef.current = 0
    },
    [reset, setMessages],
  )

  const handleSendMessage = () => {
    if (!chatInput.trim()) return

    const userMessage = chatInput.trim().slice(0, GOAL_WIZARD_MAX_USER_TEXT_CHARS)
    const detection: GoalSwitchDetectionResult = detectGoalSwitch({
      userMessage,
      currentGoalName: getValues("goalName") ?? "",
      currentCategory: getValues("category") ?? "",
      currentPhase: phase,
      milestoneCount: milestones.length,
      dailyTaskCount: dailyTasks.length,
    })
    if (detection.shouldPrompt) {
      setPendingGoalSwitch({
        userMessage,
        nextGoalName: detection.nextGoalName,
        reason: detection.reason,
      })
      return
    }

    dispatchUserChatMessage(userMessage, phase)
  }

  const handleConfirmGoalSwitch = useCallback(() => {
    if (!pendingGoalSwitch) return
    const userMessage = pendingGoalSwitch.userMessage
    const nextGoalName = pendingGoalSwitch.nextGoalName
    setPendingGoalSwitch(null)
    resetWizardForNewGoal(nextGoalName)
    window.setTimeout(() => {
      dispatchUserChatMessage(userMessage, "form")
    }, 0)
  }, [dispatchUserChatMessage, pendingGoalSwitch, resetWizardForNewGoal])

  const requestDailyPlan = useCallback(
    async (opts: { mode: DailyPlanMode; feedback?: string; forceRegenerate?: boolean }) => {
      const milestonesValidNow =
        milestones.length > 0 &&
        milestones.every((m) => (m.title ?? "").trim().length > 0 && m.targetDate)
      if (!milestonesValidNow) return

      const snap = planMilestonesSnapshotKey(milestones)
      if (!opts.forceRegenerate && opts.mode === "initial") {
        if (dailyTasks.length > 0 && dailyBuiltForMilestoneKeyRef.current === snap) {
          dailyPlanFlowStartedRef.current = true
          postBehaviorEvent({
            stepName: "wizard.chat_phase_bridge",
            eventName: "step_success",
            eventPayload: { action: "daily_plan_cache_hit", mode: opts.mode },
          })
          setPhase("daily")
          return
        }
      }

      setDailyPlanFallbackNotice(null)
      dailyPlanFlowStartedRef.current = true
      setDailyParallelStatus("starting")
      setDailyParallelDone(0)
      setDailyParallelTotal(milestones.length)
      setDailyMilestoneStatuses(
        Object.fromEntries(milestones.map((m) => [m.id, "loading" satisfies DailyMilestoneUiStatus])),
      )
      postBehaviorEvent({
        stepName: "wizard.chat_phase_bridge",
        eventName: "step_success",
        eventPayload: { action: "daily_plan_request_started", mode: opts.mode, force: Boolean(opts.forceRegenerate) },
      })
      setPhase("generating_daily")
      // 开启本轮完成态门控：允许 onFinish 把流式结果最终落表并切到 daily
      needDailyFinalizeRef.current = true

      const goalName = (getValues("goalName") ?? "").trim()
      const deadlineVal = getValues("deadline") ?? ""
      const weeklyHoursRaw = getValues("weeklyHours")
      const weeklyHoursVal =
        typeof weeklyHoursRaw === "number" && Number.isFinite(weeklyHoursRaw)
          ? Math.min(40, Math.max(1, Math.floor(weeklyHoursRaw)))
          : undefined
      if (weeklyHoursVal == null) {
        appendAssistantHint("请先填写每周可投入时长（1-40 小时/周），再继续生成每日任务。")
        setPhase("form")
        needDailyFinalizeRef.current = false
        return
      }
      const categoryVal = (getValues("category") ?? "other") as GoalBasicsForm["category"]

      const dailyCtx: DailyStreamPlanCtx = {
        goalName,
        deadlineVal,
        weeklyHours: weeklyHoursVal,
        categoryVal,
        milestones: milestones.map((m) => ({ ...m })),
      }
      dailyStreamCtxRef.current = dailyCtx

      const previousPlan = buildPreviousDailyPlanPayload(dailyTasks, extractedPlanRef.current?.easyFirstStep)

      const feedbackMerged = mergeSupplementWithPlanFeedback(basicsReviewExtra, opts.feedback)

      const payload = {
        goalName,
        deadline: deadlineVal,
        weeklyHours: weeklyHoursVal,
        category: categoryVal,
        mode: opts.mode,
        ...(feedbackMerged ? { feedback: feedbackMerged } : {}),
        ...(previousPlan ? { previousPlan } : {}),
        milestones: milestones.map((m) => ({
          id: m.id,
          title: (m.title ?? "").trim(),
          detail: (m.detail ?? "").trim(),
          targetDate: m.targetDate,
        })),
      }

      try {
        const res = await showcaseApiFetch("/api/plan/daily-from-milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
        if (!res.ok || !res.body) {
          throw new Error(`daily_parallel_http_${res.status}`)
        }
        setDailyParallelStatus("running")

        const partialByMilestone = new Map<string, DailyPlanParallelFinalResponse["milestoneResults"][number]>()
        const decoder = new TextDecoder()
        const reader = res.body.getReader()
        let buffer = ""
        const applyPartialDrafts = () => {
          const milestoneResults = milestones
            .map((m) => partialByMilestone.get(m.id))
            .filter((v): v is NonNullable<typeof v> => Boolean(v))
          const partialSuccesses = milestoneResults.filter((r) => r.status === "success")
          if (partialSuccesses.length === 0) return
          const easy =
            partialSuccesses.find((r) => r.easyFirstStep)?.easyFirstStep ??
            extractedPlanRef.current?.easyFirstStep ?? {
              title: "轻松第一步",
              duration: 15,
              criteria: "完成最小可感知进展即可",
              minimumVersion: "完成一个最小动作",
            }
          const partialData: DailyPlanAiResponse = {
            easyFirstStep: easy,
            tasks: partialSuccesses.flatMap((r) =>
              (r.tasks ?? []).map((t) => ({
                ...t,
                criteria: t.criteria ?? "",
                minimumVersion: t.minimumVersion ?? "",
              })),
            ),
            praiseAcknowledgement: partialSuccesses.find((r) => r.praiseAcknowledgement)?.praiseAcknowledgement,
          }
          const drafts = dailyPlanResponseToDrafts(partialData, milestones, deadlineVal)
          setDailyTasks(drafts)
          setDailyParallelStatus("partial_ready")
        }

        let finalPayload: DailyPlanParallelFinalResponse | null = null
        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split("\n\n")
          buffer = events.pop() ?? ""
          for (const ev of events) {
            const line = ev
              .split("\n")
              .map((s) => s.trim())
              .find((s) => s.startsWith("data:"))
            if (!line) continue
            const raw = line.slice(5).trim()
            if (!raw) continue
            let parsed: unknown
            try {
              parsed = JSON.parse(raw)
            } catch {
              continue
            }
            if (!parsed || typeof parsed !== "object") continue
            const type = (parsed as { type?: unknown }).type
            if (type === "daily_plan.parallel.started") {
              setDailyParallelStatus("running")
              const totalRaw = (parsed as { total?: unknown }).total
              if (typeof totalRaw === "number" && Number.isFinite(totalRaw)) {
                setDailyParallelTotal(Math.max(0, Math.floor(totalRaw)))
              }
              continue
            }
            if (type === "daily_plan.milestone.succeeded") {
              const milestoneId = (parsed as { milestoneId?: unknown }).milestoneId
              const doneRaw = (parsed as { done?: unknown }).done
              const resultRaw = (parsed as { result?: unknown }).result
              if (typeof milestoneId === "string" && resultRaw && typeof resultRaw === "object") {
                partialByMilestone.set(milestoneId, resultRaw as DailyPlanParallelFinalResponse["milestoneResults"][number])
                setDailyMilestoneStatuses((prev) => ({ ...prev, [milestoneId]: "success" }))
                applyPartialDrafts()
              }
              if (typeof doneRaw === "number" && Number.isFinite(doneRaw)) {
                setDailyParallelDone(Math.max(0, Math.floor(doneRaw)))
              }
              continue
            }
            if (type === "daily_plan.milestone.failed") {
              const milestoneId = (parsed as { milestoneId?: unknown }).milestoneId
              const doneRaw = (parsed as { done?: unknown }).done
              if (typeof milestoneId === "string") {
                setDailyMilestoneStatuses((prev) => ({ ...prev, [milestoneId]: "failed" }))
              }
              if (typeof doneRaw === "number" && Number.isFinite(doneRaw)) {
                setDailyParallelDone(Math.max(0, Math.floor(doneRaw)))
              }
              continue
            }
            if (type === "daily_plan.parallel.completed") {
              const payloadRaw = (parsed as { payload?: unknown }).payload
              const validated = dailyPlanParallelFinalResponseSchema.safeParse(payloadRaw)
              if (validated.success) {
                finalPayload = validated.data
              }
            }
          }
        }
        if (!finalPayload) {
          throw new Error("daily_parallel_missing_final_payload")
        }
        const finalData: DailyPlanAiResponse = {
          easyFirstStep:
            finalPayload.easyFirstStep ??
            extractedPlanRef.current?.easyFirstStep ?? {
              title: "轻松第一步",
              duration: 15,
              criteria: "完成最小可感知进展即可",
              minimumVersion: "完成一个最小动作",
            },
          tasks: finalPayload.tasks.map((t) => ({
            ...t,
            criteria: t.criteria ?? "",
            minimumVersion: t.minimumVersion ?? "",
          })),
          praiseAcknowledgement: finalPayload.praiseAcknowledgement,
        }
        finalizeDailyFromAi(dailyCtx, finalData)
        setDailyParallelDone(finalPayload.aggregate.successMilestones + finalPayload.aggregate.failedMilestones)
        setDailyParallelTotal(finalPayload.aggregate.totalMilestones)
        setDailyParallelStatus(finalPayload.result)
        if (finalPayload.result === "partial_success") {
          appendAssistantHint("部分里程碑生成失败：你可以先继续创建目标，稍后再补全失败里程碑。")
        } else if (finalPayload.result === "failed") {
          throw new Error("daily_parallel_all_failed")
        }
        prefetchDailySnapRef.current = snap
      } catch (error) {
        needDailyFinalizeRef.current = false
        setDailyParallelStatus("failed")
        const raw = error instanceof Error ? error.message : String(error)
        appendAssistantHint(planStreamValidationUserHint(raw))
        runDailyMockFromCtx(dailyCtx)
      }
    },
    [
      appendAssistantHint,
      basicsReviewExtra,
      dailyTasks,
      dailyPlanStream,
      finalizeDailyFromAi,
      getValues,
      milestones,
      runDailyMockFromCtx,
      postBehaviorEvent,
    ],
  )

  const handleRetrySingleMilestone = useCallback(
    (milestoneId: string) => {
      const target = milestones.find((m) => m.id === milestoneId)
      if (!target) return
      appendAssistantHint(
        `已记录「${target.title || "该里程碑"}」重试请求。当前 P0 先保留入口，后续将接入单里程碑增量重试接口。`,
      )
      // TODO(P1): 对接 /api/plan/daily-from-milestones 单 milestone 增量重试（不覆盖已成功里程碑）。
    },
    [appendAssistantHint, milestones],
  )

  /** 对话框展示用（与送给模型的长指令分离） */
  const QUICK_CHAT_DISPLAY = {
    regenerate: "重新生成",
    tooHard: "太难了",
    tooEasy: "太简单了",
  } as const

  const regeneratePromptForPhase = (p: WizardPhase): string => {
    switch (p) {
      case "form":
        return "请根据左侧当前表单信息重新分析，并给出改进建议或补充追问。"
      case "milestones":
      case "generating_milestones":
        return [
          "请根据左侧当前目标、截止日与每周投入，重新输出一整份结构化计划（仅一个 JSON 对象，不要其它文字）。",
          "每条 milestone 必须含 title、targetDate、detail；其中 detail 必须恰好三行，且每行分别以「具体细节：」「验收标准：」「参考资料：」开头（JSON 字符串里用换行），禁止把阶段说明写成一段无标签长文。",
        ].join("")
      case "daily":
      case "generating_daily":
        return "请根据当前每日行动，重新给出修改或补充建议。"
      default:
        return "请根据当前进度重新给出建议。"
    }
  }

  const handleQuickRegenerate = () => {
    retryCountRef.current += 1
    postBehaviorEvent({
      stepName: "wizard.retry",
      eventName: "step_success",
      retryIndex: retryCountRef.current,
      eventPayload: { phase, action: "regenerate" },
    })
    const modelPrompt = regeneratePromptForPhase(phase)
    if (phase === "daily" || phase === "generating_daily") {
      appendAssistantHint("收到，我会基于当前里程碑重新生成一版每日行动。")
      void requestDailyPlan({ mode: "regenerate", feedback: modelPrompt, forceRegenerate: true })
      return
    }
    if (phaseLiveRef.current === "form") {
      recordFormPhaseUserMessage({ source: "quick_regenerate", display: QUICK_CHAT_DISPLAY.regenerate })
    }
    lastUserModelContentOverrideRef.current = modelPrompt
    sendMessage({ text: QUICK_CHAT_DISPLAY.regenerate })
  }

  const tooHardPromptForPhase = (p: WizardPhase): string => {
    switch (p) {
      case "form":
        return "我觉得当前目标或计划对我来说太难了。请把追问和建议改得更小步、更轻松、心理压力更低，并给出更易立刻上手的拆解思路。"
      case "milestones":
      case "generating_milestones":
        return [
          "我觉得当前里程碑对我来说太难了。请在截止日期允许的前提下，输出完整 JSON 计划，改得更温和（减少并行、拉长节奏或拆细阶段）。",
          "每条 milestone 的 detail 仍必须三行，分别以「具体细节：」「验收标准：」「参考资料：」开头，不要省略标签。",
        ].join("")
      case "daily":
      case "generating_daily":
        return "我觉得当前每日行动对我来说太难了。请建议更轻松的任务颗粒度、更短单次时长，或更可承受的「轻松第一步」。"
      default:
        return "我觉得当前方案对我来说太难了，请整体往更轻松、更小步的方向调整建议。"
    }
  }

  const tooEasyPromptForPhase = (p: WizardPhase): string => {
    switch (p) {
      case "form":
        return "我觉得当前方案对我来说太简单了，挑战性不够。请在尊重截止日的前提下，适当提高标准、密度或里程碑颗粒度。"
      case "milestones":
      case "generating_milestones":
        return [
          "我觉得当前里程碑对我来说太简单了。请在截止日前提下输出完整 JSON 计划，适当提高挑战度、结果标准或略紧凑节奏。",
          "每条 milestone 的 detail 仍必须三行，分别以「具体细节：」「验收标准：」「参考资料：」开头，不要省略标签。",
        ].join("")
      case "daily":
      case "generating_daily":
        return "我觉得当前每日行动对我来说太简单了。请建议在仍可持续的前提下，略提高单次任务的难度或增加关键动作。"
      default:
        return "我觉得当前方案对我来说太简单了，请整体往更有挑战但仍可执行的方向调整建议。"
    }
  }

  const handleQuickTooHard = () => {
    retryCountRef.current += 1
    postBehaviorEvent({
      stepName: "wizard.retry",
      eventName: "step_success",
      retryIndex: retryCountRef.current,
      eventPayload: { phase, action: "too_hard" },
    })
    const modelPrompt = tooHardPromptForPhase(phase)
    if (phase === "daily" || phase === "generating_daily") {
      appendAssistantHint("收到，我会按“更轻松、更小步”的方向重排每日行动。")
      void requestDailyPlan({ mode: "easier", feedback: modelPrompt, forceRegenerate: true })
      return
    }
    if (phaseLiveRef.current === "form") {
      recordFormPhaseUserMessage({ source: "quick_too_hard", display: QUICK_CHAT_DISPLAY.tooHard })
    }
    lastUserModelContentOverrideRef.current = modelPrompt
    sendMessage({ text: QUICK_CHAT_DISPLAY.tooHard })
  }

  const handleQuickTooEasy = () => {
    retryCountRef.current += 1
    postBehaviorEvent({
      stepName: "wizard.retry",
      eventName: "step_success",
      retryIndex: retryCountRef.current,
      eventPayload: { phase, action: "too_easy" },
    })
    const modelPrompt = tooEasyPromptForPhase(phase)
    if (phase === "daily" || phase === "generating_daily") {
      appendAssistantHint("收到，我会按“更有挑战但仍可执行”的方向重排每日行动。")
      void requestDailyPlan({ mode: "harder", feedback: modelPrompt, forceRegenerate: true })
      return
    }
    if (phaseLiveRef.current === "form") {
      recordFormPhaseUserMessage({ source: "quick_too_easy", display: QUICK_CHAT_DISPLAY.tooEasy })
    }
    lastUserModelContentOverrideRef.current = modelPrompt
    sendMessage({ text: QUICK_CHAT_DISPLAY.tooEasy })
  }

  useEffect(() => {
    const applyPayload = (payload: ToolPlanPayload, dedupeKey: string) => {
      if (appliedToolCallIds.current.has(dedupeKey)) return
      appliedToolCallIds.current.add(dedupeKey)

      const milestoneSource = Array.isArray(payload.milestones) ? payload.milestones : []

      const rawTitle =
        payload.title == null ? "" : typeof payload.title === "string" ? payload.title : String(payload.title)
      const titleTrimmed = rawTitle.trim()
      const titleStripped = stripDatesFromTitle(titleTrimmed).trim()
      /** 去日期后若为空则保留原文，避免目标名称无法写入（与 goalNameAfterStripDates 一致） */
      const outTitle = titleStripped || titleTrimmed

      const rawDeadline = typeof payload.deadline === "string" ? payload.deadline : ""
      const deadlineFixed = correctGoalDeadlineToFuture(rawDeadline)
      const iso = /^\d{4}-\d{2}-\d{2}$/
      const timelineRaw = milestoneSource.map((m) =>
        typeof m.targetDate === "string" && iso.test(m.targetDate) ? m.targetDate : deadlineFixed,
      )
      const datesFixed =
        milestoneSource.length > 0 ? correctMilestoneTimelineDates(timelineRaw, deadlineFixed) : []
      const outCategory = (payload.category ?? "other") as GoalBasicsForm["category"]

      if (titleTrimmed) {
        setValue("goalName", outTitle, { shouldDirty: true, shouldTouch: true })
      }
      setValue("deadline", deadlineFixed, { shouldDirty: true, shouldTouch: true })
      deadlineUserPickedRef.current = false
      if (payload.weeklyHours != null) {
        setValue("weeklyHours", Math.min(40, Math.max(1, payload.weeklyHours)), { shouldDirty: true, shouldTouch: true })
      }
      setValue("category", outCategory, { shouldDirty: true, shouldTouch: true })
      categoryAiAppliedRef.current = true

      const nextMilestones = milestoneSource.map((milestone, index: number) => ({
        id: `m-ai-${Date.now()}-${index}`,
        title: milestone.title ?? "",
        detail: milestone.detail ?? "",
        targetDate: datesFixed[index] ?? deadlineFixed,
      }))

      setExtractedPlan({
        title: outTitle,
        deadline: deadlineFixed,
        category: outCategory,
        milestones: nextMilestones,
        easyFirstStep: payload.easyFirstStep ?? null,
      })

      if (phase === "milestones" || phase === "daily" || phase === "gantt") {
        setMilestones(nextMilestones)
      }
      milestoneReviewBaselineRef.current = milestoneReviewSnapshot(nextMilestones)

      // 无论用户是按钮流还是对话流确认目标，都必须统一经过 goal-basics-review 门控；
      // 因此对话回填后主动清空通过缓存，确保下一步仍会请求 /api/plan/goal-basics-review。
      basicsReviewPassedGateKeyRef.current = null
      // 手机单栏模式：显示“已识别并自动填充”后约 2 秒自动收起助手，便于查看左侧信息。
      scheduleMobileAiClose(2000)

      // 不在此处写入 milestonesFromBasicsKeyRef：否则用户手动填表后，仅因对话里工具/JSON 带占位里程碑
      // 就会在「下一步」误判为已规划并跳过 /api/plan/milestones-from-goal。专用里程碑只应以该接口（或其后备）完成时为准。
    }

    for (const message of messages) {
      if (message.role !== "assistant") continue
      const parts = message.parts ?? []

      parts.forEach((part, idx) => {
        if (!isExtractGoalPlanToolPart(part as { type?: string; toolName?: string })) return

        const p = part as { state?: string; toolCallId?: string; output?: unknown }
        const st = p.state
        if (st === "input-streaming") return
        // 仅在实际输出就绪后回填左侧：避免 tool input-available 阶段用未纠偏/不完整载荷写表
        if (!(st === "output-available" || p.output != null)) return

        const payload = readToolPlanPayload(p)
        if (!payload) return

        const callId =
          typeof p.toolCallId === "string" && p.toolCallId.length > 0
            ? p.toolCallId
            : `${message.id}-${idx}`

        applyPayload(payload, `${callId}:final`)
      })

    }
  }, [messages, phase, setValue, getValues, scheduleMobileAiClose])

  const handleStartAiPlan = async () => {
    const vals = getValues()
    const weeklyHoursVal =
      typeof vals.weeklyHours === "number" && Number.isFinite(vals.weeklyHours)
        ? Math.min(40, Math.max(1, Math.floor(vals.weeklyHours)))
        : undefined
    if (!(vals.goalName ?? "").trim() || !vals.deadline || !vals.category || weeklyHoursVal == null) {
      appendAssistantHint("请先补全目标名称、类别、截止日期和每周可投入时长（1-40 小时/周）。")
      return
    }

    const currentKey = normalizedGoalBasicsKeyFromForm(vals)
    if (currentKey === milestonesFromBasicsKeyRef.current) {
      // 优先用 state 里的里程碑（离开里程碑页再回来时最可靠）；避免 extractedPlan 被后续对话改写后错套用到早退分支
      const ms =
        milestones.length > 0
          ? milestones
          : extractedPlan != null && extractedPlan.milestones.length > 0
            ? extractedPlan.milestones
            : []
      if (ms.length > 0) {
        sawMilestonesWithContentRef.current = true
        postBehaviorEvent({
          stepName: "wizard.chat_phase_bridge",
          eventName: "step_success",
          eventPayload: { action: "milestones_resume_cache_hit", milestone_count: ms.length },
        })
        setMilestones(ms)
        setPhase("milestones")
        return
      }
    }

    const basicsOk = await runBasicsReviewGate()
    if (!basicsOk) return
    postBehaviorEvent({
      stepName: "wizard.navigation",
      eventName: "step_success",
      eventPayload: { action: "next_click", from: "form", to: "generating_milestones" },
    })

    pendingMilestoneReadyHintRef.current = false
    pendingMilestonePraiseAckRef.current = null
    autoCloseAiDuringMilestoneFlowRef.current = true
    setPhase("generating_milestones")
    setDailyTasks([])
    dailyBuiltForMilestoneKeyRef.current = null
    setExtractedPlan(null)
    setMilestones([])
    milestoneReviewBaselineRef.current = ""
    dailyReviewBaselineRef.current = ""

    const goalNameTrim = (vals.goalName ?? "").trim()
    const deadlineVal = vals.deadline ?? ""
    const categoryVal = (vals.category ?? "other") as GoalBasicsForm["category"]

    const recordBasicsKeyAfter = (deadlineFixed: string, nameAligned: string) => {
      milestonesFromBasicsKeyRef.current = normalizedGoalBasicsKeyFromForm({
        goalName: nameAligned,
        deadline: deadlineFixed,
        category: categoryVal,
        weeklyHours: weeklyHoursVal,
      })
    }

    goalStreamCtxRef.current = {
      goalNameTrim,
      deadlineVal,
      categoryVal,
      weeklyHours: weeklyHoursVal,
      recordBasicsKeyAfter,
    }
    try {
      await milestonePlanStream.submit({
        goalName: goalNameTrim,
        deadline: deadlineVal,
        weeklyHours: weeklyHoursVal,
        category: categoryVal,
        ...(basicsReviewExtra.trim() ? { feedback: basicsReviewExtra.trim() } : {}),
      })
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error)
      appendAssistantHint(planStreamValidationUserHint(raw))
      applyMilestoneMockFromCtx(goalStreamCtxRef.current)
    }
  }

  const updateMilestone = (id: string, patch: Partial<PlanMilestone>) => {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  const removeMilestone = (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id))
  }

  const addMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        title: "",
        detail: "",
        targetDate: "",
      },
    ])
  }

  const milestonesValid =
    milestones.length > 0 &&
    milestones.every((m) => (m.title ?? "").trim().length > 0 && m.targetDate)

  const handleConfirmMilestones = async () => {
    if (!milestonesValid) return
    const milestonesOk = await runMilestonesReviewGate()
    if (!milestonesOk) return
    postBehaviorEvent({
      stepName: "wizard.navigation",
      eventName: "step_success",
      eventPayload: { action: "next_click", from: "milestones", to: "generating_daily" },
    })
    await requestDailyPlan({ mode: "initial" })
  }

  const updateDaily = (id: string, patch: Partial<PlanDailyDraft>) => {
    setDailyTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  const handleDailyDragStart = (e: ReactDragEvent<HTMLDivElement>, id: string) => {
    setDailyDraggingId(id)
    e.dataTransfer.setData("text/plain", id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDailyDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDailyDrop = (e: ReactDragEvent<HTMLDivElement>, targetId: string, milestoneId: string) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData("text/plain")
    setDailyDraggingId(null)
    if (!sourceId || sourceId === targetId) return
    setDailyTasks((prev) => {
      const inMilestone = prev.filter((t) => t.milestoneId === milestoneId)
      const sourceIndex = inMilestone.findIndex((t) => t.id === sourceId)
      const targetIndex = inMilestone.findIndex((t) => t.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return prev
      const reordered = [...inMilestone]
      const [moved] = reordered.splice(sourceIndex, 1)
      reordered.splice(targetIndex, 0, moved)
      let cursor = 0
      return prev.map((task) => (task.milestoneId === milestoneId ? reordered[cursor++] : task))
    })
  }

  const handleDailyDragEnd = () => setDailyDraggingId(null)

  const removeDaily = (id: string) => {
    setDailyTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const addDailyForMilestone = (milestoneId: string) => {
    setDailyTasks((prev) => [
      ...prev,
      {
        id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        milestoneId,
        title: "",
        duration: 25,
        spanDays: 1,
        startDate: getBusinessTodayIso(),
        criteria: "",
        minimumVersion: "",
        isEasyFirstStep: false,
      },
    ])
  }

  const isoDate = /^\d{4}-\d{2}-\d{2}$/

  const dailyValid =
    milestones.length > 0 &&
    milestones.every((m) =>
      dailyTasks.some(
        (t) =>
          t.milestoneId === m.id &&
          (t.title ?? "").trim().length > 0 &&
          isoDate.test(t.startDate ?? "")
      )
    ) &&
    dailyTasks.length > 0

  const handleBackToMilestones = () => {
    postBehaviorEvent({
      stepName: "wizard.navigation",
      eventName: "step_success",
      eventPayload: { action: "back_click", from: "daily", to: "milestones" },
    })
    setPhase("milestones")
    setDailyPlanFallbackNotice(null)
  }

  const handleMilestonesBackToForm = () => {
    postBehaviorEvent({
      stepName: "wizard.chat_phase_bridge",
      eventName: "step_success",
      eventPayload: {
        action: "milestones_back_to_form_button",
        milestone_count: milestones.length,
        daily_plan_flow_started: dailyPlanFlowStartedRef.current,
      },
    })
    setPhase("form")
  }

  const handleNextToGantt = async () => {
    if (!dailyValid) return
    const dailyOk = await runDailyReviewGate()
    if (!dailyOk) return
    postBehaviorEvent({
      stepName: "wizard.navigation",
      eventName: "step_success",
      eventPayload: { action: "next_click", from: "daily", to: "gantt" },
    })
    setPhase("gantt")
  }

  const goToWizardStep = (target: WizardChipStep) => {
    if (target === 0) {
      setPhase("form")
      return
    }
    if (phase === "generating_milestones") return

    if (target === 1) {
      if (phase === "form") {
        void handleStartAiPlan()
        return
      }
      setPhase("milestones")
      return
    }

    if (target === 2) {
      if (phase === "form") return
      setPhase("daily")
      return
    }

    if (target === 3) {
      if (!dailyValid) return
      void handleNextToGantt()
    }
  }

  const handleFinish = async () => {
    const vals = getValues()
    if (phase !== "gantt" || !dailyValid || !vals.category) return
    setFinishSubmitting(true)
    try {
      await delay(450)
      const goal = buildGoalFromPlan({
        goalName: (vals.goalName ?? "").trim(),
        deadline: vals.deadline ?? "",
        category: vals.category ?? "other",
        milestones,
        dailyTasks: dailyTasks.filter((t) => (t.title ?? "").trim()),
      })
      await onGoalCreated(goal)
      finishedRef.current = true
      postBehaviorEvent({
        stepName: "wizard.ui",
        eventName: "step_success",
        latencyMs: Math.max(0, Date.now() - pageEnteredAtRef.current),
        eventPayload: { action: "finish_create_goal" },
      })
    } finally {
      setFinishSubmitting(false)
    }
  }

  const showFormPanel = phase === "form"

  const stepIndex =
    phase === "form"
      ? 0
      : phase === "milestones" || phase === "generating_milestones"
        ? 1
        : phase === "daily" || phase === "generating_daily"
          ? 2
          : 3

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-transparent">
      <header className="shrink-0 border-b border-slate-200/60 bg-white/50 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-5 md:px-8 md:py-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={handleExitBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">创建新目标</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">和 AI 一起制定你的行动计划</p>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          phase !== "gantt" && "lg:flex-row"
        )}
      >
        {/* 左侧：表单或规划向导 */}
        <div
          className={cn(
            "flex min-h-0 min-w-0 w-full flex-col border-b border-slate-200/70 bg-white",
            phase === "gantt" ? "lg:w-full lg:border-b-0 lg:border-r-0" : "lg:w-1/2 lg:border-b-0 lg:border-r lg:border-slate-200/70"
          )}
        >
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-5 sm:p-8 md:p-10",
              phase !== "gantt" && "max-lg:pb-24",
            )}
          >
            <GoalWizardStepChips
              stepIndex={stepIndex}
              onSelectStep={goToWizardStep}
              showMobileStepHeading={false}
            />

            {showFormPanel && (
              <div className="space-y-8">
                <GoalFormSection title="基本信息" subtitle="先用一句话说清楚「你要达成什么」，并归类到合适领域。">
                  <div className="space-y-2">
                    <Label htmlFor="goal-name" className={gfLabel}>
                      目标名称
                      <RequiredFieldMark />
                    </Label>
                    <Controller
                      name="goalName"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="goal-name"
                          placeholder="例如：三个月内学会游泳换气与踩水"
                          className={gfInput}
                          {...field}
                          onChange={(e) => {
                            categoryAiAppliedRef.current = false
                            field.onChange(e)
                          }}
                        />
                      )}
                    />
                    <p className="text-xs leading-relaxed text-slate-500">写下一个可执行的目标吧！</p>
                  </div>
                  <div className="space-y-2">
                    <Label className={gfLabel}>
                      目标类别
                      <RequiredFieldMark />
                    </Label>
                    <Select
                      value={categorySafe}
                      onValueChange={(v) => {
                        categoryUserLockedRef.current = true
                        setValue("category", v, { shouldDirty: true })
                      }}
                    >
                      <SelectTrigger className={gfSelectTrigger}>
                        <SelectValue placeholder="选择类别" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </GoalFormSection>

                <GoalFormSection title="时间规划" subtitle="截止日与每周可用时间会直接影响里程碑与每日任务的密度。">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="deadline" className={gfLabel}>
                        目标截止日期
                        <RequiredFieldMark />
                      </Label>
                      <GoalDeadlinePicker
                        id="deadline"
                        value={deadlineSafe}
                        onChange={(iso) => {
                          deadlineUserPickedRef.current = true
                          setValue("deadline", iso, { shouldDirty: true })
                        }}
                      />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Controller
                        name="weeklyHours"
                        control={control}
                        render={({ field }) => (
                          <>
                            <div className="flex items-center justify-between gap-4">
                              <Label className={gfLabel}>每周可投入时长</Label>
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                                {typeof field.value === "number" ? `${field.value} 小时/周` : "未填写"}
                              </span>
                            </div>
                            <Input
                              type="number"
                              min={1}
                              max={40}
                              step={1}
                              inputMode="numeric"
                              placeholder="请输入 1-40"
                              className={gfInput}
                              value={typeof field.value === "number" ? String(field.value) : ""}
                              onChange={(e) => {
                                const raw = e.target.value
                                if (raw.trim() === "") {
                                  field.onChange(undefined)
                                  return
                                }
                                const n = Number(raw)
                                if (!Number.isFinite(n)) return
                                field.onChange(Math.min(40, Math.max(1, Math.floor(n))))
                              }}
                            />
                          </>
                        )}
                      />
                      <p className="text-xs leading-relaxed text-slate-500">
                        估计一个和目标难度相匹配的每周投入时间吧！
                      </p>
                    </div>
                  </div>
                </GoalFormSection>

                <section className="rounded-2xl bg-slate-50/50 p-5 sm:p-6">
                  <div className="space-y-2">
                    <Label htmlFor="basics-review-extra" className={gfLabel}>
                      补充说明
                    </Label>
                    <Textarea
                      id="basics-review-extra"
                      placeholder="说说你对这个目标的其他想法，例如：只能在周末做"
                      className={gfTextarea}
                      rows={3}
                      maxLength={2000}
                      value={basicsReviewExtra}
                      onChange={(e) => setBasicsReviewExtra(e.target.value.slice(0, 2000))}
                    />
                  </div>
                </section>
              </div>
            )}

            {phase === "generating_milestones" && (
              <div className="space-y-5 py-4">
                <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-slate-700">
                  <div className="flex gap-3">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary mt-0.5" />
                    <p className="leading-relaxed">{milestoneStreamHint || "正在连接 AI…"}</p>
                  </div>
                </div>
                {milestones.length > 0 ? (
                  <ul className="space-y-2.5">
                    {milestones.map((m, i) => (
                      <li
                        key={`${m.id}-${i}`}
                        className={cn(
                          "motion-safe:animate-goal-milestone-pop rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-white px-4 py-3 text-sm shadow-sm",
                        )}
                        style={{
                          animationDelay: `${Math.min(i, 10) * 75}ms`,
                        }}
                      >
                        <p className="font-semibold leading-snug text-slate-800">
                          {m.title.trim() ? m.title : "（正在写入标题…）"}
                        </p>
                        <p className="mt-1 text-xs tabular-nums text-slate-600">目标日 {m.targetDate || "—"}</p>
                        {(m.detail ?? "").trim() ? (
                          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">
                            {splitMilestoneDetailLines(m.detail ?? "").map((line, li) => (
                              <li key={li} className="flex gap-2">
                                <span className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden />
                                <span className="break-words">{line}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}

            {(phase === "milestones" || phase === "generating_daily") && (
              <div className="space-y-6">
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm">
                  <span className="break-words font-medium text-slate-800">{goalNameSafe || "（未命名目标）"}</span>
                  <span className="text-slate-500"> · 截止 {deadlineSafe || "—"}</span>
                </div>

                {phase === "generating_daily" ? (
                  <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-slate-700">
                    <div className="flex gap-3">
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                      <div className="space-y-1">
                        <p className="leading-relaxed">
                          {dailyStreamHint ||
                            "正在按里程碑并行生成每日任务，已完成的里程碑会先展示部分结果。"}
                        </p>
                        <p className="text-xs text-slate-500">
                          进度：{dailyParallelDone}/{Math.max(dailyParallelTotal, milestones.length)}（状态：{dailyParallelStatus}）
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {milestones.map((m) => {
                        const st = dailyMilestoneStatuses[m.id] ?? "loading"
                        return (
                          <div key={`ms-run-${m.id}`} className="flex items-center justify-between rounded-md bg-white/70 px-2 py-1.5">
                            <span className="line-clamp-1 text-xs text-slate-700">{m.title || "未命名里程碑"}</span>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "text-[11px] font-medium",
                                  st === "success"
                                    ? "text-emerald-600"
                                    : st === "failed"
                                      ? "text-rose-600"
                                      : "text-slate-500",
                                )}
                              >
                                {st === "success" ? "success" : st === "failed" ? "failed" : "loading"}
                              </span>
                              {st === "failed" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => handleRetrySingleMilestone(m.id)}
                                >
                                  重试该里程碑
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">拖动手柄排序后，填写每条里程碑的标题与截止日期。</p>
                    <MilestoneSortableList
                      items={milestones}
                      onReorder={setMilestones}
                      onUpdate={(id, patch) => updateMilestone(id, patch)}
                      onRemove={removeMilestone}
                      minItems={1}
                      variant="create"
                      taskProgressForMilestone={(mid) => {
                        const list = dailyTasks.filter(
                          (t) => t.milestoneId === mid && (t.title ?? "").trim().length > 0,
                        )
                        if (list.length === 0) return undefined
                        return { completed: 0, total: list.length }
                      }}
                    />
                    <Button type="button" variant="outline" className="w-full gap-2" onClick={addMilestone}>
                      <Plus className="h-4 w-4" />
                      添加里程碑
                    </Button>
                  </>
                )}
              </div>
            )}

            {phase === "daily" && (
              <div className="space-y-6">
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm">
                  <span className="break-words font-medium text-slate-800">{goalNameSafe || "（未命名目标）"}</span>
                  <span className="text-slate-500"> · 截止 {deadlineSafe || "—"}</span>
                </div>
                {dailyPlanFallbackNotice ? (
                  <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {dailyPlanFallbackNotice}
                  </p>
                ) : null}
                <Accordion
                  type="multiple"
                  defaultValue={milestones[0]?.id ? [milestones[0].id] : []}
                  className="rounded-2xl border border-slate-200/80 bg-white px-1 shadow-sm"
                >
                  {milestones.map((ms, msIndex) => {
                    const tasks = dailyTasks.filter((t) => t.milestoneId === ms.id)
                    return (
                      <AccordionItem key={ms.id} value={ms.id} className="border-b-0">
                        <AccordionTrigger className="px-3 py-2.5 text-left text-sm font-semibold leading-snug text-slate-800 hover:no-underline">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 gap-y-1 pr-2">
                            <MilestoneIndexBadge order={msIndex + 1} />
                            <span className="line-clamp-2 min-w-0 flex-1 text-left">{ms.title}</span>
                            <span className="shrink-0 text-xs font-normal text-slate-500">{tasks.length} 项</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 px-2 pb-4 pt-0 sm:px-3">
                          {tasks.map((t) => (
                            <div
                              key={t.id}
                              onDragOver={handleDailyDragOver}
                              onDrop={(e) => handleDailyDrop(e, t.id, ms.id)}
                              className={cn(
                                "rounded-xl border border-slate-200/80 bg-slate-50/40 p-2.5 transition-opacity sm:p-3",
                                dailyDraggingId === t.id && "opacity-65",
                              )}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <div
                                  draggable
                                  onDragStart={(e) => handleDailyDragStart(e, t.id)}
                                  onDragEnd={handleDailyDragEnd}
                                  className="-m-1 flex cursor-grab touch-none rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
                                  title="拖动排序"
                                  role="button"
                                  tabIndex={0}
                                  aria-label="拖动以调整任务顺序"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-slate-500 hover:text-destructive"
                                  onClick={() => removeDaily(t.id)}
                                  aria-label="删除任务"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <Label className={gfLabel}>
                                    任务标题
                                    <RequiredFieldMark />
                                  </Label>
                                  <Input
                                    value={t.title}
                                    className={gfInput}
                                    onChange={(e) => updateDaily(t.id, { title: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className={gfLabel}>
                                    开始日期
                                    <RequiredFieldMark />
                                  </Label>
                                  <GoalDeadlinePicker
                                    value={t.startDate}
                                    onChange={(iso) => updateDaily(t.id, { startDate: iso })}
                                  />
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label className={gfLabel}>时长（分钟）</Label>
                                    <Input
                                      type="number"
                                      min={5}
                                      max={240}
                                      className={gfInput}
                                      value={t.duration}
                                      onChange={(e) =>
                                        updateDaily(t.id, { duration: Number(e.target.value) || 25 })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className={gfLabel}>预计天数</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={365}
                                      className={gfInput}
                                      value={t.spanDays}
                                      onChange={(e) =>
                                        updateDaily(t.id, {
                                          spanDays: Math.min(365, Math.max(1, Number(e.target.value) || 1)),
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className={gfLabel}>完成标准</Label>
                                  <Textarea
                                    rows={3}
                                    className={cn(gfTextarea, "min-h-[5rem] resize-y")}
                                    value={t.criteria}
                                    onChange={(e) => updateDaily(t.id, { criteria: e.target.value })}
                                  />
                                </div>
                                <EasyFirstStepField
                                  value={t.minimumVersion}
                                  onChange={(v) => updateDaily(t.id, { minimumVersion: v })}
                                />
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-10 w-full gap-1 rounded-xl border-slate-200 bg-white"
                            onClick={() => addDailyForMilestone(ms.id)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            为此里程碑添加小任务
                          </Button>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </div>
            )}

            {phase === "gantt" && (
              <GoalGanttChart
                animateEntrance
                goalName={goalNameSafe.trim()}
                deadline={deadlineSafe}
                milestones={milestones}
                tasks={dailyTasks
                  .filter((t) => (t.title ?? "").trim())
                  .map((t) => ({
                    id: t.id,
                    title: t.title,
                    milestoneId: t.milestoneId,
                    startDate: t.startDate,
                    spanDays: t.spanDays,
                  }))}
              />
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200/70 bg-white/95 p-4 backdrop-blur-sm sm:p-6">
            {showFormPanel && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-between sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-[1.5px] border-slate-200 bg-white text-slate-600 hover:bg-slate-50 sm:h-10 sm:w-auto sm:min-w-[7rem]"
                  onClick={handleExitBack}
                >
                  上一步
                </Button>
                <Button
                  className="h-11 w-full sm:h-10 sm:flex-1 sm:max-w-md sm:shrink rounded-[10px] hover:shadow-[0_4px_14px_rgba(79,110,247,0.30)]"
                  size="lg"
                  disabled={
                    !goalNameSafe.trim() ||
                    !deadlineSafe ||
                    !categorySafe ||
                    basicsReviewLoading
                  }
                  onClick={() => void handleStartAiPlan()}
                >
                  {basicsReviewLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在校验基本信息…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      下一步：开始 AI 规划
                    </>
                  )}
                </Button>
              </div>
            )}

            {(phase === "generating_milestones" || phase === "generating_daily") && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-between sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-[1.5px] border-slate-200 bg-white text-slate-600 sm:h-10 sm:w-auto"
                  disabled
                >
                  上一步
                </Button>
                <Button type="button" className="h-11 w-full sm:h-10 sm:flex-1" disabled variant="secondary">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中…
                </Button>
              </div>
            )}

            {phase === "milestones" && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-between sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-[1.5px] border-slate-200 bg-white text-slate-600 hover:bg-slate-50 sm:h-10 sm:w-auto sm:min-w-[7rem]"
                  onClick={handleMilestonesBackToForm}
                >
                  上一步
                </Button>
                <Button
                  className="h-11 w-full sm:h-10 sm:flex-1 sm:max-w-md rounded-[10px] hover:shadow-[0_4px_14px_rgba(79,110,247,0.30)]"
                  size="lg"
                  disabled={!milestonesValid}
                  onClick={() => void handleConfirmMilestones()}
                >
                  下一步：拆解每日行动
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}

            {phase === "daily" && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-between sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-[1.5px] border-slate-200 bg-white text-slate-600 hover:bg-slate-50 sm:h-10 sm:w-auto"
                  onClick={handleBackToMilestones}
                >
                  上一步
                </Button>
                <Button
                  className="h-11 w-full sm:h-10 sm:flex-1 sm:max-w-md rounded-[10px] hover:shadow-[0_4px_14px_rgba(79,110,247,0.30)]"
                  size="lg"
                  disabled={!dailyValid}
                  onClick={handleNextToGantt}
                >
                  下一步：查看甘特图
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}

            {phase === "gantt" && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-[1.5px] border-slate-200 bg-white text-slate-600 hover:bg-slate-50 sm:h-10 sm:w-auto"
                  disabled={finishSubmitting}
                  onClick={() => setPhase("daily")}
                >
                  上一步
                </Button>
                <Button
                  className="h-11 w-full gap-2 sm:h-10 sm:flex-1 sm:max-w-md rounded-[10px] hover:shadow-[0_4px_14px_rgba(79,110,247,0.30)]"
                  size="lg"
                  disabled={!dailyValid || finishSubmitting}
                  onClick={() => void handleFinish()}
                >
                  {finishSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  加入目标栏
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：AI 对话；移动端为悬浮入口 + 底部抽屉，桌面端保持分栏 */}
        {phase !== "gantt" ? (
          <>
            <div
              ref={inlineAiPanelRef}
              className={cn(
                "hidden min-h-[42dvh] w-full flex-1 flex-col lg:flex lg:min-h-0 lg:w-1/2",
                "rounded-none border-slate-200/60 bg-slate-50 shadow-[inset_0_2px_16px_rgba(15,23,42,0.05)] lg:m-4 lg:rounded-2xl lg:border",
              )}
            >
              <AddGoalAiAssistantBody
                phase={phase}
                messages={messages}
                status={status}
                error={error}
                chatInput={chatInput}
                setChatInput={setChatInput}
                onSend={handleSendMessage}
                onQuickRegenerate={handleQuickRegenerate}
                onQuickTooHard={handleQuickTooHard}
                onQuickTooEasy={handleQuickTooEasy}
                dailyTasksLength={dailyTasks.length}
              />
            </div>

            <DraggableMobileAiFab
              storageKey="stepwise-add-goal-ai-fab"
              onOpen={() => setMobileAiOpen(true)}
            />

            <Sheet open={mobileAiOpen} onOpenChange={setMobileAiOpen}>
              <SheetContent
                side="bottom"
                className="flex h-[min(92dvh,calc(100dvh-0.5rem))] max-h-[min(92dvh,calc(100dvh-0.5rem))] w-full max-w-[100vw] flex-col gap-0 rounded-t-2xl border-0 p-0 sm:max-w-none [&>button]:top-3 [&>button]:right-3"
              >
                <SheetTitle className="sr-only">创建目标 · AI 助手</SheetTitle>
                <SheetDescription className="sr-only">
                  在此输入需求并与 AI 助手对话，生成并优化目标拆解方案。
                </SheetDescription>
                <div className="flex h-full min-h-0 flex-col bg-slate-50 shadow-[inset_0_2px_16px_rgba(15,23,42,0.05)]">
                  <AddGoalAiAssistantBody
                    phase={phase}
                    messages={messages}
                    status={status}
                    error={error}
                    chatInput={chatInput}
                    setChatInput={setChatInput}
                    onSend={handleSendMessage}
                    onQuickRegenerate={handleQuickRegenerate}
                    onQuickTooHard={handleQuickTooHard}
                    onQuickTooEasy={handleQuickTooEasy}
                    dailyTasksLength={dailyTasks.length}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </>
        ) : null}
      </main>

      <AlertDialog
        open={pendingGoalSwitch != null}
        onOpenChange={(open) => {
          if (!open) setPendingGoalSwitch(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>切换到新目标？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingGoalSwitch?.nextGoalName?.trim()
                ? `检测到你可能想切换到新目标「${pendingGoalSwitch.nextGoalName.trim()}」。确认后会清空当前左侧规划，并用这条新消息继续聊天。`
                : "检测到你可能想切换到一个新目标。确认后会清空当前左侧规划，并用这条新消息继续聊天。"}
              {pendingGoalSwitch?.reason ? ` ${pendingGoalSwitch.reason}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingGoalSwitch(null)}>
              继续当前目标
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGoalSwitch}>
              切换为新目标
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
