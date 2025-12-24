import type { Break, ShiftType } from "@prisma/client"
import { differenceInMinutes, parseTimeString } from "@/lib/utils"

export interface WorkHoursInput {
  clockIn: Date
  clockOut: Date
  clockIn2?: Date
  clockOut2?: Date
  breaks: Array<{
    startTime: Date
    endTime: Date | null
    type: string
  }>
  shiftType?: ShiftType | null
}

export interface WorkHoursResult {
  // Raw minutes
  totalMinutes: number
  breakMinutes: number
  netWorkMinutes: number

  // Overtime calculation
  regularMinutes: number
  overtimeMinutes: number

  // Split shift details
  segment1Minutes: number
  segment2Minutes: number
  splitBreakMinutes: number

  // Timing anomalies
  earlyClockIn: number
  lateClockIn: number
  earlyClockOut: number
  lateClockOut: number

  // Flags
  hasUnendedBreak: boolean
  exceedsMaxBreakTime: boolean
  requiresReview: boolean

  // Breakdown
  breakDetails: Array<{
    startTime: Date
    endTime: Date | null
    durationMinutes: number
    type: string
  }>
}

export function calculateWorkHours(input: WorkHoursInput): WorkHoursResult {
  const { clockIn, clockOut, clockIn2, clockOut2, breaks, shiftType } = input

  // 1. Calculate raw segment times
  const segment1Minutes = differenceInMinutes(clockOut, clockIn)

  let segment2Minutes = 0
  if (clockIn2 && clockOut2) {
    segment2Minutes = differenceInMinutes(clockOut2, clockIn2)
  }

  // 2. Calculate total break time
  let breakMinutes = 0
  let hasUnendedBreak = false
  const breakDetails: WorkHoursResult["breakDetails"] = []

  for (const brk of breaks) {
    let durationMinutes: number
    if (brk.endTime) {
      durationMinutes = differenceInMinutes(brk.endTime, brk.startTime)
    } else {
      hasUnendedBreak = true
      durationMinutes = differenceInMinutes(new Date(), brk.startTime)
    }
    breakMinutes += durationMinutes
    breakDetails.push({
      startTime: brk.startTime,
      endTime: brk.endTime,
      durationMinutes,
      type: brk.type,
    })
  }

  // 3. Calculate split break time
  let splitBreakMinutes = 0
  if (shiftType?.isSplit && clockOut && clockIn2) {
    splitBreakMinutes = differenceInMinutes(clockIn2, clockOut)
  }

  // 4. Calculate totals
  const totalMinutes = segment1Minutes + segment2Minutes
  const netWorkMinutes = totalMinutes - breakMinutes

  // 5. Calculate overtime (if shiftType exists)
  let regularMinutes = netWorkMinutes
  let overtimeMinutes = 0

  if (shiftType) {
    const scheduledMinutes = calculateScheduledMinutes(shiftType)
    if (netWorkMinutes > scheduledMinutes) {
      regularMinutes = scheduledMinutes
      overtimeMinutes = netWorkMinutes - scheduledMinutes
    }
  }

  // 6. Calculate timing anomalies
  const { earlyClockIn, lateClockIn, earlyClockOut, lateClockOut } =
    calculateTimingAnomalies(clockIn, clockOut, shiftType)

  // 7. Check for issues requiring review
  const maxBreakMinutes = shiftType?.breakDuration ?? 30
  const exceedsMaxBreakTime = breakMinutes > maxBreakMinutes * 1.5

  const requiresReview =
    hasUnendedBreak ||
    exceedsMaxBreakTime ||
    lateClockIn > 15 ||
    earlyClockOut > 0 ||
    overtimeMinutes > 120

  return {
    totalMinutes,
    breakMinutes,
    netWorkMinutes,
    regularMinutes,
    overtimeMinutes,
    segment1Minutes,
    segment2Minutes,
    splitBreakMinutes,
    earlyClockIn,
    lateClockIn,
    earlyClockOut,
    lateClockOut,
    hasUnendedBreak,
    exceedsMaxBreakTime,
    requiresReview,
    breakDetails,
  }
}

function calculateScheduledMinutes(shiftType: ShiftType): number {
  const start = parseTimeString(shiftType.startTime)
  const end = parseTimeString(shiftType.endTime)

  let totalMinutes = end.hours * 60 + end.minutes - (start.hours * 60 + start.minutes)

  // Handle overnight shifts
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60
  }

  // Subtract split break for split shifts
  if (shiftType.isSplit && shiftType.splitBreakStart && shiftType.splitBreakEnd) {
    const splitStart = parseTimeString(shiftType.splitBreakStart)
    const splitEnd = parseTimeString(shiftType.splitBreakEnd)
    const splitMinutes =
      splitEnd.hours * 60 + splitEnd.minutes - (splitStart.hours * 60 + splitStart.minutes)
    totalMinutes -= splitMinutes
  }

  // Subtract expected break time
  totalMinutes -= shiftType.breakDuration

  return totalMinutes
}

function calculateTimingAnomalies(
  clockIn: Date,
  clockOut: Date,
  shiftType?: ShiftType | null
): {
  earlyClockIn: number
  lateClockIn: number
  earlyClockOut: number
  lateClockOut: number
} {
  if (!shiftType) {
    return { earlyClockIn: 0, lateClockIn: 0, earlyClockOut: 0, lateClockOut: 0 }
  }

  const scheduledStart = parseTimeString(shiftType.startTime)
  const scheduledEnd = parseTimeString(shiftType.endTime)

  const clockInMinutes = clockIn.getHours() * 60 + clockIn.getMinutes()
  const clockOutMinutes = clockOut.getHours() * 60 + clockOut.getMinutes()
  const schedStartMinutes = scheduledStart.hours * 60 + scheduledStart.minutes
  const schedEndMinutes = scheduledEnd.hours * 60 + scheduledEnd.minutes

  const earlyClockIn = Math.max(0, schedStartMinutes - clockInMinutes)
  const lateClockIn = Math.max(0, clockInMinutes - schedStartMinutes)
  const earlyClockOut = Math.max(0, schedEndMinutes - clockOutMinutes)
  const lateClockOut = Math.max(0, clockOutMinutes - schedEndMinutes)

  return { earlyClockIn, lateClockIn, earlyClockOut, lateClockOut }
}

// Format minutes to readable string
export function formatWorkHours(minutes: number): string {
  const hours = Math.floor(Math.abs(minutes) / 60)
  const mins = Math.abs(minutes) % 60
  const sign = minutes < 0 ? "-" : ""

  if (hours === 0) {
    return `${sign}${mins}分鐘`
  }
  if (mins === 0) {
    return `${sign}${hours}小時`
  }
  return `${sign}${hours}小時${mins}分鐘`
}
