"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  max as dfMax,
  min as dfMin,
  isSameDay,
  startOfDay,
} from "date-fns"
import { zhCN } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { GoalMilestone, Task } from "@/lib/mock-data"
import { normalizedTaskSpanDays, taskTimelineProgressPercent } from "@/lib/goal-helpers"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export type GanttTaskInput = {
  id: string
  title: string
  milestoneId?: string
  startDate: string
  spanDays: number
  progressUnits?: number
  /** 草稿预览用；有 progressUnits 时以跨度进度为准 */
  progressPct?: number
  completed?: boolean
}

export interface GoalGanttChartProps {
  goalName: string
  deadline: string
  /** 需含 targetDate，用于阶段概览条与对齐 */
  milestones: Pick<GoalMilestone, "id" | "title" | "targetDate">[]
  tasks: GanttTaskInput[]
  className?: string
  /**
   * 为 true 时播放入场动效（用于新建目标向导中的甘特预览）。
   * 目标列表等场景重新打开甘特图时请保持默认 false。
   */
  animateEntrance?: boolean
}

const TIMELINE_MIN_PX = 480
const LABEL_MIN_GAP_PX = 80
const LEFT_COL_MIN = 160
const LEFT_COL_MAX = 420
const LEFT_COL_DEFAULT = 208
/** 任务列与时间轴之间的竖条（可拖动调列宽），与表体各行对齐 */
const COLUMN_GUTTER_PX = 10
/** localStorage：用户拖动后的任务列宽 */
const GANTT_LEFT_COL_STORAGE_KEY = "goal-gantt-left-col-px-v1"

function readStoredLeftColPx(): number | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(GANTT_LEFT_COL_STORAGE_KEY)
  if (raw == null) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.max(LEFT_COL_MIN, Math.min(LEFT_COL_MAX, Math.round(n)))
}

const ROW_H = "2.25rem"
const PHASE_ROW_H = "2rem"

const ganttScrollMaxHeight = "none"

const GANTT_THEMES = [
  {
    phase: "from-primary-from/20 to-primary-to/30",
    task: "from-primary-from to-primary-to",
    ring: "ring-primary/30",
    tint: "bg-primary/[0.04]",
    base: "bg-indigo-100/60", // 与主色相近的浅底色
    border: "border-indigo-200",
    shadow: "shadow-[0_2px_8px_rgba(79,70,229,0.18)]",
  },
  {
    phase: "from-indigo-500/20 to-violet-500/30",
    task: "from-indigo-500 to-violet-600",
    ring: "ring-indigo-500/30",
    tint: "bg-indigo-500/[0.04]",
    base: "bg-indigo-100/60", // 浅靛蓝基底
    border: "border-indigo-200",
    shadow: "shadow-[0_2px_8px_rgba(79,70,229,0.18)]",
  },
  {
    phase: "from-violet-500/20 to-fuchsia-500/30",
    task: "from-violet-500 to-fuchsia-600",
    ring: "ring-violet-500/30",
    tint: "bg-violet-500/[0.04]",
    base: "bg-violet-100/60", // 浅紫色基底
    border: "border-violet-200",
    shadow: "shadow-[0_2px_8px_rgba(139,92,246,0.18)]",
  },
  {
    phase: "from-sky-500/20 to-blue-500/30",
    task: "from-sky-500 to-blue-600",
    ring: "ring-sky-500/30",
    tint: "bg-sky-500/[0.04]",
    base: "bg-sky-100/60", // 浅天蓝基底
    border: "border-sky-200",
    shadow: "shadow-[0_2px_8px_rgba(14,165,233,0.18)]",
  },
  {
    phase: "from-emerald-500/20 to-teal-500/30",
    task: "from-emerald-500 to-teal-600",
    ring: "ring-emerald-500/30",
    tint: "bg-emerald-500/[0.04]",
    base: "bg-emerald-100/60", // 浅翡翠绿基底
    border: "border-emerald-200",
    shadow: "shadow-[0_2px_8px_rgba(16,185,129,0.18)]",
  },
] as const

function parseLocalDate(iso: string) {
  const s = iso.slice(0, 10)
  return parseISO(`${s}T12:00:00`)
}

