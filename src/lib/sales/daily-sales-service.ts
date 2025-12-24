import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { startOfDay, endOfDay, startOfMonth } from "@/lib/utils"
import { Decimal } from "@prisma/client/runtime/library"
import type { SalesEntryType } from "@prisma/client"

// ===== Validation Schemas =====

export const createDailySalesReportSchema = z.object({
  storeId: z.string().min(1, "店鋪必填"),
  date: z.string().transform((val) => new Date(val)),
  dailySales: z.number().min(0, "當日營業額不可為負"),
  cashIncome: z.number().min(0, "現金收入不可為負"),
  linePayIncome: z.number().min(0, "LinePay 收入不可為負"),
  uberIncome: z.number().min(0, "Uber 收入不可為負"),
  foodPandaIncome: z.number().min(0, "FoodPanda 收入不可為負"),
  expenses: z.number().min(0, "支出費用不可為負"),
  cashDifference: z.number(), // 可正可負
  dailyCash: z.number().min(0, "當日現金不可為負"),
  depositedCash: z.number().min(0, "存入現金不可為負"),
  undepositedCash: z.number().min(0, "未存現金不可為負"),
  notes: z.string().optional(),
})

export const updateDailySalesReportSchema = createDailySalesReportSchema.partial().omit({
  storeId: true,
  date: true,
})

export const createSalesEntrySchema = z.object({
  reportId: z.string().min(1, "報表 ID 必填"),
  entryType: z.enum([
    "CASH_INCOME",
    "LINEPAY_INCOME",
    "UBER_INCOME",
    "FOODPANDA_INCOME",
    "EXPENSE",
    "DEPOSIT",
    "ADJUSTMENT",
    "OTHER",
  ]),
  amount: z.number(),
  description: z.string().optional(),
  reference: z.string().optional(),
})

export type CreateDailySalesReportInput = z.infer<typeof createDailySalesReportSchema>
export type UpdateDailySalesReportInput = z.infer<typeof updateDailySalesReportSchema>
export type CreateSalesEntryInput = z.infer<typeof createSalesEntrySchema>

// ===== Daily Sales Service =====

