"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Dialog } from "radix-ui"
import {
  CheckCircle2,
  House,
  ListChecks,
  PanelsTopLeft,
  Plus,
  Search,
  Tags,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const commands = [
  {
    href: "/quests#create-quest-title",
    icon: Plus,
    label: "Create Task",
    shortcut: "N",
  },
  { href: "/today", icon: House, label: "Go to Home", shortcut: "G H" },
  {
    href: "/quests",
    icon: ListChecks,
    label: "Go to All Tasks",
    shortcut: "G Q",
  },
  {
    href: "/gates",
    icon: PanelsTopLeft,
    label: "Go to Lists",
    shortcut: "G G",
  },
  { href: "/labels", icon: Tags, label: "Go to Labels", shortcut: "G L" },
  {
    href: "/cleared",
    icon: CheckCircle2,
    label: "Go to Cleared",
    shortcut: "G C",
  },
] as const

const navigationShortcuts = new Map<string, Route>([
  ["t", "/today"],
  ["q", "/quests"],
  ["g", "/gates"],
  ["l", "/labels"],
  ["c", "/cleared"],
])

function isEditingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

export function CommandMenu() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const awaitingNavigation = useRef(false)
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const visibleCommands = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term
      ? commands.filter(({ label }) => label.toLowerCase().includes(term))
      : commands
  }, [query])

  const run = useCallback(
    (href: Route) => {
      setOpen(false)
      setQuery("")
      router.push(href)
    },
    [router],
  )

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented) return
      const key = event.key.toLowerCase()

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault()
        setOpen((current) => !current)
        return
      }

      if (
        isEditingTarget(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return
      }

      if (key === "?" || key === "/") {
        event.preventDefault()
        setOpen(true)
        return
      }

      if (key === "n") {
        event.preventDefault()
        run("/quests#create-quest-title")
        return
      }

      if (awaitingNavigation.current) {
        awaitingNavigation.current = false
        if (navigationTimer.current) clearTimeout(navigationTimer.current)
        const href = navigationShortcuts.get(key)
        if (href) {
          event.preventDefault()
          run(href)
        }
        return
      }

      if (key === "g") {
        awaitingNavigation.current = true
        navigationTimer.current = setTimeout(() => {
          awaitingNavigation.current = false
        }, 900)
      }
    }

    window.addEventListener("keydown", handleShortcut)
    return () => {
      window.removeEventListener("keydown", handleShortcut)
      if (navigationTimer.current) clearTimeout(navigationTimer.current)
    }
  }, [run])

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Trigger asChild>
        <Button
          aria-label="Open command menu"
          className="size-11"
          ref={triggerRef}
          size="icon-lg"
          type="button"
          variant="outline"
        >
          <Search aria-hidden="true" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-80 bg-background/75 supports-backdrop-filter:backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby="command-menu-description"
          className="fixed top-1/2 left-1/2 z-90 grid max-h-[80svh] w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-panel border border-border-strong bg-surface-overlay p-4 shadow-float outline-none"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            triggerRef.current?.focus()
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            document.getElementById("command-search")?.focus()
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                Command menu
              </Dialog.Title>
              <Dialog.Description
                className="mt-1 text-sm text-ink-muted"
                id="command-menu-description"
              >
                Find a route or start a task. Press Escape to return.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                aria-label="Close command menu"
                size="icon-sm"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <Input
            aria-label="Search commands"
            autoComplete="off"
            id="command-search"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                document
                  .querySelector<HTMLElement>("[data-command-item]")
                  ?.focus()
              }
            }}
            placeholder="Type a command…"
            value={query}
          />
          <div className="grid gap-1 overflow-y-auto">
            {visibleCommands.map(({ href, icon: Icon, label, shortcut }) => (
              <Button
                className="h-auto min-h-11 justify-start gap-3 px-3 py-2 text-left"
                data-command-item
                key={href}
                onClick={() => run(href)}
                type="button"
                variant="ghost"
              >
                <Icon aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <kbd className="rounded-control border border-border-soft px-1.5 py-0.5 font-mono text-[0.65rem] text-ink-muted">
                  {shortcut}
                </kbd>
              </Button>
            ))}
            {visibleCommands.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-muted">
                No command matches “{query}”.
              </p>
            ) : null}
          </div>
          <p className="text-xs text-ink-muted">
            Shortcuts: Ctrl/⌘ K opens this menu, N creates, G then T/Q/G/L/C
            navigates.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
