import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { payrollService } from "@/lib/payroll/payroll-service"

/**
 * GET /api/payroll/summary?periodStart=xxx&periodEnd=xxx&storeId=xxx
 * Get payroll summary for a store
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can view payroll summary
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const periodStart = searchParams.get("periodStart")
    const periodEnd = searchParams.get("periodEnd")
    const storeId = searchParams.get("storeId")

    if (!periodStart || !periodEnd || !storeId) {
      return NextResponse.json({ error: "請提供期間和店鋪" }, { status: 400 })
    }

    // Check store access
    const hasAccess = session.user.stores.some((s) => s.id === storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
    }

    const summary = await payrollService.getPayrollSummary(
      storeId,
      new Date(periodStart),
      new Date(periodEnd)
    )

    return NextResponse.json(summary)
  } catch (error) {
    console.error("Error fetching payroll summary:", error)
    return NextResponse.json({ error: "取得薪資摘要失敗" }, { status: 500 })
  }
}
