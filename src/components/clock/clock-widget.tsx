"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Clock, MapPin, Calendar, Timer, Coffee, Briefcase } from "lucide-react"
import { ClockState, ClockAction, ClockStateLabels, ClockActionLabels } from "@/lib/attendance/state-machine"
import { formatTime, formatDateTime, minutesToHoursMinutes } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "./confirm-dialog"
import { SuccessAnimation } from "./success-animation"

interface AttendanceData {
  state: ClockState
  availableActions: Array<{
    action: ClockAction
    allowed: boolean
    reason?: string
  }>
  attendance: {
    id: string
    clockIn: string
    clockOut: string | null
    status: string
    netWorkMinutes: number | null
    breakMinutes: number | null
    breaks: Array<{
      id: string
      startTime: string
      endTime: string | null
      type: string
      durationMinutes: number | null
    }>
  } | null
  schedule: {
    shiftType: {
      name: string
      startTime: string
      endTime: string
    }
  } | null
  store: {
    id: string
    name: string
  }
}

async function fetchTodayAttendance(): Promise<AttendanceData> {
  const res = await fetch("/api/attendance/today")
  if (!res.ok) throw new Error("Failed to fetch attendance")
  return res.json()
}

async function clockAction(action: string, storeId?: string) {
  const endpoints: Record<string, string> = {
    [ClockAction.CLOCK_IN]: "/api/attendance/clock-in",
    [ClockAction.CLOCK_OUT]: "/api/attendance/clock-out",
    [ClockAction.START_BREAK]: "/api/attendance/break/start",
    [ClockAction.END_BREAK]: "/api/attendance/break/end",
  }

  const endpoint = endpoints[action]
  if (!endpoint) throw new Error("Invalid action")

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "操作失敗")
  return data
}

// Separate time display component to minimize re-renders
function LiveClock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="text-center">
      <div className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight">
        {formatTime(time)}
      </div>
      <div className="text-base sm:text-lg opacity-80 mt-1">
        {time.toLocaleDateString("zh-TW", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>
    </div>
  )
}

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
      <div className="bg-gradient-to-br from-primary to-primary/80 px-6 py-8">
        <div className="h-12 bg-white/20 rounded-lg w-48 mx-auto mb-4" />
        <div className="h-6 bg-white/20 rounded w-64 mx-auto" />
      </div>
      <div className="p-6 space-y-4">
        <div className="h-20 bg-gray-200 rounded-xl" />
        <div className="h-16 bg-gray-200 rounded-xl" />
        <div className="h-14 bg-gray-200 rounded-xl" />
      </div>
    </div>
  )
}

// Status badge component
function StatusBadge({ state }: { state: ClockState }) {
  const config = useMemo(() => {
    switch (state) {
      case ClockState.WORKING:
        return {
          bg: "bg-green-100",
          text: "text-green-700",
          border: "border-green-300",
          icon: Briefcase,
          pulse: true,
        }
      case ClockState.ON_BREAK:
        return {
          bg: "bg-yellow-100",
          text: "text-yellow-700",
          border: "border-yellow-300",
          icon: Coffee,
          pulse: true,
        }
      case ClockState.CLOCKED_OUT:
        return {
          bg: "bg-gray-100",
          text: "text-gray-700",
          border: "border-gray-300",
          icon: Clock,
          pulse: false,
        }
      default:
        return {
          bg: "bg-blue-100",
          text: "text-blue-700",
          border: "border-blue-300",
          icon: Clock,
          pulse: false,
        }
    }
  }, [state])

  const Icon = config.icon

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-full",
        "text-sm font-semibold border-2",
        "transition-all duration-300 animate-status-change",
        config.bg,
        config.text,
        config.border
      )}
    >
      <Icon className={cn("w-4 h-4", config.pulse && "animate-pulse")} />
      {ClockStateLabels[state]}
    </div>
  )
}

