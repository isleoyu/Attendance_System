import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create stores
  const store1 = await prisma.store.upsert({
    where: { code: "STORE001" },
    update: {},
    create: {
      name: "台北信義店",
      code: "STORE001",
      address: "台北市信義區信義路五段7號",
      timezone: "Asia/Taipei",
    },
  })

  const store2 = await prisma.store.upsert({
    where: { code: "STORE002" },
    update: {},
    create: {
      name: "台北大安店",
      code: "STORE002",
      address: "台北市大安區復興南路一段390號",
      timezone: "Asia/Taipei",
    },
  })

  console.log("Created stores:", store1.name, store2.name)

  // Create shift types for store1
  const morningShift = await prisma.shiftType.upsert({
    where: { storeId_code: { storeId: store1.id, code: "AM" } },
    update: {},
    create: {
      name: "早班",
      code: "AM",
      startTime: "09:00",
      endTime: "17:00",
      breakDuration: 60,
      maxBreakCount: 3,
      storeId: store1.id,
    },
  })

  const eveningShift = await prisma.shiftType.upsert({
    where: { storeId_code: { storeId: store1.id, code: "PM" } },
    update: {},
    create: {
      name: "晚班",
      code: "PM",
      startTime: "14:00",
      endTime: "22:00",
      breakDuration: 60,
      maxBreakCount: 3,
      storeId: store1.id,
    },
  })

  const splitShift = await prisma.shiftType.upsert({
    where: { storeId_code: { storeId: store1.id, code: "SPLIT" } },
    update: {},
    create: {
      name: "分段班",
      code: "SPLIT",
      startTime: "10:00",
      endTime: "21:00",
      breakDuration: 30,
      maxBreakCount: 4,
      isSplit: true,
      splitBreakStart: "14:00",
      splitBreakEnd: "17:00",
      storeId: store1.id,
    },
  })

  console.log("Created shift types:", morningShift.name, eveningShift.name, splitShift.name)

  // Create users
  const adminPassword = await hash("admin123", 12)
  const managerPassword = await hash("manager123", 12)
  const employeePassword = await hash("employee123", 12)

  const admin = await prisma.user.upsert({
    where: { employeeId: "ADMIN001" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: adminPassword,
      name: "系統管理員",
      employeeId: "ADMIN001",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      hourlyRate: 250,
    },
  })

  const manager = await prisma.user.upsert({
    where: { employeeId: "MGR001" },
    update: {},
    create: {
      email: "manager@example.com",
      passwordHash: managerPassword,
      name: "王店長",
      employeeId: "MGR001",
      role: "STORE_MANAGER",
      status: "ACTIVE",
      hourlyRate: 220,
    },
  })

  const employee1 = await prisma.user.upsert({
    where: { employeeId: "EMP001" },
    update: {},
    create: {
      email: "employee1@example.com",
      passwordHash: employeePassword,
      name: "陳小明",
      phone: "0912345678",
      employeeId: "EMP001",
      role: "EMPLOYEE",
      status: "ACTIVE",
      hourlyRate: 180,
    },
  })

  const employee2 = await prisma.user.upsert({
    where: { employeeId: "EMP002" },
    update: {},
    create: {
      email: "employee2@example.com",
      passwordHash: employeePassword,
      name: "林小華",
      phone: "0923456789",
      employeeId: "EMP002",
      role: "EMPLOYEE",
      status: "ACTIVE",
      hourlyRate: 180,
    },
  })

  const shiftLeader = await prisma.user.upsert({
    where: { employeeId: "LEAD001" },
    update: {},
    create: {
      email: "leader@example.com",
      passwordHash: employeePassword,
      name: "張組長",
      phone: "0934567890",
      employeeId: "LEAD001",
      role: "SHIFT_LEADER",
      status: "ACTIVE",
      hourlyRate: 200,
    },
  })

  console.log("Created users:", admin.name, manager.name, employee1.name, employee2.name, shiftLeader.name)

  // Associate users with stores
  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: admin.id, storeId: store1.id } },
    update: {},
    create: {
      userId: admin.id,
      storeId: store1.id,
      isPrimary: true,
      canClockIn: true,
      storeRole: "SUPER_ADMIN",
    },
  })

  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: admin.id, storeId: store2.id } },
    update: {},
    create: {
      userId: admin.id,
      storeId: store2.id,
      isPrimary: false,
      canClockIn: true,
      storeRole: "SUPER_ADMIN",
    },
  })

  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: manager.id, storeId: store1.id } },
    update: {},
    create: {
      userId: manager.id,
      storeId: store1.id,
      isPrimary: true,
      canClockIn: true,
      storeRole: "STORE_MANAGER",
    },
  })

  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: employee1.id, storeId: store1.id } },
    update: {},
    create: {
      userId: employee1.id,
      storeId: store1.id,
      isPrimary: true,
      canClockIn: true,
      storeRole: "EMPLOYEE",
    },
  })

  // Employee2 can work at both stores
  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: employee2.id, storeId: store1.id } },
    update: {},
    create: {
      userId: employee2.id,
      storeId: store1.id,
      isPrimary: true,
      canClockIn: true,
      storeRole: "EMPLOYEE",
    },
  })

  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: employee2.id, storeId: store2.id } },
    update: {},
    create: {
      userId: employee2.id,
      storeId: store2.id,
      isPrimary: false,
      canClockIn: true,
      storeRole: "EMPLOYEE",
    },
  })

  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: shiftLeader.id, storeId: store1.id } },
    update: {},
    create: {
      userId: shiftLeader.id,
      storeId: store1.id,
      isPrimary: true,
      canClockIn: true,
      storeRole: "SHIFT_LEADER",
    },
  })

  console.log("Associated users with stores")

  // Create some sample schedules for today and tomorrow
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  await prisma.schedule.upsert({
    where: { userId_date: { userId: employee1.id, date: today } },
    update: {},
    create: {
      userId: employee1.id,
      date: today,
      shiftTypeId: morningShift.id,
      storeId: store1.id,
      status: "SCHEDULED",
      publishedAt: new Date(),
    },
  })

  await prisma.schedule.upsert({
    where: { userId_date: { userId: employee2.id, date: today } },
    update: {},
    create: {
      userId: employee2.id,
      date: today,
      shiftTypeId: eveningShift.id,
      storeId: store1.id,
      status: "SCHEDULED",
      publishedAt: new Date(),
    },
  })

  await prisma.schedule.upsert({
    where: { userId_date: { userId: shiftLeader.id, date: today } },
    update: {},
    create: {
      userId: shiftLeader.id,
      date: today,
      shiftTypeId: splitShift.id,
      storeId: store1.id,
      status: "SCHEDULED",
      publishedAt: new Date(),
    },
  })

  console.log("Created sample schedules")

  // ===== Create December attendance records for ADMIN001 =====
  console.log("\nCreating December attendance records for ADMIN001...")

  // Create shift type for store1 if admin needs it
  const fullDayShift = await prisma.shiftType.upsert({
    where: { storeId_code: { storeId: store1.id, code: "FULL" } },
    update: {},
    create: {
      name: "全日班",
      code: "FULL",
      startTime: "09:00",
      endTime: "18:00",
      breakDuration: 60,
      maxBreakCount: 3,
      storeId: store1.id,
    },
  })

  // December 2024 attendance data for ADMIN001
  const december2024 = [
    { day: 2, clockIn: "08:55", clockOut: "18:05", breakMins: 60, status: "CLOCKED_OUT" as const },
    { day: 3, clockIn: "09:02", clockOut: "18:15", breakMins: 45, status: "CLOCKED_OUT" as const },
    { day: 4, clockIn: "08:50", clockOut: "19:30", breakMins: 60, overtimeMins: 90, status: "CLOCKED_OUT" as const },
    { day: 5, clockIn: "09:00", clockOut: "18:00", breakMins: 60, status: "CLOCKED_OUT" as const },
    { day: 6, clockIn: "09:10", clockOut: "18:20", breakMins: 50, status: "CLOCKED_OUT" as const },
    // Weekend off: 7, 8
    { day: 9, clockIn: "08:45", clockOut: "18:00", breakMins: 60, status: "CLOCKED_OUT" as const },
    { day: 10, clockIn: "09:00", clockOut: "20:00", breakMins: 60, overtimeMins: 120, status: "CLOCKED_OUT" as const },
    { day: 11, clockIn: "09:05", clockOut: "18:10", breakMins: 55, status: "CLOCKED_OUT" as const },
    { day: 12, clockIn: "08:58", clockOut: "18:00", breakMins: 60, status: "CLOCKED_OUT" as const },
    { day: 13, clockIn: "09:00", clockOut: "18:30", breakMins: 60, status: "CLOCKED_OUT" as const },
    // Weekend off: 14, 15
    { day: 16, clockIn: "09:00", clockOut: "18:00", breakMins: 60, status: "CLOCKED_OUT" as const },
    { day: 17, clockIn: "08:50", clockOut: "19:00", breakMins: 45, overtimeMins: 60, status: "CLOCKED_OUT" as const },
    { day: 18, clockIn: "09:15", clockOut: "18:20", breakMins: 60, status: "CLOCKED_OUT" as const },
    { day: 19, clockIn: "09:00", clockOut: "18:00", breakMins: 60, status: "CLOCKED_OUT" as const },
    { day: 20, clockIn: "08:55", clockOut: "18:45", breakMins: 50, status: "CLOCKED_OUT" as const },
    // Weekend off: 21, 22
    { day: 23, clockIn: "09:00", clockOut: "18:00", breakMins: 60, status: "CLOCKED_OUT" as const },
  ]

  for (const record of december2024) {
    const dateObj = new Date(2024, 11, record.day) // Month is 0-indexed, so 11 = December
    dateObj.setHours(0, 0, 0, 0)

    // Create schedule first
    const schedule = await prisma.schedule.upsert({
      where: { userId_date: { userId: admin.id, date: dateObj } },
      update: {},
      create: {
        userId: admin.id,
        date: dateObj,
        shiftTypeId: fullDayShift.id,
        storeId: store1.id,
        status: "COMPLETED",
        publishedAt: new Date(2024, 10, 25), // Published in November
      },
    })

    // Parse clock times
    const [inHour, inMin] = record.clockIn.split(":").map(Number)
    const [outHour, outMin] = record.clockOut.split(":").map(Number)

    const clockInTime = new Date(2024, 11, record.day, inHour, inMin, 0)
    const clockOutTime = new Date(2024, 11, record.day, outHour, outMin, 0)

    // Calculate total minutes
    const totalMinutes = Math.round((clockOutTime.getTime() - clockInTime.getTime()) / 60000)
    const netWorkMinutes = totalMinutes - record.breakMins

    // Create attendance record
    const attendance = await prisma.attendance.upsert({
      where: { userId_date: { userId: admin.id, date: dateObj } },
      update: {},
      create: {
        userId: admin.id,
        storeId: store1.id,
        date: dateObj,
        clockIn: clockInTime,
        clockOut: clockOutTime,
        status: record.status,
        totalMinutes,
        breakMinutes: record.breakMins,
        netWorkMinutes,
        overtimeMinutes: record.overtimeMins || 0,
        scheduleId: schedule.id,
      },
    })

    // Add break records for each attendance
    const breakStartHour = 12
    const breakDurationMins = record.breakMins

    await prisma.break.upsert({
      where: { id: `break-admin-dec-${record.day}` },
      update: {},
      create: {
        id: `break-admin-dec-${record.day}`,
        attendanceId: attendance.id,
        startTime: new Date(2024, 11, record.day, breakStartHour, 0, 0),
        endTime: new Date(2024, 11, record.day, breakStartHour, breakDurationMins, 0),
        type: "MEAL",
        durationMinutes: breakDurationMins,
      },
    })
  }

  console.log(`Created ${december2024.length} attendance records for ADMIN001 in December 2024`)

  console.log("\n=== Seed Complete ===")
  console.log("\nTest Accounts:")
  console.log("┌────────────┬────────────────┬─────────────┐")
  console.log("│ Role       │ Employee ID    │ Password    │")
  console.log("├────────────┼────────────────┼─────────────┤")
  console.log("│ Admin      │ ADMIN001       │ admin123    │")
  console.log("│ Manager    │ MGR001         │ manager123  │")
  console.log("│ Leader     │ LEAD001        │ employee123 │")
  console.log("│ Employee   │ EMP001         │ employee123 │")
  console.log("│ Employee   │ EMP002         │ employee123 │")
  console.log("└────────────┴────────────────┴─────────────┘")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
