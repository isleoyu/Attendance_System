import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { shiftTypeService, createShiftTypeSchema } from "@/lib/schedule/shift-type-service"

/**
 * GET /api/shift-types?storeId=xxx
 * Get all shift types for a store
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get("storeId")

    if (!storeId) {
      // Return shift types from user's primary store
      const primaryStore = session.user.stores.find((s) => s.isPrimary) ?? session.user.stores[0]
      if (!primaryStore) {
        return NextResponse.json({ error: "未關聯任何店鋪" }, { status: 400 })
      }
      const shiftTypes = await shiftTypeService.getShiftTypesByStore(primaryStore.id)
      return NextResponse.json(shiftTypes)
    }

    // Check if user has access to this store
    const hasAccess = session.user.stores.some((s) => s.id === storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
    }

    const shiftTypes = await shiftTypeService.getShiftTypesByStore(storeId)
    return NextResponse.json(shiftTypes)
  } catch (error) {
    console.error("Error fetching shift types:", error)
    return NextResponse.json({ error: "取得班別資料失敗" }, { status: 500 })
  }
}

/**
 * POST /api/shift-types
 * Create a new shift type
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can create shift types
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createShiftTypeSchema.parse(body)

    // Check if user has access to the store
    const hasAccess = session.user.stores.some((s) => s.id === validatedData.storeId)
    if (!hasAccess && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
    }

    const shiftType = await shiftTypeService.createShiftType(validatedData)
    return NextResponse.json(shiftType, { status: 201 })
  } catch (error) {
    console.error("Error creating shift type:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "建立班別失敗" }, { status: 500 })
  }
}
