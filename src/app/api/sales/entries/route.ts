import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { dailySalesService, createSalesEntrySchema } from "@/lib/sales/daily-sales-service"

/**
 * GET /api/sales/entries
 * Get journal entries for a report
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get("reportId")

    if (!reportId) {
      return NextResponse.json({ error: "報表 ID 必填" }, { status: 400 })
    }

    const entries = await dailySalesService.getEntries(reportId)

    return NextResponse.json(entries)
  } catch (error) {
    console.error("Error fetching entries:", error)
    return NextResponse.json({ error: "取得流水帳失敗" }, { status: 500 })
  }
}

/**
 * POST /api/sales/entries
 * Add a journal entry
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createSalesEntrySchema.parse(body)

    const entry = await dailySalesService.addEntry(validatedData, session.user.id)

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error("Error creating entry:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "新增流水帳失敗" }, { status: 500 })
  }
}
