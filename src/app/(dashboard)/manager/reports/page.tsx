"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface EmployeeDetail {
  userId: string
  userName: string
  employeeId: string
  presentDays: number
  absentDays: number
  lateDays: number
  leaveDays: number
  totalWorkHours: number
  overtimeHours: number
  attendanceRate: number
}

interface DailyStat {
  date: string
  present: number
  absent: number
  late: number
  onLeave: number
  total: number
}

interface TrendData {
  month: string
  workHours: number
  overtimeHours: number
  attendanceRate: number
}

interface Store {
  id: string
  name: string
}

const COLORS = ["#10B981", "#EF4444", "#F59E0B", "#6366F1"]

export default function ReportsPage() {
  const { data: session } = useSession()
  const [selectedStore, setSelectedStore] = useState<string>("")
  const [startDate, setStartDate] = useState(() => format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(() => format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"))
  const [stores, setStores] = useState<Store[]>([])
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetail[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([])
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<"overview" | "employees" | "trend">("overview")

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

  // Fetch data
  const fetchData = async () => {
    if (!selectedStore) return

    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({
        storeId: selectedStore,
        startDate,
        endDate,
      })

      const [detailsRes, dailyRes, trendRes] = await Promise.all([
        fetch(`/api/reports/attendance?${params}`),
        fetch(`/api/reports/daily?${params}`),
        fetch(`/api/reports/trend?storeId=${selectedStore}&year=${new Date().getFullYear()}`),
      ])

      if (!detailsRes.ok || !dailyRes.ok || !trendRes.ok) {
        throw new Error("取得報表資料失敗")
      }

      const [details, daily, trend] = await Promise.all([
        detailsRes.json(),
        dailyRes.json(),
        trendRes.json(),
      ])

      setEmployeeDetails(details)
      setDailyStats(daily)
      setTrendData(trend)
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedStore) {
      fetchData()
    }
  }, [selectedStore, startDate, endDate])

  // Export to CSV
  const handleExport = async () => {
    if (!selectedStore) return

    setExporting(true)
    try {
      const params = new URLSearchParams({
        storeId: selectedStore,
        startDate,
        endDate,
      })

      const res = await fetch(`/api/reports/export?${params}`)

      if (!res.ok) {
        throw new Error("匯出失敗")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `attendance_report_${startDate}_${endDate}.csv`
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
    setStartDate(format(startOfMonth(target), "yyyy-MM-dd"))
    setEndDate(format(endOfMonth(target), "yyyy-MM-dd"))
  }

  // Calculate summary stats
  const summaryStats = {
    totalEmployees: employeeDetails.length,
    avgAttendanceRate: employeeDetails.length > 0
      ? Math.round(employeeDetails.reduce((sum, e) => sum + e.attendanceRate, 0) / employeeDetails.length)
      : 0,
    totalWorkHours: employeeDetails.reduce((sum, e) => sum + e.totalWorkHours, 0),
    totalOvertimeHours: employeeDetails.reduce((sum, e) => sum + e.overtimeHours, 0),
    totalPresentDays: employeeDetails.reduce((sum, e) => sum + e.presentDays, 0),
    totalAbsentDays: employeeDetails.reduce((sum, e) => sum + e.absentDays, 0),
    totalLeaveDays: employeeDetails.reduce((sum, e) => sum + e.leaveDays, 0),
  }

  // Pie chart data
  const pieData = [
    { name: "出勤", value: summaryStats.totalPresentDays },
    { name: "缺勤", value: summaryStats.totalAbsentDays },
    { name: "請假", value: summaryStats.totalLeaveDays },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">出勤報表</h1>
        <button
          onClick={handleExport}
          disabled={exporting || employeeDetails.length === 0}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting ? "匯出中..." : "匯出 CSV"}
        </button>
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
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              結束日期
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {[
            { key: "overview", label: "總覽" },
            { key: "employees", label: "員工明細" },
            { key: "trend", label: "趨勢分析" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">載入中...</div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">員工人數</div>
                  <div className="text-2xl font-bold">{summaryStats.totalEmployees}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">平均出勤率</div>
                  <div className="text-2xl font-bold text-green-600">
                    {summaryStats.avgAttendanceRate}%
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">總工時</div>
                  <div className="text-2xl font-bold">
                    {summaryStats.totalWorkHours.toFixed(1)} 時
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-500">加班時數</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {summaryStats.totalOvertimeHours.toFixed(1)} 時
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Daily Attendance Chart */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-lg font-medium mb-4">每日出勤統計</h3>
                  {dailyStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => value.slice(5)}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="present" name="出勤" fill="#10B981" stackId="a" />
                        <Bar dataKey="absent" name="缺勤" fill="#EF4444" stackId="a" />
                        <Bar dataKey="onLeave" name="請假" fill="#6366F1" stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      暫無資料
                    </div>
                  )}
                </div>

                {/* Attendance Distribution Pie Chart */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-lg font-medium mb-4">出勤分布</h3>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      暫無資料
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Employees Tab */}
          {activeTab === "employees" && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {employeeDetails.length === 0 ? (
                <div className="p-8 text-center text-gray-500">暫無資料</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          員工
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          出勤
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          缺勤
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          請假
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          工時
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          加班
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          出勤率
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {employeeDetails.map((emp) => (
                        <tr key={emp.userId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium">{emp.userName}</div>
                            <div className="text-sm text-gray-500">{emp.employeeId}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-green-600">
                            {emp.presentDays} 天
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-red-600">
                            {emp.absentDays} 天
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-indigo-600">
                            {emp.leaveDays} 天
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            {emp.totalWorkHours.toFixed(1)} 時
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-orange-600">
                            {emp.overtimeHours.toFixed(1)} 時
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                emp.attendanceRate >= 90
                                  ? "bg-green-100 text-green-800"
                                  : emp.attendanceRate >= 70
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {emp.attendanceRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Trend Tab */}
          {activeTab === "trend" && (
            <div className="space-y-6">
              {/* Work Hours Trend */}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-medium mb-4">工時趨勢 ({new Date().getFullYear()})</h3>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.slice(5) + "月"}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => [`${value} 小時`, ""]}
                        labelFormatter={(label) => `${label.slice(5)}月`}
                      />
                      <Legend />
                      <Bar dataKey="workHours" name="正常工時" fill="#10B981" />
                      <Bar dataKey="overtimeHours" name="加班時數" fill="#F59E0B" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    暫無資料
                  </div>
                )}
              </div>

              {/* Attendance Rate Trend */}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-medium mb-4">出勤率趨勢 ({new Date().getFullYear()})</h3>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.slice(5) + "月"}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, "出勤率"]}
                        labelFormatter={(label) => `${label.slice(5)}月`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="attendanceRate"
                        name="出勤率"
                        stroke="#6366F1"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    暫無資料
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
