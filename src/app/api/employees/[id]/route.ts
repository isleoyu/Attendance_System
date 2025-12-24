import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { employeeService, updateEmployeeSchema } from "@/lib/employee/employee-service"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/employees/:id
 * Get a single employee
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can view employee details
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const employee = await employeeService.getEmployee(id)

    if (!employee) {
      return NextResponse.json({ error: "員工不存在" }, { status: 404 })
    }

    // Store managers can only see employees in their stores
    if (session.user.role === "STORE_MANAGER") {
      const hasAccess = employee.stores.some((s) =>
        session.user.stores.some((us) => us.id === s.storeId)
      )
      if (!hasAccess) {
        return NextResponse.json({ error: "無權限存取此員工" }, { status: 403 })
      }
    }

    return NextResponse.json(employee)
  } catch (error) {
    console.error("Error fetching employee:", error)
    return NextResponse.json({ error: "取得員工資料失敗" }, { status: 500 })
  }
}

/**
 * PUT /api/employees/:id
 * Update an employee
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only admins can update employees
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateEmployeeSchema.parse(body)

    const employee = await employeeService.updateEmployee(id, validatedData, session.user.id)

    return NextResponse.json(employee)
  } catch (error) {
    console.error("Error updating employee:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "更新員工失敗" }, { status: 500 })
  }
}

/**
 * DELETE /api/employees/:id
 * Delete an employee (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only admins can delete employees
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json({ error: "無法刪除自己的帳號" }, { status: 400 })
    }

    await employeeService.deleteEmployee(id, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting employee:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "刪除員工失敗" }, { status: 500 })
  }
}
