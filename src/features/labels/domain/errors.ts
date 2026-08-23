export type LabelServiceErrorCode =
  "CONFLICT" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR"

export class LabelServiceError extends Error {
  readonly code: LabelServiceErrorCode

  constructor(code: LabelServiceErrorCode, message: string) {
    super(message)
    this.name = "LabelServiceError"
    this.code = code
  }
}
