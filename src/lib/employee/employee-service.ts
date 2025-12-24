import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { hash } from "bcryptjs"
import type { Role, UserStatus, EmploymentType } from "@prisma/client"

export const createEmployeeSchema = z.object({
  employeeId: z.string().min(1, "員工編號必填"),
  name: z.string().min(1, "姓名必填"),
  email: z.string().email("請輸入有效的電子郵件").optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, "密碼至少 6 個字元"),
  role: z.enum(["EMPLOYEE", "SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"]),
  employmentType: z.enum(["FULL_TIME", "PART_TIME"]).default("PART_TIME"),
  hourlyRate: z.number().min(0).optional().nullable(),    // 時薪 (兼職)
  monthlySalary: z.number().min(0).optional().nullable(), // 月薪 (正職)
  storeAssignments: z.array(z.object({
    storeId: z.string(),
    isPrimary: z.boolean().default(false),
    canClockIn: z.boolean().default(true),
  })).min(1, "至少需指派一個店鋪"),
})

export const updateEmployeeSchema = z.object({
  name: z.string().min(1, "姓名必填").optional(),
  email: z.string().email("請輸入有效的電子郵件").optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, "密碼至少 6 個字元").optional(),
  role: z.enum(["EMPLOYEE", "SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME"]).optional(),
  hourlyRate: z.number().min(0).optional().nullable(),
  monthlySalary: z.number().min(0).optional().nullable(),
  storeAssignments: z.array(z.object({
    storeId: z.string(),
    isPrimary: z.boolean().default(false),
    canClockIn: z.boolean().default(true),
  })).optional(),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>

export interface EmployeeWithStores {
  id: string
  employeeId: string
  name: string
  email: string | null
  phone: string | null
  role: Role
  status: UserStatus
  employmentType: EmploymentType
  hourlyRate: number | null    // 時薪 (兼職)
  monthlySalary: number | null // 月薪 (正職)
  createdAt: Date
  stores: {
    id: string
    storeId: string
    storeName: string
    isPrimary: boolean
    canClockIn: boolean
  }[]
}

export class EmployeeService {
  /**
   * Get all employees with optional filters
   */
  async getEmployees(options: {
    storeId?: string
    role?: Role
    status?: UserStatus
    search?: string
    page?: number
    limit?: number
  } = {}): Promise<{ employees: EmployeeWithStores[]; total: number }> {
    const { storeId, role, status, search, page = 1, limit = 20 } = options

    const where: any = {}

    if (role) {
      where.role = role
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { employeeId: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }

    if (storeId) {
      where.stores = {
        some: { storeId },
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          stores: {
            include: {
              store: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    const employees: EmployeeWithStores[] = users.map((user) => ({
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      employmentType: user.employmentType,
      hourlyRate: user.hourlyRate ? Number(user.hourlyRate) : null,
      monthlySalary: user.monthlySalary ? Number(user.monthlySalary) : null,
      createdAt: user.createdAt,
      stores: user.stores.map((s) => ({
        id: s.id,
        storeId: s.storeId,
        storeName: s.store.name,
        isPrimary: s.isPrimary,
        canClockIn: s.canClockIn,
      })),
    }))

    return { employees, total }
  }

  /**
   * Get a single employee by ID
   */
  async getEmployee(id: string): Promise<EmployeeWithStores | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        stores: {
          include: {
            store: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    if (!user) return null

    return {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      employmentType: user.employmentType,
      hourlyRate: user.hourlyRate ? Number(user.hourlyRate) : null,
      monthlySalary: user.monthlySalary ? Number(user.monthlySalary) : null,
      createdAt: user.createdAt,
      stores: user.stores.map((s) => ({
        id: s.id,
        storeId: s.storeId,
        storeName: s.store.name,
        isPrimary: s.isPrimary,
        canClockIn: s.canClockIn,
      })),
    }
  }

  /**
   * Create a new employee
   */
  async createEmployee(input: CreateEmployeeInput, createdBy: string): Promise<EmployeeWithStores> {
    // Check if employee ID already exists
    const existing = await prisma.user.findUnique({
      where: { employeeId: input.employeeId },
    })

    if (existing) {
      throw new Error("員工編號已存在")
    }

    // Hash password
    const passwordHash = await hash(input.password, 12)

    // Ensure only one primary store
    const storeAssignments = input.storeAssignments.map((s, index) => ({
      ...s,
      isPrimary: index === 0 ? true : s.isPrimary,
    }))

    // Make sure only one is primary
    const primaryCount = storeAssignments.filter((s) => s.isPrimary).length
    if (primaryCount > 1) {
      storeAssignments.forEach((s, index) => {
        if (index > 0) s.isPrimary = false
      })
    }

    const user = await prisma.user.create({
      data: {
        employeeId: input.employeeId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        passwordHash,
        role: input.role,
        employmentType: input.employmentType || "PART_TIME",
        hourlyRate: input.employmentType === "PART_TIME" ? input.hourlyRate : null,
        monthlySalary: input.employmentType === "FULL_TIME" ? input.monthlySalary : null,
        stores: {
          create: storeAssignments.map((s) => ({
            storeId: s.storeId,
            isPrimary: s.isPrimary,
            canClockIn: s.canClockIn,
          })),
        },
      },
      include: {
        stores: {
          include: {
            store: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: createdBy,
        action: "CREATE_EMPLOYEE",
        entityType: "User",
        entityId: user.id,
        newValue: {
          employeeId: input.employeeId,
          name: input.name,
          role: input.role,
        },
      },
    })

    return {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      employmentType: user.employmentType,
      hourlyRate: user.hourlyRate ? Number(user.hourlyRate) : null,
      monthlySalary: user.monthlySalary ? Number(user.monthlySalary) : null,
      createdAt: user.createdAt,
      stores: user.stores.map((s) => ({
        id: s.id,
        storeId: s.storeId,
        storeName: s.store.name,
        isPrimary: s.isPrimary,
        canClockIn: s.canClockIn,
      })),
    }
  }

  /**
   * Update an employee
   */
  async updateEmployee(
    id: string,
    input: UpdateEmployeeInput,
    updatedBy: string
  ): Promise<EmployeeWithStores> {
    const existing = await prisma.user.findUnique({
      where: { id },
      include: { stores: true },
    })

    if (!existing) {
      throw new Error("員工不存在")
    }

    const updateData: any = {}

    if (input.name !== undefined) updateData.name = input.name
    if (input.email !== undefined) updateData.email = input.email
    if (input.phone !== undefined) updateData.phone = input.phone
    if (input.role !== undefined) updateData.role = input.role
    if (input.status !== undefined) updateData.status = input.status
    if (input.employmentType !== undefined) updateData.employmentType = input.employmentType

    // Handle salary based on employment type
    if (input.employmentType === "PART_TIME") {
      if (input.hourlyRate !== undefined) updateData.hourlyRate = input.hourlyRate
      updateData.monthlySalary = null
    } else if (input.employmentType === "FULL_TIME") {
      if (input.monthlySalary !== undefined) updateData.monthlySalary = input.monthlySalary
      updateData.hourlyRate = null
    } else {
      // If employment type not changing, just update the relevant salary field
      if (input.hourlyRate !== undefined) updateData.hourlyRate = input.hourlyRate
      if (input.monthlySalary !== undefined) updateData.monthlySalary = input.monthlySalary
    }

    if (input.password) {
      updateData.passwordHash = await hash(input.password, 12)
    }

    // Handle store assignments
    if (input.storeAssignments) {
      // Delete existing assignments
      await prisma.userStore.deleteMany({
        where: { userId: id },
      })

      // Ensure only one primary
      const storeAssignments = input.storeAssignments.map((s, index) => ({
        ...s,
        isPrimary: index === 0 ? true : s.isPrimary,
      }))

      const primaryCount = storeAssignments.filter((s) => s.isPrimary).length
      if (primaryCount > 1) {
        storeAssignments.forEach((s, index) => {
          if (index > 0) s.isPrimary = false
        })
      }

      // Create new assignments
      await prisma.userStore.createMany({
        data: storeAssignments.map((s) => ({
          userId: id,
          storeId: s.storeId,
          isPrimary: s.isPrimary,
          canClockIn: s.canClockIn,
        })),
      })
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        stores: {
          include: {
            store: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: updatedBy,
        action: "UPDATE_EMPLOYEE",
        entityType: "User",
        entityId: id,
        oldValue: {
          name: existing.name,
          role: existing.role,
          status: existing.status,
        },
        newValue: input,
      },
    })

    return {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      employmentType: user.employmentType,
      hourlyRate: user.hourlyRate ? Number(user.hourlyRate) : null,
      monthlySalary: user.monthlySalary ? Number(user.monthlySalary) : null,
      createdAt: user.createdAt,
      stores: user.stores.map((s) => ({
        id: s.id,
        storeId: s.storeId,
        storeName: s.store.name,
        isPrimary: s.isPrimary,
        canClockIn: s.canClockIn,
      })),
    }
  }

  /**
   * Delete an employee (soft delete by setting status to INACTIVE)
   */
  async deleteEmployee(id: string, deletedBy: string): Promise<void> {
    const existing = await prisma.user.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new Error("員工不存在")
    }

    await prisma.user.update({
      where: { id },
      data: { status: "INACTIVE" },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: deletedBy,
        action: "DELETE_EMPLOYEE",
        entityType: "User",
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: "INACTIVE" },
      },
    })
  }

  /**
   * Get all stores for dropdown
   */
  async getAllStores(): Promise<{ id: string; name: string }[]> {
    return prisma.store.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  }
}

export const employeeService = new EmployeeService()
