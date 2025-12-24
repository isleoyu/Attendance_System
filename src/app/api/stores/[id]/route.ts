import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { storeService, updateStoreSchema } from "@/lib/store/store-service"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/stores/:id
 * Get a single store with details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can view store details
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    // Store managers can only view their own stores
    if (session.user.role === "STORE_MANAGER") {
      const hasAccess = session.user.stores.some((s) => s.id === id)
      if (!hasAccess) {
        return NextResponse.json({ error: "無權限存取此店鋪" }, { status: 403 })
      }
    }

    const store = await storeService.getStore(id)

    if (!store) {
      return NextResponse.json({ error: "店鋪不存在" }, { status: 404 })
    }

    return NextResponse.json(store)
  } catch (error) {
    console.error("Error fetching store:", error)
    return NextResponse.json({ error: "取得店鋪資料失敗" }, { status: 500 })
  }
}

/**
 * PUT /api/stores/:id
 * Update a store (SUPER_ADMIN only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only super admins can update stores
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateStoreSchema.parse(body)

    const store = await storeService.updateStore(id, validatedData)

    return NextResponse.json(store)
  } catch (error) {
    console.error("Error updating store:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "更新店鋪失敗" }, { status: 500 })
  }
}

/**
 * DELETE /api/stores/:id
 * Delete a store (SUPER_ADMIN only, only if no dependencies)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only super admins can delete stores
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    await storeService.deleteStore(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting store:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "刪除店鋪失敗" }, { status: 500 })
  }
}
