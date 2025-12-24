"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

interface Store {
  id: string
  name: string
  code: string
  address: string | null
  timezone: string
  settings: Record<string, unknown> | null
  employeeCount: number
  scheduleCount: number
  shiftTypeCount: number
  createdAt: string
  updatedAt: string
}

interface StoreFormData {
  name: string
  code: string
  address: string
  timezone: string
  settings: {
    clockInRadius?: number
    clockInLat?: number
    clockInLng?: number
    requirePhoto?: boolean
    allowEarlyClockIn?: number
    allowLateClockOut?: number
  }
}

const defaultFormData: StoreFormData = {
  name: "",
  code: "",
  address: "",
  timezone: "Asia/Taipei",
  settings: {
    clockInRadius: 100,
    requirePhoto: false,
    allowEarlyClockIn: 30,
    allowLateClockOut: 30,
  },
}

export default function StoresPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [formData, setFormData] = useState<StoreFormData>(defaultFormData)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingStore, setDeletingStore] = useState<Store | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      })
      if (search) params.set("search", search)

      const res = await fetch(`/api/stores?${params}`)
      if (!res.ok) throw new Error("取得店鋪資料失敗")

      const data = await res.json()
      setStores(data.stores || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤")
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    if (status === "loading") return
    if (!session || session.user.role !== "SUPER_ADMIN") {
      router.push("/dashboard")
      return
    }
    fetchStores()
  }, [session, status, router, fetchStores])

  const openCreateModal = () => {
    setModalMode("create")
    setEditingStore(null)
    setFormData(defaultFormData)
    setFormError("")
    setShowModal(true)
  }

  const openEditModal = (store: Store) => {
    setModalMode("edit")
    setEditingStore(store)
    setFormData({
      name: store.name,
      code: store.code,
      address: store.address || "",
      timezone: store.timezone,
      settings: (store.settings as StoreFormData["settings"]) || defaultFormData.settings,
    })
    setFormError("")
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingStore(null)
    setFormData(defaultFormData)
    setFormError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError("")

    try {
      const url = modalMode === "create" ? "/api/stores" : `/api/stores/${editingStore?.id}`
      const method = modalMode === "create" ? "POST" : "PUT"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "操作失敗")
      }

      closeModal()
      fetchStores()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "操作失敗")
    } finally {
      setSaving(false)
    }
  }

  const openDeleteConfirm = (store: Store) => {
    setDeletingStore(store)
    setShowDeleteConfirm(true)
  }

  const handleDelete = async () => {
    if (!deletingStore) return
    setDeleting(true)

    try {
      const res = await fetch(`/api/stores/${deletingStore.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "刪除失敗")
      }

      setShowDeleteConfirm(false)
      setDeletingStore(null)
      fetchStores()
    } catch (err) {
      alert(err instanceof Error ? err.message : "刪除失敗")
    } finally {
      setDeleting(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">門店管理</h1>
        <p className="text-gray-600 mt-1">管理所有門店資料</p>
      </div>

      {/* Search and Actions */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="搜尋店鋪名稱、代碼或地址..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 whitespace-nowrap"
        >
          新增店鋪
        </button>
      </div>

      {/* Stores Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  店鋪資訊
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  地址
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  統計
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  建立時間
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    尚無店鋪資料
                  </td>
                </tr>
              ) : (
                stores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{store.name}</div>
                        <div className="text-sm text-gray-500">代碼: {store.code}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {store.address || "-"}
                      </div>
                      <div className="text-sm text-gray-500">{store.timezone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                          員工: {store.employeeCount}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mr-2">
                          班別: {store.shiftTypeCount}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          排班: {store.scheduleCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(store.createdAt).toLocaleDateString("zh-TW")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(store)}
                        className="text-primary hover:text-primary/80 mr-3"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(store)}
                        className="text-red-600 hover:text-red-800"
                        disabled={store.employeeCount > 0}
                        title={store.employeeCount > 0 ? "無法刪除有員工的店鋪" : ""}
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              上一頁
            </button>
            <span className="text-sm text-gray-600">
              第 {page} / {totalPages} 頁
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              下一頁
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {modalMode === "create" ? "新增店鋪" : "編輯店鋪"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    店鋪名稱 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    店鋪代碼 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                    maxLength={20}
                    placeholder="例: STORE001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  地址
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  時區
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="Asia/Taipei">Asia/Taipei (UTC+8)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                  <option value="Asia/Hong_Kong">Asia/Hong_Kong (UTC+8)</option>
                  <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                </select>
              </div>

              {/* Settings */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-4">打卡設定</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      打卡允許半徑 (公尺)
                    </label>
                    <input
                      type="number"
                      value={formData.settings.clockInRadius || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            clockInRadius: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      min={0}
                      placeholder="例: 100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      允許提早打卡 (分鐘)
                    </label>
                    <input
                      type="number"
                      value={formData.settings.allowEarlyClockIn || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            allowEarlyClockIn: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      min={0}
                      placeholder="例: 30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      允許延遲打卡 (分鐘)
                    </label>
                    <input
                      type="number"
                      value={formData.settings.allowLateClockOut || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            allowLateClockOut: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      min={0}
                      placeholder="例: 30"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="requirePhoto"
                      checked={formData.settings.requirePhoto || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: {
                            ...formData.settings,
                            requirePhoto: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="requirePhoto" className="ml-2 text-sm text-gray-700">
                      打卡時需要拍照
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">打卡位置 (GPS)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">緯度</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.settings.clockInLat || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            settings: {
                              ...formData.settings,
                              clockInLat: e.target.value ? parseFloat(e.target.value) : undefined,
                            },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="例: 25.0330"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">經度</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.settings.clockInLng || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            settings: {
                              ...formData.settings,
                              clockInLng: e.target.value ? parseFloat(e.target.value) : undefined,
                            },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="例: 121.5654"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "儲存中..." : "儲存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingStore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">確認刪除</h3>
            <p className="text-gray-600 mb-6">
              確定要刪除店鋪「{deletingStore.name}」嗎？此操作無法復原。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingStore(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "刪除中..." : "確認刪除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
