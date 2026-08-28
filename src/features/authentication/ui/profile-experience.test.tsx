import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ProfileExperience } from "./profile-experience"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock("@/features/authentication/ui/account-settings-forms", () => ({
  AccountSettingsForms: ({
    onUpdated,
  }: {
    onUpdated: (kind: "name" | "password") => void
  }) => (
    <div>
      Edit account forms
      <button onClick={() => onUpdated("name")} type="button">
        Finish name update
      </button>
    </div>
  ),
}))

vi.mock("@/features/offline/components/offline-logout-button", () => ({
  OfflineLogoutButton: () => <button type="button">Log out</button>,
}))

describe("ProfileExperience", () => {
  it("switches between the profile overview and inline editor", async () => {
    const user = userEvent.setup()

    render(
      <ProfileExperience
        currentSessionId={null}
        initialSessions={[]}
        email="ada@example.com"
        joined="12 August 2026"
        name="Ada Lovelace"
        role="owner"
        workspaceName="Ada's workspace"
      />,
    )

    expect(
      screen.getByRole("heading", { name: "Your profile" }),
    ).toBeInTheDocument()
    expect(screen.getByText("About this account")).toBeInTheDocument()
    expect(screen.getByText("Display name")).toBeInTheDocument()
    expect(screen.getByText("Email address")).toBeInTheDocument()
    for (const emailAddress of screen.getAllByText("ada@example.com")) {
      expect(emailAddress.closest("a")).toBeNull()
    }
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument()
    expect(screen.queryByText("Access")).not.toBeInTheDocument()
    expect(screen.queryByText(/password/iu)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log out" })).toBeVisible()
    expect(
      screen.getByRole("region", { name: "Session controls" }),
    ).toContainElement(screen.getByRole("button", { name: "Log out" }))

    await user.click(screen.getByRole("button", { name: "Edit profile" }))

    expect(screen.getByText("Edit your profile")).toBeInTheDocument()
    expect(screen.getByText("Edit account forms")).toBeInTheDocument()
    expect(screen.queryByText("About this account")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
  })

  it("shows a compact success popup after a profile update", async () => {
    const user = userEvent.setup()

    render(
      <ProfileExperience
        currentSessionId={null}
        initialSessions={[]}
        email="ada@example.com"
        joined="12 August 2026"
        name="Ada Lovelace"
        role="owner"
        workspaceName="Ada's workspace"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Edit profile" }))
    await user.click(screen.getByRole("button", { name: "Finish name update" }))

    expect(screen.getByRole("dialog", { name: "Looking good!" })).toBeVisible()
    expect(screen.getByText("Profile refreshed")).toBeVisible()
  })

  it("replaces the legacy demo hunter placeholder", () => {
    render(
      <ProfileExperience
        currentSessionId={null}
        initialSessions={[]}
        email="demo@example.com"
        joined="12 August 2026"
        name="Demo Hunter"
        role="owner"
        workspaceName="Demo's workspace"
      />,
    )

    expect(screen.getAllByText("Demo User")).not.toHaveLength(0)
    expect(screen.queryByText("Demo Hunter")).not.toBeInTheDocument()
  })
})
