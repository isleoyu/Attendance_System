import { prisma } from "@/lib/prisma"
import { z } from "zod"

// ===== Validation Schemas =====

export const createStoreSchema = z.object({
  name: z.string().min(1, "店鋪名稱必填"),
  code: z.string().min(1, "店鋪代碼必填").max(20, "店鋪代碼最多 20 個字元"),
  address: z.string().optional(),
  timezone: z.string().default("Asia/Taipei"),
  settings: z.object({
    clockInRadius: z.number().optional(), // 打卡允許半徑（公尺）
    clockInLat: z.number().optional(),    // 打卡點經度
    clockInLng: z.number().optional(),    // 打卡點緯度
    requirePhoto: z.boolean().optional(), // 是否需要打卡照片
    allowEarlyClockIn: z.number().optional(), // 允許提早打卡分鐘
    allowLateClockOut: z.number().optional(), // 允許延遲打卡分鐘
  }).optional(),
})

export const updateStoreSchema = createStoreSchema.partial()

export type CreateStoreInput = z.infer<typeof createStoreSchema>
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>

// ===== Store Service =====

export const storeService = {
  /**
   * Get all stores with employee count
   */
  async getStores(options?: {
    search?: string
    page?: number
    limit?: number
  }) {
    const { search, page = 1, limit = 20 } = options || {}

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
            { address: { contains: search } },
          ],
        }
      : {}

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              schedules: true,
              shiftTypes: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.store.count({ where }),
    ])

    return {
      stores: stores.map((store) => ({
        id: store.id,
        name: store.name,
        code: store.code,
        address: store.address,
        timezone: store.timezone,
        settings: store.settings as Record<string, unknown> | null,
        employeeCount: store._count.users,
        scheduleCount: store._count.schedules,
        shiftTypeCount: store._count.shiftTypes,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  },

  /**
   * Get a single store by ID
   */
  async getStore(id: string) {
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                employeeId: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
        shiftTypes: {
          select: {
            id: true,
            name: true,
            code: true,
            startTime: true,
            endTime: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            schedules: true,
            attendances: true,
          },
        },
      },
    })

    if (!store) return null

    return {
      id: store.id,
      name: store.name,
      code: store.code,
      address: store.address,
      timezone: store.timezone,
      settings: store.settings as Record<string, unknown> | null,
      employees: store.users.map((us) => ({
        id: us.user.id,
        name: us.user.name,
        employeeId: us.user.employeeId,
        role: us.user.role,
        isActive: us.user.isActive,
        isPrimary: us.isPrimary,
        canClockIn: us.canClockIn,
      })),
      shiftTypes: store.shiftTypes,
      scheduleCount: store._count.schedules,
      attendanceCount: store._count.attendances,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    }
  },

  /**
   * Create a new store
   */
  async createStore(data: CreateStoreInput) {
    // Check for duplicate code
    const existing = await prisma.store.findUnique({
      where: { code: data.code },
    })

    if (existing) {
      throw new Error("店鋪代碼已存在")
    }

    const store = await prisma.store.create({
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        timezone: data.timezone || "Asia/Taipei",
        settings: data.settings || {},
      },
    })

    return store
  },

  /**
   * Update a store
   */
  async updateStore(id: string, data: UpdateStoreInput) {
    // Check if store exists
    const existing = await prisma.store.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new Error("店鋪不存在")
    }

    // Check for duplicate code if updating code
    if (data.code && data.code !== existing.code) {
      const duplicateCode = await prisma.store.findUnique({
        where: { code: data.code },
      })

      if (duplicateCode) {
        throw new Error("店鋪代碼已存在")
      }
    }

    const store = await prisma.store.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.timezone && { timezone: data.timezone }),
        ...(data.settings && { settings: data.settings }),
      },
    })

    return store
  },

  /**
   * Delete a store (only if no employees assigned)
   */
  async deleteStore(id: string) {
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            schedules: true,
            attendances: true,
          },
        },
      },
    })

    if (!store) {
      throw new Error("店鋪不存在")
    }

    // Check for dependencies
    if (store._count.users > 0) {
      throw new Error(`無法刪除：此店鋪還有 ${store._count.users} 位員工`)
    }

    if (store._count.schedules > 0) {
      throw new Error(`無法刪除：此店鋪有 ${store._count.schedules} 筆排班記錄`)
    }

    if (store._count.attendances > 0) {
      throw new Error(`無法刪除：此店鋪有 ${store._count.attendances} 筆打卡記錄`)
    }

    await prisma.store.delete({
      where: { id },
    })

    return { success: true }
  },

  /**
   * Get store statistics
   */
  async getStoreStats(storeId: string) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const [
      totalEmployees,
      activeEmployees,
      monthlySchedules,
      monthlyAttendances,
    ] = await Promise.all([
      prisma.userStore.count({
        where: { storeId },
      }),
      prisma.userStore.count({
        where: {
          storeId,
          user: { isActive: true },
        },
      }),
      prisma.schedule.count({
        where: {
          storeId,
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
      prisma.attendance.count({
        where: {
          storeId,
          clockIn: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
    ])

    return {
      totalEmployees,
      activeEmployees,
      monthlySchedules,
      monthlyAttendances,
    }
  },

  /**
   * Get all stores for dropdown (simple list)
   */
  async getAllStoresSimple() {
    const stores = await prisma.store.findMany({
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: "asc" },
    })

    return stores
  },
}
