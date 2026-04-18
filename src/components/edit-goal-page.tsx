"use client"

import { useState, useEffect, useRef } from "react"
import { format, parseISO } from "date-fns"
import {
  ArrowLeft,
  Send,
  Sparkles,
  User,
  Loader2,
  Plus,
  Trash2,
  ChevronRight,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
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
import type { Goal, GoalMilestone, Task } from "@/lib/mock-data"
import { IconPicker } from "@/components/icon-picker"
import {
  mockRegenerateTasksForOpenMilestones,
  milestonesSnapshotEqual,
  syncGoalPhaseFields,
} from "@/lib/goal-helpers"
import { MilestoneSortableList } from "@/components/milestone-sortable-list"
import { MilestoneIndexBadge } from "@/components/milestone-index-badge"
import { inferCategoryFromEmoji } from "@/lib/ai-plan-mock"
import { inferGoalCategoryFromName } from "@/lib/ai-chat-plan-parse"
import { getBusinessTodayIso } from "@/lib/business-time"
import { correctGoalDeadlineToFuture } from "@/lib/plan-date-correction"
import { stripDatesFromTitle } from "@/lib/goal-title-deadline-align"
import { inferDeadlineFromGoalTitle } from "@/lib/goal-title-deadline-infer"
import { GoalGanttChart } from "@/components/goal-gantt-chart"
import { GoalDeadlinePicker } from "@/components/goal-deadline-picker"
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
import {
  dailyPlanResponseToDrafts,
  dailyStreamResultToAiResponse,
  planDailyDraftsToTasks,
  type DailyPlanAiResponse,
} from "@/lib/daily-plan-response"
import { dailyPlanStreamResponseSchema } from "@/lib/plan-stream-schemas"

interface EditGoalPageProps {
  goal: Goal
  onBack: () => void
  onSave: (goal: Goal) => void | Promise<void>
}

interface ChatMessage {
  role: "ai" | "user"
  content: string
}

const categories = [
  { value: "career", label: "职业发展" },
  { value: "learning", label: "学习提升" },
  { value: "health", label: "健康生活" },
  { value: "finance", label: "财务规划" },
  { value: "project", label: "项目开发" },
  { value: "other", label: "其他" },
]

type EditPhase = "form" | "milestones" | "generating_daily" | "daily" | "gantt"

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

const EDIT_AI_OPENING =
  "你好！我是你的 AI 助手。正在编辑已有目标：你可以先核对左侧基本信息与投入时间，再进入里程碑与每日行动；也欢迎随时在下方说明变化，我会给你简短建议。"

function EditGoalAiAssistantBody({
  messages,
  chatInput,
  setChatInput,
  onSend,
}: {
  messages: ChatMessage[]
  chatInput: string
  setChatInput: (v: string) => void
  onSend: () => void
}) {
  return (
    <>
      <div className="shrink-0 border-b border-primary/15 bg-primary/[0.04] px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shadow-inner">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-slate-800">AI 助手</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-6">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  msg.role === "ai" ? "bg-primary/10" : "bg-muted",
                )}
              >
                {msg.role === "ai" ? (
                  <Sparkles className="h-4 w-4 text-primary" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-5 py-4 leading-relaxed sm:px-6 sm:py-5",
                  msg.role === "ai" ? "bg-card text-foreground" : "bg-primary text-primary-foreground",
                )}
              >
                <ChatMarkdown
                  content={msg.content}
                  variant={msg.role === "user" ? "user" : "assistant"}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="shrink-0 border-t border-border p-3 sm:p-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex gap-2">
          <Input
            placeholder="描述你的目标..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            className="min-h-11 placeholder:text-gray-500 sm:min-h-10 dark:placeholder:text-gray-400"
          />
          <Button type="button" className="h-11 w-11 shrink-0 sm:h-10 sm:w-10" onClick={onSend} disabled={!chatInput.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )
}

function formatGoalCreatedLine(createdAt: string | undefined): string | null {
  if (!createdAt || createdAt.length < 10) return null
  const d = createdAt.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  return `创建于 ${format(parseISO(`${d}T12:00:00`), "yyyy年M月d日")}`
}

