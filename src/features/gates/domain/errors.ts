export type GateServiceErrorCode =
  "CONFLICT" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR"

export class GateServiceError extends Error {
  readonly code: GateServiceErrorCode

  constructor(code: GateServiceErrorCode, message: string) {
    super(message)
    this.name = "GateServiceError"
    this.code = code
  }
}
