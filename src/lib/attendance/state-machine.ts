import type { Attendance, Break, Schedule, ShiftType } from "@prisma/client"

export enum ClockState {
  NOT_CLOCKED_IN = "NOT_CLOCKED_IN",
  WORKING = "WORKING",
  ON_BREAK = "ON_BREAK",
  CLOCKED_OUT = "CLOCKED_OUT",
  SPLIT_BREAK = "SPLIT_BREAK",
}

export enum ClockAction {
  CLOCK_IN = "CLOCK_IN",
  CLOCK_OUT = "CLOCK_OUT",
  START_BREAK = "START_BREAK",
  END_BREAK = "END_BREAK",
  CLOCK_IN_SEGMENT_2 = "CLOCK_IN_SEGMENT_2",
  CLOCK_OUT_SEGMENT_2 = "CLOCK_OUT_SEGMENT_2",
}

export interface ClockContext {
  userId: string
  storeId: string
  attendanceId?: string
  currentBreakId?: string
  schedule?: Schedule & { shiftType: ShiftType }
  attendance?: Attendance & { breaks: Break[] }
  timestamp: Date
}

interface StateTransition {
  from: ClockState[]
  to: ClockState
  action: ClockAction
  guard?: (context: ClockContext) => { allowed: boolean; reason?: string }
}

const transitions: StateTransition[] = [
  {
    from: [ClockState.NOT_CLOCKED_IN],
    to: ClockState.WORKING,
    action: ClockAction.CLOCK_IN,
  },
  {
    from: [ClockState.WORKING],
    to: ClockState.ON_BREAK,
    action: ClockAction.START_BREAK,
    guard: (ctx) => {
      const breakCount = ctx.attendance?.breaks?.length ?? 0
      const maxBreaks = ctx.schedule?.shiftType?.maxBreakCount ?? 3
      if (breakCount >= maxBreaks) {
        return { allowed: false, reason: `已達到最大休息次數 (${maxBreaks})` }
      }
      return { allowed: true }
    },
  },
  {
    from: [ClockState.ON_BREAK],
    to: ClockState.WORKING,
    action: ClockAction.END_BREAK,
  },
  {
    from: [ClockState.WORKING],
    to: ClockState.CLOCKED_OUT,
    action: ClockAction.CLOCK_OUT,
    guard: (ctx) => {
      // Check if there's an unended break
      const unendedBreak = ctx.attendance?.breaks?.find((b) => !b.endTime)
      if (unendedBreak) {
        return { allowed: false, reason: "請先結束休息再下班打卡" }
      }
      return { allowed: true }
    },
  },
  {
    from: [ClockState.CLOCKED_OUT],
    to: ClockState.SPLIT_BREAK,
    action: ClockAction.CLOCK_OUT,
    guard: (ctx) => {
      if (!ctx.schedule?.shiftType?.isSplit) {
        return { allowed: false, reason: "非分段班制" }
      }
      return { allowed: true }
    },
  },
  {
    from: [ClockState.SPLIT_BREAK],
    to: ClockState.WORKING,
    action: ClockAction.CLOCK_IN_SEGMENT_2,
  },
  {
    from: [ClockState.WORKING],
    to: ClockState.CLOCKED_OUT,
    action: ClockAction.CLOCK_OUT_SEGMENT_2,
    guard: (ctx) => {
      // Must have clockIn2 for segment 2
      if (!ctx.attendance?.clockIn2) {
        return { allowed: false, reason: "尚未開始第二段班" }
      }
      return { allowed: true }
    },
  },
]

export class ClockStateMachine {
  private state: ClockState
  private context: ClockContext

  constructor(initialState: ClockState, context: ClockContext) {
    this.state = initialState
    this.context = context
  }

  static fromAttendance(
    attendance: (Attendance & { breaks: Break[] }) | null,
    ctx: Omit<ClockContext, "attendanceId" | "attendance" | "timestamp">
  ): ClockStateMachine {
    let state: ClockState

    if (!attendance) {
      state = ClockState.NOT_CLOCKED_IN
    } else if (attendance.status === "ON_BREAK") {
      state = ClockState.ON_BREAK
    } else if (attendance.status === "CLOCKED_OUT") {
      // Check if it's a split shift and can clock in for segment 2
      if (ctx.schedule?.shiftType?.isSplit && !attendance.clockIn2) {
        state = ClockState.SPLIT_BREAK
      } else {
        state = ClockState.CLOCKED_OUT
      }
    } else if (attendance.status === "CLOCKED_IN") {
      state = ClockState.WORKING
    } else {
      state = ClockState.CLOCKED_OUT
    }

    return new ClockStateMachine(state, {
      ...ctx,
      attendanceId: attendance?.id,
      attendance: attendance ?? undefined,
      currentBreakId: attendance?.breaks?.find((b) => !b.endTime)?.id,
      timestamp: new Date(),
    })
  }

  canTransition(action: ClockAction): { allowed: boolean; reason?: string } {
    const transition = transitions.find(
      (t) => t.action === action && t.from.includes(this.state)
    )

    if (!transition) {
      return {
        allowed: false,
        reason: `無法從 ${this.state} 狀態執行 ${action}`,
      }
    }

    if (transition.guard) {
      return transition.guard(this.context)
    }

    return { allowed: true }
  }

  getNextState(action: ClockAction): ClockState | null {
    const transition = transitions.find(
      (t) => t.action === action && t.from.includes(this.state)
    )
    return transition?.to ?? null
  }

  getState(): ClockState {
    return this.state
  }

  getContext(): ClockContext {
    return this.context
  }

  getAvailableActions(): { action: ClockAction; allowed: boolean; reason?: string }[] {
    return transitions
      .filter((t) => t.from.includes(this.state))
      .map((t) => {
        const result = t.guard ? t.guard(this.context) : { allowed: true }
        return {
          action: t.action,
          allowed: result.allowed,
          reason: result.reason,
        }
      })
  }

  updateContext(updates: Partial<ClockContext>): void {
    this.context = { ...this.context, ...updates }
  }

  setState(state: ClockState): void {
    this.state = state
  }
}

// Helper to get display text for states and actions
export const ClockStateLabels: Record<ClockState, string> = {
  [ClockState.NOT_CLOCKED_IN]: "未打卡",
  [ClockState.WORKING]: "工作中",
  [ClockState.ON_BREAK]: "休息中",
  [ClockState.CLOCKED_OUT]: "已下班",
  [ClockState.SPLIT_BREAK]: "分段休息",
}

export const ClockActionLabels: Record<ClockAction, string> = {
  [ClockAction.CLOCK_IN]: "上班打卡",
  [ClockAction.CLOCK_OUT]: "下班打卡",
  [ClockAction.START_BREAK]: "開始休息",
  [ClockAction.END_BREAK]: "結束休息",
  [ClockAction.CLOCK_IN_SEGMENT_2]: "第二段上班",
  [ClockAction.CLOCK_OUT_SEGMENT_2]: "第二段下班",
}
