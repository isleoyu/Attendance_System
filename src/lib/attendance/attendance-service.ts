import { prisma } from "@/lib/prisma"
import { ClockStateMachine, ClockState, ClockAction } from "./state-machine"
import { calculateWorkHours } from "./work-hours-calculator"
import type { AttendanceStatus, BreakType } from "@prisma/client"
import { startOfDay, endOfDay } from "@/lib/utils"

export interface ClockResult {
  success: boolean
  message: string
  attendance?: Awaited<ReturnType<typeof prisma.attendance.findUnique>>
  newState?: ClockState
}

export class AttendanceService {
  /**
   * Get today's attendance for a user
   */
  async getTodayAttendance(userId: string, storeId: string) {
    const today = new Date()
    const attendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: startOfDay(today),
        },
      },
      include: {
        breaks: {
          orderBy: { startTime: "desc" },
        },
        schedule: {
          include: {
            shiftType: true,
          },
        },
        store: true,
      },
    })

    // Get today's schedule if no attendance yet
    const schedule = await prisma.schedule.findUnique({
      where: {
        userId_date: {
          userId,
          date: startOfDay(today),
        },
      },
      include: {
        shiftType: true,
      },
    })

    return { attendance, schedule }
  }

  /**
   * Get current clock state for user
   */
  async getCurrentState(userId: string, storeId: string) {
    const { attendance, schedule } = await this.getTodayAttendance(userId, storeId)

    const stateMachine = ClockStateMachine.fromAttendance(attendance, {
      userId,
      storeId,
      schedule: schedule ?? undefined,
    })

    return {
      state: stateMachine.getState(),
      availableActions: stateMachine.getAvailableActions(),
      attendance,
      schedule,
    }
  }

  /**
   * Clock in
   */
  async clockIn(userId: string, storeId: string): Promise<ClockResult> {
    const { attendance, schedule } = await this.getTodayAttendance(userId, storeId)

    const stateMachine = ClockStateMachine.fromAttendance(attendance, {
      userId,
      storeId,
      schedule: schedule ?? undefined,
    })

    const canTransition = stateMachine.canTransition(ClockAction.CLOCK_IN)
    if (!canTransition.allowed) {
      return {
        success: false,
        message: canTransition.reason || "無法上班打卡",
      }
    }

    const now = new Date()
    const newAttendance = await prisma.attendance.create({
      data: {
        userId,
        storeId,
        date: startOfDay(now),
        clockIn: now,
        status: "CLOCKED_IN",
        scheduleId: schedule?.id,
      },
      include: {
        breaks: true,
        store: true,
      },
    })

    await this.createAuditLog(userId, "CLOCK_IN", "Attendance", newAttendance.id)

    return {
      success: true,
      message: "上班打卡成功",
      attendance: newAttendance,
      newState: ClockState.WORKING,
    }
  }

  /**
   * Clock out
   */
  async clockOut(userId: string, storeId: string): Promise<ClockResult> {
    const { attendance, schedule } = await this.getTodayAttendance(userId, storeId)

    if (!attendance) {
      return {
        success: false,
        message: "尚未打卡上班",
      }
    }

    const stateMachine = ClockStateMachine.fromAttendance(attendance, {
      userId,
      storeId,
      schedule: schedule ?? undefined,
    })

    const canTransition = stateMachine.canTransition(ClockAction.CLOCK_OUT)
    if (!canTransition.allowed) {
      return {
        success: false,
        message: canTransition.reason || "無法下班打卡",
      }
    }

    const now = new Date()

    // Calculate work hours
    const workHours = calculateWorkHours({
      clockIn: attendance.clockIn!,
      clockOut: now,
      clockIn2: attendance.clockIn2 ?? undefined,
      clockOut2: attendance.clockOut2 ?? undefined,
      breaks: attendance.breaks.map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
        type: b.type,
      })),
      shiftType: schedule?.shiftType,
    })

    // Determine if review is needed
    const status: AttendanceStatus = workHours.requiresReview
      ? "PENDING_REVIEW"
      : "CLOCKED_OUT"

    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOut: now,
        status,
        totalMinutes: workHours.totalMinutes,
        breakMinutes: workHours.breakMinutes,
        netWorkMinutes: workHours.netWorkMinutes,
        overtimeMinutes: workHours.overtimeMinutes,
      },
      include: {
        breaks: true,
        store: true,
      },
    })

    await this.createAuditLog(userId, "CLOCK_OUT", "Attendance", attendance.id)

    return {
      success: true,
      message: status === "PENDING_REVIEW" ? "下班打卡成功，需主管審核" : "下班打卡成功",
      attendance: updatedAttendance,
      newState: ClockState.CLOCKED_OUT,
    }
  }

  /**
   * Start break
   */
  async startBreak(
    userId: string,
    storeId: string,
    breakType: BreakType = "REST"
  ): Promise<ClockResult> {
    const { attendance, schedule } = await this.getTodayAttendance(userId, storeId)

    if (!attendance) {
      return {
        success: false,
        message: "尚未打卡上班",
      }
    }

    const stateMachine = ClockStateMachine.fromAttendance(attendance, {
      userId,
      storeId,
      schedule: schedule ?? undefined,
    })

    const canTransition = stateMachine.canTransition(ClockAction.START_BREAK)
    if (!canTransition.allowed) {
      return {
        success: false,
        message: canTransition.reason || "無法開始休息",
      }
    }

    const now = new Date()

    // Create break record and update attendance status
    await prisma.$transaction([
      prisma.break.create({
        data: {
          attendanceId: attendance.id,
          startTime: now,
          type: breakType,
        },
      }),
      prisma.attendance.update({
        where: { id: attendance.id },
        data: { status: "ON_BREAK" },
      }),
    ])

    const updatedAttendance = await prisma.attendance.findUnique({
      where: { id: attendance.id },
      include: {
        breaks: true,
        store: true,
      },
    })

    await this.createAuditLog(userId, "START_BREAK", "Attendance", attendance.id)

    return {
      success: true,
      message: "開始休息",
      attendance: updatedAttendance ?? undefined,
      newState: ClockState.ON_BREAK,
    }
  }

  /**
   * End break
   */
  async endBreak(userId: string, storeId: string): Promise<ClockResult> {
    const { attendance, schedule } = await this.getTodayAttendance(userId, storeId)

    if (!attendance) {
      return {
        success: false,
        message: "尚未打卡上班",
      }
    }

    const stateMachine = ClockStateMachine.fromAttendance(attendance, {
      userId,
      storeId,
      schedule: schedule ?? undefined,
    })

    const canTransition = stateMachine.canTransition(ClockAction.END_BREAK)
    if (!canTransition.allowed) {
      return {
        success: false,
        message: canTransition.reason || "無法結束休息",
      }
    }

    // Find the unended break
    const currentBreak = attendance.breaks.find((b) => !b.endTime)
    if (!currentBreak) {
      return {
        success: false,
        message: "找不到進行中的休息記錄",
      }
    }

    const now = new Date()
    const durationMinutes = Math.floor(
      (now.getTime() - currentBreak.startTime.getTime()) / (1000 * 60)
    )

    // Update break and attendance status
    await prisma.$transaction([
      prisma.break.update({
        where: { id: currentBreak.id },
        data: {
          endTime: now,
          durationMinutes,
        },
      }),
      prisma.attendance.update({
        where: { id: attendance.id },
        data: { status: "CLOCKED_IN" },
      }),
    ])

    const updatedAttendance = await prisma.attendance.findUnique({
      where: { id: attendance.id },
      include: {
        breaks: true,
        store: true,
      },
    })

    await this.createAuditLog(userId, "END_BREAK", "Attendance", attendance.id)

    return {
      success: true,
      message: `結束休息 (${durationMinutes} 分鐘)`,
      attendance: updatedAttendance ?? undefined,
      newState: ClockState.WORKING,
    }
  }

  /**
   * Get attendance history for a user
   */
  async getAttendanceHistory(
    userId: string,
    startDate: Date,
    endDate: Date,
    storeId?: string
  ) {
    const where: any = {
      userId,
      date: {
        gte: startOfDay(startDate),
        lte: endOfDay(endDate),
      },
    }

    if (storeId) {
      where.storeId = storeId
    }

    return prisma.attendance.findMany({
      where,
      include: {
        breaks: true,
        store: true,
        schedule: {
          include: {
            shiftType: true,
          },
        },
      },
      orderBy: { date: "desc" },
    })
  }

  /**
   * Get attendance summary statistics
   */
  async getAttendanceSummary(userId: string, startDate: Date, endDate: Date) {
    const attendances = await this.getAttendanceHistory(userId, startDate, endDate)

    let totalWorkMinutes = 0
    let totalBreakMinutes = 0
    let totalOvertimeMinutes = 0
    let daysWorked = 0
    let daysLate = 0
    let daysEarlyLeave = 0

    for (const att of attendances) {
      if (att.netWorkMinutes) {
        totalWorkMinutes += att.netWorkMinutes
        daysWorked++
      }
      if (att.breakMinutes) {
        totalBreakMinutes += att.breakMinutes
      }
      if (att.overtimeMinutes) {
        totalOvertimeMinutes += att.overtimeMinutes
      }
      // Check for late/early issues based on schedule
      // This would need more detailed calculation
    }

    return {
      totalWorkMinutes,
      totalBreakMinutes,
      totalOvertimeMinutes,
      daysWorked,
      daysLate,
      daysEarlyLeave,
      averageWorkMinutesPerDay: daysWorked > 0 ? Math.round(totalWorkMinutes / daysWorked) : 0,
    }
  }

  private async createAuditLog(
    userId: string,
    action: string,
    entityType: string,
    entityId: string
  ) {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
      },
    })
  }
}

export const attendanceService = new AttendanceService()
