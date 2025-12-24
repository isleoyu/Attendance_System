import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Validation schemas
export const createShiftTypeSchema = z.object({
  name: z.string().min(1, "班別名稱必填"),
  code: z.string().min(1, "班別代碼必填"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式需為 HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式需為 HH:mm"),
  breakDuration: z.number().min(0).default(30),
  maxBreakCount: z.number().min(1).default(3),
  isSplit: z.boolean().default(false),
  splitBreakStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  splitBreakEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  storeId: z.string(),
})

export const updateShiftTypeSchema = createShiftTypeSchema.partial().omit({ storeId: true })

export type CreateShiftTypeInput = z.infer<typeof createShiftTypeSchema>
export type UpdateShiftTypeInput = z.infer<typeof updateShiftTypeSchema>

export class ShiftTypeService {
  /**
   * Get all shift types for a store
   */
  async getShiftTypesByStore(storeId: string) {
    return prisma.shiftType.findMany({
      where: { storeId },
      orderBy: { startTime: "asc" },
    })
  }

  /**
   * Get a single shift type by ID
   */
  async getShiftTypeById(id: string) {
    return prisma.shiftType.findUnique({
      where: { id },
      include: {
        store: true,
      },
    })
  }

  /**
   * Create a new shift type
   */
  async createShiftType(data: CreateShiftTypeInput) {
    // Check for duplicate code in the same store
    const existing = await prisma.shiftType.findUnique({
      where: {
        storeId_code: {
          storeId: data.storeId,
          code: data.code,
        },
      },
    })

    if (existing) {
      throw new Error("此店鋪已存在相同代碼的班別")
    }

    return prisma.shiftType.create({
      data: {
        name: data.name,
        code: data.code,
        startTime: data.startTime,
        endTime: data.endTime,
        breakDuration: data.breakDuration,
        maxBreakCount: data.maxBreakCount,
        isSplit: data.isSplit,
        splitBreakStart: data.splitBreakStart,
        splitBreakEnd: data.splitBreakEnd,
        storeId: data.storeId,
      },
    })
  }

  /**
   * Update a shift type
   */
  async updateShiftType(id: string, data: UpdateShiftTypeInput) {
    const existing = await prisma.shiftType.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new Error("班別不存在")
    }

    // Check for duplicate code if code is being changed
    if (data.code && data.code !== existing.code) {
      const duplicate = await prisma.shiftType.findUnique({
        where: {
          storeId_code: {
            storeId: existing.storeId,
            code: data.code,
          },
        },
      })

      if (duplicate) {
        throw new Error("此店鋪已存在相同代碼的班別")
      }
    }

    return prisma.shiftType.update({
      where: { id },
      data,
    })
  }

  /**
   * Delete a shift type
   */
  async deleteShiftType(id: string) {
    // Check if any schedules are using this shift type
    const schedulesCount = await prisma.schedule.count({
      where: { shiftTypeId: id },
    })

    if (schedulesCount > 0) {
      throw new Error(`無法刪除：有 ${schedulesCount} 筆排班使用此班別`)
    }

    return prisma.shiftType.delete({
      where: { id },
    })
  }

  /**
   * Calculate expected work hours for a shift type
   */
  calculateExpectedHours(shiftType: {
    startTime: string
    endTime: string
    isSplit: boolean
    splitBreakStart?: string | null
    splitBreakEnd?: string | null
  }) {
    const [startHour, startMin] = shiftType.startTime.split(":").map(Number)
    const [endHour, endMin] = shiftType.endTime.split(":").map(Number)

    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)

    // Handle overnight shifts
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60
    }

    // Subtract split break time
    if (shiftType.isSplit && shiftType.splitBreakStart && shiftType.splitBreakEnd) {
      const [breakStartHour, breakStartMin] = shiftType.splitBreakStart.split(":").map(Number)
      const [breakEndHour, breakEndMin] = shiftType.splitBreakEnd.split(":").map(Number)
      const breakMinutes = (breakEndHour * 60 + breakEndMin) - (breakStartHour * 60 + breakStartMin)
      totalMinutes -= breakMinutes
    }

    return {
      totalMinutes,
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    }
  }
}

export const shiftTypeService = new ShiftTypeService()
