import { ClockWidget } from "@/components/clock/clock-widget"

export default function DashboardPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header - hidden on very small screens to maximize clock widget space */}
      <div className="hidden sm:block mb-6">
        <h1 className="text-2xl font-bold text-gray-900">打卡</h1>
        <p className="mt-1 text-sm text-gray-500">
          點擊下方按鈕進行上班、休息或下班打卡
        </p>
      </div>

      {/* Clock widget - takes full available space on mobile */}
      <div className="flex-1 flex items-start sm:items-center justify-center px-0 sm:px-4">
        <div className="w-full max-w-md">
          <ClockWidget />
        </div>
      </div>
    </div>
  )
}
