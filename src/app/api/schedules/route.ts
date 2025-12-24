import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { scheduleService, createScheduleSchema, batchCreateScheduleSchema } from "@/lib/schedule/schedule-service"

/**
 * GET /api/schedules?storeId=xxx&startDate=xxx&endDate=xxx&userId=xxx
 * Get schedules for a date range
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get("storeId")
    const startDateStr = searchParams.get("startDate")
    const endDateStr = searchParams.get("endDate")
    const userId = searchParams.get("userId")

    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ error: "請提供開始和結束日期" }, { status: 400 })
    }

    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)

    // If no storeId, get user's own schedules
    if (!storeId) {
      const schedules = await scheduleService.getUserSchedules(
        userId || session.user.id,
        startDate,
        endDate
      )
      return NextResponse.json(schedules)
    }

    // Check if user has access to this store
    const hasAccess = session.user.stores.some((s) => s.id === storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
    }

    // Regular employees can only see their own schedules
    if (session.user.role === "EMPLOYEE") {
      const schedules = await scheduleService.getUserSchedules(
        session.user.id,
        startDate,
        endDate
      )
      return NextResponse.json(schedules)
    }

    const schedules = await scheduleService.getSchedules(
      storeId,
      startDate,
      endDate,
      userId || undefined
    )
    return NextResponse.json(schedules)
  } catch (error) {
    console.error("Error fetching schedules:", error)
    return NextResponse.json({ error: "取得排班資料失敗" }, { status: 500 })
  }
}

/**
 * POST /api/schedules
 * Create a new schedule or batch create
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can create schedules
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const body = await request.json()

    // Check if batch create
    if (body.schedules && Array.isArray(body.schedules)) {
      const validatedData = batchCreateScheduleSchema.parse(body)

      // Check if user has access to the store
      const hasAccess = session.user.stores.some((s) => s.id === validatedData.storeId)
      if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
      }

      const result = await scheduleService.batchCreateSchedules(
        validatedData,
        session.user.id
      )
      return NextResponse.json(result, { status: 201 })
    }

    // Single schedule create
    const validatedData = createScheduleSchema.parse(body)

    // Check if user has access to the store
    const hasAccess = session.user.stores.some((s) => s.id === validatedData.storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
    }

    const schedule = await scheduleService.createSchedule(
      validatedData,
      session.user.id
    )
    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error("Error creating schedule:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "建立排班失敗" }, { status: 500 })
  }
}
