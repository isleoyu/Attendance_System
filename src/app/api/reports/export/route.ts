import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { reportService } from "@/lib/reports/report-service"

/**
 * GET /api/reports/export?storeId=xxx&startDate=xxx&endDate=xxx
 * Export attendance report to CSV
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can export reports
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get("storeId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!storeId || !startDate || !endDate) {
      return NextResponse.json({ error: "請提供店鋪和日期範圍" }, { status: 400 })
    }

    // Check store access
    const hasAccess = session.user.stores.some((s) => s.id === storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
    }

    const csv = await reportService.exportAttendanceCSV(
      storeId,
      new Date(startDate),
      new Date(endDate)
    )

    // Add BOM for Excel UTF-8 compatibility
    const bom = "\uFEFF"
    const csvWithBom = bom + csv

    return new NextResponse(csvWithBom, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance_report_${startDate}_${endDate}.csv"`,
      },
    })
  } catch (error) {
    console.error("Error exporting attendance report:", error)
    return NextResponse.json({ error: "匯出出勤報表失敗" }, { status: 500 })
  }
}
