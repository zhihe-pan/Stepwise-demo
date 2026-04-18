"use client"

import { LayoutDashboard, CalendarDays, Target, Plus, Settings, BookOpen } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AppSidebarProps {
  currentPage: "dashboard" | "today" | "goals" | "diary"
  onNavigate: (page: "dashboard" | "today" | "goals" | "diary") => void
  onAddGoal: () => void
  onOpenSettings: () => void
  username?: string
  avatarUrl?: string | null
}

const navItems = [
  { id: "dashboard" as const, label: "总览", icon: LayoutDashboard },
  { id: "today" as const, label: "今日", icon: CalendarDays },
  { id: "goals" as const, label: "目标", icon: Target },
  { id: "diary" as const, label: "日记", icon: BookOpen },
]

const frostedShell =
  "border border-slate-200 bg-white/90 shadow-sm shadow-slate-200/50 backdrop-blur-md"

function SidebarNav({
  currentPage,
  onNavigate,
  onAddGoal,
  onOpenSettings,
  username = "用户名",
  avatarUrl,
  className,
}: AppSidebarProps & { className?: string }) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", frostedShell, className)}>
      <div className="flex items-center gap-2 px-4 py-3.5 md:px-4 md:py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Target className="h-4 w-4" aria-hidden />
        </div>
        <span className="text-lg font-semibold tracking-tight text-slate-900">Stepwise</span>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 md:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0 ring-1 ring-slate-200">
            <AvatarImage src={avatarUrl || undefined} alt="用户头像" />
            <AvatarFallback className="bg-slate-100 text-sm text-slate-600">
              {username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-900">{username}</span>
            <span className="text-xs text-slate-500">免费版</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 text-slate-600 hover:bg-primary/10 md:h-8 md:w-8"
          onClick={onOpenSettings}
          aria-label="设置"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 md:py-3">
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors md:min-h-0",
                    "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900",
                    isActive && "bg-primary/10 text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full transition-colors",
                      isActive ? "bg-primary opacity-100" : "bg-primary opacity-0 hover:opacity-30",
                    )}
                    aria-hidden
                  />
                  <Icon
                    className={cn(
                      "relative h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-slate-500",
                    )}
                  />
                  <span className="relative">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-200 p-3 md:p-4">
        <Button
          type="button"
          onClick={onAddGoal}
          className="h-11 w-full gap-2 rounded-[10px] bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-[0_4px_14px_rgba(79,110,247,0.30)] md:h-10"
          size="lg"
        >
          <Plus className="h-4 w-4" />
          新建目标
        </Button>
      </div>
    </div>
  )
}

export function AppSidebar(props: AppSidebarProps) {
  return (
    <aside className="hidden h-full w-56 shrink-0 flex-col md:flex md:p-2.5 md:pl-3">
      <SidebarNav {...props} className="rounded-2xl" />
    </aside>
  )
}
