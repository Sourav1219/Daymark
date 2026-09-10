"use client"

import { useCallback, useEffect, useState } from "react"
import { BellOff, BellRing, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  disablePushNotifications,
  enablePushNotifications,
  getActivePushSubscription,
  supportsPushNotifications,
} from "@/features/reminders/components/automatic-push-enrollment"

type PushStatus =
  | "blocked"
  | "blocked-with-subscription"
  | "checking"
  | "disabled"
  | "enabled"
  | "unavailable"

export function PushNotificationControl({
  publicKey,
}: Readonly<{ publicKey: string | null }>) {
  const [status, setStatus] = useState<PushStatus>("checking")
  const [busy, setBusy] = useState(false)

  const refreshStatus = useCallback(async () => {
    if (!publicKey || !supportsPushNotifications()) {
      setStatus("unavailable")
      return
    }

    const subscription = await getActivePushSubscription().catch(() => null)
    if (Notification.permission === "denied") {
      setStatus(subscription ? "blocked-with-subscription" : "blocked")
      return
    }

    setStatus(
      Notification.permission === "granted" && subscription
        ? "enabled"
        : "disabled",
    )
  }, [publicKey])

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void refreshStatus(), 0)
    window.addEventListener("focus", refreshStatus)
    return () => {
      window.clearTimeout(initialCheck)
      window.removeEventListener("focus", refreshStatus)
    }
  }, [refreshStatus])

  const enable = async () => {
    if (!publicKey || !supportsPushNotifications()) return

    setBusy(true)
    try {
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission

      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "disabled")
        toast.info("Browser notifications were not enabled")
        return
      }

      const enabled = await enablePushNotifications(publicKey)
      if (!enabled) {
        toast.error("Notifications could not be enabled. Please try again.")
        await refreshStatus()
        return
      }

      setStatus("enabled")
      toast.success("Browser notifications enabled")
    } catch {
      toast.error("Notifications could not be enabled. Please try again.")
      await refreshStatus()
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    try {
      const disabled = await disablePushNotifications()
      if (!disabled) {
        toast.error("Notifications could not be disabled. Please try again.")
        return
      }

      setStatus(Notification.permission === "denied" ? "blocked" : "disabled")
      toast.success("Browser notifications disabled")
    } catch {
      toast.error("Notifications could not be disabled. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const enabled = status === "enabled"
  const canDisable = enabled || status === "blocked-with-subscription"
  const statusLabel =
    status === "checking"
      ? "Checking"
      : enabled
        ? "Enabled"
        : status === "blocked" || status === "blocked-with-subscription"
          ? "Blocked"
          : status === "unavailable"
            ? "Unavailable"
            : "Off"

  return (
    <section
      aria-labelledby="push-notifications-heading"
      className="rounded-panel border border-border-soft bg-surface-inset p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-system-blue/10 text-system-blue">
            {enabled ? (
              <BellRing aria-hidden="true" className="size-4" />
            ) : (
              <BellOff aria-hidden="true" className="size-4" />
            )}
          </span>
          <div>
            <h3 className="font-semibold" id="push-notifications-heading">
              Browser notifications
            </h3>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">
              {status === "unavailable"
                ? "Push notifications are not available in this browser or deployment. In-app reminders still work."
                : status === "blocked" || status === "blocked-with-subscription"
                  ? "Notifications are blocked by your browser. Allow them in this site's browser settings, then check again."
                  : enabled
                    ? "Task reminders can appear even when Traketo is not open."
                    : "Get an alert when a reminder is due, even when Traketo is not open."}
            </p>
          </div>
        </div>
        <Badge aria-live="polite" variant="outline">
          {statusLabel}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canDisable ? (
          <Button
            disabled={busy}
            onClick={() => void disable()}
            type="button"
            variant="outline"
          >
            <BellOff aria-hidden="true" />
            {busy ? "Disabling…" : "Disable notifications"}
          </Button>
        ) : status === "blocked" ? (
          <Button
            disabled={busy}
            onClick={() => void refreshStatus()}
            type="button"
            variant="outline"
          >
            Check again
          </Button>
        ) : status === "disabled" ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={busy} type="button">
                <BellRing aria-hidden="true" />
                Enable notifications
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-system-blue/10 text-system-blue">
                  <ShieldCheck aria-hidden="true" />
                </AlertDialogMedia>
                <AlertDialogTitle>
                  Enable browser notifications?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Traketo uses notifications to alert you when a reminder is
                  due, even if this tab is closed. Only reminders you create are
                  sent, and you can turn them off here at any time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Not now</AlertDialogCancel>
                <AlertDialogAction onClick={() => void enable()}>
                  Continue to browser
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </section>
  )
}
