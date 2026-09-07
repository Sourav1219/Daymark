"use client"

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import {
  Check,
  Copy,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { MutationSubmitButton } from "@/components/system/mutation-submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  enableTwoFactorAction,
} from "@/features/authentication/application/account-security-actions"
import { ProfileUpdatePopup } from "@/features/authentication/ui/profile-update-popup"

type TwoFactorSettingsCardProps = Readonly<{
  hasPassword?: boolean
  initialTwoFactorEnabled?: boolean
}>

export function TwoFactorSettingsCard({
  hasPassword = true,
  initialTwoFactorEnabled = false,
}: TwoFactorSettingsCardProps) {
  const [isEnabled, setIsEnabled] = useState(initialTwoFactorEnabled)
  const [prevInitialTwoFactorEnabled, setPrevInitialTwoFactorEnabled] =
    useState(initialTwoFactorEnabled)
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [isDisableOpen, setIsDisableOpen] = useState(false)
  const [celebrationKind, setCelebrationKind] = useState<
    "two-factor" | "two-factor-disabled" | null
  >(null)

  if (initialTwoFactorEnabled !== prevInitialTwoFactorEnabled) {
    setPrevInitialTwoFactorEnabled(initialTwoFactorEnabled)
    setIsEnabled(initialTwoFactorEnabled)
  }

  return (
    <section
      aria-labelledby="tfa-heading"
      className={`security-action-card${isEnabled ? " security-action-card--active-tfa" : ""}`}
    >
      <span
        className="security-action-card__icon"
        data-tone={isEnabled ? "emerald" : "blue"}
      >
        {isEnabled ? (
          <ShieldCheck aria-hidden="true" />
        ) : (
          <Smartphone aria-hidden="true" />
        )}
      </span>

      <div className="security-action-card__copy">
        <div className="security-action-card__meta">
          <span>{isEnabled ? "Protected" : "Two-Factor Auth"}</span>
          <small
            className={
              isEnabled
                ? "border-emerald-500/20 bg-emerald-50 text-emerald-700 font-bold"
                : undefined
            }
          >
            {isEnabled ? "Active" : "Optional"}
          </small>
        </div>
        <h3 id="tfa-heading">Google Authenticator</h3>
        <p>
          {isEnabled
            ? "Two-factor authentication is active. You will be asked for a 6-digit code from your app at sign-in."
            : "Protect your account by requiring a 6-digit code from Google Authenticator whenever you sign in."}
        </p>
      </div>

      {isEnabled ? (
        <Button
          className="security-action-card__button"
          onClick={() => setIsDisableOpen(true)}
          type="button"
          variant="outline"
        >
          <ShieldAlert aria-hidden="true" />
          Disable 2FA
        </Button>
      ) : (
        <Button
          className="security-action-card__button"
          onClick={() => setIsSetupOpen(true)}
          type="button"
        >
          <QrCode aria-hidden="true" />
          Set up Authenticator
        </Button>
      )}

      {isSetupOpen ? (
        <SetupModal
          hasPassword={hasPassword}
          onClose={() => setIsSetupOpen(false)}
          onSuccess={() => {
            setIsEnabled(true)
            setIsSetupOpen(false)
            setCelebrationKind("two-factor")
          }}
        />
      ) : null}

      {isDisableOpen ? (
        <DisableModal
          hasPassword={hasPassword}
          onClose={() => setIsDisableOpen(false)}
          onSuccess={() => {
            setIsEnabled(false)
            setIsDisableOpen(false)
            setCelebrationKind("two-factor-disabled")
          }}
        />
      ) : null}

      {celebrationKind ? (
        <ProfileUpdatePopup
          kind={celebrationKind}
          onDismiss={() => setCelebrationKind(null)}
        />
      ) : null}
    </section>
  )
}

// ─── SetupModal ───────────────────────────────────────────────────────────────

type SetupModalProps = Readonly<{
  hasPassword?: boolean
  onClose: () => void
  onSuccess: () => void
}>

