"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { ClockAction } from "@/lib/attendance/state-machine"
import { Check, Coffee, LogIn, LogOut, Play } from "lucide-react"

interface SuccessAnimationProps {
  isVisible: boolean
  action: ClockAction
  onComplete: () => void
  timestamp?: Date
}

const actionMessages: Record<ClockAction, {
  title: string
  subtitle: string
  icon: typeof Check
  color: string
  bgGradient: string
}> = {
  [ClockAction.CLOCK_IN]: {
    title: "上班打卡成功！",
    subtitle: "祝您工作順利 💪",
    icon: LogIn,
    color: "text-green-600",
    bgGradient: "from-green-400 to-emerald-500",
  },
  [ClockAction.CLOCK_OUT]: {
    title: "下班打卡成功！",
    subtitle: "辛苦了，好好休息 🌙",
    icon: LogOut,
    color: "text-blue-600",
    bgGradient: "from-blue-400 to-indigo-500",
  },
  [ClockAction.START_BREAK]: {
    title: "開始休息！",
    subtitle: "好好放鬆一下 ☕",
    icon: Coffee,
    color: "text-yellow-600",
    bgGradient: "from-yellow-400 to-orange-500",
  },
  [ClockAction.END_BREAK]: {
    title: "休息結束！",
    subtitle: "繼續加油 💪",
    icon: Play,
    color: "text-blue-600",
    bgGradient: "from-blue-400 to-cyan-500",
  },
  [ClockAction.CLOCK_IN_SEGMENT_2]: {
    title: "第二段上班成功！",
    subtitle: "繼續加油 🔄",
    icon: LogIn,
    color: "text-green-600",
    bgGradient: "from-green-400 to-teal-500",
  },
  [ClockAction.CLOCK_OUT_SEGMENT_2]: {
    title: "第二段下班成功！",
    subtitle: "辛苦了 🏁",
    icon: LogOut,
    color: "text-purple-600",
    bgGradient: "from-purple-400 to-pink-500",
  },
}

export function SuccessAnimation({
  isVisible,
  action,
  onComplete,
  timestamp = new Date(),
}: SuccessAnimationProps) {
  const [show, setShow] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const config = actionMessages[action]
  const Icon = config.icon

  useEffect(() => {
    if (isVisible) {
      setShow(true)
      setShowConfetti(true)

      // Auto close after 2.5 seconds
      const timer = setTimeout(() => {
        setShow(false)
        setShowConfetti(false)
        setTimeout(onComplete, 300) // Wait for exit animation
      }, 2500)

      return () => clearTimeout(timer)
    }
  }, [isVisible, onComplete])

  if (!isVisible && !show) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "transition-opacity duration-300",
        show ? "opacity-100" : "opacity-0"
      )}
      onClick={() => {
        setShow(false)
        setTimeout(onComplete, 300)
      }}
    >
      {/* Backdrop with gradient */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-95",
          config.bgGradient
        )}
      />

      {/* Confetti effect */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${2 + Math.random()}s`,
              }}
            >
              <div
                className={cn(
                  "w-3 h-3 rounded-sm",
                  ["bg-white", "bg-yellow-300", "bg-pink-300", "bg-cyan-300"][
                    Math.floor(Math.random() * 4)
                  ]
                )}
                style={{
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "relative text-center text-white p-8",
          "transition-all duration-500",
          show ? "scale-100 translate-y-0" : "scale-90 translate-y-4"
        )}
      >
        {/* Animated icon */}
        <div className="relative mb-6">
          {/* Pulse rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-white/20 animate-ping" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-28 h-28 rounded-full bg-white/10 animate-ping"
              style={{ animationDelay: "0.2s" }}
            />
          </div>

          {/* Icon container */}
          <div
            className={cn(
              "relative w-24 h-24 mx-auto rounded-full",
              "bg-white shadow-2xl",
              "flex items-center justify-center",
              "animate-scale-bounce"
            )}
          >
            <Icon className={cn("w-12 h-12", config.color)} strokeWidth={2.5} />
          </div>
        </div>

        {/* Check mark overlay */}
        <div className="absolute top-12 right-1/2 translate-x-16">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-pop-in shadow-lg">
            <Check className="w-5 h-5 text-white" strokeWidth={3} />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-2 animate-fade-in-up">
          {config.title}
        </h1>

        {/* Subtitle */}
        <p
          className="text-xl text-white/90 mb-4 animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          {config.subtitle}
        </p>

        {/* Timestamp */}
        <div
          className="text-4xl font-bold tabular-nums animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          {timestamp.toLocaleTimeString("zh-TW", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })}
        </div>

        {/* Tap to dismiss hint */}
        <p
          className="mt-8 text-sm text-white/70 animate-pulse"
          style={{ animationDelay: "1s" }}
        >
          點擊任意處關閉
        </p>
      </div>
    </div>
  )
}
