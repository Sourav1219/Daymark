import "server-only"

import { lookup as dnsLookup } from "node:dns/promises"
import type { LookupAddress } from "node:dns"
import { Agent } from "node:https"
import { isIP, type LookupFunction } from "node:net"

import { withDeadline } from "@/lib/timeouts"

/** Application-level deadline for the single endpoint DNS resolution. */
const dnsDeadlineMilliseconds = 5_000

const trustedPushEndpointOrigins = new Set([
  "https://fcm.googleapis.com",
  "https://updates.push.services.mozilla.com",
  "https://web.push.apple.com",
])

export class UnsafePushEndpointError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsafePushEndpointError"
  }
}

function parseIpv4(
  address: string,
): readonly [number, number, number, number] | null {
  const parts = address.split(".")
  if (parts.length !== 4) return null

  const octets = parts.map((part) => Number(part))
  if (
    !parts.every((part, index) => {
      const octet = octets[index] ?? Number.NaN
      return (
        Number.isInteger(octet) &&
        octet >= 0 &&
        octet <= 255 &&
        String(octet) === part
      )
    })
  ) {
    return null
  }

  const [
    first = Number.NaN,
    second = Number.NaN,
    third = Number.NaN,
    fourth = Number.NaN,
  ] = octets
  return [first, second, third, fourth]
}

function isPublicIpv4(address: string): boolean {
  const octets = parseIpv4(address)
  if (!octets) return false

  const [first, second, third] = octets
  if (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 &&
      (second === 0 || second === 168 || (second === 88 && third === 99))) ||
    (first === 198 && (second === 18 || second === 19 || second === 51)) ||
    (first === 203 && second === 0 && third === 113)
  ) {
    return false
  }

  return true
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  if (normalized === "::" || normalized === "::1") return false
  if (normalized.startsWith("::ffff:")) {
    return isPublicIpv4(normalized.slice("::ffff:".length))
  }
  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return false
  }

  return true
}

export function isPublicPushEndpointAddress(address: string): boolean {
  switch (isIP(address)) {
    case 4:
      return isPublicIpv4(address)
    case 6:
      return isPublicIpv6(address)
    default:
      return false
  }
}

export function parseTrustedPushEndpoint(endpoint: string): URL {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new UnsafePushEndpointError("The push endpoint is malformed.")
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !trustedPushEndpointOrigins.has(url.origin)
  ) {
    throw new UnsafePushEndpointError(
      "The push endpoint is not from a trusted browser push service.",
    )
  }

  return url
}

function unsafeLookupError(): NodeJS.ErrnoException {
  return Object.assign(
    new UnsafePushEndpointError(
      "The push endpoint resolved to a non-public network address.",
    ),
    { code: "EHOSTUNREACH" },
  )
}

function pinnedLookup(
  expectedHostname: string,
  addresses: readonly LookupAddress[],
): LookupFunction {
  return (hostname, options, callback) => {
    if (hostname !== expectedHostname) {
      callback(unsafeLookupError(), "")
      return
    }

    const candidates = options.family
      ? addresses.filter((address) => address.family === options.family)
      : addresses
    if (candidates.length === 0) {
      callback(unsafeLookupError(), "")
      return
    }

    if (options.all) {
      callback(null, [...candidates])
      return
    }

    const address = candidates[0]
    if (!address) {
      callback(unsafeLookupError(), "")
      return
    }
    callback(null, address.address, address.family)
  }
}

/**
 * Resolves an allow-listed browser push endpoint once, rejects every
 * non-public answer, then pins the HTTPS request to those approved addresses.
 */
export async function createTrustedPushAgent(endpoint: string) {
  const url = parseTrustedPushEndpoint(endpoint)
  const addresses = await withDeadline(
    dnsLookup(url.hostname, { all: true, verbatim: true }),
    dnsDeadlineMilliseconds,
    "Push endpoint DNS resolution",
  )

  if (
    addresses.length === 0 ||
    addresses.some((address) => !isPublicPushEndpointAddress(address.address))
  ) {
    throw unsafeLookupError()
  }

  return new Agent({
    keepAlive: false,
    lookup: pinnedLookup(url.hostname, addresses),
  })
}
