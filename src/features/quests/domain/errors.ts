export type QuestServiceErrorCode =
  "CONFLICT" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR"

export class QuestServiceError extends Error {
  readonly code: QuestServiceErrorCode

  constructor(code: QuestServiceErrorCode, message: string) {
    super(message)
    this.name = "QuestServiceError"
    this.code = code
  }
}
