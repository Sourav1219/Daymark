import type { ActionErrorCode } from "@/lib/actions/action-result"

export class ReminderServiceError extends Error {
  constructor(
    readonly code: ActionErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "ReminderServiceError"
  }
}
