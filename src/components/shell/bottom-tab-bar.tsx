"use client"

import { useLayoutEffect, useRef, type CSSProperties } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { primaryNavigationItems } from "@/components/shell/navigation-config"
import { cn } from "@/lib/utils"

export function BottomTabBar() {
  const tabBarRef = useRef<HTMLElement>(null)
  const pathname = usePathname()
  const activeIndex = primaryNavigationItems.findIndex(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  )

  useLayoutEffect(() => {
    const tabBar = tabBarRef.current
    if (!tabBar) return

    const centerLensOnActiveTab = () => {
      const activeTab = tabBar.querySelector<HTMLElement>(
        '.tab-item[data-active="true"]',
      )

      if (!activeTab || activeTab.offsetWidth === 0) return

      const activeTabCenter = activeTab.offsetLeft + activeTab.offsetWidth / 2
      tabBar.style.setProperty("--active-tab-position", `${activeTabCenter}px`)
    }

    centerLensOnActiveTab()

    if (typeof ResizeObserver === "undefined") return

    const resizeObserver = new ResizeObserver(centerLensOnActiveTab)
    resizeObserver.observe(tabBar)

    return () => resizeObserver.disconnect()
  }, [activeIndex])

  return (
    <nav
      aria-label="Primary navigation"
      className="app-tabbar"
      ref={tabBarRef}
      style={
        {
          "--active-tab-index": Math.max(activeIndex, 0),
          "--active-tab-position": `${((Math.max(activeIndex, 0) + 0.5) / primaryNavigationItems.length) * 100}%`,
        } as CSSProperties
      }
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
