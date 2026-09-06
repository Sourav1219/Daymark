import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TodayPromo } from "@/features/today/components/today-promo"

const { claimTodayPromoAction } = vi.hoisted(() => ({
  claimTodayPromoAction: vi.fn(),
}))

vi.mock("@/features/today/application/today-promo-actions", () => ({
  claimTodayPromoAction,
}))

describe("TodayPromo", () => {
  beforeEach(() => {
    claimTodayPromoAction.mockReset()
  })

  it("shows a claimed daily promo and lets the user dismiss it", async () => {
    claimTodayPromoAction.mockResolvedValue(true)
    render(<TodayPromo />)

    expect(screen.queryByText("Keep your streak alive")).not.toBeInTheDocument()
    expect(await screen.findByText("Keep your streak alive")).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.queryByText("Keep your streak alive")).not.toBeInTheDocument()
  })

  it("stays hidden when today's display was already claimed", async () => {
    claimTodayPromoAction.mockResolvedValue(false)
    render(<TodayPromo />)

    await waitFor(() => expect(claimTodayPromoAction).toHaveBeenCalledOnce())
    expect(screen.queryByText("Keep your streak alive")).not.toBeInTheDocument()
  })
})