export class DailySalesService {
  /**
   * Get daily sales report for a specific date
   */
  async getDailyReport(storeId: string, date: Date) {
    const report = await prisma.dailySalesReport.findUnique({
      where: {
        storeId_date: {
          storeId,
          date: startOfDay(date),
        },
      },
      include: {
        submitter: {
          select: {
            id: true,
            name: true,
            employeeId: true,
          },
        },
        entries: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                employeeId: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    if (!report) return null

    return this.formatReport(report)
  }

  /**
   * Get daily sales reports for a date range
   */
  async getReports(options: {
    storeId?: string
    startDate: Date
    endDate: Date
    page?: number
    limit?: number
  }) {
    const { storeId, startDate, endDate, page = 1, limit = 31 } = options

    const where: any = {
      date: {
        gte: startOfDay(startDate),
        lte: endOfDay(endDate),
      },
    }

    if (storeId) {
      where.storeId = storeId
    }

    const [reports, total] = await Promise.all([
      prisma.dailySalesReport.findMany({
        where,
        include: {
          submitter: {
            select: {
              id: true,
              name: true,
              employeeId: true,
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: { entries: true },
          },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dailySalesReport.count({ where }),
    ])

    return {
      reports: reports.map((r) => this.formatReport(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Create or update daily sales report
   */
  async upsertDailyReport(input: CreateDailySalesReportInput, submitterId: string) {
    const reportDate = startOfDay(input.date)

    // Calculate system fields
    const { cumulativeSales, totalLaborHours, productivity } = await this.calculateSystemFields(
      input.storeId,
      reportDate,
      input.dailySales
    )

    // Check for existing report
    const existing = await prisma.dailySalesReport.findUnique({
      where: {
        storeId_date: {
          storeId: input.storeId,
          date: reportDate,
        },
      },
    })

    const data = {
      dailySales: new Decimal(input.dailySales),
      cashIncome: new Decimal(input.cashIncome),
      linePayIncome: new Decimal(input.linePayIncome),
      uberIncome: new Decimal(input.uberIncome),
      foodPandaIncome: new Decimal(input.foodPandaIncome),
      expenses: new Decimal(input.expenses),
      cashDifference: new Decimal(input.cashDifference),
      dailyCash: new Decimal(input.dailyCash),
      depositedCash: new Decimal(input.depositedCash),
      undepositedCash: new Decimal(input.undepositedCash),
      cumulativeSales: new Decimal(cumulativeSales),
      totalLaborHours: new Decimal(totalLaborHours),
      productivity: new Decimal(productivity),
      notes: input.notes,
    }

    let report

    if (existing) {
      report = await prisma.dailySalesReport.update({
        where: { id: existing.id },
        data: {
          ...data,
          submitterId,
        },
        include: {
          submitter: {
            select: { id: true, name: true, employeeId: true },
          },
          store: {
            select: { id: true, name: true, code: true },
          },
        },
      })

      // Add update entry to journal
      await this.addEntry({
        reportId: report.id,
        entryType: "ADJUSTMENT",
        amount: input.dailySales,
        description: "報表更新",
      }, submitterId)
    } else {
      report = await prisma.dailySalesReport.create({
        data: {
          storeId: input.storeId,
          date: reportDate,
          submitterId,
          ...data,
        },
        include: {
          submitter: {
            select: { id: true, name: true, employeeId: true },
          },
          store: {
            select: { id: true, name: true, code: true },
          },
        },
      })

      // Add initial entries to journal
      if (input.cashIncome > 0) {
        await this.addEntry({
          reportId: report.id,
          entryType: "CASH_INCOME",
          amount: input.cashIncome,
          description: "現金收入",
        }, submitterId)
      }
      if (input.linePayIncome > 0) {
        await this.addEntry({
          reportId: report.id,
          entryType: "LINEPAY_INCOME",
          amount: input.linePayIncome,
          description: "LinePay 收入",
        }, submitterId)
      }
      if (input.uberIncome > 0) {
        await this.addEntry({
          reportId: report.id,
          entryType: "UBER_INCOME",
          amount: input.uberIncome,
          description: "Uber 收入",
        }, submitterId)
      }
      if (input.foodPandaIncome > 0) {
        await this.addEntry({
          reportId: report.id,
          entryType: "FOODPANDA_INCOME",
          amount: input.foodPandaIncome,
          description: "FoodPanda 收入",
        }, submitterId)
      }
      if (input.expenses > 0) {
        await this.addEntry({
          reportId: report.id,
          entryType: "EXPENSE",
          amount: -input.expenses,
          description: "支出費用",
        }, submitterId)
      }
      if (input.depositedCash > 0) {
        await this.addEntry({
          reportId: report.id,
          entryType: "DEPOSIT",
          amount: input.depositedCash,
          description: "存入現金",
        }, submitterId)
      }
    }

    return this.formatReport(report)
  }

  /**
   * Add a journal entry
   */
  async addEntry(input: CreateSalesEntryInput, createdById: string) {
    const entry = await prisma.dailySalesReportEntry.create({
      data: {
        reportId: input.reportId,
        entryType: input.entryType as SalesEntryType,
        amount: new Decimal(input.amount),
        description: input.description,
        reference: input.reference,
        createdById,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, employeeId: true },
        },
      },
    })

    return entry
  }

  /**
   * Get journal entries for a report
   */
  async getEntries(reportId: string) {
    const entries = await prisma.dailySalesReportEntry.findMany({
      where: { reportId },
      include: {
        createdBy: {
          select: { id: true, name: true, employeeId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return entries.map((e) => ({
      id: e.id,
      entryType: e.entryType,
      amount: Number(e.amount),
      description: e.description,
      reference: e.reference,
      createdBy: e.createdBy,
      createdAt: e.createdAt,
    }))
  }

  /**
   * Get monthly summary
   */
  async getMonthlySummary(storeId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    const reports = await prisma.dailySalesReport.findMany({
      where: {
        storeId,
        date: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
      },
      orderBy: { date: "asc" },
    })

    const summary = {
      month: `${year}-${String(month).padStart(2, "0")}`,
      totalDays: reports.length,
      totalSales: 0,
      totalCashIncome: 0,
      totalLinePayIncome: 0,
      totalUberIncome: 0,
      totalFoodPandaIncome: 0,
      totalExpenses: 0,
      totalCashDifference: 0,
      totalDeposited: 0,
      avgDailySales: 0,
      avgProductivity: 0,
      dailyData: [] as { date: string; sales: number; productivity: number }[],
    }

    for (const report of reports) {
      summary.totalSales += Number(report.dailySales)
      summary.totalCashIncome += Number(report.cashIncome)
      summary.totalLinePayIncome += Number(report.linePayIncome)
      summary.totalUberIncome += Number(report.uberIncome)
      summary.totalFoodPandaIncome += Number(report.foodPandaIncome)
      summary.totalExpenses += Number(report.expenses)
      summary.totalCashDifference += Number(report.cashDifference)
      summary.totalDeposited += Number(report.depositedCash)

      summary.dailyData.push({
        date: report.date.toISOString().split("T")[0],
        sales: Number(report.dailySales),
        productivity: Number(report.productivity),
      })
    }

    if (reports.length > 0) {
      summary.avgDailySales = summary.totalSales / reports.length
      const totalProductivity = reports.reduce((sum, r) => sum + Number(r.productivity), 0)
      summary.avgProductivity = totalProductivity / reports.length
    }

    return summary
  }

  // ===== Helper Methods =====

  /**
   * Calculate system fields (cumulative sales, labor hours, productivity)
   */
  private async calculateSystemFields(storeId: string, date: Date, dailySales: number) {
    // Get cumulative sales for the month
    const monthStart = startOfMonth(date)
    const previousReports = await prisma.dailySalesReport.findMany({
      where: {
        storeId,
        date: {
          gte: monthStart,
          lt: date,
        },
      },
      select: { dailySales: true },
    })

    const previousTotal = previousReports.reduce((sum, r) => sum + Number(r.dailySales), 0)
    const cumulativeSales = previousTotal + dailySales

    // Get total labor hours from attendance records for the day
    const attendances = await prisma.attendance.findMany({
      where: {
        storeId,
        date: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        status: { in: ["CLOCKED_OUT", "APPROVED"] },
      },
      select: { netWorkMinutes: true },
    })

    const totalLaborMinutes = attendances.reduce((sum, a) => sum + (a.netWorkMinutes || 0), 0)
    const totalLaborHours = totalLaborMinutes / 60

    // Calculate productivity (sales per labor hour)
    const productivity = totalLaborHours > 0 ? dailySales / totalLaborHours : 0

    return {
      cumulativeSales: Math.round(cumulativeSales * 100) / 100,
      totalLaborHours: Math.round(totalLaborHours * 100) / 100,
      productivity: Math.round(productivity * 100) / 100,
    }
  }

  /**
   * Format report for response
   */
  private formatReport(report: any) {
    return {
      id: report.id,
      storeId: report.storeId,
      store: report.store,
      date: report.date.toISOString().split("T")[0],
      dailySales: Number(report.dailySales),
      cashIncome: Number(report.cashIncome),
      linePayIncome: Number(report.linePayIncome),
      uberIncome: Number(report.uberIncome),
      foodPandaIncome: Number(report.foodPandaIncome),
      expenses: Number(report.expenses),
      cashDifference: Number(report.cashDifference),
      dailyCash: Number(report.dailyCash),
      depositedCash: Number(report.depositedCash),
      undepositedCash: Number(report.undepositedCash),
      cumulativeSales: Number(report.cumulativeSales),
      totalLaborHours: Number(report.totalLaborHours),
      productivity: Number(report.productivity),
      submitter: report.submitter,
      notes: report.notes,
      entries: report.entries?.map((e: any) => ({
        id: e.id,
        entryType: e.entryType,
        amount: Number(e.amount),
        description: e.description,
        reference: e.reference,
        createdBy: e.createdBy,
        createdAt: e.createdAt,
      })),
      entryCount: report._count?.entries,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }
  }
}

export const dailySalesService = new DailySalesService()
