"use client"

import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Download, FileDown, MonitorSmartphone, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmationDialog } from "@/components/system/confirmation-dialog"
import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  deleteAccountAction,
  exportAccountDataAction,
  revokeSessionAction,
  signOutEverywhereAction,
  type SessionView,
} from "@/features/authentication/application/account-security-actions"
import { clearPrivateOfflineData } from "@/features/offline/storage/offline-database"

function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device"
  if (/curl\//iu.test(userAgent)) return "Command-line session"

  const browser = /edg\//iu.test(userAgent)
    ? "Edge"
    : /(?:chrome|crios)\//iu.test(userAgent)
      ? "Chrome"
      : /safari\//iu.test(userAgent)
        ? "Safari"
        : /firefox\//iu.test(userAgent)
          ? "Firefox"
          : "Web browser"
  const platform = /iphone|ipad/iu.test(userAgent)
    ? "iOS"
    : /macintosh|mac os/iu.test(userAgent)
      ? "macOS"
      : /android/iu.test(userAgent)
        ? "Android"
        : /windows/iu.test(userAgent)
          ? "Windows"
          : null

  return platform ? `${browser} on ${platform}` : browser
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}

export function SecurityDataPanel({
  currentSessionId,
  initialSessions,
}: Readonly<{
  currentSessionId: string | null
  initialSessions: readonly SessionView[]
}>) {
  return (
    <div className="security-data-panel">
      <SessionsCard
        currentSessionId={currentSessionId}
        initialSessions={initialSessions}
      />
      <DataCard />
      <DeleteAccountCard />
    </div>
  )
}

