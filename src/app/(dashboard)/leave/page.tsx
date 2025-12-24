"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, X, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface LeaveRequest {
  id: string
  type: string
  startDate: string
  endDate: string
  reason: string | null
  status: string
  createdAt: string
  approval: {
    id: string
    status: string
    approvedAt: string | null
    comments: string | null
    approver: {
      id: string
      name: string
    } | null
  } | null
}

const leaveTypeLabels: Record<string, string> = {
  ANNUAL: "特休",
  SICK: "病假",
  PERSONAL: "事假",
  UNPAID: "無薪假",
  COMPENSATORY: "補休",
}

const statusLabels: Record<string, string> = {
  PENDING: "待審核",
  APPROVED: "已核准",
  REJECTED: "已駁回",
  CANCELLED: "已取消",
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
}

async function fetchLeaveRequests(): Promise<LeaveRequest[]> {
  const res = await fetch("/api/leave-requests")
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

async function createLeaveRequest(data: {
  type: string
  startDate: string
  endDate: string
  reason?: string
}) {
  const res = await fetch("/api/leave-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to create")
  }
  return res.json()
}

async function cancelLeaveRequest(id: string) {
  const res = await fetch(`/api/leave-requests/${id}/cancel`, {
    method: "POST",
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to cancel")
  }
  return res.json()
}

export default function LeavePage() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    type: "ANNUAL",
    startDate: "",
    endDate: "",
    reason: "",
  })

  const { data: leaveRequests, isLoading } = useQuery({
    queryKey: ["leaveRequests"],
    queryFn: fetchLeaveRequests,
  })

  const createMutation = useMutation({
    mutationFn: createLeaveRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveRequests"] })
      setIsModalOpen(false)
      setFormData({ type: "ANNUAL", startDate: "", endDate: "", reason: "" })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: cancelLeaveRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveRequests"] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const handleCancel = (id: string) => {
    if (confirm("確定要取消此請假申請嗎？")) {
      cancelMutation.mutate(id)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">請假申請</h1>
          <p className="mt-1 text-sm text-gray-500">申請與管理您的請假記錄</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增請假
        </button>
      </div>

      {/* Leave Request List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b">
          <h2 className="font-medium text-gray-900">請假記錄</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">載入中...</div>
        ) : leaveRequests && leaveRequests.length > 0 ? (
          <div className="divide-y">
            {leaveRequests.map((request) => (
              <div key={request.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {leaveTypeLabels[request.type] || request.type}
                      </span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        statusColors[request.status]
                      )}>
                        {statusLabels[request.status] || request.status}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-600 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(request.startDate)} - {formatDate(request.endDate)}
                      <span className="text-gray-400 ml-2">
                        ({calculateDays(request.startDate, request.endDate)} 天)
                      </span>
                    </div>
                    {request.reason && (
                      <div className="mt-1 text-sm text-gray-500">
                        原因: {request.reason}
                      </div>
                    )}
                    {request.approval?.approver && (
                      <div className="mt-1 text-xs text-gray-400">
                        審核人: {request.approval.approver.name}
                        {request.approval.comments && ` - ${request.approval.comments}`}
                      </div>
                    )}
                  </div>
                  {request.status === "PENDING" && (
                    <button
                      onClick={() => handleCancel(request.id)}
                      disabled={cancelMutation.isPending}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      取消
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            尚無請假記錄
          </div>
        )}
      </div>

      {/* Create Leave Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">新增請假申請</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {createMutation.error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {(createMutation.error as Error).message}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  假別
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  {Object.entries(leaveTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始日期
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    結束日期
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  請假原因
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="選填"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {createMutation.isPending ? "送出中..." : "送出申請"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
