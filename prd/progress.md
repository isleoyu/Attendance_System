# 開發進度追蹤

## 總覽

| 階段 | 名稱 | 狀態 | 完成度 |
|------|------|------|--------|
| Phase 1 | 基礎建設 | ✅ 完成 | 100% |
| Phase 2 | 排班系統 | ✅ 完成 | 100% |
| Phase 3 | 審核流程 | ✅ 完成 | 100% |
| Phase 4 | 薪資整合 | ✅ 完成 | 100% |
| Phase 5 | 報表系統 | ✅ 完成 | 100% |
| Phase 6 | 優化部署 | 🔲 待開發 | 0% |

---

## Phase 1: 基礎建設 ✅

**完成日期**: 2024-12-19

### 已完成項目

#### 專案初始化
- [x] Next.js 14 專案建立
- [x] TypeScript 設定
- [x] Tailwind CSS 設定
- [x] ESLint 設定

#### 資料庫設計
- [x] Prisma Schema 完成（12 個資料表）
- [x] 多店鋪關聯設計 (UserStore)
- [x] 測試資料 Seed 檔案

#### 認證系統
- [x] NextAuth.js 設定
- [x] 員工編號登入
- [x] Session 管理
- [x] 角色權限定義

#### 打卡核心邏輯
- [x] 狀態機實作 (state-machine.ts)
- [x] 工時計算器 (work-hours-calculator.ts)
- [x] 出勤服務 (attendance-service.ts)

#### API 端點
- [x] POST /api/attendance/clock-in
- [x] POST /api/attendance/clock-out
- [x] POST /api/attendance/break/start
- [x] POST /api/attendance/break/end
- [x] GET /api/attendance/today

#### UI 組件
- [x] 登入頁面
- [x] Dashboard 佈局
- [x] 導航列
- [x] 打卡組件 (ClockWidget)

### 產出檔案

```
✅ package.json
✅ tsconfig.json
✅ next.config.js
✅ tailwind.config.ts
✅ prisma/schema.prisma
✅ prisma/seed.ts
✅ src/lib/prisma.ts
✅ src/lib/utils.ts
✅ src/lib/auth/auth-options.ts
✅ src/lib/attendance/state-machine.ts
✅ src/lib/attendance/work-hours-calculator.ts
✅ src/lib/attendance/attendance-service.ts
✅ src/app/layout.tsx
✅ src/app/page.tsx
✅ src/app/(auth)/login/page.tsx
✅ src/app/(dashboard)/layout.tsx
✅ src/app/(dashboard)/dashboard/page.tsx
✅ src/app/api/auth/[...nextauth]/route.ts
✅ src/app/api/attendance/today/route.ts
✅ src/app/api/attendance/clock-in/route.ts
✅ src/app/api/attendance/clock-out/route.ts
✅ src/app/api/attendance/break/start/route.ts
✅ src/app/api/attendance/break/end/route.ts
✅ src/components/providers.tsx
✅ src/components/dashboard/nav.tsx
✅ src/components/clock/clock-widget.tsx
```

---

## Phase 2: 排班系統 ✅

**完成日期**: 2024-12-19

### 已完成項目

#### 班別管理
- [x] 班別服務 (shift-type-service.ts)
- [x] GET /api/shift-types - 取得班別列表
- [x] POST /api/shift-types - 新增班別
- [x] GET /api/shift-types/:id - 取得單一班別
- [x] PUT /api/shift-types/:id - 更新班別
- [x] DELETE /api/shift-types/:id - 刪除班別

#### 排班管理
- [x] 排班服務 (schedule-service.ts)
- [x] GET /api/schedules - 取得排班列表
- [x] POST /api/schedules - 新增排班（單一/批次）
- [x] GET /api/schedules/:id - 取得單一排班
- [x] PUT /api/schedules/:id - 更新排班
- [x] DELETE /api/schedules/:id - 刪除排班
- [x] POST /api/schedules/publish - 發布排班
- [x] GET /api/stores/:id/employees - 取得店鋪員工列表

#### UI 頁面
- [x] 我的排班頁面 (/dashboard/schedule)
- [x] 排班管理頁面 (/manager/scheduling)
- [x] 週曆視圖組件
- [x] 新增排班 Modal

### 產出檔案

```
✅ src/lib/schedule/shift-type-service.ts
✅ src/lib/schedule/schedule-service.ts
✅ src/app/api/shift-types/route.ts
✅ src/app/api/shift-types/[id]/route.ts
✅ src/app/api/schedules/route.ts
✅ src/app/api/schedules/[id]/route.ts
✅ src/app/api/schedules/publish/route.ts
✅ src/app/api/stores/[id]/employees/route.ts
✅ src/app/(dashboard)/schedule/page.tsx
✅ src/app/(dashboard)/manager/scheduling/page.tsx
```

---

## Phase 3: 審核流程 ✅

**完成日期**: 2024-12-19

### 已完成項目

#### 審核服務
- [x] 審核服務 (approval-service.ts)
- [x] 權限分級邏輯 (APPROVAL_LIMITS)
- [x] 審核類型支援：出勤調整、加班、請假、排班變更

#### API 端點
- [x] GET /api/approvals - 取得審核列表
- [x] GET /api/approvals/:id - 取得單一審核
- [x] POST /api/approvals/:id - 處理審核（核准/駁回）
- [x] GET /api/leave-requests - 取得請假列表
- [x] POST /api/leave-requests - 新增請假申請
- [x] POST /api/leave-requests/:id/cancel - 取消請假

