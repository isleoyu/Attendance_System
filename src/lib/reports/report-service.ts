import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns"
import { ScheduleStatus } from "@prisma/client"

export interface AttendanceSummary {
  totalDays: number
  presentDays: number
  absentDays: number
  lateDays: number
  earlyLeaveDays: number
  overtimeDays: number
  totalWorkMinutes: number
  totalOvertimeMinutes: number
  averageWorkMinutes: number
}

export interface DailyAttendance {
  date: string
  present: number
  absent: number
  late: number
  onLeave: number
  total: number
}

export interface EmployeeAttendanceDetail {
  userId: string
  userName: string
  employeeId: string
  presentDays: number
  absentDays: number
  lateDays: number
  leaveDays: number
  totalWorkHours: number
  overtimeHours: number
  attendanceRate: number
}

export interface StoreStatistics {
  storeId: string
  storeName: string
  totalEmployees: number
  averageAttendanceRate: number
  totalWorkHours: number
  totalOvertimeHours: number
  leaveCount: number
}

export class ReportService {
  /**
   * Get attendance summary for a user
   */
  async getUserAttendanceSummary(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AttendanceSummary> {
    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
      },
      include: {
        schedule: true,
      },
    })

    const schedules = await prisma.schedule.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
        status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.CONFIRMED] },
      },
    })

    const scheduledDays = schedules.length
    const presentDays = attendances.filter(
      (a) => a.status === "CLOCKED_OUT" || a.status === "APPROVED"
    ).length
    const absentDays = Math.max(0, scheduledDays - presentDays)

    let lateDays = 0
    let earlyLeaveDays = 0
    let overtimeDays = 0
    let totalWorkMinutes = 0
    let totalOvertimeMinutes = 0

    for (const att of attendances) {
      if (att.netWorkMinutes) {
        totalWorkMinutes += att.netWorkMinutes
      }
      if (att.overtimeMinutes && att.overtimeMinutes > 0) {
        totalOvertimeMinutes += att.overtimeMinutes
        overtimeDays++
      }
      // Note: Late/early leave detection would require schedule comparison
      // This is a simplified implementation
    }

    return {
      totalDays: scheduledDays,
      presentDays,
      absentDays,
      lateDays,
      earlyLeaveDays,
      overtimeDays,
      totalWorkMinutes,
      totalOvertimeMinutes,
      averageWorkMinutes: presentDays > 0 ? Math.round(totalWorkMinutes / presentDays) : 0,
    }
  }

  /**
   * Get daily attendance statistics for a store
   */
  async getDailyAttendanceStats(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DailyAttendance[]> {
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    const results: DailyAttendance[] = []

    // Get all employees in the store
    const employees = await prisma.userStore.findMany({
      where: {
        storeId,
        canClockIn: true,
        user: { status: "ACTIVE" },
      },
    })
    const totalEmployees = employees.length

    // Get all schedules for the period
    const schedules = await prisma.schedule.findMany({
      where: {
        storeId,
        date: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
        status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.CONFIRMED] },
      },
    })

    // Get all attendances for the period
    const attendances = await prisma.attendance.findMany({
      where: {
        storeId,
        date: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
      },
    })

    // Get all leave requests for the period
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        user: {
          stores: {
            some: { storeId },
          },
        },
        status: "APPROVED",
        startDate: { lte: endOfDay(endDate) },
        endDate: { gte: startOfDay(startDate) },
      },
    })

    for (const day of days) {
      const dateStr = format(day, "yyyy-MM-dd")
      const daySchedules = schedules.filter(
        (s) => format(s.date, "yyyy-MM-dd") === dateStr
      )
      const dayAttendances = attendances.filter(
        (a) => format(a.date, "yyyy-MM-dd") === dateStr
      )
      const dayLeaves = leaveRequests.filter(
        (l) => l.startDate <= day && l.endDate >= day
      )

      const scheduledCount = daySchedules.length
      const presentCount = dayAttendances.filter(
        (a) => a.status === "CLOCKED_OUT" || a.status === "APPROVED"
      ).length
      const onLeaveCount = dayLeaves.length
      const lateCount = 0 // Would need schedule time comparison

      results.push({
        date: dateStr,
        present: presentCount,
        absent: Math.max(0, scheduledCount - presentCount - onLeaveCount),
        late: lateCount,
        onLeave: onLeaveCount,
        total: scheduledCount,
      })
    }

    return results
  }

  /**
   * Get employee attendance details for a store
   */
  async getEmployeeAttendanceDetails(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<EmployeeAttendanceDetail[]> {
    // Get all employees in the store
    const userStores = await prisma.userStore.findMany({
      where: {
        storeId,
        canClockIn: true,
        user: { status: "ACTIVE" },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
          },
        },
      },
    })

    const results: EmployeeAttendanceDetail[] = []

    for (const us of userStores) {
      const user = us.user

      // Get schedules
      const schedules = await prisma.schedule.findMany({
        where: {
          userId: user.id,
          storeId,
          date: {
            gte: startOfDay(startDate),
            lte: endOfDay(endDate),
          },
          status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.CONFIRMED] },
        },
      })

      // Get attendances
      const attendances = await prisma.attendance.findMany({
        where: {
          userId: user.id,
          storeId,
          date: {
            gte: startOfDay(startDate),
            lte: endOfDay(endDate),
          },
        },
      })

      // Get leave requests
      const leaveRequests = await prisma.leaveRequest.findMany({
        where: {
          userId: user.id,
          status: "APPROVED",
          startDate: { lte: endOfDay(endDate) },
          endDate: { gte: startOfDay(startDate) },
        },
      })

      const scheduledDays = schedules.length
      const presentDays = attendances.filter(
        (a) => a.status === "CLOCKED_OUT" || a.status === "APPROVED"
      ).length

      // Calculate leave days within the period
      let leaveDays = 0
      for (const leave of leaveRequests) {
        const leaveStart = leave.startDate < startDate ? startDate : leave.startDate
        const leaveEnd = leave.endDate > endDate ? endDate : leave.endDate
        const days = eachDayOfInterval({ start: leaveStart, end: leaveEnd })
        leaveDays += days.length
      }

      const absentDays = Math.max(0, scheduledDays - presentDays - leaveDays)

      let totalWorkMinutes = 0
      let overtimeMinutes = 0
      for (const att of attendances) {
        if (att.netWorkMinutes) totalWorkMinutes += att.netWorkMinutes
        if (att.overtimeMinutes) overtimeMinutes += att.overtimeMinutes
      }

      const attendanceRate = scheduledDays > 0
        ? Math.round((presentDays / scheduledDays) * 100)
        : 100

      results.push({
        userId: user.id,
        userName: user.name,
        employeeId: user.employeeId,
        presentDays,
        absentDays,
        lateDays: 0, // Simplified
        leaveDays,
        totalWorkHours: Math.round((totalWorkMinutes / 60) * 100) / 100,
        overtimeHours: Math.round((overtimeMinutes / 60) * 100) / 100,
        attendanceRate,
      })
    }

    return results.sort((a, b) => a.userName.localeCompare(b.userName))
  }

  /**
   * Get store statistics summary
   */
  async getStoreStatistics(
    storeIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<StoreStatistics[]> {
    const results: StoreStatistics[] = []

    for (const storeId of storeIds) {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
      })
      if (!store) continue

      const employees = await prisma.userStore.count({
        where: {
          storeId,
          canClockIn: true,
          user: { status: "ACTIVE" },
        },
      })

      const details = await this.getEmployeeAttendanceDetails(storeId, startDate, endDate)

      const totalWorkHours = details.reduce((sum, d) => sum + d.totalWorkHours, 0)
      const totalOvertimeHours = details.reduce((sum, d) => sum + d.overtimeHours, 0)
      const avgAttendanceRate = details.length > 0
        ? Math.round(details.reduce((sum, d) => sum + d.attendanceRate, 0) / details.length)
        : 100

      const leaveCount = await prisma.leaveRequest.count({
        where: {
          user: {
            stores: { some: { storeId } },
          },
          status: "APPROVED",
          startDate: { lte: endOfDay(endDate) },
          endDate: { gte: startOfDay(startDate) },
        },
      })

      results.push({
        storeId,
        storeName: store.name,
        totalEmployees: employees,
        averageAttendanceRate: avgAttendanceRate,
        totalWorkHours: Math.round(totalWorkHours * 100) / 100,
        totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
        leaveCount,
      })
    }

    return results
  }

  /**
   * Get monthly trend data
   */
  async getMonthlyTrend(
    storeId: string,
    year: number
  ): Promise<{ month: string; workHours: number; overtimeHours: number; attendanceRate: number }[]> {
    const results = []

    for (let month = 0; month < 12; month++) {
      const startDate = startOfMonth(new Date(year, month, 1))
      const endDate = endOfMonth(new Date(year, month, 1))

      // Skip future months
      if (startDate > new Date()) break

      const details = await this.getEmployeeAttendanceDetails(storeId, startDate, endDate)

      const workHours = details.reduce((sum, d) => sum + d.totalWorkHours, 0)
      const overtimeHours = details.reduce((sum, d) => sum + d.overtimeHours, 0)
      const attendanceRate = details.length > 0
        ? Math.round(details.reduce((sum, d) => sum + d.attendanceRate, 0) / details.length)
        : 100

      results.push({
        month: format(startDate, "yyyy-MM"),
        workHours: Math.round(workHours),
        overtimeHours: Math.round(overtimeHours),
        attendanceRate,
      })
    }

    return results
  }

  /**
   * Export attendance report to CSV
   */
  async exportAttendanceCSV(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    const details = await this.getEmployeeAttendanceDetails(storeId, startDate, endDate)

    const headers = [
      "員工編號",
      "姓名",
      "出勤天數",
      "缺勤天數",
      "請假天數",
      "總工時",
      "加班時數",
      "出勤率 (%)",
    ]

    const rows = details.map((d) => [
      d.employeeId,
      d.userName,
      d.presentDays,
      d.absentDays,
      d.leaveDays,
      d.totalWorkHours.toFixed(1),
      d.overtimeHours.toFixed(1),
      d.attendanceRate,
    ])

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")

    return csv
  }
}

export const reportService = new ReportService()