function computeTickOffsets(minD: Date, totalDays: number, timelineWidthPx: number): number[] {
  const safeDays = Math.max(1, totalDays)
  const pxPerDay = timelineWidthPx / safeDays

  let interval = Math.max(1, Math.ceil(LABEL_MIN_GAP_PX / Math.max(pxPerDay, 0.001)))

  const candidates: number[] = []
  const preferMondays = safeDays >= 35 && interval >= 4

  if (preferMondays) {
    for (let i = 0; i < safeDays; i++) {
      const d = addDays(minD, i)
      const isMon = d.getDay() === 1
      if (i === 0 || i === safeDays - 1 || isMon) {
        candidates.push(i)
      }
    }
  } else {
    for (let i = 0; i < safeDays; i += interval) {
      candidates.push(i)
    }
    if (candidates[candidates.length - 1] !== safeDays - 1) {
      candidates.push(safeDays - 1)
    }
  }

  const merged: number[] = []
  for (const c of candidates) {
    if (merged.length === 0) {
      merged.push(c)
      continue
    }
    const prev = merged[merged.length - 1]!
    const gapPx = (c - prev) * pxPerDay
    if (gapPx >= LABEL_MIN_GAP_PX) {
      merged.push(c)
    } else if (c === safeDays - 1 && prev !== safeDays - 1) {
      if (merged.length >= 2) {
        const prev2 = merged[merged.length - 2]!
        if ((c - prev2) * pxPerDay >= LABEL_MIN_GAP_PX) {
          merged[merged.length - 1] = c
        }
      } else {
        merged[merged.length - 1] = c
      }
    }
  }

  if (!merged.includes(0)) merged.unshift(0)
  if (safeDays > 1 && !merged.includes(safeDays - 1)) merged.push(safeDays - 1)
  return [...new Set(merged)].sort((a, b) => a - b)
}

function milestoneAbbrev(title: string) {
  const t = title.trim()
  if (t.length <= 22) return t
  return `${t.slice(0, 20)}…`
}

function buildWeekendBackground(_minD: Date, totalDays: number, weekendDayIndices: Set<number>) {
  if (totalDays <= 0 || weekendDayIndices.size === 0) return ""

  const segments: string[] = []
  let start: number | null = null

  for (let i = 0; i < totalDays; i += 1) {
    const isWeekend = weekendDayIndices.has(i)
    if (isWeekend && start == null) start = i
    if (!isWeekend && start != null) {
      const left = (start / totalDays) * 100
      const right = (i / totalDays) * 100
      segments.push(`rgba(248,250,252,0.5) ${left}% ${right}%`)
      start = null
    }
  }

  if (start != null) {
    const left = (start / totalDays) * 100
    segments.push(`rgba(248,250,252,0.5) ${left}% 100%`)
  }

  return segments.length > 0 ? `linear-gradient(to right, ${segments.join(", ")})` : ""
}

type GanttData = {
  rows: Array<{
    id: string
    title: string
    milestoneId?: string
    startDate: string
    spanDays: number
    span: number
    milestoneTitle?: string
    milestoneIdx: number
    start: Date
    end: Date
    progress: number
  }>
  minD: Date
  maxD: Date
  totalDays: number
  planStartD: Date
  planStartPct: number
  planStartInRange: boolean
  deadlineD: Date
  deadlinePct: number
  deadlineInRange: boolean
  todayPct: number | null
}