#### UI 頁面
- [x] 請假申請頁面 (/dashboard/leave)
- [x] 審核佇列頁面 (/manager/approvals)

#### 權限分級
- [x] 組長: 出勤調整、加班上限 60 分鐘、請假上限 1 天
- [x] 店長: 全部類型、加班上限 480 分鐘、請假上限 14 天
- [x] 管理員: 無限制

### 產出檔案

```
✅ src/lib/approval/approval-service.ts
✅ src/app/api/approvals/route.ts
✅ src/app/api/approvals/[id]/route.ts
✅ src/app/api/leave-requests/route.ts
✅ src/app/api/leave-requests/[id]/cancel/route.ts
✅ src/app/(dashboard)/dashboard/leave/page.tsx
✅ src/app/(dashboard)/manager/approvals/page.tsx
```

---

## Phase 4: 薪資整合 ✅

**完成日期**: 2024-12-19

### 已完成項目

#### 薪資計算服務
- [x] 薪資服務 (payroll-service.ts)
- [x] 加班費率設定（平日前 2 小時 1.34x，2 小時後 1.67x）
- [x] 假日加班費率（2x）
- [x] 夜班津貼（22:00-06:00，每小時 +50）
- [x] 工時計算與薪資試算

#### API 端點
- [x] GET /api/payroll - 取得薪資記錄
- [x] POST /api/payroll - 產生薪資記錄
- [x] GET /api/payroll/summary - 取得薪資摘要
- [x] GET /api/payroll/export - 匯出 CSV

#### UI 頁面
- [x] 薪資報表頁面 (/manager/payroll)
- [x] 薪資摘要卡片
- [x] 員工薪資明細表
- [x] CSV 匯出功能

### 產出檔案

```
✅ src/lib/payroll/payroll-service.ts
✅ src/app/api/payroll/route.ts
✅ src/app/api/payroll/summary/route.ts
✅ src/app/api/payroll/export/route.ts
✅ src/app/(dashboard)/manager/payroll/page.tsx
```

---

## Phase 5: 報表系統 ✅

**完成日期**: 2024-12-19

### 已完成項目

#### 報表服務
- [x] 報表服務 (report-service.ts)
- [x] 員工出勤明細統計
- [x] 每日出勤統計
- [x] 月度趨勢分析
- [x] 店鋪統計摘要

#### API 端點
- [x] GET /api/reports/attendance - 員工出勤明細
- [x] GET /api/reports/daily - 每日出勤統計
- [x] GET /api/reports/trend - 月度趨勢
- [x] GET /api/reports/export - CSV 匯出

#### UI 頁面
- [x] 出勤報表頁面 (/manager/reports)
- [x] 總覽標籤（摘要卡片、長條圖、圓餅圖）
- [x] 員工明細標籤（詳細表格）
- [x] 趨勢分析標籤（折線圖、長條圖）
- [x] CSV 匯出功能

#### 圖表視覺化
- [x] 每日出勤長條圖
- [x] 出勤分布圓餅圖
- [x] 工時趨勢長條圖
- [x] 出勤率趨勢折線圖

### 產出檔案

```
✅ src/lib/reports/report-service.ts
✅ src/app/api/reports/attendance/route.ts
✅ src/app/api/reports/daily/route.ts
✅ src/app/api/reports/trend/route.ts
✅ src/app/api/reports/export/route.ts
✅ src/app/(dashboard)/manager/reports/page.tsx
```

---

## Phase 6: 優化部署 🔲

**預計內容**:
- [ ] 即時更新 (SSE)
- [ ] 手機響應式優化
- [ ] 效能優化
- [ ] 部署設定
- [ ] 文件完善

---

## 待啟動前置作業

### 1. 環境設定
```bash
# 複製環境變數檔案
cp .env.example .env

# 編輯 .env 設定資料庫連線
DATABASE_URL="postgresql://user:password@localhost:5432/attendance_system"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

### 2. 資料庫初始化
```bash
# 推送 Schema 到資料庫
pnpm db:push

# 建立測試資料
pnpm db:seed
```

### 3. 啟動開發伺服器
```bash
pnpm dev
```

### 4. 測試帳號
| 角色 | 員工編號 | 密碼 |
|------|----------|------|
| 管理員 | ADMIN001 | admin123 |
| 店長 | MGR001 | manager123 |
| 組長 | LEAD001 | employee123 |
| 員工 | EMP001 | employee123 |
| 員工 | EMP002 | employee123 |

---

## 更新日誌

### 2024-12-19
- 初始化專案結構
- 完成 Phase 1 基礎建設
- 建立 PRD 文件目錄
- 完成 Phase 2 排班系統
  - 班別 CRUD API
  - 排班 CRUD API（支援單一/批次建立）
  - 我的排班頁面（員工查看）
  - 排班管理頁面（店長管理）
- 完成 Phase 3 審核流程
  - 審核服務與權限分級
  - 請假申請功能
  - 審核佇列頁面
- 完成 Phase 4 薪資整合
  - 薪資計算服務（含加班費率、假日加班、夜班津貼）
  - 薪資 API 端點（查詢、產生、摘要、匯出）
  - 薪資報表頁面（店長/管理員）
  - CSV 匯出功能
- 完成 Phase 5 報表系統
  - 報表服務（員工出勤、每日統計、月度趨勢）
  - 報表 API 端點（查詢、匯出）
  - 出勤報表頁面（含多種圖表視覺化）
  - 使用 Recharts 實現圖表（長條圖、圓餅圖、折線圖）
