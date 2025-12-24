import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { payrollService, generatePayrollSchema } from "@/lib/payroll/payroll-service"

/**
 * GET /api/payroll?periodStart=xxx&periodEnd=xxx&storeId=xxx
 * Get payroll records
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can view payroll
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const periodStart = searchParams.get("periodStart")
    const periodEnd = searchParams.get("periodEnd")
    const storeId = searchParams.get("storeId")

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: "請提供期間開始和結束日期" }, { status: 400 })
    }

    // Check store access
    if (storeId) {
      const hasAccess = session.user.stores.some((s) => s.id === storeId)
      if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
      }
    }

    const records = await payrollService.getPayrollRecords(
      new Date(periodStart),
      new Date(periodEnd),
      storeId || undefined
    )

    return NextResponse.json(records)
  } catch (error) {
    console.error("Error fetching payroll:", error)
    return NextResponse.json({ error: "取得薪資資料失敗" }, { status: 500 })
  }
}

/**
 * POST /api/payroll
 * Generate payroll records
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can generate payroll
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = generatePayrollSchema.parse(body)

    // Check store access
    const hasAccess = session.user.stores.some((s) => s.id === validatedData.storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
    }

    const result = await payrollService.generatePayrollRecords(
      validatedData,
      session.user.id
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Error generating payroll:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "產生薪資資料失敗" }, { status: 500 })
  }
}
