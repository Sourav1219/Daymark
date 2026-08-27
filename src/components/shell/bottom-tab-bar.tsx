"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { primaryNavigationItems } from "@/components/shell/navigation-config"
import { cn } from "@/lib/utils"

export function BottomTabBar() {
  const pathname = usePathname()
  const activeIndex = primaryNavigationItems.findIndex(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  )

  return (
    <nav
      aria-label="Primary navigation"
      className="app-tabbar"
      data-active-index={activeIndex >= 0 ? activeIndex : "none"}
    >
      <span
        aria-hidden="true"
        className="tab-liquid-lens"
        data-visible={activeIndex >= 0}
      />
      {primaryNavigationItems.map((item) => (
        <TabLink item={item} key={item.href} pathname={pathname} />
      ))}
    </nav>
  )
}

function TabLink({
  item,
  pathname,
}: Readonly<{
  item: (typeof primaryNavigationItems)[number]
  pathname: string
}>) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
  const Icon = item.icon

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className="tab-item"
      data-active={active}
      href={item.href}
    >
      <span className="tab-icon">
        <Icon
          aria-hidden="true"
          className={cn("size-5")}
          strokeWidth={active ? 2.35 : 2.05}
        />
      </span>
      <span className="tab-label">{item.label}</span>
    </Link>
  )
}