// Action button component with mobile-optimized styling
function ActionButton({
  action,
  onClick,
  disabled,
}: {
  action: ClockAction
  onClick: () => void
  disabled: boolean
}) {
  const config = useMemo(() => {
    switch (action) {
      case ClockAction.CLOCK_IN:
        return {
          bg: "bg-gradient-to-r from-green-500 to-emerald-600",
          hoverBg: "hover:from-green-600 hover:to-emerald-700",
          activeBg: "active:from-green-700 active:to-emerald-800",
          shadow: "shadow-green-500/30",
          icon: "☀️",
        }
      case ClockAction.CLOCK_OUT:
        return {
          bg: "bg-gradient-to-r from-red-500 to-rose-600",
          hoverBg: "hover:from-red-600 hover:to-rose-700",
          activeBg: "active:from-red-700 active:to-rose-800",
          shadow: "shadow-red-500/30",
          icon: "🌙",
        }
      case ClockAction.START_BREAK:
        return {
          bg: "bg-gradient-to-r from-yellow-500 to-orange-500",
          hoverBg: "hover:from-yellow-600 hover:to-orange-600",
          activeBg: "active:from-yellow-700 active:to-orange-700",
          shadow: "shadow-yellow-500/30",
          icon: "☕",
        }
      case ClockAction.END_BREAK:
        return {
          bg: "bg-gradient-to-r from-blue-500 to-indigo-600",
          hoverBg: "hover:from-blue-600 hover:to-indigo-700",
          activeBg: "active:from-blue-700 active:to-indigo-800",
          shadow: "shadow-blue-500/30",
          icon: "💪",
        }
      default:
        return {
          bg: "bg-gradient-to-r from-gray-500 to-gray-600",
          hoverBg: "hover:from-gray-600 hover:to-gray-700",
          activeBg: "active:from-gray-700 active:to-gray-800",
          shadow: "shadow-gray-500/30",
          icon: "⏰",
        }
    }
  }, [action])

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ClockActionLabels[action]}
      className={cn(
        "w-full py-5 px-6 rounded-2xl",
        "text-white text-lg font-bold",
        "shadow-lg",
        "transition-all duration-200 ease-out",
        "touch-feedback",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
        "flex items-center justify-center gap-3",
        config.bg,
        config.hoverBg,
        config.activeBg,
        config.shadow,
        "hover:shadow-xl hover:-translate-y-0.5",
        "active:translate-y-0 active:shadow-md"
      )}
    >
      <span className="text-2xl">{config.icon}</span>
      <span>{ClockActionLabels[action]}</span>
    </button>
  )
}

// Work duration display
function WorkDuration({
  clockIn,
  breakMinutes,
  state,
}: {
  clockIn: string
  breakMinutes: number
  state: ClockState
}) {
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const calculateDuration = () => {
      const now = new Date()
      const start = new Date(clockIn)
      const totalMinutes = Math.floor((now.getTime() - start.getTime()) / (1000 * 60))
      setDuration(totalMinutes - breakMinutes)
    }

    calculateDuration()
    const timer = setInterval(calculateDuration, 60000) // Update every minute
    return () => clearInterval(timer)
  }, [clockIn, breakMinutes])

  if (state !== ClockState.WORKING) return null

  return (
    <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
          <Timer className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <div className="text-sm text-green-600 font-medium">工作時間</div>
          <div className="text-xs text-green-500">不含休息</div>
        </div>
      </div>
      <div className="text-2xl font-bold text-green-700 tabular-nums">
        {minutesToHoursMinutes(duration)}
      </div>
    </div>
  )
}

// Break duration display
function BreakDuration({ startTime }: { startTime: string }) {
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const calculateDuration = () => {
      const now = new Date()
      const start = new Date(startTime)
      setDuration(Math.floor((now.getTime() - start.getTime()) / (1000 * 60)))
    }

    calculateDuration()
    const timer = setInterval(calculateDuration, 1000)
    return () => clearInterval(timer)
  }, [startTime])

  return (
    <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl border border-yellow-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center animate-pulse">
          <Coffee className="w-5 h-5 text-yellow-600" />
        </div>
        <div>
          <div className="text-sm text-yellow-600 font-medium">休息中</div>
          <div className="text-xs text-yellow-500">休息時間計算中...</div>
        </div>
      </div>
      <div className="text-2xl font-bold text-yellow-700 tabular-nums">
        {duration} 分鐘
      </div>
    </div>
  )
}

