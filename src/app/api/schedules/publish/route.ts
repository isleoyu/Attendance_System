import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { scheduleService } from "@/lib/schedule/schedule-service"
import { z } from "zod"

const publishSchema = z.object({
  storeId: z.string(),
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
})

/**
 * POST /api/schedules/publish
 * Publish draft schedules
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can publish schedules
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = publishSchema.parse(body)

    // Check if user has access to the store
    const hasAccess = session.user.stores.some((s) => s.id === validatedData.storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
    }

    const result = await scheduleService.publishSchedules(
      validatedData.storeId,
      validatedData.startDate,
      validatedData.endDate,
      session.user.id
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error publishing schedules:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "發布排班失敗" }, { status: 500 })
  }
}
