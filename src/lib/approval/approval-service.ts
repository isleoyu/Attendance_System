import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { ApprovalStatus, ApprovalType, Role } from "@prisma/client"

// Permission limits by role
export const APPROVAL_LIMITS = {
  SHIFT_LEADER: {
    maxOvertimeMinutes: 60,
    maxLeaveDays: 1,
    canApprove: ["ATTENDANCE_ADJUSTMENT"] as ApprovalType[],
  },
  STORE_MANAGER: {
    maxOvertimeMinutes: 480,
    maxLeaveDays: 14,
    canApprove: ["ATTENDANCE_ADJUSTMENT", "OVERTIME", "LEAVE_REQUEST", "SCHEDULE_CHANGE"] as ApprovalType[],
  },
  SUPER_ADMIN: {
    maxOvertimeMinutes: Infinity,
    maxLeaveDays: Infinity,
    canApprove: ["ATTENDANCE_ADJUSTMENT", "OVERTIME", "LEAVE_REQUEST", "SCHEDULE_CHANGE"] as ApprovalType[],
  },
}

// Validation schemas
export const createApprovalSchema = z.object({
  type: z.enum(["ATTENDANCE_ADJUSTMENT", "OVERTIME", "LEAVE_REQUEST", "SCHEDULE_CHANGE"]),
  comments: z.string().optional(),
})

export const processApprovalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  comments: z.string().optional(),
})

export const createLeaveRequestSchema = z.object({
  type: z.enum(["ANNUAL", "SICK", "PERSONAL", "UNPAID", "COMPENSATORY"]),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  reason: z.string().optional(),
})

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>

