import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { startOfDay, endOfDay } from "@/lib/utils"
import type { PayrollStatus } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"

// 加班費率設定
export const OVERTIME_RATES = {
  // 平日加班
  WEEKDAY: {
    FIRST_2_HOURS: 1.34,  // 前 2 小時
    AFTER_2_HOURS: 1.67,  // 2 小時後
  },
  // 假日加班
  HOLIDAY: 2.0,
  // 國定假日
  NATIONAL_HOLIDAY: 2.0,
}

// 夜班津貼（22:00-06:00）
export const NIGHT_SHIFT_ALLOWANCE = 50 // 每小時加給

export const generatePayrollSchema = z.object({
  storeId: z.string(),
  periodStart: z.string().transform((val) => new Date(val)),
  periodEnd: z.string().transform((val) => new Date(val)),
  userIds: z.array(z.string()).optional(), // 若未指定則計算所有員工
})

export type GeneratePayrollInput = z.infer<typeof generatePayrollSchema>

interface PayrollCalculation {
  userId: string
  userName: string
  employeeId: string
  employmentType: string // FULL_TIME | PART_TIME
  regularHours: number
  overtimeHours: number
  holidayHours: number
  nightShiftHours: number
  basePay: number       // 基本薪資 (月薪或時薪計算)
  overtimePay: number
  holidayPay: number
  nightShiftPay: number
  grossPay: number
  workDays: number
  hourlyRate: number | null     // 時薪 (兼職)
  monthlySalary: number | null  // 月薪 (正職)
  details: {
    date: string
    regularMinutes: number
    overtimeMinutes: number
    isHoliday: boolean
    nightMinutes: number
  }[]
}

