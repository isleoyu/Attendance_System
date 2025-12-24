"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import type { Role } from "@prisma/client"
import { cn } from "@/lib/utils"

interface NavProps {
  user: {
    name: string
    role: Role
    stores: { id: string; name: string; isPrimary: boolean }[]
  }
}

const navItems = [
  { href: "/dashboard", label: "打卡", roles: ["EMPLOYEE", "SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/schedule", label: "我的排班", roles: ["EMPLOYEE", "SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/leave", label: "請假", roles: ["EMPLOYEE", "SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/sales", label: "業績回報", roles: ["EMPLOYEE", "SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/manager/scheduling", label: "排班管理", roles: ["STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/manager/approvals", label: "審核", roles: ["SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/manager/payroll", label: "薪資報表", roles: ["STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/manager/reports", label: "出勤報表", roles: ["STORE_MANAGER", "SUPER_ADMIN"] },
  { href: "/admin/employees", label: "員工管理", roles: ["SUPER_ADMIN"] },
  { href: "/admin/stores", label: "門店管理", roles: ["SUPER_ADMIN"] },
]

export function DashboardNav({ user }: NavProps) {
  const pathname = usePathname()
  const primaryStore = user.stores.find((s) => s.isPrimary) ?? user.stores[0]

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(user.role)
  )

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-primary">考勤系統</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center px-3 py-2 text-sm font-medium rounded-md",
                    pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                      ? "bg-primary text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{user.name}</span>
              {primaryStore && (
                <span className="text-gray-400 ml-2">({primaryStore.name})</span>
              )}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              登出
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="sm:hidden border-t">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block px-3 py-2 rounded-md text-base font-medium",
                pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
