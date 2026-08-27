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
import {
  Clock,
  Download,
  FileDown,
  Globe,
  LogOut,
  Monitor,
  MonitorSmartphone,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react"
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

// ─── helpers ──────────────────────────────────────────────────────────────────

type DeviceKind = "mobile" | "tablet" | "desktop"

function deviceKind(userAgent: string | null): DeviceKind {
  if (!userAgent) return "desktop"
  if (/iphone|android(?!.*tablet)|mobile/iu.test(userAgent)) return "mobile"
  if (/ipad|tablet/iu.test(userAgent)) return "tablet"
  return "desktop"
}

function deviceLabel(userAgent: string | null): {
  name: string
  kind: DeviceKind
} {
  if (!userAgent) return { kind: "desktop", name: "Unknown device" }
  if (/curl\//iu.test(userAgent))
    return { kind: "desktop", name: "Command-line session" }

  const browser = /edg\//iu.test(userAgent)
    ? "Edge"
    : /(?:chrome|crios)\//iu.test(userAgent)
      ? "Chrome"
      : /safari\//iu.test(userAgent)
        ? "Safari"
        : /firefox\//iu.test(userAgent)
          ? "Firefox"
          : "Browser"

  const platform = /iphone/iu.test(userAgent)
    ? "iPhone"
    : /ipad/iu.test(userAgent)
      ? "iPad"
      : /macintosh|mac os/iu.test(userAgent)
        ? "macOS"
        : /android/iu.test(userAgent)
          ? "Android"
          : /windows/iu.test(userAgent)
            ? "Windows"
            : /linux/iu.test(userAgent)
              ? "Linux"
              : null

  const kind = deviceKind(userAgent)
  const name = platform ? `${browser} on ${platform}` : browser
  return { kind, name }
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ─── SessionsCard ──────────────────────────────────────────────────────────────

// ─── SecurityDataPanel ────────────────────────────────────────────────────────

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

// Loopback addresses shown in dev/localhost — meaningless to the user
const LOOPBACK_PATTERN =
  /^(::1?|127\.0\.0\.1|::ffff:127\.0\.0\.1|(?:0000:){7}000[01])$/

function isRealIp(ip: string | null): ip is string {
  return ip !== null && !LOOPBACK_PATTERN.test(ip)
}

function SessionsCard({
  currentSessionId,
  initialSessions,
}: Readonly<{
  currentSessionId: string | null
  initialSessions: readonly SessionView[]
}>) {
  const router = useRouter()
  const [sessions, setSessions] =
    useState<readonly SessionView[]>(initialSessions)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [signedOutDevice, setSignedOutDevice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleRevoke = useCallback(
    (sessionId: string) => {
      const label = deviceLabel(
        sessions.find((s) => s.id === sessionId)?.userAgent ?? null,
      ).name
      // Optimistically remove the session card immediately
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      setConfirmingId(null)
      startTransition(async () => {
        const result = await revokeSessionAction({ sessionId })
        if (result.ok && result.data.revoked) {
          setSignedOutDevice(label)
        } else if (!result.ok) {
          // Restore on failure
          toast.error(result.error.message)
          setSessions(initialSessions)
        }
      })
    },
    [initialSessions, sessions],
  )

  const confirmingSession = confirmingId
    ? sessions.find((s) => s.id === confirmingId) ?? null
    : null

  const otherSessions = sessions.filter((s) => s.id !== currentSessionId)
  const currentSession = sessions.find((s) => s.id === currentSessionId)

  return (
    <section aria-labelledby="sessions-heading" className="security-sessions">
      {/* Header */}
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
          {/* Current session always first */}
          {currentSession ? (
            <SessionItem
              isCurrent
              isPending={isPending}
              key={currentSession.id}
              onRequestConfirm={setConfirmingId}
              session={currentSession}
            />
          ) : null}

          {/* Other sessions */}
          {otherSessions.map((session) => (
            <SessionItem
              isCurrent={false}
              isPending={isPending}
              key={session.id}
              onRequestConfirm={setConfirmingId}
              session={session}
            />
          ))}
        </ul>
      )}
      {confirmingSession ? (
        <RevokeSessionModal
          deviceName={deviceLabel(confirmingSession.userAgent).name}
          isPending={isPending}
          onCancel={() => setConfirmingId(null)}
          onConfirm={() => handleRevoke(confirmingSession.id)}
        />
      ) : null}
      {signedOutDevice ? (
        <SessionSignedOutPopup
          deviceName={signedOutDevice}
          onDismiss={() => {
            setSignedOutDevice(null)
            router.refresh()
          }}
        />
      ) : null}
    </section>
  )
}

// ─── SessionItem ───────────────────────────────────────────────────────────────

function SessionItem({
  isCurrent,
  isPending,
  onRequestConfirm,
  session,
}: Readonly<{
  isCurrent: boolean
  isPending: boolean
  onRequestConfirm: (id: string) => void
  session: SessionView
}>) {
  const { kind, name } = deviceLabel(session.userAgent)

  const DeviceIcon =
    kind === "mobile" ? Smartphone : kind === "tablet" ? Tablet : Monitor

  return (
    <li className="security-session" data-current={isCurrent || undefined}>
      {/* Device icon pill */}
      <span className="security-session__device" aria-hidden="true">
        <DeviceIcon />
        {isCurrent && (
          <span className="security-session__pulse" aria-hidden="true" />
        )}
      </span>

      {/* Session details */}
      <div className="security-session__copy">
        <div className="security-session__title-row">
          <strong title={session.userAgent ?? undefined}>{name}</strong>
          {isCurrent ? (
            <span className="security-session__current">This device</span>
          ) : (
            <span className="security-session__other-badge">Other</span>
          )}
        </div>

        <div className="security-session__meta-row">
          <span className="security-session__meta-item">
            <Clock aria-hidden="true" />
            Signed in {timeAgo(session.createdAt)}
          </span>
        </div>

        {isRealIp(session.ipAddress) ? (
          <span className="security-session__ip">
            <Globe aria-hidden="true" />
            {session.ipAddress}
          </span>
        ) : null}
      </div>

      {/* Sign out action — only for other sessions */}
      {!isCurrent ? (
        <div className="security-session__action">
          <Button
            className="security-session__signout"
            disabled={isPending}
            onClick={() => onRequestConfirm(session.id)}
            size="sm"
            type="button"
            variant="outline"
          >
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </div>
      ) : null}
    </li>
  )
}

// ─── RevokeSessionModal ─────────────────────────────────────────────────────────

function RevokeSessionModal({
  deviceName,
  isPending,
  onCancel,
  onConfirm,
}: Readonly<{
  deviceName: string
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}>) {
  useEffect(() => {
    const viewport = document.getElementById("app-device-viewport")
    viewport?.classList.add("has-modal-open")

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", closeOnEscape)

    return () => {
      viewport?.classList.remove("has-modal-open")
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [onCancel])

  const portalContainer =
    document.getElementById("app-device-viewport") ?? document.body

  return createPortal(
    <div
      aria-labelledby="revoke-session-dialog-title"
      aria-modal="true"
      className="revoke-session-modal__overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
      role="dialog"
    >
      <div className="revoke-session-modal">
        <div className="revoke-session-modal__visual" aria-hidden="true">
          <span className="revoke-session-modal__icon">
            <LogOut />
          </span>
        </div>

        <div className="revoke-session-modal__copy">
          <p className="revoke-session-modal__eyebrow">Remote sign-out</p>
          <h3
            className="revoke-session-modal__title"
            id="revoke-session-dialog-title"
          >
            Sign out this device?
          </h3>
          <p className="revoke-session-modal__device">
            <strong>{deviceName}</strong> will be signed out of your account
            immediately.
          </p>
        </div>

        <div className="revoke-session-modal__actions">
          <Button
            disabled={isPending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={isPending}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            <LogOut aria-hidden="true" />
            {isPending ? "Signing out…" : "Sign out device"}
          </Button>
        </div>
      </div>
    </div>,
    portalContainer,
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
        <p>A polished, readable archive of your Traketo activity.</p>
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

// ─── SessionSignedOutPopup ─────────────────────────────────────────────────────

function SessionSignedOutPopup({
  deviceName,
  onDismiss,
}: Readonly<{
  deviceName: string
  onDismiss: () => void
}>) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 4_000)
    return () => window.clearTimeout(timeout)
  }, [onDismiss])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onDismiss])

  const portalContainer =
    document.getElementById("app-device-viewport") ?? document.body

  return createPortal(
    <div className="session-signout-popup__stage" onClick={onDismiss}>
      <div
        aria-labelledby="session-signout-popup-title"
        aria-live="polite"
        aria-modal="true"
        className="session-signout-popup"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div aria-hidden="true" className="session-signout-popup__visual">
          <span className="session-signout-popup__ring session-signout-popup__ring--outer" />
          <span className="session-signout-popup__ring session-signout-popup__ring--inner" />
          <span className="session-signout-popup__icon">
            <LogOut />
          </span>
        </div>

        <div className="session-signout-popup__copy">
          <span>Done</span>
          <h2 id="session-signout-popup-title">Device signed out</h2>
          <p>
            <strong>{deviceName}</strong> has been signed out of your account.
          </p>
        </div>

        <span aria-hidden="true" className="session-signout-popup__timer" />
      </div>
    </div>,
    portalContainer,
  )
}
