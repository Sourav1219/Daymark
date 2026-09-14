import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { maximumProfilePhotoSourceBytes } from "@/features/authentication/profile-photo/constants"
import { deleteProfilePhotoAction } from "@/features/authentication/application/profile-photo-actions"
import { ProfilePhotoEditor } from "./profile-photo-editor"

vi.mock("@/features/authentication/application/profile-photo-actions", () => ({
  deleteProfilePhotoAction: vi.fn(),
  updateProfilePhotoAction: vi.fn(),
}))

describe("ProfilePhotoEditor", () => {
  it("opens an accessible editor with format and size guidance", async () => {
    const user = userEvent.setup()
    render(
      <ProfilePhotoEditor
        currentPhotoUrl={null}
        name="Ada Lovelace"
        onUpdated={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Add profile photo" }))

    expect(
      screen.getByRole("dialog", { name: "Frame it your way" }),
    ).toBeVisible()
    expect(screen.getByText(/JPEG, PNG, or WebP · up to 8 MiB/i)).toBeVisible()
    expect(screen.getByRole("button", { name: "Save photo" })).toBeDisabled()
  })

  it("rejects oversized source images before decoding them", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ProfilePhotoEditor
        currentPhotoUrl={null}
        name="Ada Lovelace"
        onUpdated={vi.fn()}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Add profile photo" }))

    const input =
      container.ownerDocument.querySelector<HTMLInputElement>(
        'input[type="file"]',
      )
    expect(input).not.toBeNull()
    await user.upload(
      input!,
      new File(
        [new Uint8Array(maximumProfilePhotoSourceBytes + 1)],
        "large.png",
        { type: "image/png" },
      ),
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose an image no larger than 8 MiB.",
    )
  })

  it("removes the current photo with one deliberate click", async () => {
    const user = userEvent.setup()
    const onUpdated = vi.fn()
    vi.mocked(deleteProfilePhotoAction).mockResolvedValue({
      data: { photoUrl: null },
      ok: true,
    })
    render(
      <ProfilePhotoEditor
        currentPhotoUrl="/api/profile/photo?v=1"
        name="Ada Lovelace"
        onUpdated={onUpdated}
      />,
    )
    await user.click(
      screen.getByRole("button", { name: "Change profile photo" }),
    )
    await user.click(screen.getByRole("button", { name: "Remove photo" }))

    expect(deleteProfilePhotoAction).toHaveBeenCalledOnce()
    expect(onUpdated).toHaveBeenCalledWith(null)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
