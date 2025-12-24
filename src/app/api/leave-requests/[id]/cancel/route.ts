import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { approvalService } from "@/lib/approval/approval-service"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/leave-requests/:id/cancel
 * Cancel a leave request
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { id } = await params

    const result = await approvalService.cancelLeaveRequest(id, session.user.id)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error canceling leave request:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "取消請假申請失敗" }, { status: 500 })
  }
}
