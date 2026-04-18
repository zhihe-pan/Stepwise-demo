"use client"

import { useState, useRef, useEffect, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  User,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  Check,
  Loader2,
  KeyRound,
  ShieldCheck,
  MonitorSmartphone,
  Sparkles,
} from "lucide-react"
import { deleteAccountAction } from "@/app/actions/app"
import { DELETE_ACCOUNT_CONFIRM_PHRASE } from "@/lib/delete-account"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { AvatarCropper } from "@/components/avatar-cropper"
import { cn } from "@/lib/utils"
import { RequiredFieldMark } from "@/components/goal-form-shared"

/** 与总览 / 日记等页一致的白底卡片 */
const surfaceCard = cn(
  "rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
)

/** 与目标/日记等内页区块标题一致：主标题 + 辅说明 */
function SettingsSectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-6 space-y-2 sm:mb-8">
      <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{title}</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
    </header>
  )
}

/** 卡片内分区小标题（避免全大写英文样式） */
function SettingsFieldGroupLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-medium text-slate-500">{children}</p>
}

function SettingsRowCard({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-5">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/80">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs leading-relaxed text-slate-600">{description}</p>
        </div>
      </div>
      <div className="shrink-0 sm:pl-2">{action}</div>
    </div>
  )
}

interface SettingsPageProps {
  onBack: () => void
  onLogout: () => void
  email: string
  /** 是否使用邮箱密码登录（有密码则需校验密码后删除） */
  hasPassword: boolean
  initialName: string
  initialAvatarUrl: string | null
  onSaveProfile: (data: { name: string; image: string | null }) => Promise<void>
}

