import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { payrollService } from "@/lib/payroll/payroll-service"

/**
 * GET /api/payroll/export?periodStart=xxx&periodEnd=xxx&storeId=xxx
 * Export payroll to CSV
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can export payroll
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

    const csv = await payrollService.exportPayrollCSV(
      new Date(periodStart),
      new Date(periodEnd),
      storeId || undefined
    )

    // Add BOM for Excel UTF-8 compatibility
    const bom = "\uFEFF"
    const csvWithBom = bom + csv

    return new NextResponse(csvWithBom, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll_${periodStart}_${periodEnd}.csv"`,
      },
    })
  } catch (error) {
    console.error("Error exporting payroll:", error)
    return NextResponse.json({ error: "匯出薪資失敗" }, { status: 500 })
  }
}
