// @vitest-environment node

import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"

import { buildAccountExportPdf } from "./account-export-pdf"

describe("buildAccountExportPdf", () => {
  it("creates a readable multi-section companion to the JSON archive", async () => {
    const pdf = await buildAccountExportPdf({
      exportMetadata: {
        contentNotes: [
          "Attachment metadata is included, but binary files are not embedded.",
        ],
        exportedAt: new Date("2026-09-10T17:30:00.000Z"),
      },
      account: {
        email: "ada@example.com",
        name: "Ada Lovelace",
      },
      workspaces: [
        {
          kind: "personal",
          name: "Ada’s workspace",
          ownedByAccount: true,
          role: "owner",
          timezone: "Asia/Kolkata",
        },
      ],
      sessions: [
        {
          createdAt: new Date("2026-09-10T15:00:00.000Z"),
          isCurrent: true,
          userAgent: "Chrome on macOS",
        },
      ],
      tasks: [
        {
          dueAt: new Date("2026-09-12T12:00:00.000Z"),
          priority: "high",
          status: "open",
          title: "Prepare project brief",
        },
      ],
      gates: [],
      labels: [],
      reminders: [],
      focusSessions: [],
      sharedGroups: [
        {
          hostedByAccount: true,
          joinCodeIncluded: false,
          name: "Study room",
          status: "closed",
          subject: "Algorithms",
        },
      ],
      sharedGroupParticipations: [],
      sharedGroupActivity: [],
      consentHistory: [
        {
          action: "accepted",
          occurredAt: new Date("2026-08-24T10:00:00.000Z"),
          type: "terms_of_service",
          version: "2026-08",
        },
      ],
      progression: [],
      attachments: [],
      activityEvents: [],
      xpLedger: [],
      taskLabels: [],
      sharingInformation: {
        sharedGroupBlocks: [],
        sharedGroupJoinRequests: [],
        workspaceMemberships: [
          {
            role: "owner",
            workspaceKind: "personal",
            workspaceName: "Ada’s workspace",
          },
        ],
      },
      securityExclusions: [
        {
          category: "Authentication secrets",
          details:
            "Passwords, session tokens, OAuth tokens, and two-factor secrets are never exported.",
        },
      ],
    })

    expect(Buffer.from(pdf).subarray(0, 4).toString("ascii")).toBe("%PDF")
    const document = await PDFDocument.load(pdf)
    expect(document.getPageCount()).toBeGreaterThanOrEqual(2)

    const outputPath = process.env.ACCOUNT_EXPORT_PDF_OUTPUT
    if (outputPath) {
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, pdf)
    }
  })
})
