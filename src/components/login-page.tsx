"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Github, Loader2, Lock, Mail, Target, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"

interface LoginPageProps {
  githubEnabled: boolean
}

/** 展示站预填：任意非空密码即可登录，满足注册页「至少 8 位」规则 */
const SHOWCASE_EXAMPLE_EMAIL = "you@example.com"
const SHOWCASE_EXAMPLE_PASSWORD = "stepwise-demo"

const loginInputClassName = cn(
  "h-11 border border-slate-200 bg-white/85 shadow-sm transition-all duration-200",
  "placeholder:text-slate-500 dark:placeholder:text-slate-400",
  "focus-visible:border-primary/35 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0",
)

export function LoginPage({ githubEnabled }: LoginPageProps) {
  const navigate = useNavigate()
  const signInDemo = useAppStore((s) => s.signInDemo)
  const registerDemo = useAppStore((s) => s.registerDemo)

  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState(SHOWCASE_EXAMPLE_EMAIL)
  const [password, setPassword] = useState(SHOWCASE_EXAMPLE_PASSWORD)
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (isLogin) {
      if (!email.trim()) {
        setError("请输入邮箱地址")
        return
      }
      if (!password) {
        setError("请输入密码")
        return
      }
      setIsSubmitting(true)
      try {
        signInDemo({ email: email.trim(), password })
        navigate("/")
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    setIsSubmitting(true)
    try {
      const registration = registerDemo({
        name: username,
        email: email.trim(),
        password,
      })

      if (!registration.ok) {
        setError(registration.message ?? "注册失败，请稍后重试")
        return
      }

      setError(null)
      setSuccess(registration.message ?? "注册成功，现在可以直接登录。")
      setPassword(SHOWCASE_EXAMPLE_PASSWORD)
      setIsLogin(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-svh overflow-hidden">
      {/* 轻盈 mesh：顶区品牌色相晕开，不抢眼 */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_-25%,rgb(239_246_255),rgb(248_250_252),white)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_5%_10%,rgb(99_102_241_/_0.11),transparent_55%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_75%_50%_at_95%_85%,rgb(37_99_235_/_0.09),transparent_52%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.35] bg-[linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px)] bg-[length:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_28%,transparent_78%)]"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-svh w-full flex-col lg:flex-row">
        <div className="relative hidden overflow-hidden lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12">
          <div
            className="absolute inset-0 bg-gradient-to-br from-primary-from via-primary-to to-slate-950"
            style={{ opacity: 0.97 }}
            aria-hidden
          />
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" aria-hidden />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 shadow-lg ring-1 ring-white/20 backdrop-blur-sm">
              <Target className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-white">Stepwise</span>
          </div>

          <div className="relative space-y-6">
            <h1 className="text-balance text-4xl font-bold leading-tight text-white">
              把长期目标拆解为
              <br />
              每日可执行任务
            </h1>
            <p className="max-w-md text-lg text-white/85">AI智能规划，让每一天都有明确的行动方向。</p>
          </div>

          <p className="relative text-sm text-white/55">&copy; 2026 Stepwise. All rights reserved.</p>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center px-4 py-6 sm:p-10">
          <div className="w-full min-w-0 max-w-md space-y-4 sm:space-y-5">
            <div className="text-center lg:hidden">
              <div className="flex justify-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-from to-primary-to shadow-lg shadow-primary/25">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <span className="self-center text-xl font-semibold text-slate-800">Stepwise</span>
              </div>
            </div>
            <div
              className={cn(
                "w-full min-w-0 space-y-6 rounded-[2rem] border border-white/40 bg-white/80 p-5 shadow-[0_25px_50px_-12px_rgb(0_0_0_/_0.12),0_0_0_1px_rgb(255_255_255_/_0.6)_inset] backdrop-blur-xl sm:space-y-8 sm:p-10",
              )}
            >
              <div className="space-y-2 text-center lg:text-left">
                <h2 className="text-2xl font-bold text-slate-900">{isLogin ? "欢迎回来" : "创建账户"}</h2>
                <p className="text-slate-500">
                  {isLogin
                    ? "登录以继续你的目标之旅"
                    : "注册后即可直接用邮箱和密码登录，所有目标和日记都会归属于你的账号。"}
                </p>
              </div>

              {success ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-800">{success}</p>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-700">
                    用户名
                    <span className="ml-1 text-red-500" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="输入你的用户名"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required={!isLogin}
                      className={cn("pl-10", loginInputClassName)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">
                  邮箱地址
                  <span className="ml-1 text-red-500" aria-hidden="true">
                    *
                  </span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn("pl-10", loginInputClassName)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">
                  密码
                  <span className="ml-1 text-red-500" aria-hidden="true">
                    *
                  </span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={isLogin ? "输入密码" : "至少 8 位密码"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn("pl-10", loginInputClassName)}
                    required
                  />
                </div>
              </div>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}

              <Button
                type="submit"
                variant="premiumCta"
                className="h-12 w-full rounded-xl text-base"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
                {isLogin ? "登录" : "注册"}
              </Button>
              </form>

              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white/85 px-2 text-slate-500 backdrop-blur-sm">或者</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2 bg-white/70"
                  disabled={!githubEnabled || isSubmitting}
                  onClick={() => setError("当前环境未接入 GitHub OAuth 登录。")}
                >
                  <Github className="h-4 w-4" />
                  {githubEnabled ? "使用 GitHub 登录" : "配置 GitHub Key 后可启用 GitHub 登录"}
                </Button>

                <p className="text-center text-sm text-slate-600">
                  {isLogin ? "还没有账户？" : "已经有账户了？"}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin((prev) => !prev)
                      setError(null)
                      setSuccess(null)
                    }}
                    className="text-link-brand ml-1"
                  >
                    {isLogin ? "去注册" : "去登录"}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
