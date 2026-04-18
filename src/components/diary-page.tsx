"use client"

import { useState, useRef, useMemo, useTransition, useCallback } from "react"
import { format } from "date-fns"
import {
  Plus,
  Image as ImageIcon,
  X,
  Target,
  Smile,
  Meh,
  Frown,
  Heart,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  CalendarDays,
} from "lucide-react"
import { getBusinessTodayIso } from "@/lib/business-time"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { DiaryEntry, Goal } from "@/lib/mock-data"
import { createDiaryEntryAction, deleteDiaryEntryAction, updateDiaryEntryAction } from "@/app/actions/app"

/** 与总览 / 目标页一致的白底卡片 */
const surfaceCard = cn(
  "rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
)

/** 超过此数量时用下拉筛选，避免横向一排芯片过长 */
const DIARY_GOAL_FILTER_CHIP_MAX = 3
const DIARY_FILTER_ALL_VALUE = "__diary_filter_all__"

const moodOptions = [
  { id: "great" as const, label: "超棒", icon: Heart, color: "text-rose-500" },
  { id: "good" as const, label: "不错", icon: Smile, color: "text-success" },
  { id: "neutral" as const, label: "一般", icon: Meh, color: "text-warning" },
  { id: "bad" as const, label: "不好", icon: Frown, color: "text-muted-foreground" },
]

function getMoodInfo(mood?: string) {
  return moodOptions.find(m => m.id === mood) || moodOptions[2]
}

