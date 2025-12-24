"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import type { Role } from "@prisma/client"
import {
  Menu,
  X,
  LogOut,
  Clock,
  Calendar,
  FileText,
  Users,
  Store,
  BarChart3,
  CheckSquare,
  DollarSign,
  ClipboardList,
  History,
  ChevronDown,
  User,
  Settings,
  Briefcase,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavProps {
  user: {
    name: string
    role: Role
    stores: { id: string; name: string; isPrimary: boolean }[]
  }
}

// Define navigation categories
const navCategories = [
  {
    id: "personal",
    label: "個人",
    icon: User,
    roles: ["EMPLOYEE", "SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"],
    items: [
      { href: "/dashboard", label: "打卡", icon: Clock },
      { href: "/schedule", label: "我的排班", icon: Calendar },
      { href: "/attendance", label: "出勤記錄", icon: History },
      { href: "/leave", label: "請假", icon: FileText },
      { href: "/sales", label: "業績回報", icon: DollarSign },
    ],
  },
  {
    id: "management",
    label: "管理",
    icon: Briefcase,
    roles: ["SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"],
    items: [
      { href: "/manager/scheduling", label: "排班管理", icon: ClipboardList, roles: ["STORE_MANAGER", "SUPER_ADMIN"] },
      { href: "/manager/approvals", label: "審核", icon: CheckSquare, roles: ["SHIFT_LEADER", "STORE_MANAGER", "SUPER_ADMIN"] },
      { href: "/manager/payroll", label: "薪資報表", icon: DollarSign, roles: ["STORE_MANAGER", "SUPER_ADMIN"] },
      { href: "/manager/reports", label: "出勤報表", icon: BarChart3, roles: ["STORE_MANAGER", "SUPER_ADMIN"] },
    ],
  },
  {
    id: "system",
    label: "系統",
    icon: Settings,
    roles: ["SUPER_ADMIN"],
    items: [
      { href: "/admin/employees", label: "員工管理", icon: Users },
      { href: "/admin/stores", label: "門店管理", icon: Store },
    ],
  },
]

// Desktop dropdown component
function DesktopDropdown({
  category,
  userRole,
  isActive,
  pathname,
}: {
  category: typeof navCategories[0]
  userRole: Role
  isActive: boolean
  pathname: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const CategoryIcon = category.icon

  // Filter items based on role
  const visibleItems = category.items.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  )

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Close on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  if (visibleItems.length === 0) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
          isActive
            ? "bg-primary text-white"
            : "text-gray-600 hover:bg-gray-100"
        )}
      >
        <CategoryIcon className="w-4 h-4" />
        {category.label}
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown menu */}
      <div
        className={cn(
          "absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50",
          "transition-all duration-200 origin-top",
          isOpen
            ? "opacity-100 scale-100 visible"
            : "opacity-0 scale-95 invisible"
        )}
      >
        {visibleItems.map((item) => {
          const ItemIcon = item.icon
          const itemActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm transition-colors",
                itemActive
                  ? "bg-primary/10 text-primary"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <ItemIcon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// Mobile category section component
function MobileCategorySection({
  category,
  userRole,
  pathname,
  onNavigate,
  defaultExpanded = false,
}: {
  category: typeof navCategories[0]
  userRole: Role
  pathname: string
  onNavigate: () => void
  defaultExpanded?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const CategoryIcon = category.icon

  // Filter items based on role
  const visibleItems = category.items.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  )

  if (visibleItems.length === 0) return null

  // Check if any item in category is active
  const hasActiveItem = visibleItems.some(
    (item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
  )

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* Category header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3",
          "text-left transition-colors",
          hasActiveItem ? "bg-primary/5" : "hover:bg-gray-50"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              hasActiveItem ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-600"
            )}
          >
            <CategoryIcon className="w-4 h-4" />
          </div>
          <span
            className={cn(
              "font-medium",
              hasActiveItem ? "text-primary" : "text-gray-900"
            )}
          >
            {category.label}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-gray-400 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Category items */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isExpanded ? "max-h-96" : "max-h-0"
        )}
      >
        <div className="pb-2">
          {visibleItems.map((item) => {
            const ItemIcon = item.icon
            const itemActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 pl-16 pr-4 py-2.5 text-sm",
                  "transition-colors active:bg-gray-100",
                  itemActive
                    ? "text-primary font-medium"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <ItemIcon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function DashboardNav({ user }: NavProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const primaryStore = user.stores.find((s) => s.isPrimary) ?? user.stores[0]

  // Filter categories based on user role
  const visibleCategories = navCategories.filter((cat) =>
    cat.roles.includes(user.role)
  )

  // Check if pathname is in a category
  const isCategoryActive = (category: typeof navCategories[0]) => {
    return category.items.some(
      (item) =>
        (!item.roles || item.roles.includes(user.role)) &&
        (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)))
    )
  }

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

  return (
    <>
      <nav className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16">
            {/* Logo and desktop nav */}
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/dashboard" className="text-lg sm:text-xl font-bold text-primary">
                  考勤系統
                </Link>
              </div>
              {/* Desktop navigation */}
              <div className="hidden md:ml-6 md:flex md:items-center md:space-x-1">
                {visibleCategories.map((category) => (
                  <DesktopDropdown
                    key={category.id}
                    category={category}
                    userRole={user.role}
                    isActive={isCategoryActive(category)}
                    pathname={pathname}
                  />
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
                onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
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

          {/* Categorized navigation */}
          <div>
            {visibleCategories.map((category) => (
              <MobileCategorySection
                key={category.id}
                category={category}
                userRole={user.role}
                pathname={pathname}
                onNavigate={() => setIsOpen(false)}
                defaultExpanded={isCategoryActive(category)}
              />
            ))}
          </div>

          {/* Logout button */}
          <div className="border-t p-4">
            <button
              onClick={() => {
                setIsOpen(false)
                signOut({ callbackUrl: `${window.location.origin}/login` })
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
