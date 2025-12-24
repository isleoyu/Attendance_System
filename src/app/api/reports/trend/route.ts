import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { reportService } from "@/lib/reports/report-service"

/**
 * GET /api/reports/trend?storeId=xxx&year=xxx
 * Get monthly trend data for a store
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can view reports
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get("storeId")
    const year = searchParams.get("year") || new Date().getFullYear().toString()

    if (!storeId) {
      return NextResponse.json({ error: "請提供店鋪" }, { status: 400 })
    }

    // Check store access
    const hasAccess = session.user.stores.some((s) => s.id === storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
    }

    const trend = await reportService.getMonthlyTrend(storeId, parseInt(year))

    return NextResponse.json(trend)
  } catch (error) {
    console.error("Error fetching trend data:", error)
    return NextResponse.json({ error: "取得趨勢資料失敗" }, { status: 500 })
  }
}
