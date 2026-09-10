export const accountExportIncludedSections = [
  "Account profile, settings, and legal acknowledgements",
  "Tasks, reminders, focus sessions, progression, and activity you own",
  "Workspace details and your membership roles",
  "Active sign-in session metadata",
  "Shared study groups and your participation activity",
  "Consent records, current communication choices, and sharing information",
] as const

export const accountExportSecurityExclusions = [
  {
    category: "Authentication secrets",
    details:
      "Passwords and password hashes, session cookies and tokens, OAuth tokens, two-factor secrets, and recovery codes are never exported.",
  },
  {
    category: "Delivery and invitation secrets",
    details:
      "Push-notification endpoints and encryption keys, service credentials, and shared-group join codes are excluded.",
  },
  {
    category: "Other people’s private data",
    details:
      "Collaborator contact details, private tasks, and content created by other people are not included in your archive.",
  },
  {
    category: "Security defenses",
    details:
      "Internal abuse signals, fraud rules, rate-limit state, and security detection logic are intentionally withheld.",
  },
] as const

export const accountExportContentNotes = [
  "Attachment metadata is included, but the binary attachment files are not embedded in the portable archive.",
  "Browser-only choices are included as a current snapshot when available because their earlier change history is not retained on the server.",
] as const
