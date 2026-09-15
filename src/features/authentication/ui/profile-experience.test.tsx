import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ProfileExperience } from "./profile-experience"

const navigation = vi.hoisted(() => ({
  bfcacheId: "profile-entry",
  refresh: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => navigation }))

vi.mock("@/features/authentication/ui/account-settings-forms", () => ({
  AccountSettingsForms: ({
    onUpdated,
  }: {
    onUpdated: (kind: "name") => void
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

vi.mock("@/features/authentication/ui/profile-photo-editor", () => ({
  ProfilePhotoEditor: () => (
    <button aria-label="Add profile photo" type="button">
      Add photo
    </button>
  ),
}))

describe("ProfileExperience", () => {
  beforeEach(() => {
    navigation.bfcacheId = `profile-${crypto.randomUUID()}`
  })

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
      screen.getByRole("button", { name: "Add profile photo" }),
    ).toBeVisible()
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

  it("keeps Report a problem inside the Contact & about dropdown", async () => {
    const user = userEvent.setup()
    const feedbackListener = vi.fn()
    window.addEventListener("traketo:open-feedback", feedbackListener)

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
      screen.queryByRole("heading", { name: "Help & feedback" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Contact support")).not.toBeInTheDocument()

    await user.click(screen.getByText("Contact & about"))

    expect(
      screen.queryByText("App Settings & Preferences"),
    ).not.toBeInTheDocument()

    const reportButton = screen.getByRole("button", {
      name: /Report a problem/u,
    })
    expect(reportButton).toBeVisible()

    await user.click(reportButton)
    expect(feedbackListener).toHaveBeenCalledOnce()

    window.removeEventListener("traketo:open-feedback", feedbackListener)
  })

  it("restores the help dropdown for the same browser history entry", async () => {
    const user = userEvent.setup()
    const historyEntry = navigation.bfcacheId
    const props = {
      currentSessionId: null,
      email: "ada@example.com",
      initialSessions: [],
      joined: "12 August 2026",
      name: "Ada Lovelace",
      role: "owner",
      workspaceName: "Ada's workspace",
    } as const
    const firstRender = render(<ProfileExperience {...props} />)

    await user.click(screen.getByText("Contact & about"))
    expect(
      screen.getByText("Contact & about").closest("details"),
    ).toHaveProperty("open", true)
    firstRender.unmount()

    navigation.bfcacheId = historyEntry
    render(<ProfileExperience {...props} />)

    expect(
      screen.getByText("Contact & about").closest("details"),
    ).toHaveProperty("open", true)
  })

  it("loads security controls only when their dropdown is opened", async () => {
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
      screen.queryByRole("heading", { name: "Active sessions" }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByText("Security & data"))

    expect(
      screen.getByRole("heading", { name: "Active sessions" }),
    ).toBeVisible()
  })
})
