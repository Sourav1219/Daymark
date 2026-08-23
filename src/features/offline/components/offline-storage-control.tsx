"use client"

import { useEffect, useState } from "react"
import { LockKeyhole, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  clearPrivateOfflineData,
  enablePrivateOfflineData,
  getOfflineStorageStatus,
  unlockPrivateOfflineData,
} from "@/features/offline/storage/offline-database"

export function OfflineStorageControl() {
  const [status, setStatus] = useState({ enabled: false, locked: false })
  const [passcode, setPasscode] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    void getOfflineStorageStatus().then(setStatus)
  }, [])

  async function submit() {
    setPending(true)
    setMessage(null)
    try {
      if (status.enabled) {
        if (!(await unlockPrivateOfflineData(passcode))) {
          setMessage("The offline passcode is incorrect.")
          return
        }
      } else {
        await enablePrivateOfflineData(passcode)
      }
      setPasscode("")
      setStatus(await getOfflineStorageStatus())
      setMessage(
        status.enabled
          ? "Offline data is unlocked for this browser session."
          : "Encrypted offline storage is enabled. Reloading to save a snapshot…",
      )
      if (!status.enabled) window.location.reload()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Offline storage failed.",
      )
    } finally {
      setPending(false)
    }
  }

  async function clear() {
    setPending(true)
    await clearPrivateOfflineData()
    setStatus({ enabled: false, locked: false })
    setPasscode("")
    setMessage("All offline task data was cleared from this device.")
    setPending(false)
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink-muted">
        Offline storage is opt-in. Task snapshots and queued changes are
        encrypted with a device passcode and expire after seven days.
      </p>
      <Input
        aria-label={
          status.enabled ? "Offline passcode" : "Create offline passcode"
        }
        autoComplete="off"
        disabled={pending}
        maxLength={128}
        minLength={6}
        onChange={(event) => setPasscode(event.target.value)}
        placeholder={
          status.enabled
            ? "Enter passcode to unlock"
            : "Create passcode (6+ characters)"
        }
        type="password"
        value={passcode}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending || passcode.length < 6}
          onClick={submit}
          type="button"
        >
          <LockKeyhole aria-hidden="true" />
          {status.enabled
            ? "Unlock offline data"
            : "Enable encrypted offline data"}
        </Button>
        <Button
          disabled={pending || !status.enabled}
          onClick={clear}
          type="button"
          variant="outline"
        >
          <Trash2 aria-hidden="true" /> Clear offline data
        </Button>
      </div>
      {message ? (
        <p className="text-sm text-ink-muted" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