export class ApprovalService {
  /**
   * Get pending approvals for a user (based on their role and store)
   */
  async getPendingApprovals(userId: string, role: Role, storeIds: string[]) {
    if (role === "EMPLOYEE") {
      return []
    }

    const allowedTypes = APPROVAL_LIMITS[role as keyof typeof APPROVAL_LIMITS]?.canApprove || []

    // Get pending approvals with related data
    const approvals = await prisma.approval.findMany({
      where: {
        status: "PENDING",
        type: { in: allowedTypes },
      },
      include: {
        attendance: {
          include: {
            user: {
              select: { id: true, name: true, employeeId: true },
            },
            store: {
              select: { id: true, name: true },
            },
          },
        },
        leaveRequest: {
          include: {
            user: {
              select: { id: true, name: true, employeeId: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Filter by store access
    return approvals.filter((approval) => {
      if (role === "SUPER_ADMIN") return true

      if (approval.attendance) {
        return storeIds.includes(approval.attendance.storeId)
      }

      // For leave requests, check if user is in any of the approver's stores
      if (approval.leaveRequest) {
        // Would need to check user's store association
        return true // Simplified for now
      }

      return false
    })
  }

  /**
   * Get approval history
   */
  async getApprovalHistory(
    userId: string,
    role: Role,
    options?: {
      status?: ApprovalStatus
      type?: ApprovalType
      limit?: number
    }
  ) {
    const where: any = {}

    if (options?.status) {
      where.status = options.status
    }

    if (options?.type) {
      where.type = options.type
    }

    // Non-admin users only see approvals they processed
    if (role !== "SUPER_ADMIN") {
      where.approverId = userId
    }

    return prisma.approval.findMany({
      where,
      include: {
        approver: {
          select: { id: true, name: true },
        },
        attendance: {
          include: {
            user: {
              select: { id: true, name: true, employeeId: true },
            },
          },
        },
        leaveRequest: {
          include: {
            user: {
              select: { id: true, name: true, employeeId: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit || 50,
    })
  }

  /**
   * Get a single approval by ID
   */
  async getApprovalById(id: string) {
    return prisma.approval.findUnique({
      where: { id },
      include: {
        approver: {
          select: { id: true, name: true },
        },
        attendance: {
          include: {
            user: {
              select: { id: true, name: true, employeeId: true },
            },
            store: true,
            breaks: true,
          },
        },
        leaveRequest: {
          include: {
            user: {
              select: { id: true, name: true, employeeId: true },
            },
          },
        },
      },
    })
  }

  /**
   * Process an approval (approve or reject)
   */
  async processApproval(
    approvalId: string,
    approverId: string,
    approverRole: Role,
    status: "APPROVED" | "REJECTED",
    comments?: string
  ) {
    const approval = await this.getApprovalById(approvalId)

    if (!approval) {
      throw new Error("審核項目不存在")
    }

    if (approval.status !== "PENDING") {
      throw new Error("此項目已被處理")
    }

    // Check permission
    const limits = APPROVAL_LIMITS[approverRole as keyof typeof APPROVAL_LIMITS]
    if (!limits || !limits.canApprove.includes(approval.type)) {
      throw new Error("無權限處理此類型審核")
    }

    // Additional limit checks for specific types
    if (approval.type === "OVERTIME" && approval.attendance?.overtimeMinutes) {
      if (approval.attendance.overtimeMinutes > limits.maxOvertimeMinutes) {
        throw new Error(`加班時數超過您的審核權限 (最高 ${limits.maxOvertimeMinutes} 分鐘)`)
      }
    }

    if (approval.type === "LEAVE_REQUEST" && approval.leaveRequest) {
      const days = Math.ceil(
        (approval.leaveRequest.endDate.getTime() - approval.leaveRequest.startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1

      if (days > limits.maxLeaveDays) {
        throw new Error(`請假天數超過您的審核權限 (最高 ${limits.maxLeaveDays} 天)`)
      }
    }

    // Update approval
    const updatedApproval = await prisma.approval.update({
      where: { id: approvalId },
      data: {
        status,
        approverId,
        approvedAt: new Date(),
        comments,
      },
    })

    // Update related records based on approval type
    if (status === "APPROVED") {
      if (approval.attendance) {
        await prisma.attendance.update({
          where: { id: approval.attendance.id },
          data: { status: "APPROVED" },
        })
      }

      if (approval.leaveRequest) {
        await prisma.leaveRequest.update({
          where: { id: approval.leaveRequest.id },
          data: { status: "APPROVED" },
        })
      }
    } else if (status === "REJECTED") {
      if (approval.leaveRequest) {
        await prisma.leaveRequest.update({
          where: { id: approval.leaveRequest.id },
          data: { status: "REJECTED" },
        })
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: approverId,
        action: `APPROVAL_${status}`,
        entityType: "Approval",
        entityId: approvalId,
        newValue: { status, comments },
      },
    })

    return updatedApproval
  }

  /**
   * Create a leave request
   */
  async createLeaveRequest(userId: string, data: CreateLeaveRequestInput) {
    // Validate dates
    if (data.endDate < data.startDate) {
      throw new Error("結束日期不能早於開始日期")
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (data.startDate < today) {
      throw new Error("開始日期不能早於今天")
    }

    // Check for overlapping leave requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "APPROVED"] },
        OR: [
          {
            startDate: { lte: data.endDate },
            endDate: { gte: data.startDate },
          },
        ],
      },
    })

    if (overlapping) {
      throw new Error("此期間已有請假申請")
    }

    // Create leave request with approval
    const result = await prisma.$transaction(async (tx) => {
      // Create approval first
      const approval = await tx.approval.create({
        data: {
          type: "LEAVE_REQUEST",
          status: "PENDING",
        },
      })

      // Create leave request
      const leaveRequest = await tx.leaveRequest.create({
        data: {
          userId,
          type: data.type,
          startDate: data.startDate,
          endDate: data.endDate,
          reason: data.reason,
          status: "PENDING",
          approvalId: approval.id,
        },
        include: {
          user: {
            select: { id: true, name: true, employeeId: true },
          },
        },
      })

      return leaveRequest
    })

    return result
  }

  /**
   * Get user's leave requests
   */
  async getUserLeaveRequests(userId: string, year?: number) {
    const where: any = { userId }

    if (year) {
      const startOfYear = new Date(year, 0, 1)
      const endOfYear = new Date(year, 11, 31)
      where.startDate = {
        gte: startOfYear,
        lte: endOfYear,
      }
    }

    return prisma.leaveRequest.findMany({
      where,
      include: {
        approval: {
          include: {
            approver: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { startDate: "desc" },
    })
  }

  /**
   * Cancel a leave request (only if pending)
   */
  async cancelLeaveRequest(id: string, userId: string) {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { approval: true },
    })

    if (!leaveRequest) {
      throw new Error("請假申請不存在")
    }

    if (leaveRequest.userId !== userId) {
      throw new Error("無權限取消此請假申請")
    }

    if (leaveRequest.status !== "PENDING") {
      throw new Error("只能取消待審核的請假申請")
    }

    // Update both leave request and approval
    await prisma.$transaction([
      prisma.leaveRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
      }),
      prisma.approval.update({
        where: { id: leaveRequest.approvalId! },
        data: { status: "CANCELLED" },
      }),
    ])

    return { success: true, message: "請假申請已取消" }
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(storeIds: string[]) {
    const pending = await prisma.approval.count({
      where: { status: "PENDING" },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayApproved = await prisma.approval.count({
      where: {
        status: "APPROVED",
        approvedAt: { gte: today },
      },
    })

    const todayRejected = await prisma.approval.count({
      where: {
        status: "REJECTED",
        approvedAt: { gte: today },
      },
    })

    return {
      pending,
      todayApproved,
      todayRejected,
    }
  }
}

export const approvalService = new ApprovalService()
