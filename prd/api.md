# API 端點文件

## 認證

所有 API（除登入外）都需要有效的 Session。使用 NextAuth.js 管理認證。

---

## 打卡 API

### GET /api/attendance/today

取得當日出勤狀態

**Response**
```json
{
  "state": "WORKING",
  "availableActions": [
    { "action": "START_BREAK", "allowed": true },
    { "action": "CLOCK_OUT", "allowed": true }
  ],
  "attendance": {
    "id": "...",
    "clockIn": "2024-12-19T09:00:00.000Z",
    "clockOut": null,
    "status": "CLOCKED_IN",
    "netWorkMinutes": null,
    "breakMinutes": 30,
    "breaks": [
      {
        "id": "...",
        "startTime": "2024-12-19T12:00:00.000Z",
        "endTime": "2024-12-19T12:30:00.000Z",
        "type": "MEAL",
        "durationMinutes": 30
      }
    ]
  },
  "schedule": {
    "shiftType": {
      "name": "早班",
      "startTime": "09:00",
      "endTime": "17:00"
    }
  },
  "store": {
    "id": "...",
    "name": "台北信義店"
  }
}
```

---

### POST /api/attendance/clock-in

上班打卡

**Request Body**
```json
{
  "storeId": "..." // 可選，預設使用主要店鋪
}
```

**Response**
```json
{
  "success": true,
  "message": "上班打卡成功",
  "attendance": { ... },
  "newState": "WORKING"
}
```

**錯誤情況**
- 401: 未授權
- 400: 已經打卡 / 無法執行此操作
- 403: 無權在此店鋪打卡

---

### POST /api/attendance/clock-out

下班打卡

**Request Body**
```json
{
  "storeId": "..."
}
```

**Response**
```json
{
  "success": true,
  "message": "下班打卡成功",
  "attendance": {
    "netWorkMinutes": 450,
    "breakMinutes": 60,
    "overtimeMinutes": 30
  },
  "newState": "CLOCKED_OUT"
}
```

**注意**: 如果有未結束的休息，會回傳錯誤

---

### POST /api/attendance/break/start

開始休息

**Request Body**
```json
{
  "storeId": "...",
  "breakType": "REST" // REST | MEAL | PERSONAL | EMERGENCY
}
```

**Response**
```json
{
  "success": true,
  "message": "開始休息",
  "newState": "ON_BREAK"
}
```

**錯誤情況**
- 400: 已達到最大休息次數

---

### POST /api/attendance/break/end

結束休息

**Request Body**
```json
{
  "storeId": "..."
}
```

**Response**
```json
{
  "success": true,
  "message": "結束休息 (30 分鐘)",
  "newState": "WORKING"
}
```

---

## 狀態碼說明

| 狀態碼 | 說明 |
|--------|------|
| 200 | 成功 |
| 400 | 請求錯誤 / 業務邏輯錯誤 |
| 401 | 未授權 (需要登入) |
| 403 | 禁止存取 (權限不足) |
| 500 | 伺服器錯誤 |

---

## 打卡狀態說明

| 狀態 | 說明 |
|------|------|
| NOT_CLOCKED_IN | 今日尚未打卡 |
| WORKING | 工作中 |
| ON_BREAK | 休息中 |
| CLOCKED_OUT | 已下班 |
| SPLIT_BREAK | 分段班休息中 |

---

## 出勤狀態說明

| 狀態 | 說明 |
|------|------|
| CLOCKED_IN | 已上班 (工作中) |
| ON_BREAK | 休息中 |
| CLOCKED_OUT | 已下班 (正常) |
| ABSENT | 缺勤 |
| PENDING_REVIEW | 待審核 |
| APPROVED | 已核准 |
| REJECTED | 已駁回 |

---

## 待開發 API

### Phase 2 - 排班
- GET /api/schedules/my-schedule
- GET /api/schedules/week/:date
- POST /api/schedules
- POST /api/schedules/bulk
- POST /api/schedules/publish
- GET /api/shifts
- POST /api/shifts

### Phase 3 - 審核
- GET /api/approvals
- POST /api/approvals/:id/approve
- POST /api/approvals/:id/reject
- POST /api/leaves
- GET /api/leaves/balance

### Phase 4 - 薪資
- POST /api/payroll/calculate
- GET /api/payroll/export
- GET /api/payroll/:userId

### Phase 5 - 報表
- GET /api/reports/attendance
- GET /api/reports/hours
- GET /api/reports/payroll
