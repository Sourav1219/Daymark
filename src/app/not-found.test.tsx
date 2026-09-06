import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import NotFound from "./not-found"

describe("NotFound", () => {
  it("renders the 404 heading and navigation actions", () => {
    render(<NotFound />)

    expect(
      screen.getByRole("heading", { name: /We can’t find that page/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("404 · Not Found")).toBeInTheDocument()
    expect(screen.getByText("404 · Page Not Found")).toBeInTheDocument()

    const tasksLink = screen.getByRole("link", {
      name: /Back to your tasks/i,
    })
    expect(tasksLink).toBeInTheDocument()
    expect(tasksLink).toHaveAttribute("href", "/today")

    const homeLink = screen.getByRole("link", {
      name: /Back to homepage/i,
    })
    expect(homeLink).toBeInTheDocument()
    expect(homeLink).toHaveAttribute("href", "/")

    const supportLink = screen.getByRole("link", {
      name: /Contact support/i,
    })
    expect(supportLink).toBeInTheDocument()
    expect(supportLink).toHaveAttribute("href", "/contact")
  })
})
