import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { startOfDay, endOfDay } from "@/lib/utils"
import type { ScheduleStatus } from "@prisma/client"

// Validation schemas
export const createScheduleSchema = z.object({
  userId: z.string(),
  date: z.string().transform((val) => new Date(val)),
  shiftTypeId: z.string(),
  storeId: z.string(),
  customStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  customEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().optional(),
})

export const updateScheduleSchema = z.object({
  shiftTypeId: z.string().optional(),
  customStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  customEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  status: z.enum(["DRAFT", "SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
  notes: z.string().optional().nullable(),
})

export const batchCreateScheduleSchema = z.object({
  schedules: z.array(z.object({
    userId: z.string(),
    date: z.string(),
    shiftTypeId: z.string(),
  })),
  storeId: z.string(),
  notes: z.string().optional(),
})

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>
export type BatchCreateScheduleInput = z.infer<typeof batchCreateScheduleSchema>

export class ScheduleService {
  /**
   * Get schedules for a date range
   */
  async getSchedules(
    storeId: string,
    startDate: Date,
    endDate: Date,
    userId?: string
  ) {
    const where: any = {
      storeId,
      date: {
        gte: startOfDay(startDate),
        lte: endOfDay(endDate),
      },
    }

    if (userId) {
      where.userId = userId
    }

    return prisma.schedule.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
          },
        },
        shiftType: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { shiftType: { startTime: "asc" } }],
    })
  }

  /**
   * Get a user's schedules
   */
  async getUserSchedules(userId: string, startDate: Date, endDate: Date) {
    return prisma.schedule.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
      },
      include: {
        shiftType: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: "asc" },
    })
  }

  /**
   * Get a single schedule by ID
   */
  async getScheduleById(id: string) {
    return prisma.schedule.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
          },
        },
        shiftType: true,
        store: true,
      },
    })
  }

  /**
   * Create a new schedule
   */
  async createSchedule(data: CreateScheduleInput, publishedBy?: string) {
    // Check for existing schedule
    const existing = await prisma.schedule.findUnique({
      where: {
        userId_date: {
          userId: data.userId,
          date: startOfDay(data.date),
        },
      },
    })

    if (existing) {
      throw new Error("該員工在此日期已有排班")
    }

    // Verify shift type belongs to the store
    const shiftType = await prisma.shiftType.findFirst({
      where: {
        id: data.shiftTypeId,
        storeId: data.storeId,
      },
    })

    if (!shiftType) {
      throw new Error("班別不存在或不屬於此店鋪")
    }

    // Verify user is associated with the store
    const userStore = await prisma.userStore.findUnique({
      where: {
        userId_storeId: {
          userId: data.userId,
          storeId: data.storeId,
        },
      },
    })

    if (!userStore) {
      throw new Error("員工未關聯此店鋪")
    }

    return prisma.schedule.create({
      data: {
        userId: data.userId,
        date: startOfDay(data.date),
        shiftTypeId: data.shiftTypeId,
        storeId: data.storeId,
        customStart: data.customStart,
        customEnd: data.customEnd,
        notes: data.notes,
        status: "SCHEDULED",
        publishedAt: new Date(),
        publishedBy,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
          },
        },
        shiftType: true,
      },
    })
  }

  /**
   * Batch create schedules
   */
  async batchCreateSchedules(data: BatchCreateScheduleInput, publishedBy?: string) {
    const results: { success: any[]; errors: { userId: string; date: string; error: string }[] } = {
      success: [],
      errors: [],
    }

    for (const schedule of data.schedules) {
      try {
        const created = await this.createSchedule(
          {
            userId: schedule.userId,
            date: new Date(schedule.date),
            shiftTypeId: schedule.shiftTypeId,
            storeId: data.storeId,
            notes: data.notes,
          },
          publishedBy
        )
        results.success.push(created)
      } catch (error) {
        results.errors.push({
          userId: schedule.userId,
          date: schedule.date,
          error: error instanceof Error ? error.message : "建立失敗",
        })
      }
    }

    return results
  }

  /**
   * Update a schedule
   */
  async updateSchedule(id: string, data: UpdateScheduleInput) {
    const existing = await prisma.schedule.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new Error("排班不存在")
    }

    // Verify new shift type if changed
    if (data.shiftTypeId && data.shiftTypeId !== existing.shiftTypeId) {
      const shiftType = await prisma.shiftType.findFirst({
        where: {
          id: data.shiftTypeId,
          storeId: existing.storeId,
        },
      })

      if (!shiftType) {
        throw new Error("班別不存在或不屬於此店鋪")
      }
    }

    return prisma.schedule.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
          },
        },
        shiftType: true,
      },
    })
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string) {
    const existing = await prisma.schedule.findUnique({
      where: { id },
      include: {
        attendance: true,
      },
    })

    if (!existing) {
      throw new Error("排班不存在")
    }

    // Check if there's an attendance record linked
    if (existing.attendance.length > 0) {
      throw new Error("此排班已有出勤記錄，無法刪除")
    }

    return prisma.schedule.delete({
      where: { id },
    })
  }

  /**
   * Publish schedules (update status and notify)
   */
  async publishSchedules(
    storeId: string,
    startDate: Date,
    endDate: Date,
    publishedBy: string
  ) {
    const result = await prisma.schedule.updateMany({
      where: {
        storeId,
        date: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
        status: "DRAFT",
      },
      data: {
        status: "SCHEDULED",
        publishedAt: new Date(),
        publishedBy,
      },
    })

    return {
      count: result.count,
      message: `已發布 ${result.count} 筆排班`,
    }
  }

  /**
   * Get store employees for scheduling
   */
  async getStoreEmployees(storeId: string) {
    return prisma.userStore.findMany({
      where: {
        storeId,
        canClockIn: true,
        user: {
          status: "ACTIVE",
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            role: true,
          },
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
    })
  }

  /**
   * Check schedule conflicts
   */
  async checkConflicts(
    userId: string,
    dates: Date[],
    excludeScheduleId?: string
  ) {
    const conflicts = await prisma.schedule.findMany({
      where: {
        userId,
        date: {
          in: dates.map((d) => startOfDay(d)),
        },
        id: excludeScheduleId ? { not: excludeScheduleId } : undefined,
      },
    })

    return conflicts
  }
}

export const scheduleService = new ScheduleService()
