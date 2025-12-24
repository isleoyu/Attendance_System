import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { shiftTypeService, updateShiftTypeSchema } from "@/lib/schedule/shift-type-service"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/shift-types/:id
 * Get a single shift type
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { id } = await params
    const shiftType = await shiftTypeService.getShiftTypeById(id)

    if (!shiftType) {
      return NextResponse.json({ error: "班別不存在" }, { status: 404 })
    }

    // Check if user has access to this store
    const hasAccess = session.user.stores.some((s) => s.id === shiftType.storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限存取此班別" }, { status: 403 })
    }

    return NextResponse.json(shiftType)
  } catch (error) {
    console.error("Error fetching shift type:", error)
    return NextResponse.json({ error: "取得班別資料失敗" }, { status: 500 })
  }
}

/**
 * PUT /api/shift-types/:id
 * Update a shift type
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can update shift types
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const { id } = await params
    const existingShiftType = await shiftTypeService.getShiftTypeById(id)

    if (!existingShiftType) {
      return NextResponse.json({ error: "班別不存在" }, { status: 404 })
    }

    // Check if user has access to this store
    const hasAccess = session.user.stores.some((s) => s.id === existingShiftType.storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限修改此班別" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateShiftTypeSchema.parse(body)

    const shiftType = await shiftTypeService.updateShiftType(id, validatedData)
    return NextResponse.json(shiftType)
  } catch (error) {
    console.error("Error updating shift type:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "更新班別失敗" }, { status: 500 })
  }
}

/**
 * DELETE /api/shift-types/:id
 * Delete a shift type
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can delete shift types
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const { id } = await params
    const existingShiftType = await shiftTypeService.getShiftTypeById(id)

    if (!existingShiftType) {
      return NextResponse.json({ error: "班別不存在" }, { status: 404 })
    }

    // Check if user has access to this store
    const hasAccess = session.user.stores.some((s) => s.id === existingShiftType.storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限刪除此班別" }, { status: 403 })
    }

    await shiftTypeService.deleteShiftType(id)
    return NextResponse.json({ success: true, message: "班別已刪除" })
  } catch (error) {
    console.error("Error deleting shift type:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "刪除班別失敗" }, { status: 500 })
  }
}
