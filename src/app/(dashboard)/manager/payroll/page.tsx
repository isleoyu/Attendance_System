"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { zhTW } from "date-fns/locale"

interface PayrollRecord {
  id: string
  userId: string
  periodStart: string
  periodEnd: string
  regularHours: number
  overtimeHours: number
  holidayHours: number
  regularRate: number
  overtimeRate: number
  holidayRate: number
  grossPay: number
  deductions: number
  netPay: number
  status: string
  user: {
    id: string
    name: string
    employeeId: string
    stores: { store: { id: string; name: string } }[]
  }
}

interface PayrollSummary {
  totalEmployees: number
  totalRegularHours: number
  totalOvertimeHours: number
  totalHolidayHours: number
  totalGrossPay: number
  totalDeductions: number
  totalNetPay: number
  byStatus: Record<string, number>
}

interface Store {
  id: string
  name: string
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PENDING_APPROVAL: "待審核",
  APPROVED: "已核准",
  PAID: "已發放",
  DISPUTED: "有爭議",
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  PAID: "bg-blue-100 text-blue-800",
  DISPUTED: "bg-red-100 text-red-800",
}

export default function PayrollPage() {
  const { data: session } = useSession()
  const [selectedStore, setSelectedStore] = useState<string>("")
  const [periodStart, setPeriodStart] = useState(() => format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"))
  const [periodEnd, setPeriodEnd] = useState(() => format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"))
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [summary, setSummary] = useState<PayrollSummary | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState("")

  // Get user's stores
  useEffect(() => {
    if (session?.user?.stores) {
      const userStores = session.user.stores.map((s: any) => ({
        id: s.id,
        name: s.name,
      }))
      setStores(userStores)
      if (userStores.length > 0 && !selectedStore) {
        setSelectedStore(userStores[0].id)
      }
    }
  }, [session])

  // Fetch payroll records
  const fetchRecords = async () => {
    if (!selectedStore) return

    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({
        periodStart,
        periodEnd,
        storeId: selectedStore,
      })

      const [recordsRes, summaryRes] = await Promise.all([
        fetch(`/api/payroll?${params}`),
        fetch(`/api/payroll/summary?${params}`),
      ])

      if (!recordsRes.ok || !summaryRes.ok) {
        throw new Error("取得薪資資料失敗")
      }

      const recordsData = await recordsRes.json()
      const summaryData = await summaryRes.json()

      setRecords(recordsData)
      setSummary(summaryData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedStore) {
      fetchRecords()
    }
  }, [selectedStore, periodStart, periodEnd])

  // Generate payroll
  const handleGenerate = async () => {
    if (!selectedStore) return

    setGenerating(true)
    setError("")
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: selectedStore,
          periodStart,
          periodEnd,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "產生薪資資料失敗")
      }

      await fetchRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤")
    } finally {
      setGenerating(false)
    }
  }

  // Export to CSV
  const handleExport = async () => {
    if (!selectedStore) return

    setExporting(true)
    try {
      const params = new URLSearchParams({
        periodStart,
        periodEnd,
        storeId: selectedStore,
      })

      const res = await fetch(`/api/payroll/export?${params}`)

      if (!res.ok) {
        throw new Error("匯出失敗")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `payroll_${periodStart}_${periodEnd}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : "匯出失敗")
    } finally {
      setExporting(false)
    }
  }

  // Quick period selection
  const setQuickPeriod = (months: number) => {
    const target = subMonths(new Date(), months)
    setPeriodStart(format(startOfMonth(target), "yyyy-MM-dd"))
    setPeriodEnd(format(endOfMonth(target), "yyyy-MM-dd"))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">薪資報表</h1>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedStore}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? "計算中..." : "產生薪資"}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || records.length === 0}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? "匯出中..." : "匯出 CSV"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              店鋪
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              起始日期
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              結束日期
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              快速選擇
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setQuickPeriod(1)}
                className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                上月
              </button>
              <button
                onClick={() => setQuickPeriod(0)}
                className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                本月
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">員工人數</div>
            <div className="text-2xl font-bold">{summary.totalEmployees}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">總工時</div>
            <div className="text-2xl font-bold">
              {(summary.totalRegularHours + summary.totalOvertimeHours + summary.totalHolidayHours).toFixed(1)} 時
            </div>
            <div className="text-xs text-gray-400">
              正常 {summary.totalRegularHours.toFixed(1)} / 加班 {summary.totalOvertimeHours.toFixed(1)} / 假日 {summary.totalHolidayHours.toFixed(1)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">總薪資</div>
            <div className="text-2xl font-bold text-green-600">
              ${summary.totalGrossPay.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">實發金額</div>
            <div className="text-2xl font-bold text-blue-600">
              ${summary.totalNetPay.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Status Summary */}
      {summary && (
        <div className="flex gap-4 flex-wrap">
          {Object.entries(summary.byStatus).map(([status, count]) => (
            count > 0 && (
              <div
                key={status}
                className={`px-3 py-1 rounded-full text-sm ${STATUS_COLORS[status] || "bg-gray-100"}`}
              >
                {STATUS_LABELS[status] || status}: {count}
              </div>
            )
          ))}
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">載入中...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>尚無薪資記錄</p>
            <p className="text-sm mt-2">點擊「產生薪資」以計算此期間的薪資</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    員工
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    正常工時
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    加班工時
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    假日工時
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    總薪資
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    扣款
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    實發
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    狀態
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium">{record.user.name}</div>
                      <div className="text-sm text-gray-500">{record.user.employeeId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {Number(record.regularHours).toFixed(1)} 時
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {Number(record.overtimeHours).toFixed(1)} 時
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {Number(record.holidayHours).toFixed(1)} 時
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                      ${Number(record.grossPay).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-red-600">
                      -${Number(record.deductions).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-green-600">
                      ${Number(record.netPay).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[record.status] || "bg-gray-100"}`}>
                        {STATUS_LABELS[record.status] || record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
