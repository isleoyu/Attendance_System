import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { scheduleService, updateScheduleSchema } from "@/lib/schedule/schedule-service"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/schedules/:id
 * Get a single schedule
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { id } = await params
    const schedule = await scheduleService.getScheduleById(id)

    if (!schedule) {
      return NextResponse.json({ error: "排班不存在" }, { status: 404 })
    }

    // Check access: own schedule or manager/admin with store access
    const isOwnSchedule = schedule.userId === session.user.id
    const hasStoreAccess = session.user.stores.some((s) => s.id === schedule.storeId)

    if (!isOwnSchedule && !hasStoreAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限存取此排班" }, { status: 403 })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    console.error("Error fetching schedule:", error)
    return NextResponse.json({ error: "取得排班資料失敗" }, { status: 500 })
  }
}

/**
 * PUT /api/schedules/:id
 * Update a schedule
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can update schedules
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const { id } = await params
    const existingSchedule = await scheduleService.getScheduleById(id)

    if (!existingSchedule) {
      return NextResponse.json({ error: "排班不存在" }, { status: 404 })
    }

    // Check if user has access to this store
    const hasAccess = session.user.stores.some((s) => s.id === existingSchedule.storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限修改此排班" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateScheduleSchema.parse(body)

    const schedule = await scheduleService.updateSchedule(id, validatedData)
    return NextResponse.json(schedule)
  } catch (error) {
    console.error("Error updating schedule:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "更新排班失敗" }, { status: 500 })
  }
}

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can delete schedules
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const { id } = await params
    const existingSchedule = await scheduleService.getScheduleById(id)

    if (!existingSchedule) {
      return NextResponse.json({ error: "排班不存在" }, { status: 404 })
    }

    // Check if user has access to this store
    const hasAccess = session.user.stores.some((s) => s.id === existingSchedule.storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限刪除此排班" }, { status: 403 })
    }

    await scheduleService.deleteSchedule(id)
    return NextResponse.json({ success: true, message: "排班已刪除" })
  } catch (error) {
    console.error("Error deleting schedule:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "刪除排班失敗" }, { status: 500 })
  }
}
