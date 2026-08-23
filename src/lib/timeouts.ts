import "server-only"

export class OperationTimeoutError extends Error {
  readonly code = "OPERATION_TIMEOUT"

  constructor(label: string, milliseconds: number) {
    super(`${label} did not complete within ${milliseconds} ms.`)
    this.name = "OperationTimeoutError"
  }
}

/**
 * Applies an application-level deadline to an external operation so a slow
 * provider can never hold a user action or cron execution until the platform
 * kills it. The underlying work is not cancelled; the caller simply stops
 * waiting and may persist retry state.
 */
export async function withDeadline<T>(
  operation: Promise<T>,
  milliseconds: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new OperationTimeoutError(label, milliseconds)),
      milliseconds,
    )
  })

  try {
    return await Promise.race([operation, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
