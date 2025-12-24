import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { employeeService, createEmployeeSchema } from "@/lib/employee/employee-service"
import type { Role, UserStatus } from "@prisma/client"

/**
 * GET /api/employees
 * Get all employees with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can view employees
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get("storeId") || undefined
    const role = searchParams.get("role") as Role | null
    const status = searchParams.get("status") as UserStatus | null
    const search = searchParams.get("search") || undefined
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    // Store managers can only see employees in their stores
    let filterStoreId = storeId
    if (session.user.role === "STORE_MANAGER" && !storeId) {
      // Get first store
      filterStoreId = session.user.stores[0]?.id
    }

    // Check store access for store managers
    if (session.user.role === "STORE_MANAGER" && filterStoreId) {
      const hasAccess = session.user.stores.some((s) => s.id === filterStoreId)
      if (!hasAccess) {
        return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
      }
    }

    const result = await employeeService.getEmployees({
      storeId: filterStoreId,
      role: role || undefined,
      status: status || undefined,
      search,
      page,
      limit,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching employees:", error)
    return NextResponse.json({ error: "取得員工資料失敗" }, { status: 500 })
  }
}

/**
 * POST /api/employees
 * Create a new employee
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only admins can create employees
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createEmployeeSchema.parse(body)

    const employee = await employeeService.createEmployee(validatedData, session.user.id)

    return NextResponse.json(employee, { status: 201 })
  } catch (error) {
    console.error("Error creating employee:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "新增員工失敗" }, { status: 500 })
  }
}
