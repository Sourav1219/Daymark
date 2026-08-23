import type { Route } from "next"
import {
  CircleCheckBig,
  Gauge,
  House,
  ListChecks,
  PanelsTopLeft,
  Settings,
  Timer,
  Tags,
  UserRound,
  type LucideIcon,
} from "lucide-react"

export type ShellNavigationItem = Readonly<{
  href: Route
  icon: LucideIcon
  label: string
}>

export const shellNavigationItems: readonly ShellNavigationItem[] = [
  { href: "/today", icon: House, label: "Home" },
  { href: "/quests", icon: ListChecks, label: "Tasks" },
  { href: "/timer" as Route, icon: Timer, label: "Timer" },
  { href: "/gates", icon: PanelsTopLeft, label: "Lists" },
  { href: "/labels", icon: Tags, label: "Labels" },
  { href: "/cleared", icon: CircleCheckBig, label: "Completed" },
  { href: "/progress", icon: Gauge, label: "Progress" },
  { href: "/profile" as Route, icon: UserRound, label: "Profile" },
  { href: "/settings", icon: Settings, label: "Settings" },
]

/**
 * Primary destinations surfaced in the native bottom tab bar. Kept to a small,
 * thumb-friendly set with Profile as a first-class destination.
 */
export const primaryNavigationItems: readonly ShellNavigationItem[] = [
  { href: "/today", icon: House, label: "Home" },
  { href: "/quests", icon: ListChecks, label: "Tasks" },
  { href: "/timer" as Route, icon: Timer, label: "Timer" },
  { href: "/progress", icon: Gauge, label: "Progress" },
  { href: "/profile" as Route, icon: UserRound, label: "Profile" },
]
