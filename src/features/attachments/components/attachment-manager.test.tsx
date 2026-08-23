import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const actions = vi.hoisted(() => ({
  deleteAttachmentAction: vi.fn(),
  finalizeAttachmentUploadAction: vi.fn(),
  requestAttachmentDownloadAction: vi.fn(),
  requestAttachmentUploadAction: vi.fn(),
}))

vi.mock("@/features/attachments/application/actions", () => actions)

import { AttachmentManager } from "./attachment-manager"

class UploadRequest extends EventTarget {
  static current: UploadRequest | null = null
  readonly upload = new EventTarget()
  status = 0

  constructor() {
    super()
    UploadRequest.current = this
  }

  open() {}
  setRequestHeader() {}
  send() {
    this.upload.dispatchEvent(
      new ProgressEvent("progress", {
        lengthComputable: true,
        loaded: 5,
        total: 10,
      }),
    )
  }
  complete() {
    this.status = 200
    this.dispatchEvent(new Event("load"))
  }
}

describe("AttachmentManager", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    UploadRequest.current = null
    vi.stubGlobal("XMLHttpRequest", UploadRequest)
    actions.requestAttachmentUploadAction.mockResolvedValue({
      data: {
        attachment: {
          byteSize: null,
          contentType: null,
          displayName: "Pending attachment",
          id: "11111111-1111-4111-8111-111111111111",
          status: "pending",
          version: 1,
        },
        expiresAt: "2026-08-09T10:05:00.000Z",
        upload: {
          headers: { "Content-Type": "application/pdf" },
          url: "https://r2.test/signed-upload",
        },
      },
      ok: true,
    })
    actions.finalizeAttachmentUploadAction.mockResolvedValue({
      data: {
        byteSize: 10,
        contentType: "application/pdf",
        displayName: "attachment-ready.pdf",
        id: "11111111-1111-4111-8111-111111111111",
        status: "ready",
        version: 2,
      },
      ok: true,
    })
  })

  it("shows determinate direct-upload progress and verified success", async () => {
    const user = userEvent.setup()
    render(
      <AttachmentManager
        attachments={[]}
        canUpload
        questId="22222222-2222-4222-8222-222222222222"
        storageAvailable
      />,
    )
    const file = new File(["%PDF-data"], "browser-name-is-not-sent.pdf", {
      type: "application/pdf",
    })
    await user.upload(screen.getByLabelText("Add a private file"), file)
    await user.click(screen.getByRole("button", { name: "Upload" }))

    expect(
      await screen.findByRole("progressbar", { name: "Upload progress: 50%" }),
    ).toBeInTheDocument()
    expect(actions.requestAttachmentUploadAction).toHaveBeenCalledWith({
      byteSize: file.size,
      mimeType: "application/pdf",
      questId: "22222222-2222-4222-8222-222222222222",
    })
    expect(
      JSON.stringify(actions.requestAttachmentUploadAction.mock.calls),
    ).not.toContain(file.name)

    await act(async () => UploadRequest.current?.complete())
    expect(await screen.findByText("attachment-ready.pdf")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(
      "attachment-ready.pdf is ready.",
    )
  })

  it("presents an actionable failure for a disallowed file", async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(
      <AttachmentManager
        attachments={[]}
        canUpload
        questId="22222222-2222-4222-8222-222222222222"
        storageAvailable
      />,
    )
    await user.upload(
      screen.getByLabelText("Add a private file"),
      new File(["<svg></svg>"], "unsafe.svg", { type: "image/svg+xml" }),
    )
    await user.click(screen.getByRole("button", { name: "Upload" }))

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a PDF, JPEG, PNG, or WebP no larger than 10 MiB.",
    )
    expect(actions.requestAttachmentUploadAction).not.toHaveBeenCalled()
  })
})
