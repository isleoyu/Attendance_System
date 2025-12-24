"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"

interface Employee {
  id: string
  employeeId: string
  name: string
  email: string | null
  phone: string | null
  role: string
  status: string
  employmentType: string
  hourlyRate: number | null    // 時薪 (兼職)
  monthlySalary: number | null // 月薪 (正職)
  createdAt: string
  stores: {
    id: string
    storeId: string
    storeName: string
    isPrimary: boolean
    canClockIn: boolean
  }[]
}

interface Store {
  id: string
  name: string
}

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "員工",
  SHIFT_LEADER: "組長",
  STORE_MANAGER: "店長",
  SUPER_ADMIN: "管理員",
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "正職",
  PART_TIME: "兼職",
}

const EMPLOYMENT_TYPE_COLORS: Record<string, string> = {
  FULL_TIME: "bg-blue-100 text-blue-800",
  PART_TIME: "bg-orange-100 text-orange-800",
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "正常",
  INACTIVE: "停用",
  SUSPENDED: "暫停",
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  SUSPENDED: "bg-red-100 text-red-800",
}

export default function EmployeesPage() {
  const { data: session } = useSession()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterStore, setFilterStore] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState({
    employeeId: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "EMPLOYEE",
    employmentType: "PART_TIME",
    hourlyRate: "",      // 時薪 (兼職)
    monthlySalary: "",   // 月薪 (正職)
    status: "ACTIVE",
    storeAssignments: [] as { storeId: string; isPrimary: boolean; canClockIn: boolean }[],
  })

  // Fetch stores
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await fetch("/api/stores?simple=true")
        if (res.ok) {
          const data = await res.json()
          setStores(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error("Error fetching stores:", err)
      }
    }
    fetchStores()
  }, [])

  // Fetch employees
  const fetchEmployees = async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (filterRole) params.set("role", filterRole)
      if (filterStatus) params.set("status", filterStatus)
      if (filterStore) params.set("storeId", filterStore)

      const res = await fetch(`/api/employees?${params}`)
      if (!res.ok) throw new Error("取得員工資料失敗")

      const data = await res.json()
      setEmployees(data.employees)
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [search, filterRole, filterStatus, filterStore])

  // Open modal for new employee
  const handleNew = () => {
    setEditingEmployee(null)
    setForm({
      employeeId: "",
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "EMPLOYEE",
      employmentType: "PART_TIME",
      hourlyRate: "183",
      monthlySalary: "",
      status: "ACTIVE",
      storeAssignments: stores.length > 0 ? [{ storeId: stores[0].id, isPrimary: true, canClockIn: true }] : [],
    })
    setShowModal(true)
  }

  // Open modal for editing
  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee)
    setForm({
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email || "",
      phone: employee.phone || "",
      password: "",
      role: employee.role,
      employmentType: employee.employmentType || "PART_TIME",
      hourlyRate: employee.hourlyRate?.toString() || "",
      monthlySalary: employee.monthlySalary?.toString() || "",
      status: employee.status,
      storeAssignments: employee.stores.map((s) => ({
        storeId: s.storeId,
        isPrimary: s.isPrimary,
        canClockIn: s.canClockIn,
      })),
    })
    setShowModal(true)
  }

  // Save employee
  const handleSave = async () => {
    setSaving(true)
    setError("")

    try {
      const payload: any = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        role: form.role,
        employmentType: form.employmentType,
        storeAssignments: form.storeAssignments,
      }

      // Set salary based on employment type
      if (form.employmentType === "PART_TIME") {
        payload.hourlyRate = form.hourlyRate ? parseFloat(form.hourlyRate) : null
        payload.monthlySalary = null
      } else {
        payload.monthlySalary = form.monthlySalary ? parseFloat(form.monthlySalary) : null
        payload.hourlyRate = null
      }

      if (editingEmployee) {
        // Update
        if (form.password) payload.password = form.password
        if (form.status) payload.status = form.status

        const res = await fetch(`/api/employees/${editingEmployee.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "更新失敗")
        }
      } else {
        // Create
        payload.employeeId = form.employeeId
        payload.password = form.password

        const res = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "新增失敗")
        }
      }

      setShowModal(false)
      fetchEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤")
    } finally {
      setSaving(false)
    }
  }

  // Delete employee
  const handleDelete = async (employee: Employee) => {
    if (!confirm(`確定要停用 ${employee.name} 嗎？`)) return

    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "刪除失敗")
      }

      fetchEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤")
    }
  }

  // Add store assignment
  const addStoreAssignment = () => {
    const availableStores = stores.filter(
      (s) => !form.storeAssignments.some((sa) => sa.storeId === s.id)
    )
    if (availableStores.length > 0) {
      setForm({
        ...form,
        storeAssignments: [
          ...form.storeAssignments,
          { storeId: availableStores[0].id, isPrimary: false, canClockIn: true },
        ],
      })
    }
  }

  // Remove store assignment
  const removeStoreAssignment = (index: number) => {
    const newAssignments = form.storeAssignments.filter((_, i) => i !== index)
    // Ensure at least one primary
    if (newAssignments.length > 0 && !newAssignments.some((s) => s.isPrimary)) {
      newAssignments[0].isPrimary = true
    }
    setForm({ ...form, storeAssignments: newAssignments })
  }

  const isAdmin = session?.user?.role === "SUPER_ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">員工管理</h1>
        {isAdmin && (
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            新增員工
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              搜尋
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="姓名或員工編號"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              角色
            </label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">全部</option>
              <option value="EMPLOYEE">員工</option>
              <option value="SHIFT_LEADER">組長</option>
              <option value="STORE_MANAGER">店長</option>
              <option value="SUPER_ADMIN">管理員</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              狀態
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">全部</option>
              <option value="ACTIVE">正常</option>
              <option value="INACTIVE">停用</option>
              <option value="SUSPENDED">暫停</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              店鋪
            </label>
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">全部</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">載入中...</div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暫無員工資料</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    員工
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    角色
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    店鋪
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    類型/薪資
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    狀態
                  </th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium">{employee.name}</div>
                      <div className="text-sm text-gray-500">{employee.employeeId}</div>
                      {employee.email && (
                        <div className="text-sm text-gray-400">{employee.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {ROLE_LABELS[employee.role] || employee.role}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {employee.stores.map((store) => (
                          <span
                            key={store.id}
                            className={`px-2 py-1 text-xs rounded-full ${
                              store.isPrimary
                                ? "bg-primary/10 text-primary"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {store.storeName}
                            {store.isPrimary && " (主)"}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            EMPLOYMENT_TYPE_COLORS[employee.employmentType] || "bg-gray-100"
                          }`}
                        >
                          {EMPLOYMENT_TYPE_LABELS[employee.employmentType] || employee.employmentType}
                        </span>
                        <span className="text-sm text-gray-600 mt-1">
                          {employee.employmentType === "FULL_TIME"
                            ? employee.monthlySalary
                              ? `月薪 $${employee.monthlySalary.toLocaleString()}`
                              : "-"
                            : employee.hourlyRate
                            ? `時薪 $${employee.hourlyRate}`
                            : "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          STATUS_COLORS[employee.status] || "bg-gray-100"
                        }`}
                      >
                        {STATUS_LABELS[employee.status] || employee.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="text-primary hover:underline mr-3"
                        >
                          編輯
                        </button>
                        {employee.status === "ACTIVE" && (
                          <button
                            onClick={() => handleDelete(employee)}
                            className="text-red-600 hover:underline"
                          >
                            停用
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingEmployee ? "編輯員工" : "新增員工"}
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      員工編號 *
                    </label>
                    <input
                      type="text"
                      value={form.employeeId}
                      onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                      disabled={!!editingEmployee}
                      className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      姓名 *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      電子郵件
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      電話
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      密碼 {editingEmployee ? "(留空不修改)" : "*"}
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      角色 *
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="EMPLOYEE">員工</option>
                      <option value="SHIFT_LEADER">組長</option>
                      <option value="STORE_MANAGER">店長</option>
                      <option value="SUPER_ADMIN">管理員</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      員工類型 *
                    </label>
                    <select
                      value={form.employmentType}
                      onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="PART_TIME">兼職 (時薪制)</option>
                      <option value="FULL_TIME">正職 (月薪制)</option>
                    </select>
                  </div>
                  {form.employmentType === "PART_TIME" ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        時薪 *
                      </label>
                      <input
                        type="number"
                        value={form.hourlyRate}
                        onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="例: 183"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        月薪 *
                      </label>
                      <input
                        type="number"
                        value={form.monthlySalary}
                        onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="例: 35000"
                      />
                    </div>
                  )}
                </div>

                {editingEmployee && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        狀態
                      </label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="ACTIVE">正常</option>
                        <option value="INACTIVE">停用</option>
                        <option value="SUSPENDED">暫停</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Store Assignments */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      店鋪指派 *
                    </label>
                    <button
                      type="button"
                      onClick={addStoreAssignment}
                      className="text-sm text-primary hover:underline"
                    >
                      + 新增店鋪
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.storeAssignments.map((assignment, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <select
                          value={assignment.storeId}
                          onChange={(e) => {
                            const newAssignments = [...form.storeAssignments]
                            newAssignments[index].storeId = e.target.value
                            setForm({ ...form, storeAssignments: newAssignments })
                          }}
                          className="flex-1 border rounded px-2 py-1"
                        >
                          {stores.map((store) => (
                            <option key={store.id} value={store.id}>
                              {store.name}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="radio"
                            name="primaryStore"
                            checked={assignment.isPrimary}
                            onChange={() => {
                              const newAssignments = form.storeAssignments.map((a, i) => ({
                                ...a,
                                isPrimary: i === index,
                              }))
                              setForm({ ...form, storeAssignments: newAssignments })
                            }}
                          />
                          主要
                        </label>
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={assignment.canClockIn}
                            onChange={(e) => {
                              const newAssignments = [...form.storeAssignments]
                              newAssignments[index].canClockIn = e.target.checked
                              setForm({ ...form, storeAssignments: newAssignments })
                            }}
                          />
                          可打卡
                        </label>
                        {form.storeAssignments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStoreAssignment(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            移除
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
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
    </div>
  )
}
