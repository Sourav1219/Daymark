import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TwoFactorChallenge } from "./two-factor-challenge"

const actions = vi.hoisted(() => ({
  verifyTwoFactorAction: vi.fn(),
}))

vi.mock("@/features/authentication/application/actions", () => actions)

describe("TwoFactorChallenge", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("accepts only six digits in authenticator mode", async () => {
    const user = userEvent.setup()
    render(<TwoFactorChallenge nextPath="/quests" />)

    const code = screen.getByLabelText("Authenticator code")
    await user.type(code, "a12-345678")

    expect(code).toHaveValue("123456")
    expect(
      screen.getByRole("button", { name: "Continue securely" }),
    ).toBeEnabled()
  })

  it("switches to case-preserving recovery-code mode", async () => {
    const user = userEvent.setup()
    render(<TwoFactorChallenge />)

    await user.click(
      screen.getByRole("button", { name: "Use a recovery code instead" }),
    )
    const code = screen.getByLabelText("Recovery code")
    await user.type(code, "AbC12-XyZ90")

    expect(code).toHaveValue("AbC12-XyZ90")
    expect(
      screen.getByText(/one of the recovery codes you saved/u),
    ).toBeInTheDocument()
  })
})
