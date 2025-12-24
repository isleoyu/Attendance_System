"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"

interface Store {
  id: string
  name: string
}

interface SalesReport {
  id: string
  storeId: string
  store: { id: string; name: string; code: string }
  date: string
  dailySales: number
  cashIncome: number
  linePayIncome: number
  uberIncome: number
  foodPandaIncome: number
  expenses: number
  cashDifference: number
  dailyCash: number
  depositedCash: number
  undepositedCash: number
  cumulativeSales: number
  totalLaborHours: number
  productivity: number
  submitter: { id: string; name: string; employeeId: string }
  notes: string | null
  entries?: SalesEntry[]
  entryCount?: number
  createdAt: string
  updatedAt: string
}

interface SalesEntry {
  id: string
  entryType: string
  amount: number
  description: string | null
  reference: string | null
  createdBy: { id: string; name: string; employeeId: string }
  createdAt: string
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  CASH_INCOME: "現金收入",
  LINEPAY_INCOME: "LinePay",
  UBER_INCOME: "Uber",
  FOODPANDA_INCOME: "FoodPanda",
  EXPENSE: "支出",
  DEPOSIT: "存款",
  ADJUSTMENT: "調整",
  OTHER: "其他",
}

const defaultForm = {
  dailySales: "",
  cashIncome: "",
  linePayIncome: "",
  uberIncome: "",
  foodPandaIncome: "",
  expenses: "",
  cashDifference: "",
  dailyCash: "",
  depositedCash: "",
  undepositedCash: "",
  notes: "",
}

