"use client"

import { useState, useEffect } from "react"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { zhTW } from "date-fns/locale"
import {
  Calendar,
  Clock,
  Coffee,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  CalendarOff,
  ChevronDown,
  ChevronUp,
  Timer,
  Briefcase,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AttendanceRecord {
  id: string
  date: string
  type: "attendance" | "absent" | "leave"
  store: {
    id: string
    name: string
  }
  schedule: {
    shiftName: string
    startTime: string
    endTime: string
  } | null
  clockIn: string | null
  clockOut: string | null
  status: string
  totalMinutes: number | null
  breakMinutes: number | null
  netWorkMinutes: number | null
  overtimeMinutes: number | null
  breaks: Array<{
    id: string
    startTime: string
    endTime: string | null
    type: string
    durationMinutes: number | null
  }>
}

interface Summary {
  totalScheduledDays: number
  presentDays: number
  absentDays: number
  leaveDays: number
  totalWorkHours: number
  totalOvertimeHours: number
  totalBreakMinutes: number
}

function minutesToHoursMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

function getStatusConfig(status: string, type: string) {
  if (type === "leave") {
    return {
      label: "請假",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-200",
      icon: CalendarOff,
    }
  }
  if (type === "absent") {
    return {
      label: "缺勤",
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      icon: XCircle,
    }
  }

  switch (status) {
    case "CLOCKED_OUT":
    case "APPROVED":
      return {
        label: "已完成",
        color: "text-green-600",
        bg: "bg-green-50",
        border: "border-green-200",
        icon: CheckCircle2,
      }
    case "CLOCKED_IN":
      return {
        label: "工作中",
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
        icon: Briefcase,
      }
    case "ON_BREAK":
      return {
        label: "休息中",
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        icon: Coffee,
      }
    case "PENDING_REVIEW":
      return {
        label: "待審核",
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-200",
        icon: AlertCircle,
      }
    default:
      return {
        label: status,
        color: "text-gray-600",
        bg: "bg-gray-50",
        border: "border-gray-200",
        icon: Clock,
      }
  }
}

function RecordCard({ record }: { record: AttendanceRecord }) {
  const [expanded, setExpanded] = useState(false)
  const statusConfig = getStatusConfig(record.status, record.type)
  const StatusIcon = statusConfig.icon
  const dateObj = new Date(record.date)

  return (
    <div
      className={cn(
        "bg-white rounded-xl border-2 overflow-hidden transition-all duration-200",
        statusConfig.border
      )}
    >
      {/* Main content */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => record.type === "attendance" && setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Date and status */}
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {format(dateObj, "dd")}
              </div>
              <div className="text-xs text-gray-500">
                {format(dateObj, "EEE", { locale: zhTW })}
              </div>
            </div>
            <div className="h-12 w-px bg-gray-200" />
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                    statusConfig.bg,
                    statusConfig.color
                  )}
                >
                  <StatusIcon className="w-3 h-3" />
                  {statusConfig.label}
                </span>
                {record.schedule && (
                  <span className="text-xs text-gray-400">
                    {record.schedule.shiftName}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {record.store.name}
              </div>
            </div>
          </div>

          {/* Time info */}
          <div className="text-right">
            {record.type === "attendance" && record.clockIn ? (
              <>
                <div className="text-sm">
                  <span className="text-gray-400">上班</span>{" "}
                  <span className="font-medium text-gray-900">{record.clockIn}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-400">下班</span>{" "}
                  <span className="font-medium text-gray-900">
                    {record.clockOut || "--:--"}
                  </span>
                </div>
              </>
            ) : record.schedule ? (
              <div className="text-sm text-gray-400">
                排班 {record.schedule.startTime} - {record.schedule.endTime}
              </div>
            ) : null}
          </div>
        </div>

        {/* Quick stats */}
        {record.type === "attendance" && record.netWorkMinutes !== null && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Timer className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">
                  工時 <span className="font-medium text-gray-900">
                    {minutesToHoursMinutes(record.netWorkMinutes)}
                  </span>
                </span>
              </div>
              {record.breakMinutes !== null && record.breakMinutes > 0 && (
                <div className="flex items-center gap-1">
                  <Coffee className="w-4 h-4 text-yellow-500" />
                  <span className="text-gray-600">
                    休息 <span className="font-medium text-gray-900">
                      {record.breakMinutes}分
                    </span>
                  </span>
                </div>
              )}
              {record.overtimeMinutes !== null && record.overtimeMinutes > 0 && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <span className="text-gray-600">
                    加班 <span className="font-medium text-orange-600">
                      {minutesToHoursMinutes(record.overtimeMinutes)}
                    </span>
                  </span>
                </div>
              )}
            </div>
            {record.breaks.length > 0 && (
              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                {expanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expanded break details */}
      {expanded && record.breaks.length > 0 && (
        <div className="px-4 pb-4 pt-0">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-500 mb-2">休息記錄</div>
            <div className="space-y-1">
              {record.breaks.map((brk, idx) => (
                <div
                  key={brk.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-600">
                    第 {idx + 1} 次 ({brk.type === "MEAL" ? "用餐" : "休息"})
                  </span>
                  <span className="text-gray-900">
                    {brk.startTime} - {brk.endTime || "進行中"}
                    {brk.durationMinutes && (
                      <span className="text-gray-400 ml-1">
                        ({brk.durationMinutes}分)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AttendancePage() {
  const [startDate, setStartDate] = useState(() =>
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  )
  const [endDate, setEndDate] = useState(() =>
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  )
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchData = async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ startDate, endDate })
      const res = await fetch(`/api/attendance/history?${params}`)

      if (!res.ok) {
        throw new Error("取得資料失敗")
      }

      const data = await res.json()
      setRecords(data.records)
      setSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [startDate, endDate])

  const setQuickPeriod = (months: number) => {
    const target = subMonths(new Date(), months)
    setStartDate(format(startOfMonth(target), "yyyy-MM-dd"))
    setEndDate(format(endOfMonth(target), "yyyy-MM-dd"))
  }

  // Group records by month
  const groupedRecords = records.reduce((acc, record) => {
    const monthKey = record.date.slice(0, 7) // yyyy-MM
    if (!acc[monthKey]) {
      acc[monthKey] = []
    }
    acc[monthKey].push(record)
    return acc
  }, {} as Record<string, AttendanceRecord[]>)

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">出勤記錄</h1>
        <p className="mt-1 text-sm text-gray-500">查看您的打卡和出缺勤明細</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        {/* Quick period selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setQuickPeriod(0)}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
              startDate === format(startOfMonth(new Date()), "yyyy-MM-dd")
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            本月
          </button>
          <button
            onClick={() => setQuickPeriod(1)}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
              startDate === format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd")
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            上月
          </button>
          <button
            onClick={() => setQuickPeriod(2)}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
              startDate === format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd")
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            前月
          </button>
        </div>

        {/* Date pickers */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">起始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-medium">出勤</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.presentDays}
              <span className="text-sm font-normal text-gray-400 ml-1">天</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-xs font-medium">缺勤</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.absentDays}
              <span className="text-sm font-normal text-gray-400 ml-1">天</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Timer className="w-4 h-4" />
              <span className="text-xs font-medium">總工時</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.totalWorkHours}
              <span className="text-sm font-normal text-gray-400 ml-1">時</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">加班</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.totalOvertimeHours}
              <span className="text-sm font-normal text-gray-400 ml-1">時</span>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Records list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-3 bg-gray-200 rounded w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <div className="text-gray-500">此期間沒有出勤記錄</div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedRecords).map(([month, monthRecords]) => (
            <div key={month}>
              <div className="text-sm font-medium text-gray-500 mb-3 px-1">
                {format(new Date(month + "-01"), "yyyy年 M月", { locale: zhTW })}
              </div>
              <div className="space-y-3">
                {monthRecords.map((record) => (
                  <RecordCard key={record.id} record={record} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