export class PayrollService {
  /**
   * Calculate payroll for a period
   */
  async calculatePayroll(
    storeId: string,
    periodStart: Date,
    periodEnd: Date,
    userIds?: string[]
  ): Promise<PayrollCalculation[]> {
    // Get all approved attendances for the period
    const where: any = {
      storeId,
      date: {
        gte: startOfDay(periodStart),
        lte: endOfDay(periodEnd),
      },
      status: { in: ["CLOCKED_OUT", "APPROVED"] },
    }

    if (userIds && userIds.length > 0) {
      where.userId = { in: userIds }
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            employmentType: true,
            hourlyRate: true,
            monthlySalary: true,
          },
        },
        schedule: {
          include: {
            shiftType: true,
          },
        },
        breaks: true,
      },
      orderBy: [{ userId: "asc" }, { date: "asc" }],
    })

    // Group by user
    const userAttendances = new Map<string, typeof attendances>()
    for (const att of attendances) {
      const existing = userAttendances.get(att.userId) || []
      existing.push(att)
      userAttendances.set(att.userId, existing)
    }

    // Calculate payroll for each user
    const results: PayrollCalculation[] = []

    for (const [userId, userAtts] of userAttendances) {
      const user = userAtts[0].user
      const employmentType = user.employmentType || "PART_TIME"
      const isFullTime = employmentType === "FULL_TIME"
      const hourlyRate = user.hourlyRate ? Number(user.hourlyRate) : 183 // 2024 基本時薪
      const monthlySalary = user.monthlySalary ? Number(user.monthlySalary) : null

      // 計算正職員工的時薪（用於加班費計算）
      // 月薪 / 30 天 / 8 小時 = 時薪
      const effectiveHourlyRate = isFullTime && monthlySalary
        ? monthlySalary / 30 / 8
        : hourlyRate

      let totalRegularMinutes = 0
      let totalOvertimeMinutes = 0
      let totalHolidayMinutes = 0
      let totalNightMinutes = 0
      const details: PayrollCalculation["details"] = []

      for (const att of userAtts) {
        if (!att.clockIn || !att.netWorkMinutes) continue

        const dayOfWeek = new Date(att.date).getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

        // Calculate night shift minutes (22:00-06:00)
        const nightMinutes = this.calculateNightMinutes(att.clockIn, att.clockOut)

        if (isWeekend) {
          // Weekend work is all holiday pay
          totalHolidayMinutes += att.netWorkMinutes
          details.push({
            date: att.date.toISOString().split("T")[0],
            regularMinutes: 0,
            overtimeMinutes: 0,
            isHoliday: true,
            nightMinutes,
          })
        } else {
          // Weekday: split into regular and overtime
          const scheduledMinutes = att.schedule?.shiftType
            ? this.getScheduledMinutes(att.schedule.shiftType)
            : 480 // Default 8 hours

          const regularMinutes = Math.min(att.netWorkMinutes, scheduledMinutes)
          const overtimeMinutes = Math.max(0, att.netWorkMinutes - scheduledMinutes)

          totalRegularMinutes += regularMinutes
          totalOvertimeMinutes += overtimeMinutes
          totalNightMinutes += nightMinutes

          details.push({
            date: att.date.toISOString().split("T")[0],
            regularMinutes,
            overtimeMinutes,
            isHoliday: false,
            nightMinutes,
          })
        }
      }

      // Calculate pay
      const regularHours = totalRegularMinutes / 60
      const overtimeHours = totalOvertimeMinutes / 60
      const holidayHours = totalHolidayMinutes / 60
      const nightShiftHours = totalNightMinutes / 60

      let basePay: number
      if (isFullTime && monthlySalary) {
        // 正職員工：計算該期間應發的月薪比例
        const periodDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        const monthDays = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate()
        basePay = (monthlySalary / monthDays) * Math.min(periodDays, monthDays)
      } else {
        // 兼職員工：時薪 x 正常工時
        basePay = regularHours * hourlyRate
      }

      const overtimePay = this.calculateOvertimePay(overtimeHours, effectiveHourlyRate)
      const holidayPay = holidayHours * effectiveHourlyRate * OVERTIME_RATES.HOLIDAY
      const nightShiftPay = nightShiftHours * NIGHT_SHIFT_ALLOWANCE

      results.push({
        userId,
        userName: user.name,
        employeeId: user.employeeId,
        employmentType,
        regularHours: Math.round(regularHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        holidayHours: Math.round(holidayHours * 100) / 100,
        nightShiftHours: Math.round(nightShiftHours * 100) / 100,
        basePay: Math.round(basePay),
        overtimePay: Math.round(overtimePay),
        holidayPay: Math.round(holidayPay),
        nightShiftPay: Math.round(nightShiftPay),
        grossPay: Math.round(basePay + overtimePay + holidayPay + nightShiftPay),
        workDays: userAtts.length,
        hourlyRate: isFullTime ? null : hourlyRate,
        monthlySalary: isFullTime ? monthlySalary : null,
        details,
      })
    }

    return results
  }

  /**
   * Generate and save payroll records
   */
  async generatePayrollRecords(input: GeneratePayrollInput, generatedBy: string) {
    const calculations = await this.calculatePayroll(
      input.storeId,
      input.periodStart,
      input.periodEnd,
      input.userIds
    )

    const records = []

    for (const calc of calculations) {
      // Check for existing record
      const existing = await prisma.payrollRecord.findUnique({
        where: {
          userId_periodStart_periodEnd: {
            userId: calc.userId,
            periodStart: startOfDay(input.periodStart),
            periodEnd: endOfDay(input.periodEnd),
          },
        },
      })

      // 計算各項費率
      const regularRate = calc.employmentType === "FULL_TIME" && calc.monthlySalary
        ? calc.monthlySalary / 30 / 8  // 正職月薪換算時薪
        : calc.basePay / (calc.regularHours || 1)  // 兼職時薪

      if (existing) {
        // Update existing record
        const updated = await prisma.payrollRecord.update({
          where: { id: existing.id },
          data: {
            regularHours: new Decimal(calc.regularHours),
            overtimeHours: new Decimal(calc.overtimeHours),
            holidayHours: new Decimal(calc.holidayHours),
            regularRate: new Decimal(regularRate),
            overtimeRate: new Decimal(calc.overtimePay / (calc.overtimeHours || 1)),
            holidayRate: new Decimal(calc.holidayPay / (calc.holidayHours || 1)),
            grossPay: new Decimal(calc.grossPay),
            deductions: new Decimal(0),
            netPay: new Decimal(calc.grossPay),
            details: {
              ...calc.details,
              employmentType: calc.employmentType,
              basePay: calc.basePay,
              hourlyRate: calc.hourlyRate,
              monthlySalary: calc.monthlySalary,
            } as any,
            status: "DRAFT",
          },
        })
        records.push(updated)
      } else {
        // Create new record
        const created = await prisma.payrollRecord.create({
          data: {
            userId: calc.userId,
            periodStart: startOfDay(input.periodStart),
            periodEnd: endOfDay(input.periodEnd),
            regularHours: new Decimal(calc.regularHours),
            overtimeHours: new Decimal(calc.overtimeHours),
            holidayHours: new Decimal(calc.holidayHours),
            regularRate: new Decimal(regularRate),
            overtimeRate: new Decimal(calc.overtimePay / (calc.overtimeHours || 1)),
            holidayRate: new Decimal(calc.holidayPay / (calc.holidayHours || 1)),
            grossPay: new Decimal(calc.grossPay),
            deductions: new Decimal(0),
            netPay: new Decimal(calc.grossPay),
            details: {
              ...calc.details,
              employmentType: calc.employmentType,
              basePay: calc.basePay,
              hourlyRate: calc.hourlyRate,
              monthlySalary: calc.monthlySalary,
            } as any,
            status: "DRAFT",
          },
        })
        records.push(created)
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: generatedBy,
        action: "GENERATE_PAYROLL",
        entityType: "PayrollRecord",
        entityId: input.storeId,
        newValue: {
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          recordCount: records.length,
        },
      },
    })

    return {
      records,
      calculations,
      summary: {
        totalEmployees: calculations.length,
        totalGrossPay: calculations.reduce((sum, c) => sum + c.grossPay, 0),
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
    }
  }

  /**
   * Get payroll records for a period
   */
  async getPayrollRecords(
    periodStart: Date,
    periodEnd: Date,
    storeId?: string,
    status?: PayrollStatus
  ) {
    const where: any = {
      periodStart: { gte: startOfDay(periodStart) },
      periodEnd: { lte: endOfDay(periodEnd) },
    }

    if (status) {
      where.status = status
    }

    const records = await prisma.payrollRecord.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            stores: {
              where: storeId ? { storeId } : undefined,
              include: {
                store: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { user: { name: "asc" } },
    })

    // Filter by store if needed
    if (storeId) {
      return records.filter((r) => r.user.stores.some((s) => s.storeId === storeId))
    }

    return records
  }

  /**
   * Get a single payroll record
   */
  async getPayrollRecord(id: string) {
    return prisma.payrollRecord.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            employmentType: true,
            hourlyRate: true,
            monthlySalary: true,
          },
        },
      },
    })
  }

  /**
   * Update payroll record status
   */
  async updatePayrollStatus(id: string, status: PayrollStatus, approverId?: string) {
    const data: any = { status }

    if (status === "APPROVED" && approverId) {
      data.approvedAt = new Date()
    }

    if (status === "PAID") {
      data.paidAt = new Date()
    }

    return prisma.payrollRecord.update({
      where: { id },
      data,
    })
  }

  /**
   * Get payroll summary for a store
   */
  async getPayrollSummary(storeId: string, periodStart: Date, periodEnd: Date) {
    const records = await this.getPayrollRecords(periodStart, periodEnd, storeId)

    const summary = {
      totalEmployees: records.length,
      totalRegularHours: 0,
      totalOvertimeHours: 0,
      totalHolidayHours: 0,
      totalGrossPay: 0,
      totalDeductions: 0,
      totalNetPay: 0,
      byStatus: {
        DRAFT: 0,
        PENDING_APPROVAL: 0,
        APPROVED: 0,
        PAID: 0,
        DISPUTED: 0,
      } as Record<string, number>,
    }

    for (const record of records) {
      summary.totalRegularHours += Number(record.regularHours)
      summary.totalOvertimeHours += Number(record.overtimeHours)
      summary.totalHolidayHours += Number(record.holidayHours)
      summary.totalGrossPay += Number(record.grossPay)
      summary.totalDeductions += Number(record.deductions)
      summary.totalNetPay += Number(record.netPay)
      summary.byStatus[record.status] = (summary.byStatus[record.status] || 0) + 1
    }

    return summary
  }

  /**
   * Export payroll to CSV format
   */
  async exportPayrollCSV(periodStart: Date, periodEnd: Date, storeId?: string): Promise<string> {
    const records = await this.getPayrollRecords(periodStart, periodEnd, storeId)

    const headers = [
      "員工編號",
      "姓名",
      "員工類型",
      "正常工時",
      "加班工時",
      "假日工時",
      "基本薪資",
      "加班費",
      "假日加班費",
      "總薪資",
      "扣款",
      "實發金額",
      "狀態",
    ]

    const rows = records.map((r) => {
      const details = r.details as { employmentType?: string; basePay?: number } | null
      const employmentType = details?.employmentType === "FULL_TIME" ? "正職" : "兼職"
      const basePay = details?.basePay ?? Math.round(Number(r.regularHours) * Number(r.regularRate))

      return [
        r.user.employeeId,
        r.user.name,
        employmentType,
        Number(r.regularHours).toFixed(2),
        Number(r.overtimeHours).toFixed(2),
        Number(r.holidayHours).toFixed(2),
        basePay,
        Math.round(Number(r.overtimeHours) * Number(r.overtimeRate)),
        Math.round(Number(r.holidayHours) * Number(r.holidayRate)),
        Number(r.grossPay),
        Number(r.deductions),
        Number(r.netPay),
        r.status,
      ]
    })

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")

    return csv
  }

  // Helper methods
  private calculateOvertimePay(hours: number, hourlyRate: number): number {
    if (hours <= 0) return 0

    const first2Hours = Math.min(hours, 2)
    const afterHours = Math.max(0, hours - 2)

    return (
      first2Hours * hourlyRate * OVERTIME_RATES.WEEKDAY.FIRST_2_HOURS +
      afterHours * hourlyRate * OVERTIME_RATES.WEEKDAY.AFTER_2_HOURS
    )
  }

  private calculateNightMinutes(clockIn: Date, clockOut: Date | null): number {
    if (!clockOut) return 0

    // Night hours: 22:00 - 06:00
    let nightMinutes = 0
    const start = new Date(clockIn)
    const end = new Date(clockOut)

    // Simplified calculation - would need more complex logic for accuracy
    const startHour = start.getHours()
    const endHour = end.getHours()

    if (startHour >= 22 || startHour < 6) {
      nightMinutes += Math.min(60 - start.getMinutes(), (end.getTime() - start.getTime()) / 60000)
    }
    if (endHour >= 22 || endHour < 6) {
      nightMinutes += end.getMinutes()
    }

    return Math.max(0, nightMinutes)
  }

  private getScheduledMinutes(shiftType: { startTime: string; endTime: string }): number {
    const [startHour, startMin] = shiftType.startTime.split(":").map(Number)
    const [endHour, endMin] = shiftType.endTime.split(":").map(Number)

    let minutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
    if (minutes < 0) minutes += 24 * 60 // Overnight shift

    return minutes
  }
}

export const payrollService = new PayrollService()
