import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { attendanceService } from "@/lib/attendance/attendance-service"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const storeId = body.storeId

    let targetStoreId = storeId
    if (!targetStoreId) {
      const primaryStore =
        session.user.stores.find((s) => s.isPrimary) ?? session.user.stores[0]
      targetStoreId = primaryStore?.id
    }

    if (!targetStoreId) {
      return NextResponse.json({ error: "未關聯任何店鋪" }, { status: 400 })
    }

    const result = await attendanceService.clockOut(session.user.id, targetStoreId)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error clocking out:", error)
    return NextResponse.json({ error: "打卡失敗" }, { status: 500 })
  }
}
