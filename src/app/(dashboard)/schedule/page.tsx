"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface Schedule {
  id: string
  date: string
  status: string
  customStart: string | null
  customEnd: string | null
  notes: string | null
  shiftType: {
    id: string
    name: string
    code: string
    startTime: string
    endTime: string
  }
  store: {
    id: string
    name: string
  }
}

async function fetchMySchedules(startDate: string, endDate: string): Promise<Schedule[]> {
  const res = await fetch(`/api/schedules?startDate=${startDate}&endDate=${endDate}`)
  if (!res.ok) throw new Error("Failed to fetch schedules")
  return res.json()
}

function getWeekDates(date: Date): Date[] {
  const week = []
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay()) // Start from Sunday

  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    week.push(day)
  }
  return week
}

function formatDateForApi(date: Date): string {
  return date.toISOString().split("T")[0]
}

const dayNames = ["日", "一", "二", "三", "四", "五", "六"]

export default function MySchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const weekDates = getWeekDates(currentDate)

  const startDate = formatDateForApi(weekDates[0])
  const endDate = formatDateForApi(weekDates[6])

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["mySchedules", startDate, endDate],
    queryFn: () => fetchMySchedules(startDate, endDate),
  })

  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
  }

  const goToNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const getScheduleForDate = (date: Date): Schedule | undefined => {
    const dateStr = formatDateForApi(date)
    return schedules?.find((s) => s.date.startsWith(dateStr))
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-600",
      SCHEDULED: "bg-blue-100 text-blue-700",
      CONFIRMED: "bg-green-100 text-green-700",
      COMPLETED: "bg-gray-100 text-gray-600",
      CANCELLED: "bg-red-100 text-red-700",
    }
    const labels: Record<string, string> = {
      DRAFT: "草稿",
      SCHEDULED: "已排班",
      CONFIRMED: "已確認",
      COMPLETED: "已完成",
      CANCELLED: "已取消",
    }
    return (
      <span className={cn("text-xs px-2 py-0.5 rounded-full", styles[status] || styles.DRAFT)}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">我的排班</h1>
        <p className="mt-1 text-sm text-gray-500">查看您的工作班表</p>
      </div>

      {/* Week Navigation */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="font-medium">
              {weekDates[0].toLocaleDateString("zh-TW", { month: "long", day: "numeric" })}
              {" - "}
              {weekDates[6].toLocaleDateString("zh-TW", { month: "long", day: "numeric" })}
            </span>
          </div>
          <button
            onClick={goToToday}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            今天
          </button>
        </div>

        {/* Week Grid */}
        {isLoading ? (
          <div className="grid grid-cols-7 gap-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date, idx) => {
              const schedule = getScheduleForDate(date)
              const today = isToday(date)

              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[120px] rounded-lg border p-2 transition-colors",
                    today ? "border-primary bg-primary/5" : "border-gray-200",
                    schedule ? "bg-white" : "bg-gray-50"
                  )}
                >
                  {/* Day Header */}
                  <div className="text-center mb-2">
                    <div className={cn(
                      "text-xs",
                      today ? "text-primary font-medium" : "text-gray-500"
                    )}>
                      週{dayNames[idx]}
                    </div>
                    <div className={cn(
                      "text-lg font-medium",
                      today ? "text-primary" : "text-gray-900"
                    )}>
                      {date.getDate()}
                    </div>
                  </div>

                  {/* Schedule Content */}
                  {schedule ? (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-900">
                        {schedule.shiftType.name}
                      </div>
                      <div className="text-xs text-gray-600">
                        {schedule.customStart || schedule.shiftType.startTime}
                        {" - "}
                        {schedule.customEnd || schedule.shiftType.endTime}
                      </div>
                      <div className="text-xs text-gray-500">
                        {schedule.store.name}
                      </div>
                      {getStatusBadge(schedule.status)}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 text-center mt-4">
                      休息
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upcoming Schedules List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b">
          <h2 className="font-medium text-gray-900">本週排班詳情</h2>
        </div>
        <div className="divide-y">
          {isLoading ? (
            <div className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ) : schedules && schedules.length > 0 ? (
            schedules.map((schedule) => (
              <div key={schedule.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {new Date(schedule.date).toLocaleDateString("zh-TW", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {schedule.shiftType.name} ({schedule.shiftType.code})
                    </div>
                    <div className="text-sm text-gray-500">
                      {schedule.customStart || schedule.shiftType.startTime}
                      {" - "}
                      {schedule.customEnd || schedule.shiftType.endTime}
                      {" @ "}
                      {schedule.store.name}
                    </div>
                    {schedule.notes && (
                      <div className="text-sm text-gray-400 mt-1">
                        備註: {schedule.notes}
                      </div>
                    )}
                  </div>
                  <div>{getStatusBadge(schedule.status)}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              本週沒有排班
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