function SetupModal({ onClose, onSuccess }: SetupModalProps) {
  const router = useRouter()
  const hasStartedRef = useRef(false)
  const [setupState, setupAction] = useActionState(enableTwoFactorAction, null)
  const [confirmState, confirmAction] = useActionState(
    confirmTwoFactorAction,
    null,
  )
  const [code, setCode] = useState("")
  const [copiedKey, setCopiedKey] = useState(false)
  const [showManualKey, setShowManualKey] = useState(false)

  // Auto-start setup once on modal open
  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true
      startTransition(() => {
        setupAction()
      })
    }
  }, [setupAction])

  const setupData = setupState?.ok ? setupState.data : null

  // Handle confirmation outcome
  useEffect(() => {
    if (confirmState?.ok) {
      router.refresh()
      onSuccess()
    }
  }, [confirmState, onSuccess, router])

  // Modal accessibility & lock
  useEffect(() => {
    const viewport = document.getElementById("app-device-viewport")
    viewport?.classList.add("has-modal-open")

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      viewport?.classList.remove("has-modal-open")
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  function copySecretKey() {
    if (!setupData?.secretKey) return
    void navigator.clipboard.writeText(setupData.secretKey)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
    toast.success("Secret key copied to clipboard")
  }

  const portalContainer =
    document.getElementById("app-device-viewport") ?? document.body

  return createPortal(
    <div
      aria-labelledby="tfa-setup-dialog-title"
      aria-modal="true"
      className="account-delete-dialog__overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
    >
      <div className="account-delete-dialog tfa-setup-modal">
        {/* Close button */}
        <button
          aria-label="Close setup"
          className="absolute top-3.5 right-3.5 flex size-7 items-center justify-center rounded-full text-ink-muted hover:bg-surface-elevated hover:text-ink transition-colors"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>

        <header className="account-delete-dialog__header">
          <span
            className="account-delete-dialog__icon"
            style={{
              background: "linear-gradient(145deg, #eef3ff, #dfe9ff)",
              borderColor: "rgba(84, 113, 207, 0.15)",
              color: "#3869df",
            }}
          >
            <QrCode aria-hidden="true" />
          </span>
          <div>
            <span style={{ color: "#3869df" }}>Google Authenticator</span>
            <h3 id="tfa-setup-dialog-title">Scan QR code</h3>
            <p>Scan with Google Authenticator, then enter the 6-digit code.</p>
          </div>
        </header>

        <div className="mt-4 flex flex-col items-center">
          {/* QR Code Canvas / Image / Loading / Error */}
          {setupData?.qrCodeDataUrl ? (
            <div className="relative rounded-2xl border border-border-soft bg-white p-3 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Google Authenticator QR code"
                className="size-44 rounded-lg select-none"
                height={176}
                src={setupData.qrCodeDataUrl}
                width={176}
              />
            </div>
          ) : setupState && !setupState.ok ? (
            <div className="flex size-44 flex-col items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-center text-xs text-destructive">
              <p className="font-semibold">{setupState.error.message}</p>
              <Button
                className="mt-1 text-xs"
                onClick={() => {
                  startTransition(() => {
                    setupAction()
                  })
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="flex size-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-soft bg-surface-elevated/40 text-xs text-ink-muted">
              <span className="size-4 animate-spin rounded-full border-2 border-system-blue border-t-transparent" />
              Generating QR code…
            </div>
          )}

          {/* Manual Secret Key Fallback */}
          {setupData?.secretKey ? (
            <div className="mt-3 w-full text-center">
              <button
                className="text-[0.62rem] font-bold text-system-blue hover:underline focus-visible:outline-none"
                onClick={() => setShowManualKey((prev) => !prev)}
                type="button"
              >
                {showManualKey
                  ? "Hide manual key"
                  : "Can't scan? Enter key manually"}
              </button>

              {showManualKey ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-border-soft bg-surface-elevated/60 px-3 py-1.5 text-left">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[0.48rem] font-bold uppercase tracking-wider text-ink-muted">
                      Secret key
                    </span>
                    <code className="block truncate font-mono text-[0.64rem] font-bold text-ink select-all">
                      {setupData.secretKey}
                    </code>
                  </div>
                  <Button
                    aria-label="Copy secret key"
                    className="size-7 p-0 shrink-0"
                    onClick={copySecretKey}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {copiedKey ? (
                      <Check className="size-3.5 text-success" />
                    ) : (
                      <Copy className="size-3.5 text-ink-muted" />
                    )}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* TOTP 6-digit confirmation form */}
        <form
          action={confirmAction}
          className="account-delete-dialog__form mt-4"
        >
          <div className="account-delete-dialog__field">
            <Label
              className="text-center block text-xs"
              htmlFor="tfa-code-input"
            >
              6-digit code from Google Authenticator
            </Label>
            <Input
              aria-describedby={
                confirmState && !confirmState.ok ? "tfa-code-error" : undefined
              }
              aria-invalid={Boolean(confirmState && !confirmState.ok)}
              autoComplete="one-time-code"
              autoFocus
              className="text-center font-mono text-lg font-black tracking-widest h-12"
              id="tfa-code-input"
              inputMode="numeric"
              maxLength={6}
              name="code"
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/gu, "").slice(0, 6)
                setCode(cleaned)
              }}
              pattern="[0-9]{6}"
              placeholder="000000"
              required
              value={code}
            />
            {confirmState && !confirmState.ok ? (
              <p
                className="account-delete-dialog__error text-center"
                id="tfa-code-error"
                role="alert"
              >
                {confirmState.error.fieldErrors?.code?.[0] ??
                  confirmState.error.message}
              </p>
            ) : null}
          </div>

          <div className="tfa-setup-dialog__actions mt-1">
            <Button
              className="account-delete-dialog__cancel"
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <MutationSubmitButton
              className="tfa-setup-dialog__submit"
              disabled={code.length !== 6 || !setupData}
              idleLabel="Activate 2FA"
              pendingLabel="Verifying…"
            />
          </div>
        </form>
      </div>
    </div>,
    portalContainer,
  )
}

// ─── DisableModal ─────────────────────────────────────────────────────────────

type DisableModalProps = Readonly<{
  hasPassword?: boolean
  onClose: () => void
  onSuccess: () => void
}>

function DisableModal({ onClose, onSuccess }: DisableModalProps) {
  const router = useRouter()
  const [state, action] = useActionState(disableTwoFactorAction, null)

  useEffect(() => {
    if (state?.ok) {
      router.refresh()
      onSuccess()
    }
  }, [onSuccess, router, state])

  useEffect(() => {
    const viewport = document.getElementById("app-device-viewport")
    viewport?.classList.add("has-modal-open")

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      viewport?.classList.remove("has-modal-open")
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  const portalContainer =
    document.getElementById("app-device-viewport") ?? document.body

  return createPortal(
    <div
      aria-labelledby="tfa-disable-dialog-title"
      aria-modal="true"
      className="account-delete-dialog__overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
    >
      <div className="account-delete-dialog">
        <header className="account-delete-dialog__header">
          <span className="account-delete-dialog__icon">
            <ShieldAlert aria-hidden="true" />
          </span>
          <div>
            <span>Security warning</span>
            <h3 id="tfa-disable-dialog-title">Disable 2FA?</h3>
            <p>
              Your account will no longer require a security code from Google
              Authenticator to sign in.
            </p>
          </div>
        </header>

        <form action={action} className="account-delete-dialog__form">
          {state && !state.ok ? (
            <p className="account-delete-dialog__error" role="alert">
              {state.error.message}
            </p>
          ) : null}

          <div className="tfa-setup-dialog__actions mt-1">
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
              idleLabel="Disable 2FA"
              pendingLabel="Disabling…"
            />
          </div>
        </form>
      </div>
    </div>,
    portalContainer,
  )
}
