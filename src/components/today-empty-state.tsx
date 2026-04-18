"use client"

import { Button } from "@/components/ui/button"

function TodayEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="today-empty-a" x1="36" y1="24" x2="168" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary)" stopOpacity="0.4" />
          <stop offset="0.45" stopColor="var(--primary)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="today-empty-b" x1="100" y1="20" x2="100" y2="104" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary)" stopOpacity="0.12" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <rect x="28" y="28" width="144" height="64" rx="18" fill="url(#today-empty-b)" stroke="#e2e8f0" strokeWidth="1" />
      <path
        d="M52 56h56M52 72h40"
        stroke="#cbd5e1"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="138" cy="52" r="22" fill="url(#today-empty-a)" />
      <path
        d="M128 52l8 8 16-18"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <g opacity="0.5">
        <circle cx="56" cy="100" r="4" fill="var(--primary)" opacity="0.35" />
        <circle cx="72" cy="106" r="3" fill="var(--primary)" opacity="0.28" />
        <circle cx="86" cy="100" r="2.5" fill="var(--primary)" opacity="0.22" />
      </g>
    </svg>
  )
}

interface TodayEmptyStateProps {
  onNewGoal: () => void
}

export function TodayEmptyState({ onNewGoal }: TodayEmptyStateProps) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-8 text-center shadow-sm shadow-slate-200/40 sm:mt-10 sm:px-8 sm:py-10 dark:border-slate-700 dark:bg-slate-900/30">
      <div className="mx-auto flex max-w-[11rem] justify-center text-primary">
        <TodayEmptyIllustration className="h-auto w-full opacity-90" />
      </div>
      <h2 className="mt-5 text-balance text-[1.35rem] font-semibold leading-snug tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
        今天暂无待办
      </h2>
      <p className="mx-auto mt-3 max-w-md text-balance text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        新建目标或在「目标」页继续，今天要做的会出现在这里。
      </p>
      <Button
        type="button"
        className="mt-6 h-11 rounded-[10px] px-7 text-sm font-semibold shadow-sm hover:bg-primary/90 hover:shadow-[0_4px_14px_rgba(79,110,247,0.30)]"
        onClick={onNewGoal}
      >
        + 新建目标
      </Button>
    </div>
  )
}
