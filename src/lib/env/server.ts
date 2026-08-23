import "server-only"

import { serverEnvSchema, type ServerEnv } from "./schema"

let cachedEnv: ServerEnv | undefined

export function readServerEnv(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  if (source === process.env && cachedEnv) {
    return cachedEnv
  }

  const parsed = serverEnvSchema.parse(source)

  if (source === process.env) {
    cachedEnv = parsed
  }

  return parsed
}
