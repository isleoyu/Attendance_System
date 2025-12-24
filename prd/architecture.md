# 系統架構設計

## 技術架構

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  Next.js 14 (App Router) + React 18 + TypeScript            │
│  Tailwind CSS + shadcn/ui + React Query + Zustand           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                                │
│              Next.js API Routes + NextAuth.js               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  AttendanceService + ScheduleService + ApprovalService      │
│  PayrollCalculator + WorkHoursCalculator                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
│                 Prisma ORM + PostgreSQL                      │
└─────────────────────────────────────────────────────────────┘
```

## 資料庫 Schema

### 核心實體關係圖

```
┌──────────┐     ┌───────────┐     ┌─────────┐
│   User   │◄───►│ UserStore │◄───►│  Store  │
└────┬─────┘     └───────────┘     └────┬────┘
     │                                   │
     │ 1:N                               │ 1:N
     ▼                                   ▼
┌──────────┐                      ┌───────────┐
│Attendance│◄────────────────────►│ ShiftType │
└────┬─────┘                      └─────┬─────┘
     │                                   │
     │ 1:N                               │
     ▼                                   ▼
┌──────────┐                      ┌──────────┐
│  Break   │                      │ Schedule │
└──────────┘                      └──────────┘
```

### 主要表格說明

| 表格 | 用途 | 關鍵欄位 |
|------|------|----------|
| `User` | 員工資料 | employeeId, role, hourlyRate |
| `Store` | 店鋪設定 | code, timezone |
| `UserStore` | 員工-店鋪關聯 (多對多) | isPrimary, canClockIn, storeRole |
| `ShiftType` | 班別定義 | startTime, endTime, isSplit |
| `Attendance` | 出勤記錄 | clockIn/Out, status, netWorkMinutes |
| `Break` | 休息記錄 | startTime, endTime, type |
| `Schedule` | 排班表 | date, shiftTypeId, status |
| `LeaveRequest` | 請假申請 | type, startDate, endDate |
| `Approval` | 審核記錄 | type, status, approverId |
| `PayrollRecord` | 薪資記錄 | regularHours, overtimeHours, grossPay |

## 打卡狀態機

```
                    ┌─────────────────────┐
                    │   NOT_CLOCKED_IN    │
                    │    (初始狀態)        │
                    └──────────┬──────────┘
                               │
                         clock_in()
                               │
                               ▼
                    ┌─────────────────────┐
              ┌────►│      WORKING        │◄────┐
              │     │      (工作中)        │     │
              │     └──────────┬──────────┘     │
              │                │                │
         end_break()    ┌──────┴──────┐    clock_in_2()
              │         │             │         │
              │   start_break()  clock_out()    │
              │         │             │         │
              │         ▼             ▼         │
        ┌─────┴─────┐         ┌─────────────┐   │
        │ ON_BREAK  │         │ CLOCKED_OUT │   │
        │ (休息中)   │         │  (已下班)    │───┘
        └───────────┘         └─────────────┘   (分段班)
```

## 工時計算邏輯

```typescript
淨工時 = 總打卡時間 - 所有休息時間
加班時數 = max(0, 淨工時 - 排班時數)

// 異常標記條件
requiresReview =
  hasUnendedBreak ||           // 未結束的休息
  exceedsMaxBreakTime ||       // 休息超時 (>150%)
  lateClockIn > 15 ||          // 遲到超過15分鐘
  earlyClockOut > 0 ||         // 提早下班
  overtimeMinutes > 120        // 加班超過2小時
```

## 目錄結構

```
src/
├── app/
│   ├── (auth)/                 # 認證相關頁面
│   │   └── login/
│   ├── (dashboard)/            # 員工 Dashboard
│   │   ├── dashboard/          # 打卡主頁
│   │   ├── attendance/         # 出勤記錄
│   │   ├── schedule/           # 我的排班
│   │   └── leave/              # 請假申請
│   ├── (manager)/              # 主管功能
│   │   ├── team/               # 團隊管理
│   │   ├── scheduling/         # 排班管理
│   │   ├── approvals/          # 審核佇列
│   │   └── reports/            # 報表
│   ├── (admin)/                # 管理員功能
│   │   ├── users/              # 員工管理
│   │   ├── stores/             # 店鋪設定
│   │   └── shifts/             # 班別設定
│   └── api/                    # API 端點
│       ├── auth/
│       ├── attendance/
│       ├── schedules/
│       ├── approvals/
│       └── payroll/
├── components/
│   ├── clock/                  # 打卡組件
│   ├── dashboard/              # Dashboard 組件
│   └── ui/                     # 通用 UI 組件
└── lib/
    ├── attendance/             # 出勤服務
    │   ├── state-machine.ts    # 狀態機
    │   ├── work-hours-calculator.ts
    │   └── attendance-service.ts
    ├── auth/                   # 認證設定
    └── prisma.ts               # Prisma client
```
