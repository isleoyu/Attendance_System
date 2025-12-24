import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { scheduleService } from "@/lib/schedule/schedule-service"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/stores/:id/employees
 * Get employees that can be scheduled for a store
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { id: storeId } = await params

    // Check if user has access to this store
    const hasAccess = session.user.stores.some((s) => s.id === storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
    }

    // Only managers and above can see employee list for scheduling
    if (!["SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const employees = await scheduleService.getStoreEmployees(storeId)

    // Format response
    const formattedEmployees = employees.map((e) => ({
      id: e.user.id,
      name: e.user.name,
      employeeId: e.user.employeeId,
      role: e.user.role,
    }))

    return NextResponse.json(formattedEmployees)
  } catch (error) {
    console.error("Error fetching store employees:", error)
    return NextResponse.json({ error: "取得員工列表失敗" }, { status: 500 })
  }
}
