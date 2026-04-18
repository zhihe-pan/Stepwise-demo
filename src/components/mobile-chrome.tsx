"use client"

import { LayoutDashboard, CalendarDays, Target, BookOpen, Settings, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type NavPage = "dashboard" | "today" | "goals" | "diary"

const tabs: { id: NavPage; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "总览", icon: LayoutDashboard },
  { id: "today", label: "今日", icon: CalendarDays },
  { id: "goals", label: "目标", icon: Target },
  { id: "diary", label: "日记", icon: BookOpen },
]

interface MobileTopBarProps {
  title: string
  subtitle?: string | null
  onOpenSettings: () => void
}

export function MobileTopBar({ title, subtitle, onOpenSettings }: MobileTopBarProps) {
  return (
    <header
      className="sticky top-0 z-40 shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur-md md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex h-12 items-center px-2">
        <div className="flex w-10 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-base font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex w-10 shrink-0 justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-slate-600 hover:bg-primary/10"
            onClick={onOpenSettings}
            aria-label="设置"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}

interface MobileBottomNavProps {
  currentPage: NavPage
  onNavigate: (page: NavPage) => void
  onAddGoal: () => void
}

export function MobileBottomNav({ currentPage, onNavigate, onAddGoal }: MobileBottomNavProps) {
  const leftTabs = tabs.slice(0, 2)
  const rightTabs = tabs.slice(2, 4)

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 overflow-visible border-t border-slate-200 bg-white/80 backdrop-blur-md md:hidden"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
      aria-label="主导航"
    >
      <div className="mx-auto flex max-w-lg items-end justify-between px-0.5 pt-0.5">
        <div className="flex min-w-0 flex-1">
          {leftTabs.map((tab) => {
            const Icon = tab.icon
            const active = currentPage === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onNavigate(tab.id)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[0.62rem] font-medium transition-colors",
                  active ? "text-primary" : "text-slate-500 hover:bg-slate-900/5 hover:text-slate-900",
                )}
              >
                <Icon className={cn("h-6 w-6 shrink-0", active && "text-primary")} strokeWidth={active ? 2.25 : 2} />
                <span className="truncate">{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="relative z-[51] flex shrink-0 flex-col items-center px-0.5 pb-1">
          <button
            type="button"
            onClick={onAddGoal}
            className={cn(
              "-mt-5 flex size-11 items-center justify-center rounded-2xl",
              "bg-primary text-primary-foreground shadow-[0_8px_24px_-4px_rgba(79,70,229,0.45)]",
              "ring-4 ring-white/95 transition active:scale-[0.96]",
            )}
            aria-label="新建目标"
          >
            <Plus className="h-6 w-6 shrink-0" strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex min-w-0 flex-1">
          {rightTabs.map((tab) => {
            const Icon = tab.icon
            const active = currentPage === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onNavigate(tab.id)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[0.62rem] font-medium transition-colors",
                  active ? "text-primary" : "text-slate-500 hover:bg-slate-900/5 hover:text-slate-900",
                )}
              >
                <Icon className={cn("h-6 w-6 shrink-0", active && "text-primary")} strokeWidth={active ? 2.25 : 2} />
                <span className="truncate">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
