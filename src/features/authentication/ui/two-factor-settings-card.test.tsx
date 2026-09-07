import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TwoFactorSettingsCard } from "./two-factor-settings-card"

const mocks = vi.hoisted(() => ({
  confirmTwoFactorAction: vi.fn(),
  disableTwoFactorAction: vi.fn(),
  enableTwoFactorAction: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

vi.mock(
  "@/features/authentication/application/account-security-actions",
  () => ({
    confirmTwoFactorAction: mocks.confirmTwoFactorAction,
    disableTwoFactorAction: mocks.disableTwoFactorAction,
    enableTwoFactorAction: mocks.enableTwoFactorAction,
  }),
)

describe("TwoFactorSettingsCard", () => {
  beforeEach(() => {
    mocks.confirmTwoFactorAction.mockReset()
    mocks.disableTwoFactorAction.mockReset()
    mocks.enableTwoFactorAction.mockReset()
    mocks.push.mockReset()
    mocks.refresh.mockReset()
  })

  it("renders the disabled state when 2FA is not active", () => {
    render(<TwoFactorSettingsCard initialTwoFactorEnabled={false} />)

    expect(
      screen.getByRole("heading", { name: "Google Authenticator" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Optional")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /set up authenticator/i }),
    ).toBeInTheDocument()
  })

  it("renders the enabled state when 2FA is active", () => {
    render(<TwoFactorSettingsCard initialTwoFactorEnabled={true} />)

    expect(
      screen.getByRole("heading", { name: "Google Authenticator" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /disable 2fa/i }),
    ).toBeInTheDocument()
  })

  it("opens setup modal directly in QR step without password prompt", async () => {
    mocks.enableTwoFactorAction.mockResolvedValueOnce({
      data: {
        qrCodeDataUrl: "data:image/png;base64,mockqr",
        secretKey: "JBSWY3DPEHPK3PXP",
        totpURI:
          "otpauth://totp/Traketo:user@example.com?secret=JBSWY3DPEHPK3PXP",
      },
      ok: true,
    })

    render(<TwoFactorSettingsCard initialTwoFactorEnabled={false} />)

    fireEvent.click(
      screen.getByRole("button", { name: /set up authenticator/i }),
    )

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    // Must NEVER ask for a password
    expect(screen.queryByPlaceholderText(/password/i)).not.toBeInTheDocument()
    expect(screen.queryByText("Step 1 of 2")).not.toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByAltText("Google Authenticator QR code"),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("heading", { name: "Scan QR code" }),
      ).toBeInTheDocument()
      expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument()
    })
  })

  it("allows toggling manual secret key", async () => {
    mocks.enableTwoFactorAction.mockResolvedValueOnce({
      data: {
        qrCodeDataUrl: "data:image/png;base64,mockqr",
        secretKey: "JBSWY3DPEHPK3PXP",
        totpURI:
          "otpauth://totp/Traketo:user@example.com?secret=JBSWY3DPEHPK3PXP",
      },
      ok: true,
    })

    render(<TwoFactorSettingsCard initialTwoFactorEnabled={false} />)

    fireEvent.click(
      screen.getByRole("button", { name: /set up authenticator/i }),
    )

    await waitFor(() => {
      expect(screen.getByText(/enter key manually/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/enter key manually/i))
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument()
  })

  it("shows celebration popup on successful activation and activates 2FA", async () => {
    mocks.enableTwoFactorAction.mockResolvedValueOnce({
      data: {
        qrCodeDataUrl: "data:image/png;base64,mockqr",
        secretKey: "JBSWY3DPEHPK3PXP",
        totpURI:
          "otpauth://totp/Traketo:user@example.com?secret=JBSWY3DPEHPK3PXP",
      },
      ok: true,
    })
    mocks.confirmTwoFactorAction.mockResolvedValueOnce({
      data: { enabled: true },
      ok: true,
    })

    render(<TwoFactorSettingsCard initialTwoFactorEnabled={false} />)

    fireEvent.click(
      screen.getByRole("button", { name: /set up authenticator/i }),
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/6-digit code/i), {
      target: { value: "123456" },
    })
    fireEvent.click(screen.getByRole("button", { name: /activate 2fa/i }))

    await waitFor(() => {
      expect(screen.getByText("Authentication enabled")).toBeInTheDocument()
      expect(
        screen.getByText(/Google Authenticator is now active/),
      ).toBeInTheDocument()
    })

    // Dismiss celebration
    fireEvent.click(screen.getByRole("button", { name: /done/i }))
    await waitFor(() => {
      expect(
        screen.queryByText("Authentication enabled"),
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole("button", { name: /disable 2fa/i }),
    ).toBeInTheDocument()
  })

  it("opens disable confirmation dialog without password field and handles cancellation", async () => {
    render(<TwoFactorSettingsCard initialTwoFactorEnabled={true} />)

    fireEvent.click(screen.getByRole("button", { name: /disable 2fa/i }))

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText(/disable 2fa\?/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/password/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows celebration popup on successful disable, updates state, and allows dismissal", async () => {
    mocks.disableTwoFactorAction.mockResolvedValueOnce({
      data: { disabled: true },
      ok: true,
    })

    render(<TwoFactorSettingsCard initialTwoFactorEnabled={true} />)

    fireEvent.click(screen.getByRole("button", { name: /disable 2fa/i }))

    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeInTheDocument()
    const submitButton = within(dialog).getByRole("button", {
      name: /^disable 2fa$/i,
    })
    expect(submitButton).toBeInTheDocument()

    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("Authentication disabled")).toBeInTheDocument()
      expect(
        screen.getByText(/Google Authenticator has been disabled/),
      ).toBeInTheDocument()
    })

    // Dismiss celebration
    fireEvent.click(screen.getByRole("button", { name: /done/i }))
    await waitFor(() => {
      expect(
        screen.queryByText("Authentication disabled"),
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole("button", { name: /set up authenticator/i }),
    ).toBeInTheDocument()
  })
})
