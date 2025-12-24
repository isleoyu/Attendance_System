import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, format } from "date-fns"

/**
 * GET /api/attendance/history?startDate=xxx&endDate=xxx
 * Get current user's attendance history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "請提供日期範圍" }, { status: 400 })
    }

    const userId = session.user.id

    // Get attendance records
    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay(new Date(startDate)),
          lte: endOfDay(new Date(endDate)),
        },
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        breaks: {
          orderBy: { startTime: "asc" },
        },
        schedule: {
          include: {
            shiftType: true,
          },
        },
      },
      orderBy: { date: "desc" },
    })

    // Get schedules for days without attendance (to show as absent/未打卡)
    const schedules = await prisma.schedule.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay(new Date(startDate)),
          lte: endOfDay(new Date(endDate)),
        },
        status: { in: ["SCHEDULED", "CONFIRMED", "COMPLETED"] },
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        shiftType: true,
      },
      orderBy: { date: "desc" },
    })

    // Get leave requests for the period
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: "APPROVED",
        startDate: { lte: endOfDay(new Date(endDate)) },
        endDate: { gte: startOfDay(new Date(startDate)) },
      },
    })

    // Build detailed records
    const records = attendances.map((att) => ({
      id: att.id,
      date: format(att.date, "yyyy-MM-dd"),
      type: "attendance" as const,
      store: att.store,
      schedule: att.schedule
        ? {
            shiftName: att.schedule.shiftType.name,
            startTime: att.schedule.shiftType.startTime,
            endTime: att.schedule.shiftType.endTime,
          }
        : null,
      clockIn: att.clockIn ? format(att.clockIn, "HH:mm") : null,
      clockOut: att.clockOut ? format(att.clockOut, "HH:mm") : null,
      status: att.status,
      totalMinutes: att.totalMinutes,
      breakMinutes: att.breakMinutes,
      netWorkMinutes: att.netWorkMinutes,
      overtimeMinutes: att.overtimeMinutes,
      breaks: att.breaks.map((b) => ({
        id: b.id,
        startTime: format(b.startTime, "HH:mm"),
        endTime: b.endTime ? format(b.endTime, "HH:mm") : null,
        type: b.type,
        durationMinutes: b.durationMinutes,
      })),
    }))

    // Find scheduled days without attendance
    const attendanceDates = new Set(attendances.map((a) => format(a.date, "yyyy-MM-dd")))
    const missedSchedules = schedules
      .filter((s) => !attendanceDates.has(format(s.date, "yyyy-MM-dd")))
      .map((s) => {
        const dateStr = format(s.date, "yyyy-MM-dd")
        // Check if on leave
        const isOnLeave = leaveRequests.some(
          (lr) => lr.startDate <= s.date && lr.endDate >= s.date
        )

        return {
          id: `schedule-${s.id}`,
          date: dateStr,
          type: isOnLeave ? ("leave" as const) : ("absent" as const),
          store: s.store,
          schedule: {
            shiftName: s.shiftType.name,
            startTime: s.shiftType.startTime,
            endTime: s.shiftType.endTime,
          },
          clockIn: null,
          clockOut: null,
          status: isOnLeave ? "ON_LEAVE" : "ABSENT",
          totalMinutes: null,
          breakMinutes: null,
          netWorkMinutes: null,
          overtimeMinutes: null,
          breaks: [],
        }
      })

    // Combine and sort by date desc
    const allRecords = [...records, ...missedSchedules].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    // Calculate summary
    const summary = {
      totalScheduledDays: schedules.length,
      presentDays: attendances.filter(
        (a) => a.status === "CLOCKED_OUT" || a.status === "APPROVED"
      ).length,
      absentDays: missedSchedules.filter((s) => s.type === "absent").length,
      leaveDays: missedSchedules.filter((s) => s.type === "leave").length,
      totalWorkHours: Math.round(
        attendances.reduce((sum, a) => sum + (a.netWorkMinutes || 0), 0) / 60 * 100
      ) / 100,
      totalOvertimeHours: Math.round(
        attendances.reduce((sum, a) => sum + (a.overtimeMinutes || 0), 0) / 60 * 100
      ) / 100,
      totalBreakMinutes: attendances.reduce((sum, a) => sum + (a.breakMinutes || 0), 0),
    }

    return NextResponse.json({
      records: allRecords,
      summary,
    })
  } catch (error) {
    console.error("Error fetching attendance history:", error)
    return NextResponse.json({ error: "取得出勤記錄失敗" }, { status: 500 })
  }
}
