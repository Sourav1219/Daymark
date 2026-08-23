export type ActionErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "STORAGE_UNAVAILABLE"
  | "VALIDATION_ERROR"

export type ActionFailure = Readonly<{
  ok: false
  error: Readonly<{
    code: ActionErrorCode
    message: string
    fieldErrors?: Readonly<Record<string, readonly string[]>>
  }>
}>

type ActionSuccess<T> = Readonly<{
  ok: true
  data: T
}>

export type ActionResult<T> = ActionSuccess<T> | ActionFailure
