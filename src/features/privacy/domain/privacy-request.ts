export const privacyRequestTypes = [
  "access",
  "correction",
  "erasure",
  "portability",
  "objection",
  "grievance",
] as const

export type PrivacyRequestType = (typeof privacyRequestTypes)[number]
export type PrivacyRequestStatus = "submitted" | "review" | "completed"

export const privacyRequestTypeLabels: Record<PrivacyRequestType, string> = {
  access: "Access & Summary",
  correction: "Correction & Rectification",
  erasure: "Account & Data Erasure",
  grievance: "Grievance Redressal",
  objection: "Restriction / Objection",
  portability: "Data Portability (Machine-Readable)",
}

export type PrivacyRequestView = Readonly<{
  createdAt: string
  details: string
  id: string
  status: PrivacyRequestStatus
  ticketNumber: string
  type: string
}>
