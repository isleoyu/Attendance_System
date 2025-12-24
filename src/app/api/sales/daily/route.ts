import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { dailySalesService, createDailySalesReportSchema } from "@/lib/sales/daily-sales-service"

/**
 * GET /api/sales/daily
 * Get daily sales reports
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get("storeId") || undefined
    const date = searchParams.get("date")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "31")

    // If specific date requested, get single report
    if (date && storeId) {
      const report = await dailySalesService.getDailyReport(storeId, new Date(date))
      return NextResponse.json(report)
    }

    // Get reports for date range
    const start = startDate ? new Date(startDate) : new Date()
    const end = endDate ? new Date(endDate) : new Date()

    // If no date range, default to current month
    if (!startDate && !endDate) {
      start.setDate(1)
      end.setMonth(end.getMonth() + 1, 0)
    }

    // Non-admin users can only see their store's reports
    let effectiveStoreId = storeId
    if (session.user.role === "EMPLOYEE" || session.user.role === "SHIFT_LEADER") {
      const primaryStore = session.user.stores.find((s) => s.isPrimary) || session.user.stores[0]
      if (primaryStore) {
        effectiveStoreId = primaryStore.id
      }
    }

    const result = await dailySalesService.getReports({
      storeId: effectiveStoreId,
      startDate: start,
      endDate: end,
      page,
      limit,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching daily sales:", error)
    return NextResponse.json({ error: "取得業績資料失敗" }, { status: 500 })
  }
}

/**
 * POST /api/sales/daily
 * Create or update daily sales report
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createDailySalesReportSchema.parse(body)

    // Check if user has access to this store
    const hasAccess = session.user.role === "SUPER_ADMIN" ||
      session.user.stores.some((s) => s.id === validatedData.storeId)

    if (!hasAccess) {
      return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
    }

    const report = await dailySalesService.upsertDailyReport(validatedData, session.user.id)

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error("Error creating daily sales report:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "建立業績報表失敗" }, { status: 500 })
  }
}