export default function DailySalesPage() {
  const { data: session } = useSession()
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState("")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [reports, setReports] = useState<SalesReport[]>([])
  const [currentReport, setCurrentReport] = useState<SalesReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  // Journal modal
  const [showJournal, setShowJournal] = useState(false)
  const [journalEntries, setJournalEntries] = useState<SalesEntry[]>([])

  // Fetch stores
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await fetch("/api/stores?simple=true")
        if (res.ok) {
          const data = await res.json()
          const storeList = Array.isArray(data) ? data : []
          setStores(storeList)
          if (storeList.length > 0 && !selectedStore) {
            setSelectedStore(storeList[0].id)
          }
        }
      } catch (err) {
        console.error("Error fetching stores:", err)
      }
    }
    fetchStores()
  }, [])

  // Fetch reports
  const fetchReports = useCallback(async () => {
    if (!selectedStore) return

    setLoading(true)
    setError("")
    try {
      // Get current month range
      const date = new Date(selectedDate)
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0]
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0]

      const params = new URLSearchParams({
        storeId: selectedStore,
        startDate,
        endDate,
      })

      const res = await fetch(`/api/sales/daily?${params}`)
      if (!res.ok) throw new Error("取得業績資料失敗")

      const data = await res.json()
      setReports(data.reports || [])

      // Find today's report
      const todayReport = (data.reports || []).find((r: SalesReport) => r.date === selectedDate)
      setCurrentReport(todayReport || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤")
    } finally {
      setLoading(false)
    }
  }, [selectedStore, selectedDate])

  useEffect(() => {
    if (selectedStore) {
      fetchReports()
    }
  }, [selectedStore, selectedDate, fetchReports])

  // Open form for new/edit
  const openForm = (report?: SalesReport) => {
    if (report) {
      setForm({
        dailySales: report.dailySales.toString(),
        cashIncome: report.cashIncome.toString(),
        linePayIncome: report.linePayIncome.toString(),
        uberIncome: report.uberIncome.toString(),
        foodPandaIncome: report.foodPandaIncome.toString(),
        expenses: report.expenses.toString(),
        cashDifference: report.cashDifference.toString(),
        dailyCash: report.dailyCash.toString(),
        depositedCash: report.depositedCash.toString(),
        undepositedCash: report.undepositedCash.toString(),
        notes: report.notes || "",
      })
    } else {
      setForm(defaultForm)
    }
    setShowForm(true)
  }

  // Save report
  const handleSave = async () => {
    setSaving(true)
    setError("")

    try {
      const payload = {
        storeId: selectedStore,
        date: selectedDate,
        dailySales: parseFloat(form.dailySales) || 0,
        cashIncome: parseFloat(form.cashIncome) || 0,
        linePayIncome: parseFloat(form.linePayIncome) || 0,
        uberIncome: parseFloat(form.uberIncome) || 0,
        foodPandaIncome: parseFloat(form.foodPandaIncome) || 0,
        expenses: parseFloat(form.expenses) || 0,
        cashDifference: parseFloat(form.cashDifference) || 0,
        dailyCash: parseFloat(form.dailyCash) || 0,
        depositedCash: parseFloat(form.depositedCash) || 0,
        undepositedCash: parseFloat(form.undepositedCash) || 0,
        notes: form.notes || undefined,
      }

      const res = await fetch("/api/sales/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "儲存失敗")
      }

      setShowForm(false)
      fetchReports()
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤")
    } finally {
      setSaving(false)
    }
  }

  // View journal
  const viewJournal = async (report: SalesReport) => {
    try {
      const res = await fetch(`/api/sales/entries?reportId=${report.id}`)
      if (res.ok) {
        const entries = await res.json()
        setJournalEntries(entries)
        setShowJournal(true)
      }
    } catch (err) {
      console.error("Error fetching journal:", err)
    }
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString()}`
  }

  if (loading && !stores.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">每日業績回報</h1>
          <p className="text-gray-600 mt-1">記錄每日營業額與現金流</p>
        </div>
        <button
          onClick={() => openForm(currentReport || undefined)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          {currentReport ? "編輯今日業績" : "填寫今日業績"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">店鋪</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Today's Summary */}
      {currentReport && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">今日業績摘要</h2>
            <span className="text-sm text-gray-500">
              結帳人: {currentReport.submitter.name}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600">當日營業額</div>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(currentReport.dailySales)}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600">累計營業額</div>
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(currentReport.cumulativeSales)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-600">總人力時</div>
              <div className="text-2xl font-bold text-purple-700">
                {currentReport.totalLaborHours.toFixed(1)} hr
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-sm text-orange-600">生產力</div>
              <div className="text-2xl font-bold text-orange-700">
                {formatCurrency(currentReport.productivity)}/hr
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-gray-500">現金收入:</span>
              <span className="ml-2 font-medium">{formatCurrency(currentReport.cashIncome)}</span>
            </div>
            <div>
              <span className="text-gray-500">LinePay:</span>
              <span className="ml-2 font-medium">{formatCurrency(currentReport.linePayIncome)}</span>
            </div>
            <div>
              <span className="text-gray-500">Uber:</span>
              <span className="ml-2 font-medium">{formatCurrency(currentReport.uberIncome)}</span>
            </div>
            <div>
              <span className="text-gray-500">FoodPanda:</span>
              <span className="ml-2 font-medium">{formatCurrency(currentReport.foodPandaIncome)}</span>
            </div>
            <div>
              <span className="text-gray-500">支出:</span>
              <span className="ml-2 font-medium text-red-600">{formatCurrency(currentReport.expenses)}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">短溢金額:</span>
              <span className={`ml-2 font-medium ${currentReport.cashDifference >= 0 ? "text-green-600" : "text-red-600"}`}>
                {currentReport.cashDifference >= 0 ? "+" : ""}{formatCurrency(currentReport.cashDifference)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">當日現金:</span>
              <span className="ml-2 font-medium">{formatCurrency(currentReport.dailyCash)}</span>
            </div>
            <div>
              <span className="text-gray-500">存入現金:</span>
              <span className="ml-2 font-medium">{formatCurrency(currentReport.depositedCash)}</span>
            </div>
            <div>
              <span className="text-gray-500">未存現金:</span>
              <span className="ml-2 font-medium">{formatCurrency(currentReport.undepositedCash)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Reports Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">本月業績記錄</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">載入中...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-gray-500">本月尚無業績記錄</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">營業額</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">累計</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">人力時</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">生產力</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">結帳人</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(report.date).toLocaleDateString("zh-TW", {
                        month: "2-digit",
                        day: "2-digit",
                        weekday: "short",
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      {formatCurrency(report.dailySales)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {formatCurrency(report.cumulativeSales)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {report.totalLaborHours.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {formatCurrency(report.productivity)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {report.submitter.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <button
                        onClick={() => viewJournal(report)}
                        className="text-primary hover:underline mr-3"
                      >
                        流水帳
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDate(report.date)
                          openForm(report)
                        }}
                        className="text-gray-600 hover:underline"
                      >
                        編輯
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Input Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {currentReport ? "編輯業績" : "填寫業績"} - {selectedDate}
              </h2>

              <div className="space-y-4">
                {/* Sales inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      當日營業額 *
                    </label>
                    <input
                      type="number"
                      value={form.dailySales}
                      onChange={(e) => setForm({ ...form, dailySales: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      現金收入
                    </label>
                    <input
                      type="number"
                      value={form.cashIncome}
                      onChange={(e) => setForm({ ...form, cashIncome: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      LinePay 收入
                    </label>
                    <input
                      type="number"
                      value={form.linePayIncome}
                      onChange={(e) => setForm({ ...form, linePayIncome: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Uber 收入
                    </label>
                    <input
                      type="number"
                      value={form.uberIncome}
                      onChange={(e) => setForm({ ...form, uberIncome: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      FoodPanda 收入
                    </label>
                    <input
                      type="number"
                      value={form.foodPandaIncome}
                      onChange={(e) => setForm({ ...form, foodPandaIncome: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      支出費用
                    </label>
                    <input
                      type="number"
                      value={form.expenses}
                      onChange={(e) => setForm({ ...form, expenses: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      短溢金額 (正=溢收, 負=短少)
                    </label>
                    <input
                      type="number"
                      value={form.cashDifference}
                      onChange={(e) => setForm({ ...form, cashDifference: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">現金處理</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        當日現金
                      </label>
                      <input
                        type="number"
                        value={form.dailyCash}
                        onChange={(e) => setForm({ ...form, dailyCash: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        存入現金
                      </label>
                      <input
                        type="number"
                        value={form.depositedCash}
                        onChange={(e) => setForm({ ...form, depositedCash: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        未存現金
                      </label>
                      <input
                        type="number"
                        value={form.undepositedCash}
                        onChange={(e) => setForm({ ...form, undepositedCash: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    備註
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="其他說明..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "儲存中..." : "儲存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Journal Modal */}
      {showJournal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">流水帳記錄</h2>
                <button
                  onClick={() => setShowJournal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  關閉
                </button>
              </div>

              {journalEntries.length === 0 ? (
                <div className="text-center text-gray-500 py-8">暫無流水帳記錄</div>
              ) : (
                <div className="space-y-3">
                  {journalEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            entry.amount >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}>
                            {ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType}
                          </span>
                          <span className="text-sm text-gray-500">{entry.description}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {entry.createdBy.name} - {new Date(entry.createdAt).toLocaleString("zh-TW")}
                        </div>
                      </div>
                      <div className={`text-lg font-medium ${entry.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {entry.amount >= 0 ? "+" : ""}{formatCurrency(entry.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
