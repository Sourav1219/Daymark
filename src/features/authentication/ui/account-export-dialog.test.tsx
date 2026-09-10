import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AccountExportDialog } from "./account-export-dialog"

const mocks = vi.hoisted(() => ({
  exportAccountDataAction: vi.fn(),
}))

vi.mock(
  "@/features/authentication/application/account-security-actions",
  () => ({
    exportAccountDataAction: mocks.exportAccountDataAction,
  }),
)

const successfulExport = {
  data: {
    json: {
      base64: btoa('{"account":{"name":"Ada"}}'),
      filename: "traketo-export-2026-09-10.json",
      mimeType: "application/json" as const,
    },
    pdf: {
      base64: btoa("pdf-content"),
      filename: "traketo-export-2026-09-10.pdf",
      mimeType: "application/pdf" as const,
    },
    summary: {
      consentRecords: 4,
      sessions: 2,
      sharedGroups: 1,
      tasks: 12,
      workspaces: 2,
    },
  },
  ok: true as const,
}

describe("AccountExportDialog", () => {
  beforeEach(() => {
    mocks.exportAccountDataAction.mockReset()
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:account-export"),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it("requires one confirmation and shows progress before the JSON download", async () => {
    let finishExport: ((value: typeof successfulExport) => void) | undefined
    mocks.exportAccountDataAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishExport = resolve
        }),
    )
    const user = userEvent.setup()
    render(<AccountExportDialog />)

    await user.click(screen.getByRole("button", { name: "Request export" }))

    expect(
      screen.getByRole("heading", { name: "Prepare your data export?" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Authentication secrets")).toBeInTheDocument()
    expect(mocks.exportAccountDataAction).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Prepare export" }))

    expect(mocks.exportAccountDataAction).toHaveBeenCalledOnce()
    expect(mocks.exportAccountDataAction).toHaveBeenCalledWith({
      includePdf: false,
    })
    expect(
      screen.getByRole("progressbar", { name: "Export progress" }),
    ).toBeInTheDocument()

    finishExport?.(successfulExport)

    expect(
      await screen.findByRole("heading", {
        name: "Your private archive is ready",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Download JSON" }),
    ).toBeInTheDocument()
  })

  it("creates the optional PDF when selected", async () => {
    mocks.exportAccountDataAction.mockResolvedValue(successfulExport)
    const user = userEvent.setup()
    render(<AccountExportDialog />)

    await user.click(screen.getByRole("button", { name: "Request export" }))
    await user.click(screen.getByRole("checkbox", { name: /PDF summary/u }))
    await user.click(screen.getByRole("button", { name: "Prepare export" }))

    expect(
      await screen.findByRole("button", { name: "Download PDF" }),
    ).toBeInTheDocument()
    expect(mocks.exportAccountDataAction).toHaveBeenCalledWith({
      includePdf: true,
    })
  })
})