export function ClockWidget() {
  const queryClient = useQueryClient()

  // Dialog states
  const [confirmAction, setConfirmAction] = useState<ClockAction | null>(null)
  const [successAction, setSuccessAction] = useState<ClockAction | null>(null)
  const [successTimestamp, setSuccessTimestamp] = useState<Date | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["todayAttendance"],
    queryFn: fetchTodayAttendance,
    refetchInterval: 30000,
  })

  const mutation = useMutation({
    mutationFn: ({ action, storeId }: { action: string; storeId?: string }) =>
      clockAction(action, storeId),
    onSuccess: (_, variables) => {
      setConfirmAction(null)
      setSuccessTimestamp(new Date())
      setSuccessAction(variables.action as ClockAction)
      queryClient.invalidateQueries({ queryKey: ["todayAttendance"] })
    },
    onError: () => {
      setConfirmAction(null)
    },
  })

  const handleActionClick = useCallback((action: ClockAction) => {
    setConfirmAction(action)
  }, [])

  const handleConfirm = useCallback(() => {
    if (confirmAction && data) {
      mutation.mutate({ action: confirmAction, storeId: data.store.id })
    }
  }, [confirmAction, data, mutation])

  const handleCancel = useCallback(() => {
    setConfirmAction(null)
  }, [])

  const handleSuccessComplete = useCallback(() => {
    setSuccessAction(null)
    setSuccessTimestamp(null)
  }, [])

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-red-500 text-6xl mb-4">😕</div>
        <div className="text-xl font-semibold text-gray-900 mb-2">載入失敗</div>
        <div className="text-gray-500 mb-6">無法取得打卡資訊，請重試</div>
        <button
          onClick={() => refetch()}
          className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          重新載入
        </button>
      </div>
    )
  }

  if (!data) return null

  const { state, availableActions, attendance, schedule, store } = data
  const currentBreak = attendance?.breaks?.find((b) => !b.endTime)
  const allowedActions = availableActions.filter((a) => a.allowed)
  const disabledActions = availableActions.filter((a) => !a.allowed && a.reason)

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header with live clock */}
        <div className="bg-gradient-to-br from-primary via-primary to-primary/80 px-6 py-8 text-white">
          {/* Store info */}
          <div className="flex items-center justify-center gap-2 mb-4 opacity-90">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">{store.name}</span>
          </div>

          {/* Live clock - separated to minimize re-renders */}
          <LiveClock />

          {/* Schedule info */}
          {schedule && (
            <div className="mt-6 flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
                <Calendar className="w-4 h-4" />
                <span>{schedule.shiftType.name}</span>
              </div>
              <div className="bg-white/10 px-4 py-2 rounded-full">
                {schedule.shiftType.startTime} - {schedule.shiftType.endTime}
              </div>
            </div>
          )}
        </div>

        {/* Status section */}
        <div className="px-6 py-5 border-b bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                目前狀態
              </div>
              <StatusBadge state={state} />
            </div>
          </div>
        </div>

        {/* Duration displays */}
        {attendance && state === ClockState.WORKING && (
          <div className="px-6 py-4">
            <WorkDuration
              clockIn={attendance.clockIn}
              breakMinutes={attendance.breakMinutes || 0}
              state={state}
            />
          </div>
        )}

        {state === ClockState.ON_BREAK && currentBreak && (
          <div className="px-6 py-4">
            <BreakDuration startTime={currentBreak.startTime} />
          </div>
        )}

        {/* Attendance details */}
        {attendance && (
          <div className="px-6 py-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">上班時間</div>
                <div className="font-semibold text-gray-900">
                  {formatTime(new Date(attendance.clockIn))}
                </div>
              </div>
              {attendance.clockOut && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">下班時間</div>
                  <div className="font-semibold text-gray-900">
                    {formatTime(new Date(attendance.clockOut))}
                  </div>
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">休息次數</div>
                <div className="font-semibold text-gray-900">
                  {attendance.breaks?.length || 0} 次
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">累計休息</div>
                <div className="font-semibold text-gray-900">
                  {attendance.breakMinutes || 0} 分鐘
                </div>
              </div>
            </div>

            {/* Break history (collapsible on mobile) */}
            {attendance.breaks && attendance.breaks.length > 0 && (
              <details className="mt-4">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 transition-colors">
                  查看休息記錄 ({attendance.breaks.length} 筆)
                </summary>
                <div className="mt-3 space-y-2">
                  {attendance.breaks.map((brk, idx) => (
                    <div
                      key={brk.id}
                      className="flex justify-between items-center text-sm bg-gray-50 px-4 py-3 rounded-xl"
                    >
                      <span className="text-gray-600">
                        第 {idx + 1} 次 ({brk.type === "MEAL" ? "用餐" : "休息"})
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatTime(new Date(brk.startTime))} -{" "}
                        {brk.endTime ? formatTime(new Date(brk.endTime)) : "進行中"}
                        {brk.durationMinutes && (
                          <span className="text-gray-500 ml-2">
                            ({brk.durationMinutes}分)
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Error display */}
        {mutation.error && (
          <div className="mx-6 mb-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-3">
            <span className="text-2xl">❌</span>
            <span>{(mutation.error as Error).message}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="p-6 pt-2 space-y-3">
          {allowedActions.map((action) => (
            <ActionButton
              key={action.action}
              action={action.action}
              onClick={() => handleActionClick(action.action)}
              disabled={mutation.isPending}
            />
          ))}

          {/* Show disabled action reasons */}
          {disabledActions.length > 0 && (
            <div className="pt-2 space-y-1">
              {disabledActions.map((action) => (
                <div
                  key={action.action}
                  className="text-xs text-gray-400 flex items-center gap-2"
                >
                  <span>ℹ️</span>
                  <span>
                    {ClockActionLabels[action.action]}: {action.reason}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Final summary when clocked out */}
        {state === ClockState.CLOCKED_OUT && attendance?.netWorkMinutes && (
          <div className="px-6 py-6 bg-gradient-to-r from-green-50 to-emerald-50 border-t">
            <div className="text-center">
              <div className="text-sm text-green-600 font-medium mb-1">
                🎉 今日淨工時
              </div>
              <div className="text-3xl font-bold text-green-700">
                {minutesToHoursMinutes(attendance.netWorkMinutes)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmAction && (
        <ConfirmDialog
          isOpen={!!confirmAction}
          action={confirmAction}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          isLoading={mutation.isPending}
          storeName={data.store.name}
        />
      )}

      {/* Success animation */}
      {successAction && successTimestamp && (
        <SuccessAnimation
          isVisible={!!successAction}
          action={successAction}
          onComplete={handleSuccessComplete}
          timestamp={successTimestamp}
        />
      )}
    </>
  )
}