export function GoalGanttChart({
  goalName,
  deadline,
  milestones,
  tasks,
  className,
  animateEntrance = false,
}: GoalGanttChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewportW, setViewportW] = useState(920)
  const [leftColPx, setLeftColPx] = useState(LEFT_COL_DEFAULT)
  const [leftColResizing, setLeftColResizing] = useState(false)
  const leftColResizeRef = useRef<{ pointerId: number; startX: number; startW: number } | null>(null)

  useEffect(() => {
    const longestTitle = tasks.reduce((max, t) => Math.max(max, (t.title || "").length), 0)
    const estimatedW = Math.max(LEFT_COL_MIN, Math.min(LEFT_COL_MAX, longestTitle * 8 + 64))
    const stored = readStoredLeftColPx()
    if (stored != null) {
      setLeftColPx(stored)
    } else {
      setLeftColPx(estimatedW)
    }

    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewportW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [tasks])

  const onLeftColResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    leftColResizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startW: leftColPx,
    }
    setLeftColResizing(true)
  }, [leftColPx])

  const onLeftColResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = leftColResizeRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    e.preventDefault()
    const dx = e.clientX - drag.startX
    const next = Math.max(LEFT_COL_MIN, Math.min(LEFT_COL_MAX, drag.startW + dx))
    setLeftColPx(next)
  }, [])

  const onLeftColResizePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = leftColResizeRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    leftColResizeRef.current = null
    setLeftColResizing(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const dx = e.clientX - drag.startX
    const finalW = Math.max(LEFT_COL_MIN, Math.min(LEFT_COL_MAX, drag.startW + dx))
    setLeftColPx(finalW)
    try {
      window.localStorage.setItem(GANTT_LEFT_COL_STORAGE_KEY, String(finalW))
    } catch {
      /* ignore */
    }
  }, [])

  const msOrder = useMemo(() => {
    const map = new Map(milestones.map((m, i) => [m.id, i]))
    return map
  }, [milestones])

  const data = useMemo((): GanttData | null => {
    if (tasks.length === 0) return null
    const msTitle = Object.fromEntries(milestones.map((m) => [m.id, m.title]))
    const deadlineD = parseLocalDate(deadline)
    const today = startOfDay(new Date())

    const rows = tasks.map((t) => {
      const span = normalizedTaskSpanDays(t as Task)
      const start = parseLocalDate(t.startDate)
      const end = addDays(start, span - 1)
      let progress = taskTimelineProgressPercent(t as Task)
      if (
        progress === 0 &&
        !t.completed &&
        typeof t.progressPct === "number" &&
        Number.isFinite(t.progressPct)
      ) {
        progress = Math.min(100, Math.max(0, t.progressPct))
      }
      const mid = t.milestoneId
      const milestoneIdx = mid != null ? (msOrder.get(mid) ?? 0) : 0
      return {
        ...t,
        span,
        milestoneTitle: mid ? msTitle[mid] : undefined,
        milestoneIdx,
        start,
        end,
        progress,
      }
    })

    const planStartD = dfMin(rows.map((r) => r.start))
    const minD = addDays(planStartD, -1)
    const maxD = dfMax(rows.flatMap((r) => [r.start, r.end]).concat(deadlineD))
    const totalDays = Math.max(1, differenceInCalendarDays(maxD, minD) + 1)

    const planStartPct = Math.min(
      100,
      Math.max(0, (differenceInCalendarDays(planStartD, minD) / totalDays) * 100),
    )
    const planStartInRange =
      differenceInCalendarDays(planStartD, minD) >= 0 && differenceInCalendarDays(maxD, planStartD) >= 0

    const deadlinePct = Math.min(100, Math.max(0, (differenceInCalendarDays(deadlineD, minD) / totalDays) * 100))
    const deadlineInRange =
      differenceInCalendarDays(deadlineD, minD) >= 0 && differenceInCalendarDays(maxD, deadlineD) >= 0

    let todayPct: number | null = null
    if (differenceInCalendarDays(today, minD) >= 0 && differenceInCalendarDays(maxD, today) >= 0) {
      todayPct = Math.min(100, Math.max(0, (differenceInCalendarDays(today, minD) / totalDays) * 100))
    }

    return {
      rows,
      minD,
      maxD,
      totalDays,
      planStartD,
      planStartPct,
      planStartInRange,
      deadlineD,
      deadlinePct,
      deadlineInRange,
      todayPct,
    }
  }, [tasks, deadline, milestones, msOrder])

  const timelineWidthPx = useMemo(() => {
    if (!data) return TIMELINE_MIN_PX
    const chartViewportW = Math.max(200, viewportW - leftColPx - COLUMN_GUTTER_PX - 2)
    // 灵活适配宽度：如果总天数不多，尽量占满窗口；但不低于一个可读的最小比例
    const autoPxPerDay = chartViewportW / data.totalDays
    const pxPerDay = Math.max(12, autoPxPerDay) // 稍微提高一点 pxPerDay，让刻度更宽绰
    return Math.max(TIMELINE_MIN_PX, data.totalDays * pxPerDay)
  }, [data, viewportW, leftColPx])

  const tickOffsets = useMemo(() => {
    if (!data) return []
    return computeTickOffsets(data.minD, data.totalDays, timelineWidthPx)
  }, [data, timelineWidthPx])

  const milestoneSpans = useMemo(() => {
    if (!data) return []
    const byId = new Map<string, typeof data.rows>()
    for (const r of data.rows) {
      if (!r.milestoneId) continue
      const list = byId.get(r.milestoneId) ?? []
      list.push(r)
      byId.set(r.milestoneId, list)
    }

    const milestoneById = Object.fromEntries(milestones.map((m) => [m.id, m]))
    const out: Array<{
      id: string
      start: Date
      end: Date
      idx: number
    }> = []

    for (const [id, list] of byId) {
      if (list.length === 0) continue
      const starts = list.map((r) => r.start)
      const ends = list.map((r) => r.end)
      let end = dfMax(ends)
      const m = milestoneById[id]
      if (m?.targetDate) {
        const td = parseLocalDate(m.targetDate)
        end = dfMax([end, td])
      }
      const start = dfMin(starts)
      const idx = msOrder.get(id) ?? 0
      out.push({ id, start, end, idx })
    }
    out.sort((a, b) => differenceInCalendarDays(a.start, b.start))
    return out
  }, [data, milestones, msOrder])

  const weekendDayIndices = useMemo(() => {
    if (!data) return new Set<number>()
    const set = new Set<number>()
    for (let i = 0; i < data.totalDays; i++) {
      const d = addDays(data.minD, i)
      const dow = d.getDay()
      if (dow === 0 || dow === 6) set.add(i)
    }
    return set
  }, [data])

  const gridBackgroundImage = useMemo(() => {
    if (!data) return ""
    const layers: string[] = []
    if (data.totalDays > 0) {
      layers.push(
        `repeating-linear-gradient(to right, rgba(226,232,240,0.4) 0, rgba(226,232,240,0.4) 1px, transparent 1px, transparent calc(100% / ${data.totalDays}))`,
      )
      const weekendBg = buildWeekendBackground(data.minD, data.totalDays, weekendDayIndices)
      if (weekendBg) layers.push(weekendBg)
    }
    return layers.join(", ")
  }, [data, weekendDayIndices])

  /** 避免「起始 / 截止」与 Today 同轴叠字；同日则省略重复标签 */
  const headerMarkerLayout = useMemo(() => {
    if (!data) return null
    const today = startOfDay(new Date())
    const {
      planStartD,
      planStartPct,
      planStartInRange,
      deadlineD,
      deadlinePct,
      deadlineInRange,
      todayPct,
    } = data
    const hidePlanStartChip = planStartInRange && isSameDay(planStartD, today)
    const hideDeadlineChip = deadlineInRange && isSameDay(deadlineD, today)
    const minGapPx = 48
    let planNudge = 0
    let deadNudge = 0
    if (todayPct != null && planStartInRange && !hidePlanStartChip) {
      const gap = (Math.abs(planStartPct - todayPct) / 100) * timelineWidthPx
      if (gap > 0 && gap < minGapPx) {
        planNudge = planStartPct < todayPct ? -(minGapPx - gap) * 0.5 : (minGapPx - gap) * 0.5
      }
    }
    if (todayPct != null && deadlineInRange && !hideDeadlineChip) {
      const gap = (Math.abs(deadlinePct - todayPct) / 100) * timelineWidthPx
      if (gap > 0 && gap < minGapPx) {
        deadNudge = deadlinePct < todayPct ? -(minGapPx - gap) * 0.5 : (minGapPx - gap) * 0.5
      }
    }
    if (planStartInRange && deadlineInRange && !hidePlanStartChip && !hideDeadlineChip) {
      const gap = (Math.abs(planStartPct - deadlinePct) / 100) * timelineWidthPx
      if (gap > 0 && gap < minGapPx) {
        deadNudge += deadlinePct >= planStartPct ? (minGapPx - gap) * 0.35 : -(minGapPx - gap) * 0.35
      }
    }
    return { hidePlanStartChip, hideDeadlineChip, planNudge, deadNudge }
  }, [data, timelineWidthPx])

  if (!data) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        暂无任务，请先在前一步添加每日任务。
      </div>
    )
  }

  const { rows, minD, totalDays, planStartD, planStartPct, planStartInRange, deadlineD, deadlinePct, deadlineInRange, todayPct } =
    data

  const axisDayFormat = "M.d"
  const todayLabelDate = format(startOfDay(new Date()), axisDayFormat)
  const totalWidth = leftColPx + COLUMN_GUTTER_PX + timelineWidthPx

  const leftColClass = cn(
    "sticky left-0 z-20 shrink-0 border-r border-slate-200/90 bg-white/95 backdrop-blur-sm",
    "shadow-[4px_0_20px_rgba(15,23,42,0.04)]",
  )
  const leftHeaderClass = cn("sticky left-0 z-[45]", leftColClass)

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("min-w-0 max-w-full space-y-3", className)}>
      <div
        className={cn(
          "rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm",
          animateEntrance && "animate-gantt-chart-title-enter",
        )}
      >
        <span className="break-words font-medium text-slate-800">{goalName || "目标"}</span>
        <span className="text-slate-500"> · 截止 {deadline}</span>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "overflow-x-auto overflow-y-visible rounded-xl border border-slate-200/80 bg-white shadow-sm [-webkit-overflow-scrolling:touch]",
          animateEntrance && "animate-gantt-chart-shell-enter",
        )}
        style={{
          maxHeight: ganttScrollMaxHeight,
          ...(animateEntrance ? { animationDelay: "70ms" } : {}),
        }}
      >
        <div className="inline-block min-w-full align-top" style={{ minWidth: totalWidth }}>
          {/* ===== 表头 ===== */}
          <div
            className={cn(
              "sticky top-0 z-30 flex border-b border-slate-200/90 bg-white/95 backdrop-blur-md",
              "shadow-[0_6px_16px_-6px_rgba(15,23,42,0.08)]",
              animateEntrance && "animate-gantt-chart-title-enter",
            )}
            style={animateEntrance ? { animationDelay: "115ms" } : undefined}
          >
            <div
              className={cn(leftHeaderClass, "flex min-h-[4.25rem] items-center px-3 py-2")}
              style={{ width: leftColPx, minWidth: leftColPx }}
            >
              <span className="text-xs font-semibold tracking-tight text-slate-600">任务</span>
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="拖动调整任务列宽度"
              title="拖动调整任务列宽度"
              className={cn(
                "relative z-[55] flex shrink-0 cursor-col-resize touch-none select-none flex-col items-center justify-center",
                "border-0 bg-slate-100/90 shadow-[inset_-1px_0_0_rgba(148,163,184,0.35)]",
                leftColResizing && "bg-indigo-100/90 shadow-[inset_-1px_0_0_rgba(99,102,241,0.45)]",
              )}
              style={{ width: COLUMN_GUTTER_PX, minWidth: COLUMN_GUTTER_PX }}
              onPointerDown={onLeftColResizePointerDown}
              onPointerMove={onLeftColResizePointerMove}
              onPointerUp={onLeftColResizePointerUp}
              onPointerCancel={onLeftColResizePointerUp}
            />
            <div className="relative min-h-[4.75rem] shrink-0 pr-1 sm:min-h-[4.5rem]" style={{ width: timelineWidthPx }}>
              {todayPct != null ? (
                <div
                  className="pointer-events-none absolute top-1.5 z-[60] flex flex-col items-center"
                  style={{ left: `${todayPct}%`, transform: "translateX(-50%)" }}
                >
                  <span className="mb-0.5 whitespace-nowrap rounded-md border px-1.5 py-px text-[9px] font-bold tabular-nums tracking-wide text-white shadow-[0_0_12px_rgba(79,70,229,0.3)] sm:px-2 sm:text-[10px] border-indigo-500/40 bg-indigo-600">
                    今天 {todayLabelDate}
                  </span>
                  <div className="h-3 w-0.5 rounded-full bg-indigo-500 shadow-[0_0_0_2px_rgba(255,255,255,1)]" />
                </div>
              ) : null}

              {planStartInRange && headerMarkerLayout && !headerMarkerLayout.hidePlanStartChip ? (
                <div
                  className="pointer-events-none absolute top-1.5 z-[59] flex flex-col items-center"
                  style={{
                    left: `${planStartPct}%`,
                    transform: `translateX(calc(-50% + ${headerMarkerLayout.planNudge}px))`,
                  }}
                >
                  <span className="mb-0.5 whitespace-nowrap rounded-md border px-1.5 py-px text-[9px] font-bold tabular-nums tracking-wide text-white shadow-[0_0_12px_rgba(16,185,129,0.35)] sm:px-2 sm:text-[10px] border-emerald-500/40 bg-emerald-600">
                    起始 {format(planStartD, axisDayFormat)}
                  </span>
                  <div className="h-3 w-0.5 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(255,255,255,1)]" />
                </div>
              ) : null}
              {deadlineInRange && headerMarkerLayout && !headerMarkerLayout.hideDeadlineChip ? (
                <div
                  className="pointer-events-none absolute top-1.5 z-[59] flex flex-col items-center"
                  style={{
                    left: `${deadlinePct}%`,
                    transform: `translateX(calc(-50% + ${headerMarkerLayout.deadNudge}px))`,
                  }}
                >
                  <span className="mb-0.5 whitespace-nowrap rounded-md border px-1.5 py-px text-[9px] font-bold tabular-nums tracking-wide text-white shadow-[0_0_12px_rgba(217,119,6,0.35)] sm:px-2 sm:text-[10px] border-amber-500/40 bg-amber-600">
                    截止 {format(deadlineD, axisDayFormat)}
                  </span>
                  <div className="h-3 w-0.5 rounded-full bg-amber-500 shadow-[0_0_0_2px_rgba(255,255,255,1)]" />
                </div>
              ) : null}

              <div className="pointer-events-none absolute bottom-[1.375rem] left-0 right-0 z-[2] h-3" aria-hidden>
                {tickOffsets.map((off) => {
                  const leftPct = (off / totalDays) * 100
                  return (
                    <div
                      key={`tick-${off}`}
                      className="absolute bottom-0 flex justify-center"
                      style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
                    >
                      <div className="h-2 w-px bg-slate-300/70" />
                    </div>
                  )
                })}
                {planStartInRange ? (
                  <div
                    className="absolute bottom-0 flex justify-center"
                    style={{ left: `${planStartPct}%`, transform: "translateX(-50%)" }}
                  >
                    <div className="h-3 w-px bg-emerald-500" />
                  </div>
                ) : null}
                {deadlineInRange ? (
                  <div
                    className="absolute bottom-0 flex justify-center"
                    style={{ left: `${deadlinePct}%`, transform: "translateX(-50%)" }}
                  >
                    <div className="h-3 w-px bg-amber-500" />
                  </div>
                ) : null}
                {todayPct != null ? (
                  <div
                    className="absolute bottom-0 flex justify-center"
                    style={{ left: `${todayPct}%`, transform: "translateX(-50%)" }}
                  >
                    <div className="h-4 w-px rounded-full bg-indigo-500 shadow-sm" />
                  </div>
                ) : null}
              </div>

              <div className="pointer-events-none absolute bottom-2 left-0 right-0 z-[1] h-4">
                {tickOffsets.map((off) => {
                  const d = addDays(minD, off)
                  if (planStartInRange && isSameDay(d, planStartD)) return null
                  if (deadlineInRange && isSameDay(d, deadlineD)) return null
                  const leftPct = (off / totalDays) * 100
                  return (
                    <div
                      key={`lbl-${off}`}
                      className="absolute bottom-0 flex justify-center leading-none"
                      style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
                    >
                      <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-700">
                        {format(d, axisDayFormat, { locale: zhCN })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ===== 表体：行容器 ===== */}
          <div className="relative">
            {/* 1. 背景网格层 (位于所有行之下) */}
            <div
              className={cn(
                "pointer-events-none absolute inset-0 z-0",
                animateEntrance && "animate-gantt-grid-layer-enter",
              )}
              style={{
                marginLeft: leftColPx + COLUMN_GUTTER_PX,
                width: timelineWidthPx,
                backgroundImage: gridBackgroundImage || undefined,
                ...(animateEntrance ? { animationDelay: "140ms" } : {}),
              }}
            >
              {/* 里程碑区间背景色 */}
              {milestoneSpans.map((seg) => {
                const off0 = differenceInCalendarDays(seg.start, minD)
                const spanDays = Math.max(1, differenceInCalendarDays(seg.end, seg.start) + 1)
                const left = Math.max(0, off0 / totalDays) * 100
                const width = Math.min(100 - left, (spanDays / totalDays) * 100)
                const theme = GANTT_THEMES[seg.idx % GANTT_THEMES.length]!
                return (
                  <div
                    key={`band-${seg.id}`}
                    className={cn("absolute top-0 bottom-0 opacity-40", theme.tint)}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                )
              })}
              {/* 今日红线 */}
              {todayPct != null ? (
                <div
                  className="absolute top-0 bottom-0 z-[10] w-px bg-indigo-500/80 shadow-[0_0_8px_rgba(79,70,229,0.4)]"
                  style={{ left: `${todayPct}%` }}
                />
              ) : null}
              {/* 起始线：与起始标签同色，贯穿图体 */}
              {planStartInRange ? (
                <div
                  className="absolute top-0 bottom-0 z-[10] w-px bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.35)]"
                  style={{ left: `${planStartPct}%` }}
                />
              ) : null}
              {/* 截止线：与截止标签同色，贯穿图体 */}
              {deadlineInRange ? (
                <div
                  className="absolute top-0 bottom-0 z-[10] w-px bg-amber-500/80 shadow-[0_0_8px_rgba(217,119,6,0.35)]"
                  style={{ left: `${deadlinePct}%` }}
                />
              ) : null}
            </div>

            {/* 2. 内容行：阶段概览行 */}
            <div
              className={cn(
                "group/row relative z-10 flex border-b border-slate-200/60",
                animateEntrance && "animate-goal-milestone-pop",
              )}
              style={animateEntrance ? { animationDelay: "165ms" } : undefined}
            >
              <div
                className={cn(
                  "sticky left-0 z-20 shrink-0 flex items-center bg-white/95 px-3 backdrop-blur-sm",
                  "shadow-[4px_0_12px_rgba(15,23,42,0.03)]"
                )}
                style={{ width: leftColPx, minWidth: leftColPx, minHeight: PHASE_ROW_H }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">阶段条</span>
              </div>
              <div
                aria-hidden
                className={cn(
                  "z-[56] shrink-0 cursor-col-resize touch-none select-none bg-slate-50/40 shadow-[inset_-1px_0_0_rgba(148,163,184,0.2)]",
                  leftColResizing && "bg-indigo-50/80",
                )}
                style={{ width: COLUMN_GUTTER_PX, minWidth: COLUMN_GUTTER_PX }}
                onPointerDown={onLeftColResizePointerDown}
                onPointerMove={onLeftColResizePointerMove}
                onPointerUp={onLeftColResizePointerUp}
                onPointerCancel={onLeftColResizePointerUp}
              />
              <div
                className="relative shrink-0 flex items-center pr-1"
                style={{ width: timelineWidthPx, minHeight: PHASE_ROW_H }}
              >
                {milestoneSpans.map((seg, segAnimIdx) => {
                  const off0 = differenceInCalendarDays(seg.start, minD)
                  const off1 = differenceInCalendarDays(seg.end, minD)
                  const left = Math.max(0, off0 / totalDays) * 100
                  const width = Math.max((off1 - off0 + 1) / totalDays, 1 / totalDays) * 100
                  const theme = GANTT_THEMES[seg.idx % GANTT_THEMES.length]!
                  return (
                    <div
                      key={`phase-${seg.id}`}
                      className={cn(
                        "pointer-events-none absolute top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-gradient-to-r opacity-95 shadow-sm ring-1 ring-white/50",
                        theme.phase,
                        animateEntrance && "animate-gantt-phase-pill-enter",
                      )}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        ...(animateEntrance
                          ? { animationDelay: `${190 + segAnimIdx * 68}ms` }
                          : {}),
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/30 via-transparent to-slate-900/[0.08]"
                        aria-hidden
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 3. 内容行：任务行 */}
            {rows.map((row, rowIndex) => {
              const offset = differenceInCalendarDays(row.start, minD)
              const leftPct = (offset / totalDays) * 100
              const widthPct = (row.span / totalDays) * 100
              const minBarPct = (1 / totalDays) * 100
              const prog = row.progress

              const theme = GANTT_THEMES[row.milestoneIdx % GANTT_THEMES.length]!

              const entranceDelayMs = 210 + Math.min(rowIndex, 24) * 48

              return (
                <div
                  key={row.id}
                  className={cn(
                    "group/row relative z-10 flex border-b border-slate-100 last:border-b-0 hover:bg-slate-50/30",
                    animateEntrance && "animate-goal-milestone-pop",
                  )}
                  style={animateEntrance ? { animationDelay: `${entranceDelayMs}ms` } : undefined}
                >
                  <div
                    className={cn(
                      "sticky left-0 z-20 shrink-0 flex flex-col justify-center bg-white/95 px-3 py-2.5 backdrop-blur-sm",
                      "shadow-[4px_0_12px_rgba(15,23,42,0.03)]"
                    )}
                    style={{ width: leftColPx, minWidth: leftColPx, minHeight: ROW_H }}
                  >
                    <p className="whitespace-normal break-words text-xs font-semibold leading-relaxed text-slate-800">
                      {row.title}
                    </p>
                    {row.milestoneTitle ? (
                      <p className="mt-1.5 line-clamp-2 flex items-center gap-1.5 text-[10px] leading-tight text-slate-400">
                        <span className="inline-flex h-3.5 min-w-[1.25rem] items-center justify-center rounded-sm bg-slate-100/80 px-1 text-[9px] font-bold text-slate-400 tabular-nums">
                          {row.milestoneIdx + 1}
                        </span>
                        {milestoneAbbrev(row.milestoneTitle)}
                      </p>
                    ) : null}
                  </div>
                  <div
                    aria-hidden
                    className={cn(
                      "z-[56] shrink-0 cursor-col-resize touch-none select-none self-stretch bg-slate-50/40 shadow-[inset_-1px_0_0_rgba(148,163,184,0.2)]",
                      leftColResizing && "bg-indigo-50/80",
                    )}
                    style={{ width: COLUMN_GUTTER_PX, minWidth: COLUMN_GUTTER_PX }}
                    onPointerDown={onLeftColResizePointerDown}
                    onPointerMove={onLeftColResizePointerMove}
                    onPointerUp={onLeftColResizePointerUp}
                    onPointerCancel={onLeftColResizePointerUp}
                  />
                  <div
                    className="relative shrink-0 flex items-center pr-1"
                    style={{ width: timelineWidthPx, minHeight: ROW_H }}
                  >
                    <div className="relative h-8 w-full">
                      <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "absolute top-1/2 h-8 min-w-[12px] -translate-y-1/2 cursor-pointer rounded-md",
                              theme.base,
                              "border",
                              theme.border,
                              "shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_2px_rgba(0,0,0,0.05)]",
                              "transition-[top,box-shadow,border-color,transform] duration-150 ease-out",
                              "hover:border-slate-400 hover:top-[calc(50%-0.5px)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.12),inset_0_1px_2px_rgba(0,0,0,0.05)]",
                              "group/bar",
                              animateEntrance && "animate-gantt-bar-enter",
                            )}
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(widthPct, minBarPct)}%`,
                              ...(animateEntrance
                                ? { animationDelay: `${entranceDelayMs + 35}ms` }
                                : {}),
                            }}
                          >
                            <div className="relative h-full w-full overflow-hidden rounded-[5px]">
                              <div
                                className={cn(
                                  "absolute inset-y-0 left-0 bg-gradient-to-r transition-[width,filter] duration-500 ease-out",
                                  prog >= 100 ? "rounded-[5px]" : "rounded-l-[5px] rounded-r-[2px]",
                                  theme.task,
                                  "group-hover/bar:brightness-110",
                                )}
                                style={{ width: `${prog}%` }}
                              />

                              {widthPct > 6 && prog > 0 && (
                                <span className={cn(
                                  "absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums pointer-events-none transition-colors",
                                  prog > 60 ? "text-white" : "text-slate-500"
                                )}>
                                  {Math.round(prog)}%
                                </span>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={10}
                          className={cn(
                            "z-50 w-64 max-w-[280px] rounded-xl border border-slate-200 bg-white/95 p-0 text-left text-slate-900 shadow-2xl backdrop-blur-md overflow-hidden [&>span]:!bg-white [&>span]:!fill-white [&>span]:ring-1 [&>span]:ring-slate-200",
                            "animate-in fade-in-0 zoom-in-95 data-[side=top]:slide-in-from-bottom-2",
                          )}
                        >
                          <div className="px-5 py-4">
                            <p className="break-words text-sm font-bold leading-tight text-slate-900 border-b border-slate-100 pb-3 mb-3 [text-wrap:wrap]">
                              {row.title}
                            </p>
                            
                            <div className="space-y-2.5 text-xs text-slate-600">
                              <div className="flex items-center justify-between gap-6">
                                <span className="text-slate-400 font-medium">计划周期</span>
                                <span className="font-semibold tabular-nums text-slate-800">
                                  {format(row.start, "MM.dd")} — {format(row.end, "MM.dd")}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-6">
                                <span className="text-slate-400 font-medium">持续时长</span>
                                <span className="font-bold tabular-nums text-slate-800">
                                  {row.span} 天
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-6">
                                <span className="text-slate-400 font-medium">当前进度</span>
                                <span className={cn("font-extrabold tabular-nums", theme.task.split(' ')[0].replace('from-', 'text-'))}>
                                  {Math.round(prog)}%
                                </span>
                              </div>
                            </div>
                          </div>

                          {row.milestoneTitle ? (
                            <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">关联里程碑</span>
                                <span className="text-[11px] font-semibold text-slate-500 leading-tight text-right line-clamp-2">
                                  {row.milestoneTitle}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
