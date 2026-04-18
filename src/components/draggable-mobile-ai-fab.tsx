"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const FAB_PX = 56
const MARGIN = 8
const DRAG_THRESHOLD_PX = 10

function clampFabTop(top: number) {
  if (typeof window === "undefined") return top
  const h = window.innerHeight
  return Math.min(Math.max(MARGIN, top), h - FAB_PX - MARGIN)
}

function defaultFabTop() {
  if (typeof window === "undefined") return 0
  const h = window.innerHeight
  return clampFabTop(h / 2 - FAB_PX / 2)
}

type DragSession = {
  pointerId: number
  startClientY: number
  originTop: number
  moved: boolean
}

type DraggableMobileAiFabProps = {
  onOpen: () => void
  /** 区分创建/编辑页，避免互相覆盖位置记忆 */
  storageKey?: string
  className?: string
}

export function DraggableMobileAiFab({
  onOpen,
  storageKey = "stepwise-wizard-ai-fab-pos",
  className,
}: DraggableMobileAiFabProps) {
  const [mounted, setMounted] = useState(false)
  const [top, setTop] = useState<number | null>(null)
  const dragRef = useRef<DragSession | null>(null)
  const topRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    setMounted(true)
    if (typeof window === "undefined") return
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const p = JSON.parse(raw) as { top?: number }
        if (typeof p.top === "number") {
          const nextTop = clampFabTop(p.top)
          topRef.current = nextTop
          setTop(nextTop)
          return
        }
      }
    } catch {
      /* ignore */
    }
    const nextTop = defaultFabTop()
    topRef.current = nextTop
    setTop(nextTop)
  }, [storageKey])

  const persist = useCallback(
    (nextTop: number) => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ top: nextTop }))
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  )

  const onResize = useCallback(() => {
    setTop((t) => {
      if (t == null) return t
      const nextTop = clampFabTop(t)
      topRef.current = nextTop
      return nextTop
    })
  }, [])

  useEffect(() => {
    if (!mounted) return
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [mounted, onResize])

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      pointerId: e.pointerId,
      startClientY: e.clientY,
      originTop: rect.top,
      moved: false,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.pointerId) return
    const dy = e.clientY - d.startClientY
    if (Math.abs(dy) > DRAG_THRESHOLD_PX) d.moved = true
    const nextTop = clampFabTop(d.originTop + dy)
    topRef.current = nextTop
    setTop(nextTop)
  }

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.pointerId) return
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const moved = d.moved
    const finalTop = topRef.current
    if (moved && finalTop != null) persist(finalTop)
    if (!moved) onOpen()
  }

  if (!mounted || top == null) return null

  return (
    <button
      type="button"
      aria-label="打开 AI 助手（吸附右侧）"
      className={cn(
        "fixed z-40 flex h-14 w-14 cursor-grab touch-none select-none items-center justify-center rounded-full border border-white/80 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/25 active:cursor-grabbing lg:hidden",
        className,
      )}
      style={{
        right: MARGIN + 8,
        top,
        left: "auto",
        bottom: "auto",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={() => {
        dragRef.current = null
      }}
    >
      <Sparkles className="pointer-events-none h-6 w-6" aria-hidden />
    </button>
  )
}
