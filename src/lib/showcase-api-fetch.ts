import { createUIMessageStream, createUIMessageStreamResponse, generateId } from "ai"
import {
  buildShowcaseExtractGoalPlanPayload,
  readShowcaseChatWizardHints,
  SHOWCASE_CHAT_STUB_INTRO,
} from "@/lib/showcase-chat-default-plan"

const GOAL_BASICS_CATEGORIES = ["career", "learning", "health", "finance", "project", "other"] as const
type GoalBasicsCategory = (typeof GOAL_BASICS_CATEGORIES)[number]

function normalizeGoalBasicsCategory(raw: string): GoalBasicsCategory {
  const v = raw.trim().toLowerCase()
  return (GOAL_BASICS_CATEGORIES as readonly string[]).includes(v) ? (v as GoalBasicsCategory) : "other"
}

function pathnameOf(urlStr: string): string {
  try {
    return new URL(urlStr).pathname
  } catch {
    try {
      return new URL(urlStr, "http://local.mock").pathname
    } catch {
      return urlStr
    }
  }
}

async function showcaseGoalWizardChatResponse(init?: RequestInit): Promise<Response> {
  const body = await readRequestJson(init)
  const hints = readShowcaseChatWizardHints(body)
  const { parsedInput, toolOutput } = buildShowcaseExtractGoalPlanPayload(hints)
  const textId = `showcase-assistant-${Date.now()}`
  const toolCallId = generateId()
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "text-start", id: textId })
      writer.write({ type: "text-delta", id: textId, delta: SHOWCASE_CHAT_STUB_INTRO })
      writer.write({ type: "text-end", id: textId })

      writer.write({
        type: "tool-input-start",
        toolCallId,
        toolName: "extract_goal_plan",
        providerExecuted: true,
      })
      writer.write({
        type: "tool-input-available",
        toolCallId,
        toolName: "extract_goal_plan",
        input: parsedInput,
        providerExecuted: true,
      })
      writer.write({
        type: "tool-output-available",
        toolCallId,
        output: toolOutput,
        providerExecuted: true,
      })
    },
  })
  return createUIMessageStreamResponse({ status: 200, stream })
}

async function readRequestJson(init?: RequestInit): Promise<unknown> {
  if (!init?.body) return null
  if (typeof init.body === "string") {
    try {
      return JSON.parse(init.body) as unknown
    } catch {
      return null
    }
  }
  if (init.body instanceof Blob) {
    try {
      return JSON.parse(await init.body.text()) as unknown
    } catch {
      return null
    }
  }
  return null
}

/**
 * 拦截 Stepwise 前端对 `/api/**` 的请求，在纯静态展示环境下返回可用的占位响应，
 * 让页面走与线上一致的降级分支（本地模板等）。
 */
export function createShowcaseApiFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const path = pathnameOf(urlStr)
    if (!path.includes("/api/")) {
      return baseFetch(input, init)
    }

    if (path.includes("/api/ops/behavior-event")) {
      return new Response(null, { status: 204 })
    }

    if (path.endsWith("/api/plan/goal-basics-review") && (init?.method ?? "GET").toUpperCase() === "POST") {
      const json = (await readRequestJson(init)) as Record<string, unknown> | null
      const goalName = typeof json?.goalName === "string" ? json.goalName.trim() : ""
      const deadline = typeof json?.deadline === "string" ? json.deadline.trim() : ""
      const categoryRaw = typeof json?.category === "string" ? json.category : ""
      const weeklyRaw = json?.weeklyHours
      const weeklyHours =
        typeof weeklyRaw === "number" && Number.isFinite(weeklyRaw)
          ? Math.min(40, Math.max(1, Math.floor(weeklyRaw)))
          : typeof weeklyRaw === "string" && Number.isFinite(Number(weeklyRaw))
            ? Math.min(40, Math.max(1, Math.floor(Number(weeklyRaw))))
            : 8

      const category = normalizeGoalBasicsCategory(categoryRaw || "other")
      const deadlineOk = /^\d{4}-\d{2}-\d{2}$/.test(deadline)

      const body = {
        decision: "ready" as const,
        reasoning: "showcase_stub",
        userFacingNote: "",
        questions: [] as string[],
        form:
          goalName && deadlineOk
            ? {
                goalName,
                deadline,
                category,
                weeklyHours,
              }
            : null,
      }

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      })
    }

    if (path.endsWith("/api/plan/milestones-review") && (init?.method ?? "GET").toUpperCase() === "POST") {
      const body = {
        decision: "ready" as const,
        reasonType: "none" as const,
        allowProceedIfUserInsists: true,
        reasoning: "showcase_stub",
        userFacingNote: "",
        questions: [] as string[],
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      })
    }

    if (path.endsWith("/api/plan/daily-review") && (init?.method ?? "GET").toUpperCase() === "POST") {
      const body = {
        decision: "ready" as const,
        reasonType: "none" as const,
        allowProceedIfUserInsists: true,
        reasoning: "showcase_stub",
        userFacingNote: "",
        questions: [] as string[],
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      })
    }

    if (path.endsWith("/api/chat") && (init?.method ?? "GET").toUpperCase() === "POST") {
      return showcaseGoalWizardChatResponse(init)
    }

    if (
      path.endsWith("/api/plan/milestones-from-goal") ||
      path.endsWith("/api/plan/daily-from-milestones")
    ) {
      return new Response("", { status: 401, statusText: "Unauthorized" })
    }

    return baseFetch(input, init)
  }
}

export const showcaseApiFetch = createShowcaseApiFetch(
  typeof globalThis !== "undefined" && globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch,
)
