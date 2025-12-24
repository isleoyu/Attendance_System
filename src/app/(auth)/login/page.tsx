"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { User, Lock, AlertCircle, CheckCircle2, Loader2, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

const REMEMBER_KEY = "attendance_remembered_employee"

export default function LoginPage() {
  const router = useRouter()
  const [employeeId, setEmployeeId] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Load remembered employee ID and trigger mount animation
  useEffect(() => {
    setMounted(true)
    const remembered = localStorage.getItem(REMEMBER_KEY)
    if (remembered) {
      setEmployeeId(remembered)
      setRememberMe(true)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        employeeId,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("員工編號或密碼錯誤")
        setIsLoading(false)
      } else {
        // Save or remove remembered employee ID
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, employeeId)
        } else {
          localStorage.removeItem(REMEMBER_KEY)
        }

        setIsSuccess(true)
        // Wait for success animation before redirect
        setTimeout(() => {
          router.push("/dashboard")
          router.refresh()
        }, 1000)
      }
    } catch (err) {
      setError("登入失敗，請稍後再試")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-blue-600 to-indigo-800">
        {/* Animated shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-blob" />
          <div className="absolute top-40 -left-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute -bottom-40 left-1/2 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl animate-blob animation-delay-4000" />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Login card */}
      <div
        className={cn(
          "relative w-full max-w-md",
          "transition-all duration-700 ease-out",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}
      >
        {/* Glass card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="relative px-8 pt-10 pb-8 text-center">
            {/* Logo icon */}
            <div
              className={cn(
                "mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-blue-600",
                "flex items-center justify-center shadow-lg shadow-primary/30",
                "transition-transform duration-500",
                mounted ? "scale-100 rotate-0" : "scale-50 rotate-12"
              )}
            >
              <Clock className="w-10 h-10 text-white" />
            </div>

            {/* Title */}
            <h1
              className={cn(
                "mt-6 text-2xl font-bold text-gray-900",
                "transition-all duration-500 delay-100",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              考勤打卡系統
            </h1>
            <p
              className={cn(
                "mt-2 text-gray-500",
                "transition-all duration-500 delay-200",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              請使用員工編號登入
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-10 space-y-6">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl animate-shake">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}

            {/* Success message */}
            {isSuccess && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl animate-fade-in">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className="text-sm text-green-600">登入成功！正在跳轉...</span>
              </div>
            )}

            {/* Employee ID input */}
            <div
              className={cn(
                "relative",
                "transition-all duration-500 delay-300",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className={cn(
                  "w-5 h-5 transition-colors",
                  employeeId ? "text-primary" : "text-gray-400"
                )} />
              </div>
              <input
                id="employee-id"
                name="employeeId"
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={isLoading || isSuccess}
                className={cn(
                  "block w-full pl-12 pr-4 py-4",
                  "bg-gray-50 border-2 border-gray-100 rounded-xl",
                  "text-gray-900 placeholder-gray-400",
                  "transition-all duration-200",
                  "focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  "outline-none"
                )}
                placeholder="員工編號"
              />
            </div>

            {/* Password input */}
            <div
              className={cn(
                "relative",
                "transition-all duration-500 delay-400",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className={cn(
                  "w-5 h-5 transition-colors",
                  password ? "text-primary" : "text-gray-400"
                )} />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isSuccess}
                className={cn(
                  "block w-full pl-12 pr-4 py-4",
                  "bg-gray-50 border-2 border-gray-100 rounded-xl",
                  "text-gray-900 placeholder-gray-400",
                  "transition-all duration-200",
                  "focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  "outline-none"
                )}
                placeholder="密碼"
              />
            </div>

            {/* Remember me switch */}
            <div
              className={cn(
                "flex items-center justify-between",
                "transition-all duration-500 delay-[450ms]",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <span className="text-sm text-gray-600">記住帳號</span>
              <button
                type="button"
                role="switch"
                aria-checked={rememberMe}
                onClick={() => setRememberMe(!rememberMe)}
                disabled={isLoading || isSuccess}
                className={cn(
                  "relative inline-flex h-7 w-12 items-center rounded-full",
                  "transition-colors duration-300 ease-in-out",
                  "focus:outline-none focus:ring-4 focus:ring-primary/10",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  rememberMe ? "bg-primary" : "bg-gray-200"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 rounded-full bg-white shadow-md",
                    "transform transition-transform duration-300 ease-in-out",
                    rememberMe ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            {/* Submit button */}
            <div
              className={cn(
                "transition-all duration-500 delay-500",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <button
                type="submit"
                disabled={isLoading || isSuccess}
                className={cn(
                  "relative w-full py-4 px-6 rounded-xl",
                  "font-semibold text-lg text-white",
                  "bg-gradient-to-r from-primary to-blue-600",
                  "shadow-lg shadow-primary/30",
                  "transition-all duration-300",
                  "hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5",
                  "active:translate-y-0 active:shadow-md",
                  "disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg",
                  "overflow-hidden"
                )}
              >
                {/* Button content */}
                <span className={cn(
                  "flex items-center justify-center gap-2 transition-all duration-300",
                  isLoading || isSuccess ? "opacity-0" : "opacity-100"
                )}>
                  登入
                </span>

                {/* Loading state */}
                {isLoading && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </span>
                )}

                {/* Success state */}
                {isSuccess && (
                  <span className="absolute inset-0 flex items-center justify-center animate-scale-bounce">
                    <CheckCircle2 className="w-6 h-6" />
                  </span>
                )}
              </button>
            </div>
          </form>

        </div>

        {/* Bottom decoration */}
        <div
          className={cn(
            "mt-8 text-center text-white/70 text-sm",
            "transition-all duration-500 delay-700",
            mounted ? "opacity-100" : "opacity-0"
          )}
        >
          <p>© 2026 Created by Leo</p>
        </div>
      </div>
    </div>
  )
}
