import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { dailySalesService } from "@/lib/sales/daily-sales-service"

/**
 * GET /api/sales/summary
 * Get monthly sales summary
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get("storeId")
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString())

    if (!storeId) {
      return NextResponse.json({ error: "店鋪 ID 必填" }, { status: 400 })
    }

    // Check access
    const hasAccess = session.user.role === "SUPER_ADMIN" ||
      session.user.stores.some((s) => s.id === storeId)

    if (!hasAccess) {
      return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
    }

    const summary = await dailySalesService.getMonthlySummary(storeId, year, month)

    return NextResponse.json(summary)
  } catch (error) {
    console.error("Error fetching summary:", error)
    return NextResponse.json({ error: "取得統計資料失敗" }, { status: 500 })
  }
}
