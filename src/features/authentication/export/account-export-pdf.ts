import "server-only"

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib"

import type { AccountExportPayload } from "@/features/authentication/export/account-export-service"

const pageWidth = 595.28
const pageHeight = 841.89
const margin = 46
const contentWidth = pageWidth - margin * 2
const navy = rgb(0.06, 0.14, 0.25)
const muted = rgb(0.36, 0.43, 0.55)
const blue = rgb(0.18, 0.42, 0.93)
const paleBlue = rgb(0.92, 0.95, 1)
const rule = rgb(0.86, 0.89, 0.95)

type PdfState = {
  body: PDFFont
  bold: PDFFont
  document: PDFDocument
  page: PDFPage
  y: number
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function array(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function ascii(value: unknown): string {
  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string"
        ? value
        : value === null || value === undefined
          ? "Not set"
          : String(value)

  return text
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201c", '"')
    .replaceAll("\u201d", '"')
    .replaceAll("\u2013", "-")
    .replaceAll("\u2014", "-")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/gu, "?")
}

function labelFor(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^\w/u, (letter) => letter.toUpperCase())
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = ascii(text).split(/\s+/u)
  const lines: string[] = []
  let line = ""

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = word
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : [""]
}

function addPage(state: PdfState) {
  state.page = state.document.addPage([pageWidth, pageHeight])
  state.page.drawRectangle({
    color: rgb(0.975, 0.982, 1),
    height: pageHeight,
    width: pageWidth,
    x: 0,
    y: 0,
  })
  state.page.drawRectangle({
    color: blue,
    height: 5,
    width: pageWidth,
    x: 0,
    y: pageHeight - 5,
  })
  state.page.drawText("TRAKETO", {
    color: blue,
    font: state.bold,
    size: 9,
    x: margin,
    y: pageHeight - 29,
  })
  state.y = pageHeight - 52
}

function ensureSpace(state: PdfState, height: number) {
  if (state.y - height < 52) addPage(state)
}

function drawWrapped(
  state: PdfState,
  text: string,
  options: {
    color?: ReturnType<typeof rgb>
    font?: PDFFont
    gap?: number
    maxWidth?: number
    size?: number
    x?: number
  } = {},
) {
  const font = options.font ?? state.body
  const size = options.size ?? 9
  const gap = options.gap ?? size * 1.38
  const x = options.x ?? margin
  const lines = wrap(text, font, size, options.maxWidth ?? contentWidth)
  ensureSpace(state, lines.length * gap)
  for (const line of lines) {
    state.page.drawText(line, {
      color: options.color ?? navy,
      font,
      size,
      x,
      y: state.y,
    })
    state.y -= gap
  }
}

function drawSectionTitle(state: PdfState, title: string, count?: number) {
  ensureSpace(state, 42)
  state.y -= 10
  state.page.drawText(title.toUpperCase(), {
    color: blue,
    font: state.bold,
    size: 9,
    x: margin,
    y: state.y,
  })
  if (count !== undefined) {
    const countText = `${count} record${count === 1 ? "" : "s"}`
    state.page.drawText(countText, {
      color: muted,
      font: state.body,
      size: 8,
      x: pageWidth - margin - state.body.widthOfTextAtSize(countText, 8),
      y: state.y,
    })
  }
  state.y -= 12
  state.page.drawLine({
    color: rule,
    end: { x: pageWidth - margin, y: state.y },
    start: { x: margin, y: state.y },
    thickness: 0.8,
  })
  state.y -= 17
}

function summaryValue(value: unknown): string {
  if (value === null || value === undefined) return "Not set"
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return `${value.length} items`
  if (typeof value === "object") return "Included"
  return ascii(value)
}

function drawRecord(state: PdfState, value: unknown, index: number) {
  const item = record(value)
  if (!item) {
    drawWrapped(state, `${index + 1}. ${summaryValue(value)}`, {
      color: muted,
      size: 8,
    })
    state.y -= 6
    return
  }

  const headline =
    item.title ??
    item.name ??
    item.subject ??
    item.displayName ??
    item.eventType ??
    item.reason ??
    `Record ${index + 1}`
  ensureSpace(state, 48)
  drawWrapped(state, ascii(headline), {
    font: state.bold,
    maxWidth: contentWidth - 24,
    size: 9,
    x: margin + 12,
  })

  const details = Object.entries(item)
    .filter(
      ([key]) => !["title", "name", "subject", "displayName"].includes(key),
    )
    .map(([key, entry]) => `${labelFor(key)}: ${summaryValue(entry)}`)
    .join("  |  ")
  drawWrapped(state, details || "No additional details", {
    color: muted,
    maxWidth: contentWidth - 24,
    size: 7.5,
    x: margin + 12,
  })
  state.y -= 8
}