export function EditGoalPage({ goal, onBack, onSave }: EditGoalPageProps) {
  const [phase, setPhase] = useState<EditPhase>("form")
  const [name, setName] = useState(goal.name)
  const [deadline, setDeadline] = useState(goal.deadline)
  const [weeklyHours, setWeeklyHours] = useState([5])
  const [category, setCategory] = useState(inferCategoryFromEmoji(goal.emoji))
  const [emoji, setEmoji] = useState(goal.emoji)
  const [currentPhase, setCurrentPhase] = useState(goal.currentPhase)
  const [milestones, setMilestones] = useState<GoalMilestone[]>(goal.milestones.map((m) => ({ ...m })))
  const [localTasks, setLocalTasks] = useState<Task[]>(goal.tasks.map((t) => ({ ...t })))
  const [chatInput, setChatInput] = useState("")
  const [mobileAiOpen, setMobileAiOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "ai", content: EDIT_AI_OPENING }])
  const [saveSubmitting, setSaveSubmitting] = useState(false)
  /** 与上次载入/保存一致时的里程碑快照；未改动则不必重算每日任务 */
  const milestonesBaselineRef = useRef<GoalMilestone[]>(goal.milestones.map((m) => ({ ...m })))
  const categoryUserLockedRef = useRef(false)
  const baselineGoalNameRef = useRef(goal.name)
  const deadlineUserPickedRef = useRef(false)
  const deadlineRef = useRef(deadline)
  deadlineRef.current = deadline

  useEffect(() => {
    setPhase("form")
    setName(goal.name)
    setDeadline(goal.deadline)
    setWeeklyHours([5])
    setCategory(inferCategoryFromEmoji(goal.emoji))
    setEmoji(goal.emoji)
    setCurrentPhase(goal.currentPhase)
    const ms = goal.milestones.map((m) => ({ ...m }))
    setMilestones(ms)
    milestonesBaselineRef.current = goal.milestones.map((m) => ({ ...m }))
    setLocalTasks(goal.tasks.map((t) => ({ ...t })))
    setMessages([{ role: "ai", content: EDIT_AI_OPENING }])
    setChatInput("")
    categoryUserLockedRef.current = false
    baselineGoalNameRef.current = goal.name
    deadlineUserPickedRef.current = false
  }, [goal.id])

  useEffect(() => {
    if (phase !== "form") return
    const t = window.setTimeout(() => {
      if (categoryUserLockedRef.current) return
      const n = name.trim()
      if (!n) return
      if (n === baselineGoalNameRef.current.trim()) return
      const next = inferGoalCategoryFromName(n)
      if (next) setCategory(next)
    }, 400)
    return () => window.clearTimeout(t)
  }, [name, phase])

  useEffect(() => {
    if (phase !== "form") return
    const t = window.setTimeout(() => {
      const trimmed = name.trim()
      if (!trimmed) return
      const parsed = inferDeadlineFromGoalTitle(trimmed)
      if (!parsed) return
      const fixed = correctGoalDeadlineToFuture(parsed.iso)
      const currentRaw = deadlineRef.current.trim()
      const currentFixed =
        currentRaw && /^\d{4}-\d{2}-\d{2}$/.test(currentRaw) ? correctGoalDeadlineToFuture(currentRaw) : ""
      if (parsed.source === "relative" && deadlineUserPickedRef.current) return
      if (fixed === currentFixed) return
      setDeadline(fixed)
      setName(stripDatesFromTitle(trimmed))
      deadlineUserPickedRef.current = false
    }, 480)
    return () => window.clearTimeout(t)
  }, [name, phase])

  const pushAi = (content: string) => {
    setMessages((prev) => [...prev, { role: "ai", content }])
  }

  const handleSendMessage = () => {
    if (!chatInput.trim()) return
    const userMessage = chatInput.trim()
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setChatInput("")
    setTimeout(() => {
      let aiResponse =
        phase === "daily"
          ? "收到。请直接在左侧调整任务；完成后进入「下一步：查看甘特图」。若要整体重排，可先回到里程碑再生成。"
          : phase === "milestones"
            ? "收到。里程碑在左侧，调整完可进入「下一步：拆解每日行动」。"
            : "收到。请先核对基本信息与投入时间，然后点击「开始 AI 规划」进入里程碑。"
      if (userMessage.includes("紧") || userMessage.includes("时间")) {
        aiResponse =
          "时间变紧时，可适当提高每周投入或减少里程碑数量；在里程碑页删改后再生成每日行动即可。"
      }
      setMessages((prev) => [...prev, { role: "ai", content: aiResponse }])
    }, 800)
  }

  const handleEnterPlan = () => {
    if (!name.trim() || !deadline || !category) return
    setPhase("milestones")
    pushAi("已进入里程碑。可拖动手柄排序、编辑标题与截止日期，完成后进入「下一步：拆解每日行动」。")
  }

  const milestonesValid =
    milestones.length > 0 && milestones.every((m) => m.title.trim().length > 0 && m.targetDate)

  const handleConfirmMilestones = async () => {
    if (!milestonesValid) return

    const openMs = milestones.filter((m) => !m.achieved)
    const kept = localTasks.filter((t) => {
      const ms = milestones.find((x) => x.id === t.milestoneId)
      return ms?.achieved === true
    })

    const unchanged = milestonesSnapshotEqual(milestones, milestonesBaselineRef.current)
    if (unchanged) {
      if (openMs.length === 0) {
        setLocalTasks(kept)
        setPhase("daily")
        pushAi("当前没有未完成的里程碑，已保留已完成里程碑下的任务记录。")
        return
      }
      setPhase("daily")
      pushAi("里程碑未改动，已保留原有每日任务与轻松第一步。需要重排时可先改里程碑再生成。")
      return
    }

    setPhase("generating_daily")

    if (openMs.length === 0) {
      setLocalTasks(kept)
      setPhase("daily")
      pushAi("当前没有未完成的里程碑，已保留已完成里程碑下的任务记录。")
      return
    }

    const runFallback = () => {
      const draft: Goal = {
        ...goal,
        name: name.trim(),
        emoji,
        deadline,
        currentPhase,
        milestones,
        tasks: localTasks,
      }
      setLocalTasks(mockRegenerateTasksForOpenMilestones(draft, milestones, weeklyHours[0]))
    }
    const openIdSet = new Set(openMs.map((m) => m.id))
    const prevEasyTask =
      localTasks.find((t) => t.isEasyFirstStep && t.milestoneId && openIdSet.has(t.milestoneId)) ??
      localTasks.find((t) => t.isEasyFirstStep)
    const previousPlanTasks = localTasks
      .filter((t) => !t.isEasyFirstStep && t.milestoneId && openIdSet.has(t.milestoneId))
      .map((t) => ({
        milestoneId: t.milestoneId!,
        title: (t.title ?? "").trim(),
        duration: typeof t.duration === "number" && Number.isFinite(t.duration) ? Math.round(t.duration) : 25,
        estimatedDays:
          typeof t.spanDays === "number" && Number.isFinite(t.spanDays) ? Math.max(1, Math.floor(t.spanDays)) : 1,
        criteria: (t.criteria ?? "").trim(),
        minimumVersion: (t.minimumVersion ?? "").trim(),
      }))
      .filter((t) => t.title.length > 0)
    const previousPlan =
      prevEasyTask && previousPlanTasks.length > 0
        ? {
            easyFirstStep: {
              title: (prevEasyTask.title ?? "").trim() || "轻松第一步",
              duration:
                typeof prevEasyTask.duration === "number" && Number.isFinite(prevEasyTask.duration)
                  ? Math.min(120, Math.max(5, Math.round(prevEasyTask.duration)))
                  : 25,
              criteria: (prevEasyTask.criteria ?? "").trim(),
              minimumVersion: (prevEasyTask.minimumVersion ?? "").trim(),
            },
            tasks: previousPlanTasks,
          }
        : undefined
    const mode: "initial" | "regenerate" = previousPlan ? "regenerate" : "initial"

    try {
      const res = await fetch("/api/plan/daily-from-milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalName: name.trim(),
          deadline,
          weeklyHours: weeklyHours[0],
          category,
          mode,
          ...(previousPlan ? { previousPlan } : {}),
          milestones: openMs.map((m) => ({
            id: m.id,
            title: m.title.trim(),
            detail: (m.detail ?? "").trim(),
            targetDate: m.targetDate,
          })),
        }),
      })
      if (!res.ok) {
        runFallback()
        setPhase("daily")
        pushAi("AI 拆解暂不可用，已用本地模板生成每日任务，请检查修改。")
        return
      }
      const text = await res.text()
      let parsedBody: unknown
      try {
        parsedBody = JSON.parse(text)
      } catch {
        runFallback()
        setPhase("daily")
        pushAi("AI 返回无法解析，已用本地模板生成每日任务。")
        return
      }
      const validated = dailyPlanStreamResponseSchema.safeParse(parsedBody)
      if (!validated.success) {
        runFallback()
        setPhase("daily")
        pushAi("AI 返回不完整，已用本地模板生成每日任务。")
        return
      }
      const data: DailyPlanAiResponse = dailyStreamResultToAiResponse(validated.data)
      if (!data?.easyFirstStep || !Array.isArray(data.tasks) || data.tasks.length === 0) {
        runFallback()
        setPhase("daily")
        pushAi("AI 返回不完整，已用本地模板生成每日任务。")
        return
      }
      if (data.praiseAcknowledgement?.trim()) {
        pushAi(data.praiseAcknowledgement.trim())
      }
      const planMilestones = openMs.map((m) => ({
        id: m.id,
        title: m.title,
        detail: m.detail ?? "",
        targetDate: m.targetDate,
      }))
      const drafts = dailyPlanResponseToDrafts(data, planMilestones, deadline)
      const newTasks = planDailyDraftsToTasks(drafts)
      setLocalTasks([...kept, ...newTasks])
      setPhase("daily")
      pushAi("已根据里程碑生成每日任务与轻松第一步，请按里程碑展开检查；完成后进入「下一步：查看甘特图」。")
    } catch {
      runFallback()
      setPhase("daily")
      pushAi("请求失败，已用本地模板生成每日任务。")
    }
  }

  const handleMilestoneUpdate = (id: string, patch: Partial<Pick<GoalMilestone, "title" | "detail" | "targetDate">>) => {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  const handleRemoveMilestone = (id: string) => {
    if (milestones.length <= 1) return
    setMilestones((prev) => prev.filter((m) => m.id !== id))
    setLocalTasks((prev) => prev.filter((t) => t.milestoneId !== id))
  }

  const handleAddMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      {
        id: `m-new-${Date.now()}`,
        title: "",
        detail: "",
        targetDate: "",
        achieved: false,
        achievedEarly: false,
      },
    ])
  }

  const markMilestoneAchieved = (id: string) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, achieved: true, achievedEarly: false } : m))
    )
  }

  const unmarkMilestone = (id: string) => {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, achieved: false, achievedEarly: false } : m)))
  }

  const updateTask = (id: string, patch: Partial<Task>) => {
    setLocalTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  const removeTask = (id: string) => {
    setLocalTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const addTaskForMilestone = (milestoneId: string) => {
    setLocalTasks((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        milestoneId,
        title: "",
        duration: 25,
        spanDays: 1,
        startDate: getBusinessTodayIso(),
        criteria: "",
        minimumVersion: "",
        isEasyFirstStep: false,
        completed: false,
        progressUnits: 0,
      },
    ])
  }

  const isoDate = /^\d{4}-\d{2}-\d{2}$/

  const dailyValid =
    localTasks.length > 0 &&
    milestones
      .filter((m) => !m.achieved)
      .every((m) =>
        localTasks.some(
          (t) => t.milestoneId === m.id && t.title.trim().length > 0 && isoDate.test(t.startDate)
        )
      )

  const handleBackToMilestones = () => {
    setPhase("milestones")
    pushAi("已返回里程碑编辑。未改里程碑可直接再进每日行动；若调整了里程碑，再点「下一步」重新生成。")
  }

  const handleNextToGantt = () => {
    if (!dailyValid) return
    setPhase("gantt")
  }

  const handleSave = async () => {
    if (phase !== "gantt" || !dailyValid || !category) return
    setSaveSubmitting(true)
    try {
      await delay(450)
      const draft: Goal = {
        ...goal,
        name: name.trim(),
        emoji,
        deadline,
        currentPhase,
        milestones,
        tasks: localTasks.filter((t) => t.title.trim()),
      }
      await onSave({ ...draft, ...syncGoalPhaseFields(draft) })
      milestonesBaselineRef.current = milestones.map((m) => ({ ...m }))
    } finally {
      setSaveSubmitting(false)
    }
  }

  const showFormPanel = phase === "form"
  const stepIndex =
    phase === "form"
      ? 0
      : phase === "milestones"
        ? 1
        : phase === "generating_daily" || phase === "daily"
          ? 2
          : 3

  const goToWizardStep = (target: WizardChipStep) => {
    if (target === 0) {
      setPhase("form")
      return
    }
    if (target === 1) {
      if (phase === "form") {
        handleEnterPlan()
        return
      }
      setPhase("milestones")
      return
    }
    if (target === 2) {
      if (phase === "form") {
        if (!name.trim() || !deadline || !category) return
        setPhase("daily")
        return
      }
      setPhase("daily")
      return
    }
    if (target === 3) {
      if (!dailyValid) return
      setPhase("gantt")
    }
  }

  const createdLine = formatGoalCreatedLine(goal.createdAt)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-transparent">
      <header className="shrink-0 border-b border-slate-200/60 bg-white/50 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-5 md:px-8 md:py-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-slate-900 sm:text-2xl">
              编辑：{name.trim() || goal.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              {[createdLine, "与 AI 一起调整行动计划"].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          phase !== "gantt" && "lg:flex-row"
        )}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 w-full flex-col border-b border-slate-200/70 bg-white",
            phase === "gantt"
              ? "lg:w-full lg:border-b-0 lg:border-r-0"
              : "lg:w-1/2 lg:border-b-0 lg:border-r lg:border-slate-200/70",
          )}
        >
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-5 sm:p-8 md:p-10",
              phase !== "gantt" && "max-lg:pb-24",
            )}
          >
            <GoalWizardStepChips stepIndex={stepIndex} onSelectStep={goToWizardStep} />

            {showFormPanel && (
              <div className="space-y-8">
                <GoalFormSection title="基本信息" subtitle="核对名称、阶段与类别，确保计划与你的真实进度一致。">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <div className="space-y-2">
                      <Label className={gfLabel}>目标图标</Label>
                      <IconPicker icon={emoji} onIconChange={setEmoji}>
                        <div className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl shadow-sm transition-all hover:ring-2 hover:ring-primary/30">
                          {emoji}
                        </div>
                      </IconPicker>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label htmlFor="edit-goal-name" className={gfLabel}>
                        目标名称
                        <RequiredFieldMark />
                      </Label>
                      <Input
                        id="edit-goal-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="例如：三个月内学会游泳换气与踩水"
                        className={gfInput}
                      />
                      <p className="text-xs leading-relaxed text-slate-500">
                        目标尽量保持现实、可执行、在你的身份和时间范围内有机会完成；避免像“成为美国总统”这类明显不切实际的目标。
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-current-phase" className={gfLabel}>
                      当前阶段
                    </Label>
                    <Input
                      id="edit-current-phase"
                      value={currentPhase}
                      onChange={(e) => setCurrentPhase(e.target.value)}
                      className={gfInput}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={gfLabel}>
                      目标类别
                      <RequiredFieldMark />
                    </Label>
                    <Select
                      value={category}
                      onValueChange={(v) => {
                        categoryUserLockedRef.current = true
                        setCategory(v)
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

                <GoalFormSection title="时间规划" subtitle="调整截止日与每周投入后，可在里程碑页重新生成每日行动。">
                  <div className="space-y-2">
                    <Label htmlFor="edit-deadline" className={gfLabel}>
                      目标截止日期
                      <RequiredFieldMark />
                    </Label>
                    <GoalDeadlinePicker
                      id="edit-deadline"
                      value={deadline}
                      onChange={(iso) => {
                        deadlineUserPickedRef.current = true
                        setDeadline(iso)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <Label className={gfLabel}>每周可投入时长</Label>
                      <span className="text-sm font-semibold tabular-nums text-slate-700">{weeklyHours[0]} 小时/周</span>
                    </div>
                    <Slider
                      value={weeklyHours}
                      onValueChange={setWeeklyHours}
                      max={40}
                      min={1}
                      step={1}
                      className="py-3"
                    />
                    <p className="text-xs leading-relaxed text-slate-500">
                      每周投入要和目标难度与截止日期一起看；如果目标很大但时间投入过低，系统会提醒你调整目标范围、截止日期或每周时长。
                    </p>
                  </div>
                </GoalFormSection>
              </div>
            )}

            {(phase === "milestones" || phase === "generating_daily") && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 text-sm sm:p-4">
                  <p className="font-semibold leading-snug text-slate-800">{name || "（未命名目标）"}</p>
                  <p className="mt-0.5 text-slate-600">截止 {deadline || "—"}</p>
                </div>

                {phase === "generating_daily" ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    正在将里程碑细分为每日任务与轻松第一步...
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">拖动手柄排序后，填写每条里程碑的标题与截止日期。</p>
                    <MilestoneSortableList
                      items={milestones}
                      onReorder={(next) =>
                        setMilestones(
                          next.map((row) => {
                            const prev = milestones.find((x) => x.id === row.id)
                            return {
                              id: row.id,
                              title: row.title,
                              targetDate: row.targetDate,
                              achieved: prev?.achieved ?? false,
                              achievedEarly: prev?.achievedEarly ?? false,
                            }
                          }),
                        )
                      }
                      onUpdate={handleMilestoneUpdate}
                      onRemove={handleRemoveMilestone}
                      minItems={1}
                      variant="edit"
                      onMarkAchieved={markMilestoneAchieved}
                      onUnmarkAchieved={unmarkMilestone}
                      taskProgressForMilestone={(mid) => {
                        const list = localTasks.filter((t) => t.milestoneId === mid && t.title.trim().length > 0)
                        if (list.length === 0) return undefined
                        return {
                          completed: list.filter((t) => t.completed).length,
                          total: list.length,
                        }
                      }}
                    />
                    <Button type="button" variant="outline" className="w-full gap-2" onClick={handleAddMilestone}>
                      <Plus className="h-4 w-4" />
                      添加里程碑
                    </Button>
                  </>
                )}
              </div>
            )}

            {phase === "daily" && (
              <div className="space-y-6">
                <p className="text-sm text-slate-600">下列任务将出现在「今日」与「目标」中。</p>
                <Accordion
                  type="multiple"
                  defaultValue={milestones[0]?.id ? [milestones[0].id] : []}
                  className="rounded-2xl border border-slate-200/80 bg-white px-1 shadow-sm"
                >
                  {milestones.map((ms, msIndex) => {
                    const tasks = localTasks.filter((t) => t.milestoneId === ms.id)
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
                              className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-3 sm:p-4"
                            >
                              <div className="mb-3 flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-slate-500 hover:text-destructive"
                                  onClick={() => removeTask(t.id)}
                                  aria-label="删除任务"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label className={gfLabel}>
                                    任务标题
                                    <RequiredFieldMark />
                                  </Label>
                                  <Input
                                    value={t.title}
                                    className={gfInput}
                                    onChange={(e) => updateTask(t.id, { title: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className={gfLabel}>
                                    开始日期
                                    <RequiredFieldMark />
                                  </Label>
                                  <GoalDeadlinePicker
                                    value={t.startDate}
                                    onChange={(iso) => updateTask(t.id, { startDate: iso })}
                                  />
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label className={gfLabel}>时长（分钟）</Label>
                                    <Input
                                      type="number"
                                      min={5}
                                      max={240}
                                      className={gfInput}
                                      value={t.duration}
                                      onChange={(e) => updateTask(t.id, { duration: Number(e.target.value) || 25 })}
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
                                        updateTask(t.id, {
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
                                    onChange={(e) => updateTask(t.id, { criteria: e.target.value })}
                                  />
                                </div>
                                <EasyFirstStepField
                                  value={t.minimumVersion}
                                  onChange={(v) => updateTask(t.id, { minimumVersion: v })}
                                />
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-10 w-full gap-1 rounded-xl border-slate-200 bg-white"
                            onClick={() => addTaskForMilestone(ms.id)}
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
                goalName={name.trim()}
                deadline={deadline}
                milestones={milestones}
                tasks={localTasks
                  .filter((t) => t.title.trim())
                  .map((t) => ({
                    id: t.id,
                    title: t.title,
                    milestoneId: t.milestoneId,
                    startDate: t.startDate,
                    spanDays: t.spanDays,
                    completed: t.completed,
                    progressUnits: t.progressUnits,
                  }))}
              />
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200/70 bg-white/95 p-4 backdrop-blur-sm sm:p-6">
            {showFormPanel && (
              <Button
                className="h-11 w-full sm:h-10"
                size="lg"
                disabled={!name.trim() || !deadline || !category}
                onClick={handleEnterPlan}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                开始 AI 规划
              </Button>
            )}

            {phase === "milestones" && (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-row-reverse">
                <Button
                  className="h-11 w-full sm:h-10 sm:flex-1"
                  size="lg"
                  disabled={!milestonesValid}
                  onClick={() => void handleConfirmMilestones()}
                >
                  下一步：拆解每日行动
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}

            {phase === "generating_daily" && (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-[1.5px] border-slate-200 bg-white text-slate-600 sm:h-10 sm:w-auto"
                  disabled
                >
                  上一步
                </Button>
                <Button type="button" className="h-11 sm:h-10 sm:flex-1" disabled variant="secondary">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中…
                </Button>
              </div>
            )}

            {phase === "daily" && (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-[1.5px] border-slate-200 bg-white text-slate-600 hover:bg-slate-50 sm:h-10 sm:w-auto"
                  onClick={handleBackToMilestones}
                >
                  上一步
                </Button>
                <Button
                  className="h-11 gap-2 sm:h-10 sm:min-w-[10rem]"
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
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-[1.5px] border-slate-200 bg-white text-slate-600 hover:bg-slate-50 sm:h-10 sm:w-auto"
                  disabled={saveSubmitting}
                  onClick={() => setPhase("daily")}
                >
                  上一步
                </Button>
                <Button
                  className="h-11 gap-2 sm:h-10 sm:min-w-[10rem]"
                  size="lg"
                  disabled={!dailyValid || saveSubmitting}
                  onClick={() => void handleSave()}
                >
                  {saveSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  保存修改
                </Button>
              </div>
            )}
          </div>
        </div>

        {phase !== "gantt" ? (
          <>
            <div className="hidden min-h-[42dvh] w-full flex-1 flex-col bg-muted/30 lg:flex lg:min-h-0 lg:w-1/2">
              <EditGoalAiAssistantBody
                messages={messages}
                chatInput={chatInput}
                setChatInput={setChatInput}
                onSend={handleSendMessage}
              />
            </div>

            <DraggableMobileAiFab
              storageKey="stepwise-edit-goal-ai-fab"
              onOpen={() => setMobileAiOpen(true)}
            />

            <Sheet open={mobileAiOpen} onOpenChange={setMobileAiOpen}>
              <SheetContent
                side="bottom"
                className="flex h-[min(92dvh,calc(100dvh-0.5rem))] max-h-[min(92dvh,calc(100dvh-0.5rem))] w-full max-w-[100vw] flex-col gap-0 rounded-t-2xl border-0 bg-muted/30 p-0 sm:max-w-none [&>button]:top-3 [&>button]:right-3"
              >
                <SheetTitle className="sr-only">编辑目标 · AI 助手</SheetTitle>
                <SheetDescription className="sr-only">
                  在此与 AI 助手沟通，调整当前目标的拆解与执行建议。
                </SheetDescription>
                <div className="flex h-full min-h-0 flex-col">
                  <EditGoalAiAssistantBody
                    messages={messages}
                    chatInput={chatInput}
                    setChatInput={setChatInput}
                    onSend={handleSendMessage}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </>
        ) : null}
      </main>
    </div>
  )
}
