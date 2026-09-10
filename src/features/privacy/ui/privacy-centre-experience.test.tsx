import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  PrivacyCentreExperience,
  type PrivacyCentreUser,
} from "./privacy-centre-experience"

const mockUser: PrivacyCentreUser = {
  createdAt: "2026-08-01T10:00:00.000Z",
  email: "testuser@example.com",
  emailVerified: true,
  hasPassword: true,
  id: "user-1234-uuid",
  name: "Test User",
  timezone: "Asia/Kolkata",
  workspaceName: "My Workspace",
}

const { mockExportAccountDataAction, mockSubmitPrivacyRequestAction } =
  vi.hoisted(() => ({
    mockExportAccountDataAction: vi.fn(),
    mockSubmitPrivacyRequestAction: vi.fn(),
  }))

vi.mock(
  "@/features/authentication/application/account-security-actions",
  () => ({
    deleteAccountAction: vi.fn(),
    exportAccountDataAction: () => mockExportAccountDataAction(),
  }),
)

vi.mock("@/features/privacy/application/cookie-consent-actions", () => ({
  saveCookieConsentAction: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock("@/features/privacy/application/privacy-request-actions", () => ({
  submitPrivacyRequestAction: (previousState: unknown, formData: FormData) =>
    mockSubmitPrivacyRequestAction(previousState, formData),
}))

vi.mock("@/features/offline/storage/offline-database", () => ({
  clearPrivateOfflineData: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}))

describe("PrivacyCentreExperience", () => {
  let writeTextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSubmitPrivacyRequestAction.mockImplementation(
      (_previousState: unknown, formData: FormData) =>
        Promise.resolve({
          data: {
            request: {
              createdAt: "2026-09-11T00:00:00.000Z",
              details: String(formData.get("details")),
              id: "request-1",
              status: "submitted",
              ticketNumber: "PR-2026-TEST0001",
              type: "Access & Summary",
            },
          },
          ok: true,
        }),
    )
    writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    })
  })

  it("renders page hero, status chip, and initial Data Inventory with lawful bases", () => {
    render(<PrivacyCentreExperience user={mockUser} />)

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Privacy & Data Centre",
      }),
    ).toBeVisible()
    expect(screen.getByText("Active & Regulated")).toBeVisible()
    expect(
      screen.getByText(/Personal Data Inventory & Lawful Bases/i),
    ).toBeVisible()

    // 5 inventory categories
    expect(screen.getByText(/1. Identity & Account Credentials/i)).toBeVisible()
    expect(
      screen.getByText(/2. Habits, Quests & Progression Data/i),
    ).toBeVisible()
    expect(screen.getByText(/3. Shared Study & Collaboration/i)).toBeVisible()
    expect(
      screen.getByText(/4. Device, Telemetry & Offline Cache/i),
    ).toBeVisible()
    expect(screen.getByText(/5. Security & Audit Logs/i)).toBeVisible()

    // Lawful bases
    expect(
      screen.getAllByText(/Contractual Necessity/i).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText(/Explicit Consent/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Legitimate Interest/i).length).toBeGreaterThan(
      0,
    )
  })

  it("switches to Consent & Ledger tab, displays hub link, and shows explicit consent given timestamps without live toggle cards", async () => {
    const user = userEvent.setup()
    render(<PrivacyCentreExperience user={mockUser} />)

    const consentTab = screen.getByRole("button", { name: /consent & ledger/i })
    await user.click(consentTab)

    expect(
      screen.getByText(/Granular Consent Controls & Regulatory Ledger/i),
    ).toBeVisible()
    expect(screen.getByText(/Consent Audit Trail & Ledger/i)).toBeVisible()

    // Hub callout should point to profile settings
    expect(screen.getByText(/Active Account Consent Controls/i)).toBeVisible()
    expect(
      screen.getByRole("link", { name: /manage in profile settings/i }),
    ).toHaveAttribute("href", "/profile")

    // The interactive toggle cards should NOT be here in Privacy Centre
    expect(
      screen.queryByText("Optional Preferences Storage"),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/toggle optional preferences storage/i),
    ).not.toBeInTheDocument()

    // Consent given timestamps should be prominently listed in the ledger
    expect(screen.getAllByText(/Consent given:/i).length).toBeGreaterThan(0)
    expect(screen.getByText("Aug 24, 2026 · 09:18 AM")).toBeVisible()
    expect(screen.getByText("Aug 24, 2026 · 10:04 AM")).toBeVisible()
  })

  it("submits a new privacy request and adds it to the tracking list", async () => {
    const user = userEvent.setup()
    render(<PrivacyCentreExperience user={mockUser} />)

    const rightsTab = screen.getByRole("button", { name: /rights desk/i })
    await user.click(rightsTab)

    expect(screen.getByText(/Statutory Privacy Rights Desk/i)).toBeVisible()

    const textarea = screen.getByPlaceholderText(
      /Please describe the specific data or processing concern/i,
    )
    await user.type(textarea, "Please provide complete logs of my activity.")

    const submitBtn = screen.getByRole("button", {
      name: /submit formal request/i,
    })
    await user.click(submitBtn)

    // Should see new request with details
    expect(
      await screen.findByText("Please provide complete logs of my activity."),
    ).toBeVisible()
  })

  it("displays digital nominee details and allows editing nominee", async () => {
    const user = userEvent.setup()
    render(<PrivacyCentreExperience user={mockUser} />)

    const nomineeTab = screen.getByRole("button", { name: /digital nominee/i })
    await user.click(nomineeTab)

    expect(screen.getByText(/Digital Nominee Designation/i)).toBeVisible()
    expect(screen.getByText("Ananya Sharma")).toBeVisible()

    const editBtn = screen.getByRole("button", {
      name: /edit nominee details/i,
    })
    await user.click(editBtn)

    expect(screen.getByLabelText(/nominee full name/i)).toBeVisible()
    expect(
      screen.getByRole("button", { name: /save nominee designation/i }),
    ).toBeVisible()
  })

  it("does not render Export & Erasure tab (relocated to profile security & data)", () => {
    render(<PrivacyCentreExperience user={mockUser} />)

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

  it("copies the privacy email to clipboard", async () => {
    render(<PrivacyCentreExperience user={mockUser} />)

    const copyBtn = screen.getByRole("button", {
      name: /privacy@traketo\.com/i,
    })
    copyBtn.click()

    expect(writeTextMock).toHaveBeenCalledWith("privacy@traketo.com")
  })
})
