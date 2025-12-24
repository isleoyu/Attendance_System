import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth-options"
import { approvalService, processApprovalSchema } from "@/lib/approval/approval-service"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/approvals/:id
 * Get a single approval
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    const { id } = await params
    const approval = await approvalService.getApprovalById(id)

    if (!approval) {
      return NextResponse.json({ error: "審核項目不存在" }, { status: 404 })
    }

    return NextResponse.json(approval)
  } catch (error) {
    console.error("Error fetching approval:", error)
    return NextResponse.json({ error: "取得審核資料失敗" }, { status: 500 })
  }
}

/**
 * POST /api/approvals/:id
 * Process an approval (approve or reject)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 })
    }

    // Only leaders and above can process approvals
    if (!["SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "權限不足" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = processApprovalSchema.parse(body)

    const approval = await approvalService.processApproval(
      id,
      session.user.id,
      session.user.role,
      validatedData.status,
      validatedData.comments
    )

    return NextResponse.json({
      success: true,
      message: validatedData.status === "APPROVED" ? "已核准" : "已駁回",
      approval,
    })
  } catch (error) {
    console.error("Error processing approval:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "處理審核失敗" }, { status: 500 })
  }
}
