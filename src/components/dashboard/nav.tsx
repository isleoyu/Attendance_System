"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import type { Role } from "@prisma/client"
import { Menu, X, LogOut, Clock, Calendar, FileText, Users, Store, BarChart3, CheckSquare, DollarSign, ClipboardList, History } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavProps {
  user: {
    name: string
    role: Role
    stores: { id: string; name: string; isPrimary: boolean }[]
  }
}

const navItems = [
  { href: "/dashboard", label: "打卡", icon: Clock, roles: ["EMPLOYEE", "SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/schedule", label: "我的排班", icon: Calendar, roles: ["EMPLOYEE", "SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/attendance", label: "出勤記錄", icon: History, roles: ["EMPLOYEE", "SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/leave", label: "請假", icon: FileText, roles: ["EMPLOYEE", "SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/sales", label: "業績回報", icon: DollarSign, roles: ["EMPLOYEE", "SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/manager/scheduling", label: "排班管理", icon: ClipboardList, roles: ["STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/manager/approvals", label: "審核", icon: CheckSquare, roles: ["SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/manager/payroll", label: "薪資報表", icon: DollarSign, roles: ["STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/manager/reports", label: "出勤報表", icon: BarChart3, roles: ["STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/admin/employees", label: "員工管理", icon: Users, roles: ["SUPER_ADMIN"] },
  { href: "/admin/stores", label: "門店管理", icon: Store, roles: ["SUPER_ADMIN"] },
]

export function DashboardNav({ user }: NavProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const primaryStore = user.stores.find((s) => s.isPrimary) ?? user.stores[0]

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(user.role)
  )

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  const isActive = (href: string) => {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
  }

  return (
    <>
      <nav className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16">
            {/* Logo and desktop nav */}
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-lg sm:text-xl font-bold text-primary">考勤系統</span>
              </div>
              {/* Desktop navigation */}
              <div className="hidden md:ml-6 md:flex md:space-x-2">
                {visibleItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive(item.href)
                        ? "bg-primary text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Desktop user info */}
            <div className="hidden md:flex md:items-center md:space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{user.name}</span>
                {primaryStore && (
                  <span className="text-gray-400 ml-2">({primaryStore.name})</span>
                )}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <LogOut className="w-4 h-4" />
                登出
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  "text-gray-600 hover:bg-gray-100 active:bg-gray-200",
                  isOpen && "bg-gray-100"
                )}
                aria-label={isOpen ? "關閉選單" : "開啟選單"}
                aria-expanded={isOpen}
              >
                {isOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <div
        className={cn(
          "fixed inset-0 z-30 md:hidden transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setIsOpen(false)}
        />

        {/* Menu panel */}
        <div
          className={cn(
            "absolute top-14 left-0 right-0 bg-white shadow-lg",
            "max-h-[calc(100vh-3.5rem)] overflow-y-auto",
            "transition-transform duration-300 ease-out",
            isOpen ? "translate-y-0" : "-translate-y-full"
          )}
        >
          {/* User info */}
          <div className="px-4 py-3 bg-gray-50 border-b">
            <div className="font-medium text-gray-900">{user.name}</div>
            {primaryStore && (
              <div className="text-sm text-gray-500">{primaryStore.name}</div>
            )}
          </div>

          {/* Navigation items */}
          <div className="py-2">
            {visibleItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-base font-medium",
                    "transition-colors active:bg-gray-100",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary border-l-4 border-primary"
                      : "text-gray-700 hover:bg-gray-50 border-l-4 border-transparent"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              )
            })}
          </div>

          {/* Logout button */}
          <div className="border-t p-4">
            <button
              onClick={() => {
                setIsOpen(false)
                signOut({ callbackUrl: "/login" })
              }}
              className={cn(
                "w-full flex items-center justify-center gap-2",
                "py-3 px-4 rounded-xl",
                "bg-gray-100 text-gray-700",
                "font-medium text-base",
                "hover:bg-gray-200 active:bg-gray-300",
                "transition-colors"
              )}
            >
              <LogOut className="w-5 h-5" />
              登出
            </button>
          </div>

          {/* Safe area padding for phones with notch */}
          <div className="h-safe-area-inset-bottom" />
        </div>
      </div>
    </>
  )
}
