"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ClockAction, ClockActionLabels } from "@/lib/attendance/state-machine"

interface ConfirmDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  action: ClockAction
  isLoading?: boolean
  storeName?: string
}

const actionConfig: Record<ClockAction, {
  title: string
  description: string
  confirmText: string
  confirmStyle: string
  icon: string
}> = {
  [ClockAction.CLOCK_IN]: {
    title: "確認上班打卡",
    description: "確認要開始今天的工作嗎？",
    confirmText: "確認上班",
    confirmStyle: "bg-green-600 hover:bg-green-700 active:bg-green-800",
    icon: "☀️",
  },
  [ClockAction.CLOCK_OUT]: {
    title: "確認下班打卡",
    description: "確認要結束今天的工作嗎？打卡後將無法修改。",
    confirmText: "確認下班",
    confirmStyle: "bg-red-600 hover:bg-red-700 active:bg-red-800",
    icon: "🌙",
  },
  [ClockAction.START_BREAK]: {
    title: "確認開始休息",
    description: "確認要開始休息嗎？",
    confirmText: "開始休息",
    confirmStyle: "bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700",
    icon: "☕",
  },
  [ClockAction.END_BREAK]: {
    title: "確認結束休息",
    description: "確認要結束休息並繼續工作嗎？",
    confirmText: "結束休息",
    confirmStyle: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
    icon: "💪",
  },
  [ClockAction.CLOCK_IN_SEGMENT_2]: {
    title: "確認第二段上班",
    description: "確認要開始第二段班嗎？",
    confirmText: "開始第二段",
    confirmStyle: "bg-green-600 hover:bg-green-700 active:bg-green-800",
    icon: "🔄",
  },
  [ClockAction.CLOCK_OUT_SEGMENT_2]: {
    title: "確認第二段下班",
    description: "確認要結束第二段班嗎？",
    confirmText: "結束第二段",
    confirmStyle: "bg-red-600 hover:bg-red-700 active:bg-red-800",
    icon: "🏁",
  },
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  action,
  isLoading,
  storeName,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const config = actionConfig[action]

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onCancel()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, isLoading, onCancel])

  // Focus trap and body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      dialogRef.current?.focus()
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={!isLoading ? onCancel : undefined}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "relative w-full sm:max-w-md mx-auto bg-white",
          "rounded-t-3xl sm:rounded-2xl shadow-2xl",
          "animate-slide-up sm:animate-scale-in",
          "focus:outline-none"
        )}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          disabled={isLoading}
          className={cn(
            "absolute top-4 right-4 p-2 rounded-full",
            "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
            "transition-colors duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          aria-label="關閉"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8 text-center">
          {/* Icon */}
          <div className="text-5xl mb-4 animate-bounce-gentle">
            {config.icon}
          </div>

          {/* Title */}
          <h2 id="dialog-title" className="text-xl font-bold text-gray-900 mb-2">
            {config.title}
          </h2>

          {/* Store name */}
          {storeName && (
            <div className="text-sm text-gray-500 mb-2">
              📍 {storeName}
            </div>
          )}

          {/* Description */}
          <p className="text-gray-600 mb-6">
            {config.description}
          </p>

          {/* Time display */}
          <div className="text-3xl font-bold text-primary mb-6 tabular-nums">
            {new Date().toLocaleTimeString("zh-TW", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className={cn(
                "flex-1 py-4 px-6 rounded-xl font-medium text-lg",
                "bg-gray-100 text-gray-700",
                "hover:bg-gray-200 active:bg-gray-300",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                "flex-1 py-4 px-6 rounded-xl font-medium text-lg text-white",
                config.confirmStyle,
                "transition-all duration-200",
                "disabled:opacity-70 disabled:cursor-not-allowed",
                "relative overflow-hidden"
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  處理中...
                </span>
              ) : (
                config.confirmText
              )}
            </button>
          </div>
        </div>

        {/* Bottom safe area for mobile */}
        <div className="h-safe-area-inset-bottom bg-white rounded-b-none sm:rounded-b-2xl" />
      </div>
    </div>
  )
}