export function SettingsPage({
  onBack,
  onLogout,
  email,
  hasPassword,
  initialName,
  initialAvatarUrl,
  onSaveProfile,
}: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<"profile" | "notifications" | "account">("profile")
  const [name, setName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(initialName)
    setAvatarUrl(initialAvatarUrl)
  }, [initialName, initialAvatarUrl])

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  const [dailyReminder, setDailyReminder] = useState(true)
  const [missedTaskAlert, setMissedTaskAlert] = useState(true)
  const [weeklyReport, setWeeklyReport] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState(true)

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""

    if (!file) return
    if (!file.type.startsWith("image/")) {
      alert("请选择图片文件")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("图片大小不能超过 5MB")
      return
    }

    setIsUploading(true)
    const url = URL.createObjectURL(file)
    setCropSourceUrl(url)
    setIsUploading(false)
  }

  const handleCropComplete = (croppedDataUrl: string) => {
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl)
      setCropSourceUrl(null)
    }
    setAvatarUrl(croppedDataUrl)
  }

  const handleCropCancel = () => {
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl)
      setCropSourceUrl(null)
    }
  }

  const phraseOk = deleteConfirmText === DELETE_ACCOUNT_CONFIRM_PHRASE
  const passwordOk = !hasPassword || deletePassword.length >= 8
  const canSubmitDelete = phraseOk && passwordOk

  const resetDeleteAccountForm = () => {
    setDeleteConfirmText("")
    setDeletePassword("")
    setDeleteError(null)
  }

  const handleDeleteAccountOpenChange = (open: boolean) => {
    setDeleteAccountOpen(open)
    if (!open) resetDeleteAccountForm()
  }

  const handleDeleteAccount = async () => {
    if (!canSubmitDelete) return
    setDeleteError(null)
    setIsDeletingAccount(true)
    try {
      const result = await deleteAccountAction({
        confirmation: deleteConfirmText,
        password: hasPassword ? deletePassword : undefined,
      })
      if (!result.ok) {
        setDeleteError(result.message)
        return
      }
      resetDeleteAccountForm()
      setDeleteAccountOpen(false)
      onLogout()
    } catch {
      setDeleteError("删除失败，请稍后再试")
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const handleSaveProfile = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setSaveError("用户名不能为空")
      return
    }
    setSaveError(null)
    setIsSaving(true)
    try {
      await onSaveProfile({ name: trimmed, image: avatarUrl })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaveError("保存失败，请检查网络或稍后再试")
    } finally {
      setIsSaving(false)
    }
  }

  const menuItems = [
    { id: "profile" as const, label: "个人资料", icon: User },
    { id: "notifications" as const, label: "通知设置", icon: Bell },
    { id: "account" as const, label: "账户安全", icon: Shield },
  ]

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col bg-transparent md:flex-row">
      {cropSourceUrl && (
        <AvatarCropper
          imageSrc={cropSourceUrl}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      <aside className="flex shrink-0 flex-col border-b border-slate-200/90 bg-white/90 backdrop-blur-sm md:h-full md:w-[17.5rem] md:border-b-0 md:border-r md:bg-slate-50/80">
        <div
          className="flex items-center gap-2 border-b border-slate-200/90 p-3 md:p-4 md:pt-4"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
        >
          <Button
            variant="ghost"
            onClick={onBack}
            className="h-10 gap-2 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 md:h-9"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            返回
          </Button>
        </div>

        <div className="p-3 md:p-4 md:pt-3">
          <h2 className="mb-1 text-sm font-semibold tracking-tight text-slate-800 md:mb-2">设置</h2>
          <p className="mb-3 text-xs leading-relaxed text-slate-500 md:mb-4">个人资料、通知与账户</p>
          <nav
            className="-mx-1 flex gap-1 overflow-x-auto pb-1 md:mx-0 md:flex-col md:space-y-1 md:overflow-visible md:pb-0"
            aria-label="设置分区"
          >
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors md:w-full md:justify-between",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15"
                      : "text-slate-600 hover:bg-white hover:text-slate-900 md:hover:shadow-sm",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    {item.label}
                  </span>
                  <ChevronRight
                    className={cn(
                      "hidden h-4 w-4 shrink-0 md:block",
                      isActive ? "text-primary" : "text-slate-300",
                    )}
                    aria-hidden
                  />
                </button>
              )
            })}
          </nav>
        </div>

        <div
          className="mt-auto border-t border-slate-200/90 p-3 md:p-4"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="h-11 w-full justify-start gap-3 text-rose-700 hover:bg-rose-50 hover:text-rose-800 md:h-10"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                退出登录
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="mx-4 max-w-[calc(100vw-2rem)]">
              <AlertDialogHeader>
                <AlertDialogTitle>确认退出登录?</AlertDialogTitle>
                <AlertDialogDescription>
                  退出后需要重新登录才能使用 Stepwise。你的数据会安全保存在云端。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                <AlertDialogCancel className="mt-0">取消</AlertDialogCancel>
                <AlertDialogAction onClick={onLogout}>确认退出</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain bg-slate-50/50 md:bg-slate-50/30">
        <div
          className="mx-auto min-w-0 max-w-2xl px-4 py-6 sm:px-6 sm:py-8 md:px-10"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))" }}
        >
          {activeSection === "profile" && (
            <div>
              <SettingsSectionHeader
                title="个人资料"
                description="头像与显示名会出现在侧栏与总览问候中；登录邮箱由账号体系决定，此处仅供查看。"
              />

              <div className={cn(surfaceCard, "overflow-hidden")}>
                <div className="border-b border-slate-100 px-4 py-5 sm:px-6 sm:py-6">
                  <SettingsFieldGroupLabel>头像与裁剪</SettingsFieldGroupLabel>
                  <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
                    <div className="relative shrink-0 self-start sm:self-center">
                      <Avatar className="h-24 w-24 border-2 border-slate-200/90 shadow-sm ring-1 ring-slate-100/80">
                        <AvatarImage src={avatarUrl || undefined} alt="头像" />
                        <AvatarFallback className="bg-slate-100 text-2xl font-semibold text-slate-500">
                          {(name.trim().charAt(0) || email.charAt(0) || "?").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        onClick={handleAvatarClick}
                        disabled={isUploading}
                        className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/85 text-white shadow-md ring-2 ring-white transition-colors hover:bg-slate-900 disabled:opacity-50 sm:h-9 sm:w-9"
                        aria-label="更换头像"
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Camera className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-medium text-slate-800">如何更换</p>
                      <p className="text-xs leading-relaxed text-slate-600">
                        支持 JPG、PNG，单张不超过 5MB。选择后可在裁剪器中拖动、缩放取景。
                      </p>
                      {avatarUrl ? (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl(null)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          恢复为默认字母头像
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
                  <div>
                    <SettingsFieldGroupLabel>显示名与邮箱</SettingsFieldGroupLabel>
                    <div className="mt-4 space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-sm font-medium text-slate-800">
                          用户名
                          <RequiredFieldMark />
                        </Label>
                        <Input
                          id="username"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="在侧栏与问候中展示的名称"
                          maxLength={40}
                          className="h-11 border-slate-200/90 bg-white md:h-10"
                        />
                        <p className="text-xs text-slate-500">还可输入 {40 - name.length} 字（最多 40 字）</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium text-slate-800">
                          登录邮箱
                        </Label>
                        <Input
                          id="email"
                          value={email || "—"}
                          disabled
                          readOnly
                          className="h-11 cursor-not-allowed border-slate-200 bg-slate-50/90 text-slate-600 md:h-10"
                        />
                        <p className="text-xs leading-relaxed text-slate-500">
                          {email
                            ? "与当前登录账号一致，暂不支持在应用内修改。"
                            : "当前为第三方登录，提供商可能未返回邮箱。"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {saveError ? (
                    <p className="rounded-lg border border-rose-200/80 bg-rose-50/50 px-3 py-2 text-sm font-medium text-rose-700">
                      {saveError}
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={isSaving || (name.trim() === initialName && avatarUrl === initialAvatarUrl)}
                        className="h-11 w-full gap-2 rounded-lg sm:h-10 sm:w-auto"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            保存中…
                          </>
                        ) : saved ? (
                          <>
                            <Check className="h-4 w-4" aria-hidden />
                            已保存
                          </>
                        ) : (
                          "保存更改"
                        )}
                      </Button>
                      {saved ? (
                        <span className="text-sm text-emerald-700">已写入当前会话，侧栏将随之更新。</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "notifications" && (
            <div>
              <SettingsSectionHeader
                title="通知设置"
                description="先在此勾选期望的提醒类型；真正发到邮箱或系统推送前，还需要完成渠道绑定（后续版本）。"
              />

              <div className={cn(surfaceCard, "overflow-hidden")}>
                <div className="border-b border-slate-100 border-l-[3px] border-l-primary/40 bg-gradient-to-r from-primary/[0.06] to-transparent px-4 py-3.5 sm:px-6">
                  <p className="text-xs leading-relaxed text-slate-700">
                    当前开关<strong className="font-semibold text-slate-800">仅保存在本浏览器会话</strong>
                    ，用于演示产品节奏；与账号云端同步将在后续接入。
                  </p>
                </div>
                <div className="divide-y divide-slate-100">
                  {(
                    [
                      {
                        id: "daily",
                        title: "每日任务提醒",
                        body: "每日固定时间汇总「今日」待办，避免遗漏。",
                        checked: dailyReminder,
                        set: setDailyReminder,
                        Icon: Bell,
                      },
                      {
                        id: "missed",
                        title: "未完成任务提醒",
                        body: "晚间轻量提醒仍未勾选的任务，便于收口一天。",
                        checked: missedTaskAlert,
                        set: setMissedTaskAlert,
                        Icon: Bell,
                      },
                      {
                        id: "weekly",
                        title: "每周进度报告",
                        body: "以周报形式回顾目标与里程碑（示意能力）。",
                        checked: weeklyReport,
                        set: setWeeklyReport,
                        Icon: Bell,
                      },
                      {
                        id: "ai",
                        title: "AI 规划与建议",
                        body: "与总览、今日中的建议类体验预留联动。",
                        checked: aiSuggestions,
                        set: setAiSuggestions,
                        Icon: Sparkles,
                      },
                    ] satisfies ReadonlyArray<{
                      id: string
                      title: string
                      body: string
                      checked: boolean
                      set: (v: boolean) => void
                      Icon: LucideIcon
                    }>
                  ).map((row) => {
                    const RowIcon = row.Icon
                    return (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-4"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3 pr-2">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200/80">
                          <RowIcon className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <Label className="text-sm font-semibold text-slate-900">{row.title}</Label>
                          <p className="text-xs leading-relaxed text-slate-600">{row.body}</p>
                        </div>
                      </div>
                      <Switch checked={row.checked} onCheckedChange={row.set} className="shrink-0" />
                    </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeSection === "account" && (
            <div>
              <SettingsSectionHeader
                title="账户安全"
                description="敏感操作将在此集中；删除账户会清除 Stepwise 内全部数据。"
              />

              <div className={cn(surfaceCard, "divide-y divide-slate-100 overflow-hidden")}>
                <SettingsRowCard
                  icon={KeyRound}
                  title="修改密码"
                  description="使用邮箱密码登录时可在此更换；当前版本入口尚在接入中。"
                  action={
                    <Button variant="outline" size="sm" className="h-9 border-slate-200/90" disabled>
                      即将开放
                    </Button>
                  }
                />
                <SettingsRowCard
                  icon={ShieldCheck}
                  title="两步验证"
                  description="为账号增加第二道验证，降低盗用风险。"
                  action={
                    <Button variant="outline" size="sm" className="h-9 border-slate-200/90" disabled>
                      即将开放
                    </Button>
                  }
                />
                <SettingsRowCard
                  icon={MonitorSmartphone}
                  title="登录设备"
                  description="查看已登录会话并在必要时退出其它设备。"
                  action={
                    <Button variant="outline" size="sm" className="h-9 border-slate-200/90" disabled>
                      即将开放
                    </Button>
                  }
                />
              </div>

              <div
                className={cn(
                  surfaceCard,
                  "mt-6 overflow-hidden border-rose-200/60 bg-rose-50/30 ring-1 ring-rose-100/80",
                )}
              >
                <div className="flex flex-col gap-4 border-l-[3px] border-l-rose-500 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-rose-900">删除账户</p>
                    <p className="text-xs leading-relaxed text-rose-800/90">
                      永久删除账号及目标、任务、日记等全部数据，且无法恢复。
                    </p>
                  </div>
                  <AlertDialog open={deleteAccountOpen} onOpenChange={handleDeleteAccountOpenChange}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 w-auto shrink-0 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive px-4"
                        >
                          删除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="mx-4 max-h-[min(90vh,32rem)] max-w-[calc(100vw-2rem)] overflow-y-auto">
                        <AlertDialogHeader>
                          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                            <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden />
                          </div>
                          <AlertDialogTitle className="text-center">删除账户</AlertDialogTitle>
                          <AlertDialogDescription className="text-center">
                            将永久删除当前账号及全部数据，且无法恢复。
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="space-y-4 py-2">
                          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                            <p className="font-medium text-foreground">删除后将会：</p>
                            <ul className="mt-2 space-y-1.5 text-muted-foreground">
                              <li className="flex gap-2">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-destructive" />
                                所有目标、任务、里程碑与执行记录
                              </li>
                              <li className="flex gap-2">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-destructive" />
                                日记与头像等个人资料
                              </li>
                              <li className="flex gap-2">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-destructive" />
                                邮箱密码或第三方登录绑定关系
                              </li>
                            </ul>
                          </div>

                          {hasPassword ? (
                            <div className="space-y-2">
                              <Label htmlFor="delete-account-password">当前登录密码</Label>
                              <Input
                                id="delete-account-password"
                                type="password"
                                autoComplete="current-password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                placeholder="输入密码以确认身份"
                                className="h-11 md:h-10"
                              />
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              你当前为第三方账号登录（未设置应用内密码），输入下方确认语后即可删除。
                            </p>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="delete-account-confirm">
                              请输入 <span className="font-medium text-foreground">{DELETE_ACCOUNT_CONFIRM_PHRASE}</span>
                            </Label>
                            <Input
                              id="delete-account-confirm"
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              placeholder={DELETE_ACCOUNT_CONFIRM_PHRASE}
                              className="h-11 md:h-10"
                              autoComplete="off"
                            />
                          </div>

                          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
                        </div>

                        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                          <AlertDialogCancel className="mt-0" disabled={isDeletingAccount}>
                            取消
                          </AlertDialogCancel>
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={!canSubmitDelete || isDeletingAccount}
                            onClick={() => void handleDeleteAccount()}
                            className="gap-2"
                          >
                            {isDeletingAccount ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                删除中…
                              </>
                            ) : (
                              "确认删除账户"
                            )}
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
