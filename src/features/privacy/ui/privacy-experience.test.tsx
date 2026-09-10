import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PrivacyExperience, type PrivacyCentreUser } from "./privacy-experience"

const backHrefState = vi.hoisted(() => ({ href: "/profile" }))
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}))

vi.mock("sonner", () => ({ toast: toastMocks }))

vi.mock("@/components/legal/legal-shell-context", () => ({
  useLegalBackHref: () => backHrefState.href,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}))

vi.mock(
  "@/features/authentication/application/account-security-actions",
  () => ({
    exportAccountDataAction: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        filename: "traketo-export-test.pdf",
        pdfBase64: btoa("Dummy PDF binary content"),
      },
    }),
  }),
)

vi.mock("@/features/privacy/application/cookie-consent-actions", () => ({
  saveCookieConsentAction: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock("@/features/privacy/application/privacy-request-actions", () => ({
  submitPrivacyRequestAction: vi.fn(),
}))

const mockUser: PrivacyCentreUser = {
  createdAt: "2026-08-01T10:00:00.000Z",
  email: "testuser@example.com",
  emailVerified: true,
  hasPassword: true,
  id: "user-1234-uuid",
  name: "Test User",
  timezone: "Asia/Kolkata",
  workspaceName: "Personal Space",
}

describe("PrivacyExperience (Unified Privacy & Data Centre)", () => {
  let writeTextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    })
  })

  it("renders the merged title and core privacy guarantees", () => {
    render(<PrivacyExperience user={mockUser} />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy & Data Centre" }),
    ).toBeVisible()
    expect(
      screen.getByRole("region", { name: "Core privacy promises" }),
    ).toBeVisible()
    expect(screen.getByText("Zero data selling")).toBeVisible()
    expect(screen.getByText("Encrypted storage")).toBeVisible()
    expect(screen.getByText("Full data control")).toBeVisible()
    expect(screen.getByText("Zero ad cookies")).toBeVisible()
  })

  it("renders all 11 policy sections with section 1 open by default on the policy tab", () => {
    const { container } = render(<PrivacyExperience user={mockUser} />)

    const cards = container.querySelectorAll(".privacy-accordion-card")
    expect(cards).toHaveLength(11)

    // Section 1 should be open initially
    expect(cards[0]).toHaveAttribute("open")
    expect(screen.getByText("Who operates Traketo")).toBeVisible()
    expect(
      screen.getByText(
        /Traketo is operated by Sourav Verma, an individual based in Jammu and Kashmir, India/i,
      ),
    ).toBeVisible()

    // Section 2 should not be open initially
    expect(cards[1]).not.toHaveAttribute("open")
  })

  it("allows switching to Data Inventory tab and displays lawful bases", async () => {
    const user = userEvent.setup()
    render(<PrivacyExperience user={mockUser} />)

    const inventoryTabBtn = screen.getByRole("button", {
      name: /data inventory/i,
    })
    await user.click(inventoryTabBtn)

    expect(
      screen.getByText(/Personal Data Inventory & Lawful Bases/i),
    ).toBeVisible()
    expect(screen.getByText(/1. Identity & Account Credentials/i)).toBeVisible()
    expect(
      screen.getByText(/2. Habits, Quests & Progression Data/i),
    ).toBeVisible()
    expect(
      screen.getAllByText(/Contractual Necessity/i).length,
    ).toBeGreaterThan(0)
  })

  it("switches to Consent & Ledger tab, displays hub link, and shows explicit consent given timestamps without live toggle cards", async () => {
    const user = userEvent.setup()
    render(<PrivacyExperience user={mockUser} />)

    const consentTabBtn = screen.getByRole("button", {
      name: /consent & ledger/i,
    })
    await user.click(consentTabBtn)

    expect(
      screen.getByText(/Granular Consent Controls & Regulatory Ledger/i),
    ).toBeVisible()
    expect(screen.getByText(/Consent Audit Trail & Ledger/i)).toBeVisible()

    // Hub callout should point to profile settings
    expect(screen.getByText(/Active Account Consent Controls/i)).toBeVisible()
    expect(
      screen.getByRole("link", { name: /manage in profile settings/i }),
    ).toHaveAttribute("href", "/profile")

    // The 4 interactive toggle cards should NOT be here in Privacy Centre
    expect(
      screen.queryByLabelText(/toggle optional preferences storage/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/toggle email task reminders/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/toggle web push notifications/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/toggle encrypted local device storage/i),
    ).not.toBeInTheDocument()

    // Consent given timestamps should be prominently listed in the ledger
    expect(screen.getAllByText(/Consent given:/i).length).toBeGreaterThan(0)
    expect(screen.getByText("Aug 24, 2026 · 09:18 AM")).toBeVisible()
    expect(screen.getByText("Aug 24, 2026 · 10:04 AM")).toBeVisible()
  })

  it("allows switching to Rights Desk and viewing request tracking", async () => {
    const user = userEvent.setup()
    render(
      <PrivacyExperience
        initialRequests={[
          {
            createdAt: "2026-08-28T14:30:00.000Z",
            details:
              "Request for personal data audit under DPDP Act Section 11.",
            id: "req-1",
            status: "completed",
            ticketNumber: "PR-2026-7821",
            type: "Data Access Audit",
          },
        ]}
        user={mockUser}
      />,
    )

    const rightsTabBtn = screen.getByRole("button", { name: /rights desk/i })
    await user.click(rightsTabBtn)

    expect(screen.getByText(/Statutory Privacy Rights Desk/i)).toBeVisible()
    expect(screen.getByText(/Submit a Formal Privacy Request/i)).toBeVisible()
    expect(screen.getByText(/PR-2026-7821/i)).toBeVisible()
  })

  it("allows switching to Digital Nominee tab and displays nominee card, triggering rich animated popups upon revocation and appointment", async () => {
    const user = userEvent.setup()
    render(<PrivacyExperience user={mockUser} />)

    const nomineeTabBtn = screen.getByRole("button", {
      name: /digital nominee/i,
    })
    await user.click(nomineeTabBtn)

    expect(screen.getByText(/Digital Nominee Designation/i)).toBeVisible()
    expect(screen.getByText(/Ananya Sharma/i)).toBeVisible()

    // Revoke nomination to see revocation animated popup & empty state card
    const revokeBtn = screen.getByRole("button", { name: /revoke nomination/i })
    await user.click(revokeBtn)

    // Animated popup for nominee removed should be visible
    expect(
      screen.getByRole("dialog", { name: /nominee removed/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Delegation Revoked for Ananya Sharma/i),
    ).toBeInTheDocument()
    expect(toastMocks.success).not.toHaveBeenCalled()

    // Dismiss popup via Continue button
    const continueBtn = screen.getByRole("button", { name: /continue/i })
    await user.click(continueBtn)
    expect(
      screen.queryByRole("dialog", { name: /nominee removed/i }),
    ).not.toBeInTheDocument()

    // Empty state should be visible
    expect(screen.getByText(/No Digital Nominee Appointed/i)).toBeVisible()
    expect(screen.getByText(/DPDP Act 2023 · Section 14/i)).toBeVisible()
    expect(screen.getByText(/Legal Authority/i)).toBeVisible()
    expect(screen.getByText(/Data Portability/i)).toBeVisible()
    expect(screen.getByText(/Zero Active Access/i)).toBeVisible()

    // Appoint a new nominee to trigger celebration popup
    const appointBtn = screen.getByRole("button", {
      name: /appoint digital nominee/i,
    })
    await user.click(appointBtn)

    // Fill the nominee dialog
    const nameInput = screen.getByLabelText(/nominee full name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    await user.clear(nameInput)
    await user.type(nameInput, "Vikram Sharma")
    await user.clear(emailInput)
    await user.type(emailInput, "vikram@example.com")

    const saveBtn = screen.getByRole("button", {
      name: /save nominee designation/i,
    })
    await user.click(saveBtn)

    // Animated popup for nominee appointed should be visible
    expect(
      screen.getByRole("dialog", { name: /nominee appointed!/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/🛡️ Vikram Sharma/i)).toBeInTheDocument()
    expect(toastMocks.success).not.toHaveBeenCalled()

    // Dismiss celebration popup
    const continueCelebrationBtn = screen.getByRole("button", {
      name: /continue/i,
    })
    await user.click(continueCelebrationBtn)
    expect(
      screen.queryByRole("dialog", { name: /nominee appointed!/i }),
    ).not.toBeInTheDocument()

    // Updated nominee card should now be rendered
    expect(screen.getByText("Vikram Sharma")).toBeVisible()
  })

  it("does not render Export & Erasure in privacy tabs (moved to profile security & data)", () => {
    render(<PrivacyExperience user={mockUser} />)

    expect(
      screen.queryByRole("button", { name: /export & erasure/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Download My Data Archive/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Danger Zone: Permanent Account Erasure/i),
    ).not.toBeInTheDocument()
  })

  it("copies the privacy email to clipboard when clicking copy in footer", async () => {
    render(<PrivacyExperience user={mockUser} />)

    const copyBtn = screen.getByRole("button", {
      name: /privacy@traketo\.com/i,
    })
    copyBtn.click()

    expect(writeTextMock).toHaveBeenCalledWith("privacy@traketo.com")
  })

  it("renders back button with the resolved back href", () => {
    render(<PrivacyExperience user={mockUser} />)

    const backButton = screen.getByLabelText("Back")
    expect(backButton).toBeVisible()
    expect(backButton).toHaveAttribute("href", "/profile")
  })
})
