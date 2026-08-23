"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { Download, Smartphone } from "lucide-react"

import { Button } from "@/components/ui/button"

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function subscribeStandalone(callback: () => void) {
  const media = window.matchMedia("(display-mode: standalone)")
  media.addEventListener("change", callback)
  return () => media.removeEventListener("change", callback)
}

function standaloneSnapshot() {
  return window.matchMedia("(display-mode: standalone)").matches
}

function browserSnapshot() {
  return /iPad|iPhone|iPod/u.test(navigator.userAgent)
}

function serverSnapshot() {
  return false
}

function subscribeStatic() {
  return () => undefined
}

export function PwaInstallCard() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const standalone = useSyncExternalStore(
    subscribeStandalone,
    standaloneSnapshot,
    serverSnapshot,
  )
  const isIOS = useSyncExternalStore(
    subscribeStatic,
    browserSnapshot,
    serverSnapshot,
  )

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", capture)
    return () => {
      window.removeEventListener("beforeinstallprompt", capture)
    }
  }, [])

  if (standalone) {
    return (
      <p className="flex items-center gap-2 text-sm text-success" role="status">
        <Smartphone aria-hidden="true" className="size-4" /> Daymark is
        installed on this device.
      </p>
    )
  }

  return (
    <div className="grid gap-3 text-sm text-ink-muted">
      <p>
        Install Daymark for app-like launching. Recent tasks and queued creates,
        edits, completions, deletions, and reopens stay in private device
        storage and synchronize after reconnection. Data is removed on logout.
      </p>
      {prompt ? (
        <Button
          onClick={async () => {
            await prompt.prompt()
            await prompt.userChoice
            setPrompt(null)
          }}
        >
          <Download aria-hidden="true" /> Install Daymark
        </Button>
      ) : (
        <p className="text-xs">
          {isIOS
            ? "On iPhone or iPad, use Share → Add to Home Screen."
            : "Use your browser’s Install app command when it becomes available."}
        </p>
      )}
    </div>
  )
}
