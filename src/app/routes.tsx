import type { ReactNode } from "react"
import { createHashRouter, Navigate } from "react-router-dom"
import { AppShell } from "@/components/app-shell"
import { LoginPage } from "@/components/login-page"
import { useAppStore } from "@/store/app-store"

function RequireAuth({ children }: { children: ReactNode }) {
  const authed = useAppStore((s) => s.isAuthenticated)
  if (!authed) return <Navigate to="/login" replace />
  return <>{children}</>
}

export const router = createHashRouter([
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
  },
  { path: "/login", element: <LoginPage githubEnabled={false} /> },
  { path: "*", element: <Navigate to="/" replace /> },
])
