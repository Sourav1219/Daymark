import type { ActionErrorCode } from "@/lib/actions/action-result"

export class TimerServiceError extends Error {
  constructor(
    public readonly code: ActionErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "TimerServiceError"
  }
}
