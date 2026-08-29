import "server-only"

import { serverEnvSchema, type ServerEnv } from "./schema"

let cachedEnv: ServerEnv | undefined
let cachedError: Error | undefined

export function readServerEnv(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  // A misconfigured deployment is fatal, so the failure is cached too:
  // otherwise every request re-parses the whole schema before throwing.
  if (source === process.env) {
    if (cachedEnv) return cachedEnv
    if (cachedError) throw cachedError
  }

  const parsed = serverEnvSchema.safeParse(source)

  if (!parsed.success) {
    // A raw ZodError thrown from a route handler is unreadable. Name the
    // offending variables so the misconfiguration is actionable.
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ")
    const error = new Error(`Invalid server environment — ${issues}`)

    if (source === process.env) {
      cachedError = error
    }

    throw error
  }

  if (source === process.env) {
    cachedEnv = parsed.data
  }

  return parsed.data
}