export async function buildAccountExportPdf(
  payload: AccountExportPayload,
): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const body = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const state: PdfState = {
    body,
    bold,
    document,
    page: document.addPage([pageWidth, pageHeight]),
    y: 0,
  }
  document.removePage(0)
  addPage(state)

  state.page.drawRectangle({
    color: paleBlue,
    height: 124,
    width: contentWidth,
    x: margin,
    y: state.y - 106,
  })
  drawWrapped(state, "PERSONAL DATA EXPORT", {
    color: blue,
    font: bold,
    size: 9,
    x: margin + 18,
  })
  state.y -= 5
  drawWrapped(state, "Your Traketo archive", {
    font: bold,
    maxWidth: contentWidth - 36,
    size: 25,
    x: margin + 18,
  })
  drawWrapped(
    state,
    "A readable snapshot of your account, workspace, tasks, focus history, reminders, and progression.",
    {
      color: muted,
      maxWidth: contentWidth - 36,
      size: 9,
      x: margin + 18,
    },
  )
  state.y -= 28

  const account = record(payload.account) ?? {}
  const workspace = record(payload.workspace) ?? {}
  drawSectionTitle(state, "Export details")
  drawWrapped(state, `Account: ${summaryValue(account.name)}`, {
    font: bold,
    size: 10,
  })
  drawWrapped(state, `Email: ${summaryValue(account.email)}`, {
    color: muted,
    size: 8.5,
  })
  drawWrapped(state, `Workspace: ${summaryValue(workspace.name)}`, {
    color: muted,
    size: 8.5,
  })
  drawWrapped(state, `Timezone: ${summaryValue(workspace.timezone)}`, {
    color: muted,
    size: 8.5,
  })
  drawWrapped(state, `Exported: ${summaryValue(account.exportedAt)}`, {
    color: muted,
    size: 8.5,
  })
  state.y -= 8

  const sectionLabels: readonly [string, string][] = [
    ["tasks", "Tasks"],
    ["gates", "Lists"],
    ["labels", "Labels"],
    ["reminders", "Reminders"],
    ["timerSessions", "Focus sessions"],
    ["groupStudyParticipations", "Group study participation"],
    ["attachments", "Attachments"],
    ["activityEvents", "Activity"],
    ["xpLedger", "Progression ledger"],
    ["taskLabels", "Task label links"],
  ]

  drawSectionTitle(state, "Archive overview")
  for (const [key, label] of sectionLabels) {
    drawWrapped(state, `${label}: ${array(payload[key]).length}`, {
      color: navy,
      size: 9,
    })
  }

  const progression = record(payload.progression)
  if (progression) {
    drawSectionTitle(state, "Progression")
    drawRecord(state, progression, 0)
  }

  for (const [key, label] of sectionLabels) {
    const rows = array(payload[key])
    drawSectionTitle(state, label, rows.length)
    if (rows.length === 0) {
      drawWrapped(state, "No records in this section.", {
        color: muted,
        size: 8,
      })
      continue
    }
    rows.forEach((item, index) => drawRecord(state, item, index))
  }

  const pages = document.getPages()
  pages.forEach((page, index) => {
    const footer = `Private export  |  Page ${index + 1} of ${pages.length}`
    page.drawLine({
      color: rule,
      end: { x: pageWidth - margin, y: 38 },
      start: { x: margin, y: 38 },
      thickness: 0.6,
    })
    page.drawText(footer, {
      color: muted,
      font: body,
      size: 7,
      x: margin,
      y: 24,
    })
  })

  document.setAuthor("Traketo")
  document.setCreator("Traketo")
  document.setSubject("Personal account data export")
  document.setTitle("Traketo personal data export")

  return document.save({ useObjectStreams: true })
}
