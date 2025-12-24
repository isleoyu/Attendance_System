import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { storeService, createStoreSchema } from "@/lib/store/store-service"

/**
 * GET /api/stores
 * Get all stores (for dropdown or full list)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only managers and admins can view stores
    if (!["STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const simple = searchParams.get("simple") === "true"
    const search = searchParams.get("search") || undefined
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    // Super admins can see all stores with full details
    if (session.user.role === "SUPER_ADMIN") {
      if (simple) {
        const stores = await storeService.getAllStoresSimple()
        return NextResponse.json(stores)
      }

      const result = await storeService.getStores({ search, page, limit })
      return NextResponse.json(result)
    }

    // Store managers can only see their own stores
    const stores = session.user.stores.map((s) => ({
      id: s.id,
      name: s.name,
    }))

    return NextResponse.json(stores)
  } catch (error) {
    console.error("Error fetching stores:", error)
    return NextResponse.json({ error: "取得店鋪資料失敗" }, { status: 500 })
  }
}

/**
 * POST /api/stores
 * Create a new store (SUPER_ADMIN only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only super admins can create stores
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createStoreSchema.parse(body)

    const store = await storeService.createStore(validatedData)

    return NextResponse.json(store, { status: 201 })
  } catch (error) {
    console.error("Error creating store:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "建立店鋪失敗" }, { status: 500 })
  }
}
