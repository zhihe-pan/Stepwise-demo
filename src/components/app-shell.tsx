import { useEffect, useState, useTransition } from "react"
import { useNavigate } from "react-router-dom"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileBottomNav, MobileTopBar } from "@/components/mobile-chrome"
import { TodayPage } from "@/components/today-page"
import { DashboardPage } from "@/components/dashboard-page"
import { GoalsPage } from "@/components/goals-page"
import { AddGoalPage } from "@/components/add-goal-page"
import { EditGoalPage } from "@/components/edit-goal-page"
import { SettingsPage } from "@/components/settings-page"
import { DiaryPage } from "@/components/diary-page"
import type { Goal } from "@/lib/types"
import {
  createDiaryEntryAction,
  createGoalAction,
  updateGoalAction,
  updateProfileAction,
} from "@/app/actions/app"
import { useAppStore } from "@/store/app-store"

type Page = "dashboard" | "today" | "goals" | "diary" | "add-goal" | "edit-goal" | "settings"
type MainNavPage = "dashboard" | "today" | "goals" | "diary"

const mainNavPages: ReadonlySet<Page> = new Set(["dashboard", "today", "goals", "diary"])

const MOBILE_TITLE: Record<MainNavPage, string> = {
  dashboard: "总览",
  today: "今日",
  goals: "目标",
  diary: "日记",
}

function sortGoalsForClient(goals: Goal[]) {
  return goals
    .map((goal, index) => ({ goal, index }))
    .sort((a, b) => {
      const deadlineDiff =
        new Date(`${a.goal.deadline}T12:00:00`).getTime() - new Date(`${b.goal.deadline}T12:00:00`).getTime()
      if (deadlineDiff !== 0) return deadlineDiff
      return a.index - b.index
    })
    .map(({ goal }) => goal)
}

function formatTodaySubtitle(): string {
  const d = new Date()
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`
}

export function AppShell() {
  const user = useAppStore((s) => s.user)
  const goals = useAppStore((s) => s.goals)
  const diaryEntries = useAppStore((s) => s.diaryEntries)
  const logout = useAppStore((s) => s.logout)

  const [currentPage, setCurrentPage] = useState<Page>("today")
  const [localGoals, setLocalGoals] = useState<Goal[]>(() => goals)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [pageBeforeAddGoal, setPageBeforeAddGoal] = useState<Page>("today")
  const [, startTransition] = useTransition()
  const navigate = useNavigate()

  const refresh = () => {
    startTransition(() => {
      setLocalGoals(useAppStore.getState().goals)
    })
  }

  useEffect(() => {
    setLocalGoals(goals)
  }, [goals])

  const openAddGoal = () => {
    if (mainNavPages.has(currentPage)) {
      setPageBeforeAddGoal(currentPage)
    } else {
      setPageBeforeAddGoal("goals")
    }
    setCurrentPage("add-goal")
  }

  return (
    <div className="flex h-[100dvh] min-h-0 w-full max-w-[100vw] flex-col overflow-x-hidden bg-background md:flex-row">
      {currentPage !== "add-goal" && currentPage !== "edit-goal" && currentPage !== "settings" && (
        <AppSidebar
          currentPage={currentPage as MainNavPage}
          onNavigate={setCurrentPage}
          onAddGoal={openAddGoal}
          onOpenSettings={() => setCurrentPage("settings")}
          username={user.name ?? user.email ?? "Stepwise 用户"}
          avatarUrl={user.image ?? null}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {mainNavPages.has(currentPage) ? (
          <MobileTopBar
            title={MOBILE_TITLE[currentPage as MainNavPage]}
            subtitle={currentPage === "today" ? formatTodaySubtitle() : null}
            onOpenSettings={() => setCurrentPage("settings")}
          />
        ) : null}

        {currentPage === "dashboard" && (
          <DashboardPage
            goals={localGoals}
            username={user.name ?? undefined}
            onGoToday={() => setCurrentPage("today")}
          />
        )}
        {currentPage === "today" && (
          <TodayPage
            goals={localGoals}
            onAddGoal={openAddGoal}
            onDataRefresh={refresh}
            onEditGoal={(goal) => {
              setEditingGoal(goal)
              setCurrentPage("edit-goal")
            }}
          />
        )}
        {currentPage === "goals" && (
          <GoalsPage
            goals={localGoals}
            onDataRefresh={refresh}
            onEditGoal={(goal) => {
              setEditingGoal(goal)
              setCurrentPage("edit-goal")
            }}
            onAddDiaryEntry={async (entry) => {
              await createDiaryEntryAction(entry)
              refresh()
            }}
          />
        )}
        {currentPage === "diary" && (
          <DiaryPage goals={localGoals} entries={diaryEntries} onDataRefresh={refresh} />
        )}
        {currentPage === "add-goal" && (
          <AddGoalPage
            onBack={() => setCurrentPage(pageBeforeAddGoal)}
            onGoalCreated={async (goal) => {
              await createGoalAction(goal)
              setLocalGoals((current) => sortGoalsForClient([...current, goal]))
              refresh()
              setCurrentPage(pageBeforeAddGoal)
            }}
          />
        )}
        {currentPage === "edit-goal" && editingGoal && (
          <EditGoalPage
            goal={editingGoal}
            onBack={() => setCurrentPage("goals")}
            onSave={async (goal) => {
              await updateGoalAction(goal)
              setLocalGoals((current) =>
                sortGoalsForClient(current.map((item) => (item.id === goal.id ? goal : item))),
              )
              setEditingGoal(goal)
              refresh()
              setCurrentPage("goals")
            }}
          />
        )}
        {currentPage === "settings" && (
          <SettingsPage
            onBack={() => setCurrentPage("today")}
            onLogout={() => {
              logout()
              navigate("/login")
            }}
            email={user.email ?? ""}
            hasPassword={user.hasPassword}
            initialName={user.name ?? ""}
            initialAvatarUrl={user.image ?? null}
            onSaveProfile={async (data) => {
              await updateProfileAction(data)
              refresh()
            }}
          />
        )}
      </div>

      {mainNavPages.has(currentPage) ? (
        <MobileBottomNav
          currentPage={currentPage as MainNavPage}
          onNavigate={setCurrentPage}
          onAddGoal={openAddGoal}
        />
      ) : null}
    </div>
  )
}
