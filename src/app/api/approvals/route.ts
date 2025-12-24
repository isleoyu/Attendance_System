import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { approvalService } from "@/lib/approval/approval-service"

/**
 * GET /api/approvals?status=PENDING
 * Get approvals (pending for review or history)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const type = searchParams.get("type")

    const storeIds = session.user.stores.map((s) => s.id)

    if (status === "PENDING") {
      // Get pending approvals for review
      const approvals = await approvalService.getPendingApprovals(
        session.user.id,
        session.user.role,
        storeIds
      )
      return NextResponse.json(approvals)
    }

    // Get approval history
    const approvals = await approvalService.getApprovalHistory(
      session.user.id,
      session.user.role,
      {
        status: status as any,
        type: type as any,
      }
    )

    return NextResponse.json(approvals)
  } catch (error) {
    console.error("Error fetching approvals:", error)
    return NextResponse.json({ error: "取得審核資料失敗" }, { status: 500 })
  }
}
