import "server-only"

import { readServerEnv } from "@/lib/env/server"
import { googleAuthEnvFromServerEnv } from "@/lib/env/schema"

export function isGoogleAuthConfigured() {
  return googleAuthEnvFromServerEnv(readServerEnv()) !== null
}
