import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TermsExperience } from "./terms-experience"

const backHrefState = vi.hoisted(() => ({ href: "/profile" }))

vi.mock("@/components/legal/legal-shell-context", () => ({
  useLegalBackHref: () => backHrefState.href,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}))

describe("TermsExperience", () => {
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

  it("renders the page title and core agreement pillars", () => {
    render(<TermsExperience />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of Service" }),
    ).toBeVisible()
    expect(
      screen.getByRole("region", { name: "Core agreement principles" }),
    ).toBeVisible()
    expect(screen.getByText("You own your work")).toBeVisible()
    expect(screen.getByText("Fair & safe conduct")).toBeVisible()
    expect(screen.getByText("Zero lock-in")).toBeVisible()
  })

  it("renders all 13 terms clauses with numbers 01 to 13 initially", () => {
    const { container } = render(<TermsExperience />)

    const cards = container.querySelectorAll(".terms-clause-card")
    expect(cards).toHaveLength(13)

    expect(screen.getByText("Agreement and operator")).toBeVisible()
    expect(screen.getByText("Eligibility")).toBeVisible()
    expect(screen.getByText("Your account")).toBeVisible()
    expect(screen.getByText("The service")).toBeVisible()
    expect(screen.getByText("Your content")).toBeVisible()
    expect(screen.getByText("Acceptable use")).toBeVisible()
    expect(screen.getByText("Shared features and attachments")).toBeVisible()
    expect(screen.getByText("Third-party services")).toBeVisible()
    expect(screen.getByText("Availability and changes")).toBeVisible()
    expect(screen.getByText("Suspension and termination")).toBeVisible()
    expect(screen.getByText("Disclaimers and liability")).toBeVisible()
    expect(screen.getByText("Governing law and disputes")).toBeVisible()
    expect(screen.getByText("Changes and general terms")).toBeVisible()
  })

  it("filters clauses when clicking category tabs", async () => {
    const user = userEvent.setup()
    const { container } = render(<TermsExperience />)

    // Click "Content & Conduct (3)"
    const contentTab = screen.getByRole("tab", {
      name: /content & conduct/i,
    })
    await user.click(contentTab)

    let cards = container.querySelectorAll(".terms-clause-card")
    expect(cards).toHaveLength(3)
    expect(screen.getByText("Your content")).toBeVisible()
    expect(screen.getByText("Acceptable use")).toBeVisible()
    expect(screen.getByText("Shared features and attachments")).toBeVisible()
    expect(screen.queryByText("Agreement and operator")).not.toBeInTheDocument()

    // Click "All (13)"
    const allTab = screen.getByRole("tab", { name: /all \(13\)/i })
    await user.click(allTab)

    cards = container.querySelectorAll(".terms-clause-card")
    expect(cards).toHaveLength(13)
    expect(screen.getByText("Agreement and operator")).toBeVisible()
  })

  it("copies the legal email to clipboard when clicking 'Copy email'", async () => {
    render(<TermsExperience />)

    const copyBtn = screen.getByRole("button", { name: /copy email/i })
    copyBtn.click()

    expect(writeTextMock).toHaveBeenCalledWith("privacy@traketo.com")
    expect(await screen.findByRole("button", { name: /copied/i })).toBeVisible()
  })

  it("renders back button with the resolved back href", () => {
    render(<TermsExperience />)

    const backButton = screen.getByLabelText("Back")
    expect(backButton).toBeVisible()
    expect(backButton).toHaveAttribute("href", "/profile")
  })
})
