"use client"

import type { ReactNode } from "react"

import { BottomTabBar } from "@/components/shell/bottom-tab-bar"
import { ScrollableMain } from "@/components/shell/scrollable-main"
import { ShellKeyboardShortcuts } from "@/components/shell/shell-keyboard-shortcuts"
import { Toaster } from "@/components/ui/sonner"
import { OfflineStatusBar } from "@/features/offline/components/offline-provider"

type AppFrameProps = Readonly<{
  children: ReactNode
}>

export function AppFrame({ children }: AppFrameProps) {
  return (
    <div className="device-frame" id="app-device-viewport">
      <a
        className="motion-interactive absolute start-4 top-4 z-[60] -translate-y-24 rounded-control bg-system-blue px-4 py-2 font-semibold text-primary-foreground shadow-float transition-transform focus:translate-y-0"
        href="#main-content"
      >
        Skip to main content
      </a>

      <OfflineStatusBar />
      <ShellKeyboardShortcuts />

      <ScrollableMain id="main-content" tabIndex={-1}>
        {children}
      </ScrollableMain>

      <BottomTabBar />
      <Toaster closeButton position="bottom-center" richColors />
    </div>
  )
}
