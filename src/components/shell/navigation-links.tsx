"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { shellNavigationItems } from "@/components/shell/navigation-config"
import { cn } from "@/lib/utils"

type NavigationLinksProps = Readonly<{
  onNavigate?: () => void
  variant?: "desktop" | "mobile"
}>

export function NavigationLinks({
  onNavigate,
  variant = "desktop",
}: NavigationLinksProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedDate = searchParams.get("date")

  return (
    <nav aria-label="Primary navigation">
      <ul className="grid gap-1.5">
        {shellNavigationItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          const href = selectedDate
            ? { pathname: item.href, query: { date: selectedDate } }
            : item.href

          return (
            <li key={item.href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "motion-interactive group relative flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium text-ink-muted",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active &&
                    "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_var(--border-soft)]",
                  variant === "mobile" && "min-h-12 text-base",
                )}
                href={href}
                {...(onNavigate ? { onClick: onNavigate } : {})}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "motion-interactive absolute inset-y-2 start-0 w-0.5 rounded-full bg-system-blue opacity-0 shadow-glow-blue",
                    active && "opacity-100",
                  )}
                />
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-4.5 text-ink-muted",
                    active && "text-spectral-cyan",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