/** 撰写 / 内联编辑：单列 slim 元数据条（图片、目标、心情） */
function DiaryMetaBar({
  disabled,
  fileInputRef,
  onFileChange,
  goals,
  goalId,
  setGoalId,
  mood,
  setMood,
}: {
  disabled?: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  goals: Goal[]
  goalId: string | null
  setGoalId: (id: string | null) => void
  mood: DiaryEntry["mood"]
  setMood: (m: DiaryEntry["mood"]) => void
}) {
  const goal = goals.find((g) => g.id === goalId)
  const goalLabel = goal
    ? `${goal.emoji} ${goal.name.length > 9 ? `${goal.name.slice(0, 9)}…` : goal.name}`
    : "关联目标"
  const moodInfo = getMoodInfo(mood)
  const MoodIcon = moodInfo.icon

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFileChange}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-slate-600 hover:bg-slate-100/80 hover:text-slate-800"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="h-3.5 w-3.5" aria-hidden />
          <span className="text-xs">图片</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 max-w-[10rem] shrink-0 gap-1 px-2 text-slate-600 hover:bg-slate-100/80 hover:text-slate-800"
              disabled={disabled}
            >
              <Target className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-xs">{goalLabel}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setGoalId(null)}>
              <span className="text-slate-500">不关联</span>
            </DropdownMenuItem>
            {goals.map((g) => (
              <DropdownMenuItem key={g.id} onClick={() => setGoalId(g.id)}>
                {g.emoji} {g.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1 px-2 text-slate-600 hover:bg-slate-100/80 hover:text-slate-800"
              disabled={disabled}
            >
              <MoodIcon className={cn("h-3.5 w-3.5", moodInfo.color)} aria-hidden />
              <span className="text-xs">{moodInfo.label}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {moodOptions.map((opt) => {
              const Icon = opt.icon
              return (
                <DropdownMenuItem key={opt.id} onClick={() => setMood(opt.id)}>
                  <Icon className={cn("mr-2 h-4 w-4", opt.color)} />
                  {opt.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

interface DiaryPageProps {
  goals: Goal[]
  entries: DiaryEntry[]
  onDataRefresh?: () => void
}

function DiaryTimelineEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="diary-soft-a" x1="40" y1="20" x2="160" y2="140" gradientUnits="userSpaceOnUse">
          <stop stopColor="#93c5fd" stopOpacity="0.35" />
          <stop offset="1" stopColor="#a5b4fc" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="diary-soft-b" x1="100" y1="40" x2="100" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e0e7ff" />
          <stop offset="1" stopColor="#f8fafc" />
        </linearGradient>
      </defs>
      <rect x="24" y="28" width="152" height="104" rx="20" fill="url(#diary-soft-b)" stroke="#e2e8f0" strokeWidth="1.5" />
      <path
        d="M48 52h96M48 72h72M48 92h84"
        stroke="#cbd5e1"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="152" cy="48" r="22" fill="url(#diary-soft-a)" />
      <path
        d="M148 46l6 6 12-14"
        stroke="#4f46e5"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <circle cx="56" cy="118" r="6" fill="#bfdbfe" opacity="0.9" />
      <circle cx="76" cy="126" r="4" fill="#c7d2fe" opacity="0.85" />
    </svg>
  )
}

export function DiaryPage({ goals, entries, onDataRefresh }: DiaryPageProps) {
  const [composeOpen, setComposeOpen] = useState(false)
  const [newContent, setNewContent] = useState("")
  const [newImages, setNewImages] = useState<string[]>([])
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [selectedMood, setSelectedMood] = useState<DiaryEntry["mood"]>("good")
  const [filterGoalId, setFilterGoalId] = useState<string | null>(null)
  const [filterDateFrom, setFilterDateFrom] = useState<string | null>(null)
  const [filterDateTo, setFilterDateTo] = useState<string | null>(null)
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const [dateDraftFrom, setDateDraftFrom] = useState("")
  const [dateDraftTo, setDateDraftTo] = useState("")
  const [goalFilterOpen, setGoalFilterOpen] = useState(false)
  const [viewingImage, setViewingImage] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editImages, setEditImages] = useState<string[]>([])
  const [editGoalId, setEditGoalId] = useState<string | null>(null)
  const [editMood, setEditMood] = useState<DiaryEntry["mood"]>("good")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const isSavingEditRef = useRef(false)

  const filteredEntries = useMemo(() => {
    let list = entries
    if (filterGoalId) {
      list = list.filter((e) => e.goalId === filterGoalId)
    }
    if (filterDateFrom || filterDateTo) {
      list = list.filter((e) => {
        const key = format(new Date(e.createdAt), "yyyy-MM-dd")
        if (filterDateFrom && key < filterDateFrom) return false
        if (filterDateTo && key > filterDateTo) return false
        return true
      })
    }
    return list
  }, [entries, filterGoalId, filterDateFrom, filterDateTo])

  const hasActiveDateFilter = Boolean(filterDateFrom || filterDateTo)
  const hasActiveGoalFilter = filterGoalId != null
  const hasActiveFilters = hasActiveDateFilter || hasActiveGoalFilter

  const clearAllFilters = useCallback(() => {
    setFilterGoalId(null)
    setFilterDateFrom(null)
    setFilterDateTo(null)
    setDateDraftFrom("")
    setDateDraftTo("")
  }, [])

  const openDateFilterDialog = useCallback(() => {
    setDateDraftFrom(filterDateFrom ?? "")
    setDateDraftTo(filterDateTo ?? "")
    setDateFilterOpen(true)
  }, [filterDateFrom, filterDateTo])

  const applyDateFilter = useCallback(() => {
    let from = dateDraftFrom.trim() || null
    let to = dateDraftTo.trim() || null
    if (from && to && from > to) {
      const t = from
      from = to
      to = t
    }
    setFilterDateFrom(from)
    setFilterDateTo(to)
    setDateFilterOpen(false)
  }, [dateDraftFrom, dateDraftTo])

  const clearDateFilter = useCallback(() => {
    setFilterDateFrom(null)
    setFilterDateTo(null)
    setDateDraftFrom("")
    setDateDraftTo("")
    setDateFilterOpen(false)
  }, [])

  const setDatePresetDays = useCallback((days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (days - 1))
    setDateDraftFrom(format(start, "yyyy-MM-dd"))
    setDateDraftTo(format(end, "yyyy-MM-dd"))
  }, [])

  const todayKey = getBusinessTodayIso()
  const hasTodayEntry = filteredEntries.some(
    (e) => getBusinessTodayIso(new Date(e.createdAt)) === todayKey,
  )

  const sortedEntries = useMemo(
    () =>
      [...filteredEntries].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [filteredEntries],
  )

  const timelineGroups = useMemo(() => {
    const sorted = sortedEntries
    const groups: { dateKey: string; items: DiaryEntry[] }[] = []
    let lastKey = ""
    for (const e of sorted) {
      const k = format(new Date(e.createdAt), "yyyy-MM-dd")
      if (k !== lastKey) {
        groups.push({ dateKey: k, items: [] })
        lastKey = k
      }
      groups[groups.length - 1]!.items.push(e)
    }
    return groups
  }, [sortedEntries])

  const showTodayPromptCard = !hasTodayEntry && sortedEntries.length > 0

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const files = e.target.files
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader()
        reader.onload = (event) => {
          if (event.target?.result) {
            const dataUrl = event.target.result as string
            if (isEdit) {
              setEditImages(prev => [...prev, dataUrl])
            } else {
              setNewImages(prev => [...prev, dataUrl])
            }
          }
        }
        reader.readAsDataURL(file)
      })
    }
    // Reset input to allow re-uploading same file
    e.target.value = ""
  }

  const removeImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = useCallback(async () => {
    if (!newContent.trim() && newImages.length === 0) return
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setIsSubmitting(true)
    try {
      await createDiaryEntryAction({
        content: newContent,
        images: newImages,
        goalId: selectedGoalId,
        mood: selectedMood,
      })
      setNewContent("")
      setNewImages([])
      setSelectedGoalId(null)
      setSelectedMood("good")
      setComposeOpen(false)
      startTransition(() => {
        onDataRefresh?.()
      })
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }, [newContent, newImages, selectedGoalId, selectedMood, onDataRefresh])

  const handleDelete = (id: string) => {
    void (async () => {
      await deleteDiaryEntryAction(id)
      startTransition(() => {
        onDataRefresh?.()
      })
    })()
  }

  const handleStartEdit = (entry: DiaryEntry) => {
    setEditingEntry(entry)
    setEditContent(entry.content)
    setEditImages([...entry.images])
    setEditGoalId(entry.goalId)
    setEditMood(entry.mood || "good")
  }

  const handleCancelEdit = () => {
    setEditingEntry(null)
    setEditContent("")
    setEditImages([])
    setEditGoalId(null)
    setEditMood("good")
  }

  const handleSaveEdit = useCallback(async () => {
    if (!editingEntry) return
    if (!editContent.trim() && editImages.length === 0) return
    if (isSavingEditRef.current) return
    isSavingEditRef.current = true
    setIsSavingEdit(true)
    try {
      await updateDiaryEntryAction(editingEntry.id, {
        content: editContent,
        images: editImages,
        goalId: editGoalId,
        mood: editMood,
      })
      setEditingEntry(null)
      setEditContent("")
      setEditImages([])
      setEditGoalId(null)
      setEditMood("good")
      startTransition(() => {
        onDataRefresh?.()
      })
    } finally {
      isSavingEditRef.current = false
      setIsSavingEdit(false)
    }
  }, [editingEntry, editContent, editImages, editGoalId, editMood, onDataRefresh])

  const removeEditImage = (index: number) => {
    setEditImages(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      <header className="hidden shrink-0 border-b border-slate-200 bg-white/40 backdrop-blur-sm md:block">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-8 md:py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">日记</h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">回顾你的来时路</p>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div
          className="mx-auto box-border min-w-0 max-w-5xl space-y-6 px-4 py-4 md:space-y-8 md:px-8 md:py-8"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))" }}
        >
        {!hasTodayEntry && sortedEntries.length > 0 ? (
          <>
            {/* Desktop: motivational card with CTA merged in */}
            <div className="hidden md:block">
              <div className={cn(surfaceCard, "relative overflow-hidden")}>
                <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-[3px] bg-primary" aria-hidden />
                <div className="relative flex flex-col gap-4 bg-gradient-to-b from-[#EEF2FF]/35 via-white to-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0 pl-2 sm:pl-3">
                    <p className="text-[11px] font-medium text-slate-500">今日尚未记录</p>
                    <p className="mt-1 text-base font-semibold leading-snug tracking-tight text-slate-900">
                      记一句今天的进展
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">一句话即可，与总览、目标页的进度叙事衔接起来。</p>
                  </div>
                  <Button
                    type="button"
                    className="h-10 shrink-0 gap-2 self-start rounded-lg px-5 text-sm font-semibold shadow-sm sm:self-center"
                    disabled={isSubmitting}
                    onClick={() => setComposeOpen(true)}
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                    新建日记
                  </Button>
                </div>
              </div>
            </div>
            {/* Mobile: compact inline prompt */}
            <div
              className={cn(
                surfaceCard,
                "border-primary/20 bg-gradient-to-b from-primary/[0.04] to-white px-4 py-3.5 md:hidden",
              )}
              role="status"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">今天还没有记录</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">一句话即可，点右侧新建。</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 shrink-0 rounded-lg px-4 text-xs font-medium"
                  disabled={isSubmitting}
                  onClick={() => setComposeOpen(true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                  新建
                </Button>
              </div>
            </div>
          </>
        ) : null}

        {entries.length > 0 ? (
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3",
              showTodayPromptCard ? "mt-1.5" : "mt-0",
            )}
            role="toolbar"
            aria-label="筛选时间线"
          >
            <span className="shrink-0 text-[11px] font-medium tracking-tight text-slate-500">筛选</span>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-8 shrink-0 gap-1 rounded-lg border px-2 py-0 text-[11px] font-semibold leading-none shadow-none transition-colors",
                  "border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 text-slate-700",
                  "hover:border-slate-300/90 hover:from-slate-50 hover:to-slate-100/80 hover:text-slate-900",
                  hasActiveGoalFilter &&
                    "border-primary/35 bg-gradient-to-b from-primary/[0.14] to-primary/[0.06] text-primary hover:from-primary/[0.18] hover:to-primary/[0.1] hover:text-primary",
                )}
                aria-label="按目标筛选日记"
                onClick={() => setGoalFilterOpen(true)}
              >
                <Target className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                按目标
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-8 shrink-0 gap-1 rounded-lg border px-2 py-0 text-[11px] font-semibold leading-none shadow-none transition-colors",
                  "border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 text-slate-700",
                  "hover:border-slate-300/90 hover:from-slate-50 hover:to-slate-100/80 hover:text-slate-900",
                  hasActiveDateFilter &&
                    "border-primary/35 bg-gradient-to-b from-primary/[0.14] to-primary/[0.06] text-primary hover:from-primary/[0.18] hover:to-primary/[0.1] hover:text-primary",
                )}
                title={
                  hasActiveDateFilter && filterDateFrom && filterDateTo
                    ? `${filterDateFrom} ～ ${filterDateTo}`
                    : hasActiveDateFilter && filterDateFrom
                      ? `自 ${filterDateFrom} 起`
                      : hasActiveDateFilter && filterDateTo
                        ? `截至 ${filterDateTo}`
                        : undefined
                }
                aria-label="按日期筛选日记"
                onClick={openDateFilterDialog}
              >
                <CalendarDays className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                按日期
              </Button>
            </div>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 px-2 text-[11px] font-medium text-slate-500 hover:bg-slate-100/80 hover:text-slate-800"
                onClick={clearAllFilters}
              >
                清除
              </Button>
            ) : null}
          </div>
        ) : null}

        {sortedEntries.length === 0 ? (
          entries.length === 0 ? (
          <div className={cn(surfaceCard, "flex flex-col items-center px-4 py-12 text-center sm:py-14")}>
            <DiaryTimelineEmptyIllustration className="mx-auto mb-5 h-28 w-full max-w-[180px] text-slate-400" />
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">还没有日记</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">从一句话、一张图开始，之后会在时间线里按天聚合。</p>
            <Button
              type="button"
              size="sm"
              className="mt-6 h-10 gap-2 rounded-lg px-6 text-sm font-medium"
              disabled={isSubmitting}
              onClick={() => setComposeOpen(true)}
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
              新建日记
            </Button>
          </div>
          ) : (
            <div className={cn(surfaceCard, "flex flex-col items-center px-4 py-10 text-center sm:py-12")}>
              <CalendarDays className="mx-auto mb-3 h-10 w-10 text-slate-300" aria-hidden />
              <h2 className="text-base font-semibold tracking-tight text-slate-900">没有符合筛选条件的日记</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                试试放宽日期区间，或改为查看全部目标下的记录。
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-5 h-9 rounded-lg px-4 text-xs font-medium"
                onClick={clearAllFilters}
              >
                清除全部筛选
              </Button>
            </div>
          )
        ) : (
          <section className="mx-auto min-w-0 max-w-2xl" aria-label="日记时间线">
            <div className="relative">
              <div className="absolute bottom-0 left-[9px] top-4 w-px bg-slate-200/90" aria-hidden />
            {timelineGroups.map((group) => {
              const groupDate = new Date(group.dateKey + "T12:00:00")
              const now = new Date()
              const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
              const startGroup = new Date(groupDate.getFullYear(), groupDate.getMonth(), groupDate.getDate()).getTime()
              const dayDiff = Math.round((startToday - startGroup) / (1000 * 60 * 60 * 24))
              const dayLabel = dayDiff === 0 ? "今天" : dayDiff === 1 ? "昨天" : dayDiff === 2 ? "前天" : ""
              const fullLabel = `${groupDate.getMonth() + 1}月${groupDate.getDate()}日`
              return (
                <div key={group.dateKey} className="mb-8 last:mb-0">
                  <div className="relative mb-3 flex items-center gap-3 pl-0.5">
                    <div
                      className={cn(
                        "relative z-10 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white shadow-sm ring-2",
                        dayDiff === 0 ? "bg-primary ring-primary/25" : "bg-slate-300 ring-slate-100",
                      )}
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span
                        className={cn(
                          "text-sm font-semibold tracking-tight text-slate-900",
                          dayDiff === 0 && "text-primary",
                        )}
                      >
                        {fullLabel}
                      </span>
                      {dayLabel ? (
                        <span className="text-xs font-medium text-slate-500">{dayLabel}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="ml-6 space-y-4 sm:ml-7">
                    {group.items.map((entry) => {
                      if (editingEntry?.id === entry.id) {
                        return (
                          <article
                            key={entry.id}
                            className={cn(
                              surfaceCard,
                              "group border-primary/25 p-4 ring-1 ring-primary/15 sm:p-5",
                            )}
                          >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500">编辑中</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={isSavingEdit}
                        onClick={handleCancelEdit}
                      >
                        取消
                      </Button>
                    </div>
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      disabled={isSavingEdit}
                      className="min-h-[5rem] resize-none border-0 bg-slate-50/50 p-2 text-base leading-relaxed focus-visible:bg-white focus-visible:ring-1"
                      autoFocus
                    />
                    {editImages.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {editImages.map((img, index) => (
                          <div key={`edit-img-${index}`} className="relative">
                            <img src={img} alt="" className="h-14 w-14 rounded-xl object-cover" />
                            <button
                              type="button"
                              onClick={() => removeEditImage(index)}
                              className="absolute -right-1 -top-1 rounded-full bg-slate-900 p-0.5 text-white shadow"
                            >
                              <X className="h-2.5 w-2.5" aria-hidden />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                      <DiaryMetaBar
                        disabled={isPending || isSavingEdit}
                        fileInputRef={editFileInputRef}
                        onFileChange={(e) => handleImageUpload(e, true)}
                        goals={goals}
                        goalId={editGoalId}
                        setGoalId={setEditGoalId}
                        mood={editMood}
                        setMood={setEditMood}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-2 px-3 text-xs"
                        onClick={() => void handleSaveEdit()}
                        disabled={(!editContent.trim() && editImages.length === 0) || isPending || isSavingEdit}
                      >
                        {isSavingEdit ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : null}
                        {isSavingEdit ? "保存中..." : "保存"}
                      </Button>
                    </div>
                          </article>
                        )
                      }

                      const moodInfo = getMoodInfo(entry.mood)
                      const MoodIcon = moodInfo.icon
                      const entryTime = new Date(entry.createdAt)
                      const timeStr = `${entryTime.getHours().toString().padStart(2, "0")}:${entryTime.getMinutes().toString().padStart(2, "0")}`

                      return (
                        <article
                          key={entry.id}
                          className={cn(
                            surfaceCard,
                            "group p-4 transition-shadow sm:p-5",
                            "hover:shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]",
                          )}
                        >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                        <time
                          className="text-xs font-semibold tabular-nums text-slate-700"
                          dateTime={entry.createdAt}
                        >
                          {timeStr}
                        </time>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200/80 sm:text-xs",
                            moodInfo.color === "text-rose-500" && "bg-rose-50 text-rose-900 ring-rose-100",
                            moodInfo.color === "text-success" && "bg-emerald-50 text-emerald-900 ring-emerald-100",
                            moodInfo.color === "text-warning" && "bg-amber-50 text-amber-900 ring-amber-100",
                            moodInfo.color === "text-muted-foreground" && "bg-slate-100 text-slate-700",
                          )}
                        >
                          <MoodIcon className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", moodInfo.color)} aria-hidden />
                          {moodInfo.label}
                        </span>
                        {entry.goalName ? (
                          <span className="max-w-[min(100%,14rem)] truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80 sm:text-xs">
                            {goals.find((g) => g.id === entry.goalId)?.emoji} {entry.goalName}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          data-diary-action
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-slate-400 opacity-80 transition-opacity hover:bg-slate-100/80 hover:text-slate-600 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                          disabled={isPending}
                          aria-label="更多操作"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStartEdit(entry)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {entry.content.trim() ? (
                    <button
                      type="button"
                      className="mt-3 w-full rounded-lg text-left outline-none transition-colors hover:bg-slate-50/90 focus-visible:ring-2 focus-visible:ring-primary/25"
                      onClick={() => handleStartEdit(entry)}
                    >
                      <span className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 sm:text-[0.9375rem] sm:leading-relaxed">
                        {entry.content}
                      </span>
                    </button>
                  ) : entry.images.length > 0 ? (
                    <p className="mt-3 text-xs text-slate-500">（仅附图）</p>
                  ) : null}

                  {entry.images.length > 0 ? (
                    <div
                      className={cn(
                        "mt-3 grid gap-2 sm:mt-4",
                        entry.images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-2",
                      )}
                    >
                      {entry.images.map((img, index) => (
                        <div
                          key={`entry-${entry.id}-img-${index}`}
                          className="relative max-h-64 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80 sm:max-h-72"
                        >
                          <button
                            type="button"
                            className="block h-full w-full"
                            onClick={() => setViewingImage(img)}
                          >
                            <img
                              src={img}
                              alt=""
                              className="h-44 w-full object-cover sm:h-52"
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                        </article>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            </div>
          </section>
        )}
        </div>
      </main>

      <Dialog
        open={dateFilterOpen}
        onOpenChange={(open) => {
          setDateFilterOpen(open)
          if (open) {
            setDateDraftFrom(filterDateFrom ?? "")
            setDateDraftTo(filterDateTo ?? "")
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] gap-4 rounded-2xl border-slate-200/90 sm:max-w-md" showCloseButton>
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-semibold text-slate-900">按日期筛选</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              按日记发布时间（当天）限定时间线；留空一侧表示不限制该端。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 rounded-lg text-xs"
              onClick={() => setDatePresetDays(7)}
            >
              最近 7 天
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 rounded-lg text-xs"
              onClick={() => setDatePresetDays(30)}
            >
              最近 30 天
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-xs text-slate-600"
              onClick={() => {
                setDateDraftFrom("")
                setDateDraftTo("")
              }}
            >
              清空输入
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="diary-filter-date-from" className="text-xs font-medium text-slate-600">
                开始日期
              </Label>
              <Input
                id="diary-filter-date-from"
                type="date"
                value={dateDraftFrom}
                onChange={(e) => setDateDraftFrom(e.target.value)}
                className="h-10 rounded-xl border-slate-200/90 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="diary-filter-date-to" className="text-xs font-medium text-slate-600">
                结束日期
              </Label>
              <Input
                id="diary-filter-date-to"
                type="date"
                value={dateDraftTo}
                onChange={(e) => setDateDraftTo(e.target.value)}
                className="h-10 rounded-xl border-slate-200/90 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-lg"
              onClick={clearDateFilter}
            >
              清除日期条件
            </Button>
            <Button type="button" size="sm" className="rounded-lg" onClick={applyDateFilter}>
              应用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={goalFilterOpen} onOpenChange={setGoalFilterOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] gap-4 rounded-2xl border-slate-200/90 sm:max-w-md" showCloseButton>
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-semibold text-slate-900">按目标筛选</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              仅显示关联到所选目标的日记；选择「全部」可查看所有记录。
            </DialogDescription>
          </DialogHeader>
          {goals.length === 0 ? (
            <p className="text-sm text-slate-500">暂无目标，无法按目标筛选。创建目标并关联日记后即可使用。</p>
          ) : goals.length > DIARY_GOAL_FILTER_CHIP_MAX ? (
            <Select
              value={filterGoalId ?? DIARY_FILTER_ALL_VALUE}
              onValueChange={(v) => {
                setFilterGoalId(v === DIARY_FILTER_ALL_VALUE ? null : v)
                setGoalFilterOpen(false)
              }}
            >
              <SelectTrigger
                className={cn(
                  "h-10 w-full rounded-xl border-slate-200/90 bg-slate-50/60 text-left text-sm font-medium text-slate-800 shadow-none",
                  "hover:bg-slate-50 focus-visible:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:ring-offset-0",
                )}
              >
                <SelectValue placeholder="选择目标" />
              </SelectTrigger>
              <SelectContent
                className="max-h-[min(22rem,70vh)] rounded-xl border-slate-200/90"
                position="popper"
                sideOffset={6}
              >
                <SelectGroup>
                  <SelectLabel className="text-[11px] font-medium text-slate-400">范围</SelectLabel>
                  <SelectItem value={DIARY_FILTER_ALL_VALUE} className="rounded-lg py-2.5 text-sm">
                    全部日记
                  </SelectItem>
                </SelectGroup>
                <SelectSeparator className="my-1 bg-slate-100" />
                <SelectGroup>
                  <SelectLabel className="text-[11px] font-medium text-slate-400">按目标</SelectLabel>
                  {goals.map((goal) => (
                    <SelectItem
                      key={goal.id}
                      value={goal.id}
                      className="rounded-lg py-2.5 text-sm"
                      title={`${goal.emoji} ${goal.name}`}
                    >
                      {goal.emoji} {goal.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <div
              className="flex flex-wrap gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 ring-1 ring-slate-100/80"
              role="group"
              aria-label="选择目标"
            >
              <button
                type="button"
                onClick={() => {
                  setFilterGoalId(null)
                  setGoalFilterOpen(false)
                }}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                  filterGoalId === null
                    ? "bg-white text-primary shadow-sm ring-1 ring-primary/20"
                    : "text-slate-600 hover:bg-white/80",
                )}
              >
                全部
              </button>
              {goals.map((goal) => (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => {
                    setFilterGoalId(goal.id)
                    setGoalFilterOpen(false)
                  }}
                  className={cn(
                    "max-w-full min-w-0 truncate rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all sm:max-w-[13rem]",
                    filterGoalId === goal.id
                      ? "bg-white text-primary shadow-sm ring-1 ring-primary/20"
                      : "text-slate-600 hover:bg-white/80",
                  )}
                  title={`${goal.emoji} ${goal.name}`}
                >
                  {goal.emoji} {goal.name}
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setGoalFilterOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={composeOpen}
        onOpenChange={(open) => {
          if (!open && isSubmittingRef.current) return
          setComposeOpen(open)
          if (!open) {
            setNewContent("")
            setNewImages([])
            setSelectedGoalId(null)
            setSelectedMood("good")
          }
        }}
      >
        <DialogContent
          className={cn(
            "flex max-h-[min(92vh,44rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
            "max-sm:inset-x-0 max-sm:top-0 max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0",
          )}
        >
          <DialogHeader className="shrink-0 space-y-0 border-b border-slate-100 px-4 py-4 text-left sm:px-6">
            <DialogTitle className="text-lg font-semibold text-slate-900">新建日记</DialogTitle>
            <DialogDescription className="mt-1 text-sm font-normal leading-relaxed text-slate-600">
              写完后会进入时间线；列表页以阅读为主。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-6">
            <Textarea
              placeholder="今天完成了什么？"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              disabled={isSubmitting}
              className="min-h-[40vh] resize-none border-slate-200 bg-white text-base leading-relaxed placeholder:text-slate-400 focus-visible:ring-primary/25 sm:min-h-[12rem]"
              autoFocus
            />
            {newImages.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {newImages.map((img, index) => (
                  <div key={`new-img-${index}`} className="relative">
                    <img src={img} alt="" className="h-20 w-20 rounded-xl object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 p-1 text-white shadow"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="shrink-0 border-t border-slate-100 px-4 py-3 sm:px-6">
            <DiaryMetaBar
              disabled={isPending || isSubmitting}
              fileInputRef={fileInputRef}
              onFileChange={handleImageUpload}
              goals={goals}
              goalId={selectedGoalId}
              setGoalId={setSelectedGoalId}
              mood={selectedMood}
              setMood={setSelectedMood}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9"
                disabled={isSubmitting}
                onClick={() => setComposeOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="premiumCta"
                size="sm"
                className="h-9 px-5 gap-2"
                onClick={() => void handleSubmit()}
                disabled={
                  (!newContent.trim() && newImages.length === 0) || isPending || isSubmitting
                }
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
                {isSubmitting ? "发布中..." : "发布"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>查看图片</DialogTitle>
            <DialogDescription>查看日记图片的大图预览。</DialogDescription>
          </DialogHeader>
          {viewingImage && (
            <img
              src={viewingImage}
              alt="查看大图"
              className="h-auto w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
