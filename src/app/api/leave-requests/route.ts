import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { approvalService, createLeaveRequestSchema } from "@/lib/approval/approval-service"

/**
 * GET /api/leave-requests
 * Get user's leave requests
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year")

    const leaveRequests = await approvalService.getUserLeaveRequests(
      session.user.id,
      year ? parseInt(year) : undefined
    )

    return NextResponse.json(leaveRequests)
  } catch (error) {
    console.error("Error fetching leave requests:", error)
    return NextResponse.json({ error: "取得請假資料失敗" }, { status: 500 })
  }
}

/**
 * POST /api/leave-requests
 * Create a new leave request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createLeaveRequestSchema.parse(body)

    const leaveRequest = await approvalService.createLeaveRequest(
      session.user.id,
      validatedData
    )

    return NextResponse.json(leaveRequest, { status: 201 })
  } catch (error) {
    console.error("Error creating leave request:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "建立請假申請失敗" }, { status: 500 })
  }
}
