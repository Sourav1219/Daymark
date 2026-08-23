export type AttachmentServiceErrorCode =
  | "CONFLICT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STORAGE_UNAVAILABLE"
  | "VALIDATION_ERROR"

export class AttachmentServiceError extends Error {
  readonly code: AttachmentServiceErrorCode

  constructor(code: AttachmentServiceErrorCode, message: string) {
    super(message)
    this.name = "AttachmentServiceError"
    this.code = code
  }
}
