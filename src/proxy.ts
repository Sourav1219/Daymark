import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

import { AUTH_COOKIE_PREFIX } from "@/features/authentication/config"

const r2AccountIdPattern = /^[a-f\d]{32}$/iu
// next/image emits style="color:transparent" to prevent an image flash. This
// hash permits only that exact framework-generated style attribute.
const nextImageTransparentStyleHash =
  "'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='"

function r2ConnectSources(accountId: string | undefined) {
  if (!accountId || !r2AccountIdPattern.test(accountId)) return []

  const r2Host = `${accountId}.r2.cloudflarestorage.com`
  return [`https://${r2Host}`, `https://*.${r2Host}`]
}

export function buildContentSecurityPolicy(
  nonce: string,
  options: Readonly<{
    development?: boolean
    r2AccountId?: string
  }> = {},
) {
  const development =
    options.development ?? process.env.NODE_ENV !== "production"
  const r2Sources = r2ConnectSources(
    options.r2AccountId ?? process.env.R2_ACCOUNT_ID,
  )
  const connectSources = [
    "'self'",
    ...r2Sources,
    ...(development ? ["ws:", "wss:"] : []),
  ]

  return [
    "base-uri 'self'",
    "default-src 'self'",
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      development ? " 'unsafe-eval'" : ""
    }`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-hashes' ${nextImageTransparentStyleHash}${
      development ? " 'unsafe-inline'" : ""
    }`,
    `connect-src ${connectSources.join(" ")}`,
    "worker-src 'self' blob:",
    ...(!development ? ["upgrade-insecure-requests"] : []),
  ].join("; ")
}

function nonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64")
}

function isProtectedPath(pathname: string) {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/today" ||
    pathname === "/quests" ||
    pathname.startsWith("/quests/") ||
    [
      "/timer",
      "/gates",
      "/labels",
      "/cleared",
      "/progress",
      "/profile",
      "/contact",
      "/settings",
    ].includes(pathname)
  )
}

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  const requestNonce = nonce()
  const contentSecurityPolicy = buildContentSecurityPolicy(requestNonce)
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy)
  requestHeaders.set("x-nonce", requestNonce)

  // Correlation id for structured logs: forward an upstream id when present,
  // otherwise stamp one so Server Actions and RSC requests log traceably.
  const requestId =
    requestHeaders.get("x-request-id") ?? `req_${crypto.randomUUID()}`
  requestHeaders.set("x-request-id", requestId)

  let response: NextResponse
  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: AUTH_COOKIE_PREFIX,
  })
  if (
    request.nextUrl.pathname === "/unauthorized" ||
    request.nextUrl.pathname === "/session-expired"
  ) {
    const signOutUrl = request.nextUrl.clone()
    signOutUrl.pathname = "/sign-out"
    response = NextResponse.redirect(signOutUrl)
  } else if (isProtectedPath(request.nextUrl.pathname) && !sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url)
    signInUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    )

    response = NextResponse.redirect(signInUrl)
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } })
  }

  response.headers.set("Content-Security-Policy", contentSecurityPolicy)
  response.headers.set("x-request-id", requestId)
  return response
}

export const config = {
  matcher: [
    {
      missing: [
        { key: "next-router-prefetch", type: "header" },
        { key: "purpose", type: "header", value: "prefetch" },
      ],
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|serwist/|manifest.webmanifest|dev-cache-cleanup\\.js).*)",
    },
  ],
}