function SessionsCard({
  currentSessionId,
  initialSessions,
}: Readonly<{
  currentSessionId: string | null
  initialSessions: readonly SessionView[]
}>) {
  const router = useRouter()
  const [sessions] = useState<readonly SessionView[]>(initialSessions)
  const [isPending, startTransition] = useTransition()

  return (
    <section aria-labelledby="sessions-heading" className="security-sessions">
      <div className="security-card-heading">
        <span className="security-card-heading__icon">
          <MonitorSmartphone aria-hidden="true" />
        </span>
        <div>
          <div className="security-card-heading__title">
            <h3 id="sessions-heading">Active sessions</h3>
            <span>{sessions.length}</span>
          </div>
          <p>Devices currently signed in to your account.</p>
        </div>
        <div className="security-card-heading__action">
          <ConfirmationDialog
            confirmLabel="Sign out everywhere"
            description="Every signed-in device, including this one, will be signed out. You will need your password to sign in again."
            onConfirm={async () => {
              const result = await signOutEverywhereAction()
              if (result.ok) {
                await clearPrivateOfflineData()
                router.push("/sign-in")
              } else {
                toast.error(result.error.message)
              }
            }}
            title="Sign out of all devices?"
            triggerLabel="Sign out all"
            variant="destructive"
          />
        </div>
      </div>
      {sessions.length === 0 ? (
        <p className="security-sessions__empty">No active sessions found.</p>
      ) : (
        <ul className="security-session-list">
          {sessions.map((session) => (
            <li className="security-session" key={session.id}>
              <span className="security-session__device" aria-hidden="true">
                <MonitorSmartphone />
              </span>
              <div className="security-session__copy">
                <div>
                  <strong title={session.userAgent ?? undefined}>
                    {deviceLabel(session.userAgent)}
                  </strong>
                  {session.id === currentSessionId ? (
                    <span className="security-session__current">Current</span>
                  ) : null}
                </div>
                <p>Signed in {formatDate(session.createdAt)}</p>
                <small>
                  Expires {formatDate(session.expiresAt)}
                  {session.ipAddress ? ` · ${session.ipAddress}` : ""}
                </small>
              </div>
              {session.id === currentSessionId ? null : (
                <Button
                  className="security-session__revoke"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await revokeSessionAction({
                        sessionId: session.id,
                      })
                      if (result.ok && result.data.revoked) {
                        toast.success("Session signed out")
                      } else if (!result.ok) {
                        toast.error(result.error.message)
                      }
                      router.refresh()
                    })
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DataCard() {
  const [isPending, startTransition] = useTransition()

  return (
    <section aria-labelledby="export-heading" className="security-action-card">
      <span className="security-action-card__icon" data-tone="blue">
        <Download aria-hidden="true" />
      </span>
      <div className="security-action-card__copy">
        <div className="security-action-card__meta">
          <span>Your archive</span>
          <small>PDF · Private</small>
        </div>
        <h3 id="export-heading">Export your data</h3>
        <p>A polished, readable archive of your Daymark activity.</p>
        <Button
          className="security-action-card__button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await exportAccountDataAction()
              if (!result?.ok) {
                toast.error(
                  result && !result.ok
                    ? result.error.message
                    : "The export could not be created. Try again.",
                )
                return
              }
              const binary = atob(result.data.pdfBase64)
              const bytes = Uint8Array.from(binary, (character) =>
                character.charCodeAt(0),
              )
              const blob = new Blob([bytes], {
                type: "application/pdf",
              })
              const url = URL.createObjectURL(blob)
              const anchor = document.createElement("a")
              anchor.href = url
              anchor.download = result.data.filename
              anchor.click()
              URL.revokeObjectURL(url)
            })
          }
          type="button"
          variant="outline"
        >
          <FileDown aria-hidden="true" />
          {isPending ? "Building PDF" : "Download PDF"}
        </Button>
      </div>
    </section>
  )
}

function DeleteAccountCard() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // Stable so the dialog's completion effect does not re-fire on re-render.
  const handleDeleted = useCallback(async () => {
    await clearPrivateOfflineData()
    router.push("/sign-in")
  }, [router])

  return (
    <section
      aria-labelledby="danger-heading"
      className="security-action-card security-action-card--danger"
    >
      <span className="security-action-card__icon" data-tone="red">
        <Trash2 aria-hidden="true" />
      </span>
      <div className="security-action-card__copy">
        <div className="security-action-card__meta">
          <span>Danger zone</span>
          <small>Permanent</small>
        </div>
        <h3 id="danger-heading">Delete account</h3>
        <p>Erase your workspace and every connected record forever.</p>
        <Button
          className="security-action-card__button"
          onClick={() => setOpen(true)}
          type="button"
          variant="destructive"
        >
          <Trash2 aria-hidden="true" />
          Delete my account
        </Button>
      </div>
      {open ? (
        <DeleteAccountDialog
          onClose={() => setOpen(false)}
          onDeleted={handleDeleted}
        />
      ) : null}
    </section>
  )
}

function DeleteAccountDialog({
  onClose,
  onDeleted,
}: Readonly<{
  onClose: () => void
  onDeleted: () => Promise<void> | void
}>) {
  const [state, action] = useActionState(deleteAccountAction, null)

  useEffect(() => {
    if (state?.ok) {
      void onDeleted()
    }
  }, [onDeleted, state])

  useEffect(() => {
    const viewport = document.getElementById("app-device-viewport")
    viewport?.classList.add("has-modal-open")

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)

    return () => {
      viewport?.classList.remove("has-modal-open")
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [onClose])

  const portalContainer =
    document.getElementById("app-device-viewport") ?? document.body

  return createPortal(
    <div
      aria-labelledby="delete-account-dialog-title"
      aria-modal="true"
      className="account-delete-dialog__overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="dialog"
    >
      <div className="account-delete-dialog">
        <header className="account-delete-dialog__header">
          <span className="account-delete-dialog__icon">
            <Trash2 aria-hidden="true" />
          </span>
          <div>
            <span>Permanent deletion</span>
            <h3 id="delete-account-dialog-title">Delete your account?</h3>
            <p>
              Your profile, workspace, tasks, history, and attachments will be
              removed.
            </p>
          </div>
        </header>
        <form action={action} className="account-delete-dialog__form">
          <div className="account-delete-dialog__field">
            <Label htmlFor="delete-account-password">Password</Label>
            <Input
              autoComplete="current-password"
              autoFocus
              id="delete-account-password"
              name="password"
              required
              type="password"
            />
            {state && !state.ok ? (
              <p className="account-delete-dialog__error" role="alert">
                {state.error.fieldErrors?.password?.[0] ?? state.error.message}
              </p>
            ) : null}
          </div>
          <div className="account-delete-dialog__actions">
            <Button
              className="account-delete-dialog__cancel"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <MutationSubmitButton
              className="account-delete-dialog__submit"
              idleLabel="Permanently delete"
              pendingLabel="Deleting account"
            />
          </div>
        </form>
      </div>
    </div>,
    portalContainer,
  )
}
