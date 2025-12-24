"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, X, Clock, User, Calendar, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface Approval {
  id: string
  type: string
  status: string
  createdAt: string
  comments: string | null
  attendance: {
    id: string
    date: string
    clockIn: string
    clockOut: string | null
    overtimeMinutes: number | null
    user: {
      id: string
      name: string
      employeeId: string
    }
    store: {
      id: string
      name: string
    }
  } | null
  leaveRequest: {
    id: string
    type: string
    startDate: string
    endDate: string
    reason: string | null
    user: {
      id: string
      name: string
      employeeId: string
    }
  } | null
}

const typeLabels: Record<string, string> = {
  ATTENDANCE_ADJUSTMENT: "出勤調整",
  OVERTIME: "加班審核",
  LEAVE_REQUEST: "請假申請",
  SCHEDULE_CHANGE: "排班變更",
}

const leaveTypeLabels: Record<string, string> = {
  ANNUAL: "特休",
  SICK: "病假",
  PERSONAL: "事假",
  UNPAID: "無薪假",
  COMPENSATORY: "補休",
}

async function fetchPendingApprovals(): Promise<Approval[]> {
  const res = await fetch("/api/approvals?status=PENDING")
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

async function processApproval(id: string, data: { status: string; comments?: string }) {
  const res = await fetch(`/api/approvals/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to process")
  }
  return res.json()
}

export default function ApprovalsPage() {
  const queryClient = useQueryClient()
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)
  const [comments, setComments] = useState("")

  const { data: approvals, isLoading } = useQuery({
    queryKey: ["pendingApprovals"],
    queryFn: fetchPendingApprovals,
  })

  const processMutation = useMutation({
    mutationFn: ({ id, status, comments }: { id: string; status: string; comments?: string }) =>
      processApproval(id, { status, comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] })
      setSelectedApproval(null)
      setComments("")
    },
  })

  const handleApprove = (id: string) => {
    processMutation.mutate({ id, status: "APPROVED", comments: comments || undefined })
  }

  const handleReject = (id: string) => {
    if (!comments.trim()) {
      alert("駁回時請填寫原因")
      return
    }
    processMutation.mutate({ id, status: "REJECTED", comments })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("zh-TW", {
      month: "short",
      day: "numeric",
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("zh-TW", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">待審核項目</h1>
        <p className="mt-1 text-sm text-gray-500">審核員工的請假、出勤調整等申請</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-medium text-gray-900">待處理</h2>
            <span className="text-sm text-gray-500">
              {approvals?.length || 0} 項
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">載入中...</div>
          ) : approvals && approvals.length > 0 ? (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {approvals.map((approval) => (
                <div
                  key={approval.id}
                  onClick={() => setSelectedApproval(approval)}
                  className={cn(
                    "p-4 cursor-pointer transition-colors",
                    selectedApproval?.id === approval.id
                      ? "bg-primary/5 border-l-2 border-primary"
                      : "hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary">
                      {typeLabels[approval.type] || approval.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(approval.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                    <User className="w-4 h-4" />
                    {approval.leaveRequest?.user.name || approval.attendance?.user.name}
                  </div>
                  {approval.leaveRequest && (
                    <div className="mt-1 text-xs text-gray-500">
                      {leaveTypeLabels[approval.leaveRequest.type]} ·{" "}
                      {calculateDays(approval.leaveRequest.startDate, approval.leaveRequest.endDate)} 天
                    </div>
                  )}
                  {approval.attendance?.overtimeMinutes && (
                    <div className="mt-1 text-xs text-gray-500">
                      加班 {approval.attendance.overtimeMinutes} 分鐘
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Check className="w-12 h-12 mx-auto text-green-300 mb-2" />
              目前沒有待審核項目
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="bg-white rounded-lg shadow">
          {selectedApproval ? (
            <>
              <div className="px-4 py-3 border-b">
                <h2 className="font-medium text-gray-900">
                  {typeLabels[selectedApproval.type] || selectedApproval.type}
                </h2>
              </div>
              <div className="p-4 space-y-4">
                {/* Applicant Info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {selectedApproval.leaveRequest?.user.name ||
                        selectedApproval.attendance?.user.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedApproval.leaveRequest?.user.employeeId ||
                        selectedApproval.attendance?.user.employeeId}
                    </div>
                  </div>
                </div>

                {/* Leave Request Details */}
                {selectedApproval.leaveRequest && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">假別:</span>
                      <span>{leaveTypeLabels[selectedApproval.leaveRequest.type]}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">期間:</span>
                      <span>
                        {formatDate(selectedApproval.leaveRequest.startDate)} -{" "}
                        {formatDate(selectedApproval.leaveRequest.endDate)}
                        ({calculateDays(
                          selectedApproval.leaveRequest.startDate,
                          selectedApproval.leaveRequest.endDate
                        )} 天)
                      </span>
                    </div>
                    {selectedApproval.leaveRequest.reason && (
                      <div className="text-sm">
                        <span className="font-medium">原因:</span>
                        <p className="mt-1 text-gray-600">
                          {selectedApproval.leaveRequest.reason}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Attendance Details */}
                {selectedApproval.attendance && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">日期:</span>
                      <span>{formatDate(selectedApproval.attendance.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">打卡時間:</span>
                      <span>
                        {formatDateTime(selectedApproval.attendance.clockIn)}
                        {selectedApproval.attendance.clockOut &&
                          ` - ${formatDateTime(selectedApproval.attendance.clockOut)}`}
                      </span>
                    </div>
                    {selectedApproval.attendance.overtimeMinutes && (
                      <div className="text-sm">
                        <span className="font-medium">加班時數:</span>
                        <span className="ml-2 text-orange-600">
                          {Math.floor(selectedApproval.attendance.overtimeMinutes / 60)} 小時{" "}
                          {selectedApproval.attendance.overtimeMinutes % 60} 分鐘
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Comments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    審核意見
                  </label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="選填 (駁回時必填)"
                  />
                </div>

                {processMutation.error && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    {(processMutation.error as Error).message}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleReject(selectedApproval.id)}
                    disabled={processMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    駁回
                  </button>
                  <button
                    onClick={() => handleApprove(selectedApproval.id)}
                    disabled={processMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    核准
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-2" />
              選擇左側項目查看詳情
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
