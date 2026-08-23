import "server-only"

import { randomUUID } from "node:crypto"

import { headers } from "next/headers"

const requestIdHeader = "x-request-id"
const requestIdPattern = /^[\w.-]{8,128}$/u

/**
 * Resolves the correlation id for the current request. The proxy stamps every
 * navigation and Server Action request with `x-request-id`; when absent (cron
 * jobs, route handlers invoked directly) a fresh id is generated so every log
 * line and incident message can be correlated end to end.
 */
export async function resolveRequestId(): Promise<string> {
  const incoming = (await headers()).get(requestIdHeader)
  if (incoming && requestIdPattern.test(incoming)) {
    return incoming
  }
  return `req_${randomUUID()}`
}

export function newRequestId(): string {
  return `req_${randomUUID()}`
}
