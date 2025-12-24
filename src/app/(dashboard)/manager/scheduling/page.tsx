"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ShiftType {
  id: string
  name: string
  code: string
  startTime: string
  endTime: string
}

interface Employee {
  id: string
  name: string
  employeeId: string
  role: string
}

interface Schedule {
  id: string
  date: string
  status: string
  user: {
    id: string
    name: string
    employeeId: string
  }
  shiftType: ShiftType
}

interface Store {
  id: string
  name: string
  isPrimary: boolean
}

async function fetchUserStores(): Promise<Store[]> {
  const res = await fetch("/api/attendance/today")
  if (!res.ok) throw new Error("Failed to fetch")
  const data = await res.json()
  return [data.store] // Simplified - should have a dedicated endpoint
}

async function fetchShiftTypes(storeId: string): Promise<ShiftType[]> {
  const res = await fetch(`/api/shift-types?storeId=${storeId}`)
  if (!res.ok) throw new Error("Failed to fetch shift types")
  return res.json()
}

async function fetchEmployees(storeId: string): Promise<Employee[]> {
  const res = await fetch(`/api/stores/${storeId}/employees`)
  if (!res.ok) throw new Error("Failed to fetch employees")
  return res.json()
}

async function fetchSchedules(storeId: string, startDate: string, endDate: string): Promise<Schedule[]> {
  const res = await fetch(`/api/schedules?storeId=${storeId}&startDate=${startDate}&endDate=${endDate}`)
  if (!res.ok) throw new Error("Failed to fetch schedules")
  return res.json()
}

async function createSchedule(data: {
  userId: string
  date: string
  shiftTypeId: string
  storeId: string
}) {
  const res = await fetch("/api/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to create schedule")
  }
  return res.json()
}

async function deleteSchedule(id: string) {
  const res = await fetch(`/api/schedules/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to delete schedule")
  }
  return res.json()
}

function getWeekDates(date: Date): Date[] {
  const week = []
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay())
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

export default function SchedulingPage() {
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedStore, setSelectedStore] = useState<string>("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ date: Date; employeeId?: string } | null>(null)

  const weekDates = getWeekDates(currentDate)
  const startDate = formatDateForApi(weekDates[0])
  const endDate = formatDateForApi(weekDates[6])

  // Fetch stores
  const { data: stores } = useQuery({
    queryKey: ["userStores"],
    queryFn: fetchUserStores,
  })

  // Set default store
  if (stores && stores.length > 0 && !selectedStore) {
    setSelectedStore(stores[0].id)
  }

  // Fetch shift types
  const { data: shiftTypes } = useQuery({
    queryKey: ["shiftTypes", selectedStore],
    queryFn: () => fetchShiftTypes(selectedStore),
    enabled: !!selectedStore,
  })

  // Fetch employees
  const { data: employees } = useQuery({
    queryKey: ["storeEmployees", selectedStore],
    queryFn: () => fetchEmployees(selectedStore),
    enabled: !!selectedStore,
  })

  // Fetch schedules
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["schedules", selectedStore, startDate, endDate],
    queryFn: () => fetchSchedules(selectedStore, startDate, endDate),
    enabled: !!selectedStore,
  })

  // Create schedule mutation
  const createMutation = useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
      setIsAddModalOpen(false)
      setSelectedCell(null)
    },
  })

  // Delete schedule mutation
  const deleteMutation = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
    },
  })

  const getScheduleForCell = (employeeId: string, date: Date): Schedule | undefined => {
    const dateStr = formatDateForApi(date)
    return schedules?.find(
      (s) => s.user.id === employeeId && s.date.startsWith(dateStr)
    )
  }

  const handleCellClick = (employeeId: string, date: Date) => {
    const existing = getScheduleForCell(employeeId, date)
    if (!existing) {
      setSelectedCell({ date, employeeId })
      setIsAddModalOpen(true)
    }
  }

  const handleAddSchedule = (shiftTypeId: string) => {
    if (!selectedCell?.employeeId) return

    createMutation.mutate({
      userId: selectedCell.employeeId,
      date: formatDateForApi(selectedCell.date),
      shiftTypeId,
      storeId: selectedStore,
    })
  }

  const handleDeleteSchedule = (scheduleId: string) => {
    if (confirm("確定要刪除此排班嗎？")) {
      deleteMutation.mutate(scheduleId)
    }
  }

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

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">排班管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理員工班表</p>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg"
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
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            本週
          </button>
        </div>

        {/* Schedule Grid */}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-500">載入中...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-sm font-medium text-gray-600 w-32 border-b">
                    員工
                  </th>
                  {weekDates.map((date, idx) => (
                    <th
                      key={idx}
                      className={cn(
                        "p-2 text-center text-sm font-medium border-b min-w-[100px]",
                        isToday(date) ? "bg-primary/10 text-primary" : "text-gray-600"
                      )}
                    >
                      <div>週{dayNames[idx]}</div>
                      <div className="text-lg">{date.getDate()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees?.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="p-2 border-b">
                      <div className="font-medium text-sm">{employee.name}</div>
                      <div className="text-xs text-gray-500">{employee.employeeId}</div>
                    </td>
                    {weekDates.map((date, idx) => {
                      const schedule = getScheduleForCell(employee.id, date)
                      return (
                        <td
                          key={idx}
                          className={cn(
                            "p-1 border-b text-center cursor-pointer transition-colors",
                            isToday(date) ? "bg-primary/5" : "",
                            !schedule && "hover:bg-gray-100"
                          )}
                          onClick={() => handleCellClick(employee.id, date)}
                        >
                          {schedule ? (
                            <div className="relative group">
                              <div className="bg-blue-100 text-blue-800 rounded px-2 py-1 text-xs">
                                <div className="font-medium">{schedule.shiftType.name}</div>
                                <div>
                                  {schedule.shiftType.startTime}-{schedule.shiftType.endTime}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteSchedule(schedule.id)
                                }}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="h-12 flex items-center justify-center text-gray-300 hover:text-gray-500">
                              <Plus className="w-4 h-4" />
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Schedule Modal */}
      {isAddModalOpen && selectedCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">新增排班</h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false)
                  setSelectedCell(null)
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 text-sm text-gray-600">
              日期: {selectedCell.date.toLocaleDateString("zh-TW", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>

            {createMutation.error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {(createMutation.error as Error).message}
              </div>
            )}

            <div className="space-y-2">
              {shiftTypes?.map((shift) => (
                <button
                  key={shift.id}
                  onClick={() => handleAddSchedule(shift.id)}
                  disabled={createMutation.isPending}
                  className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <div className="font-medium">{shift.name}</div>
                  <div className="text-sm text-gray-500">
                    {shift.startTime} - {shift.endTime}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
