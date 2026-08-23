type PostgreSQLError = Readonly<{
  cause?: unknown
  code?: unknown
  constraint_name?: unknown
}>

export function isUniqueViolation(
  error: unknown,
  constraintName: string,
): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const databaseError = error as PostgreSQLError

  if (
    databaseError.code === "23505" &&
    databaseError.constraint_name === constraintName
  ) {
    return true
  }

  return databaseError.cause !== error
    ? isUniqueViolation(databaseError.cause, constraintName)
    : false
}
