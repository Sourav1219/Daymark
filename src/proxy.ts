import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

import { AUTH_COOKIE_PREFIX } from "@/features/authentication/config"
import { buildContentSecurityPolicy } from "@/lib/security/content-security-policy"

export { buildContentSecurityPolicy } from "@/lib/security/content-security-policy"

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
      "/cleared",
      "/progress",
      "/profile",
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
  } else if (request.nextUrl.pathname === "/") {
    const destination = sessionCookie ? "/today" : "/sign-in"
    response = NextResponse.redirect(new URL(destination, request.url))
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
      // Only routes that need an optimistic cookie redirect or a nonce-based
      // dynamic CSP enter the Node.js proxy. Public/static pages and arbitrary
      // scanner paths are served directly by Next/Vercel's CDN.
      source:
        "/((?:app(?:/.*)?|today|quests(?:/.*)?|timer|gates|cleared|progress|profile|settings|sign-in|sign-up|reset-password|sign-out|session-expired|unauthorized|contact)?)",
    },
  ],
}
