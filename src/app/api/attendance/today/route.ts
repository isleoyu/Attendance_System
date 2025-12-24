import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { attendanceService } from "@/lib/attendance/attendance-service"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Get primary store or first available store
    const primaryStore = session.user.stores.find((s) => s.isPrimary) ?? session.user.stores[0]

    if (!primaryStore) {
      return NextResponse.json({ error: "未關聯任何店鋪" }, { status: 400 })
    }

    const currentState = await attendanceService.getCurrentState(
      session.user.id,
      primaryStore.id
    )

    return NextResponse.json({
      state: currentState.state,
      availableActions: currentState.availableActions,
      attendance: currentState.attendance,
      schedule: currentState.schedule,
      store: primaryStore,
    })
  } catch (error) {
    console.error("Error fetching today attendance:", error)
    return NextResponse.json({ error: "取得出勤資料失敗" }, { status: 500 })
  }
}
