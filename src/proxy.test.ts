// @vitest-environment node

import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { buildContentSecurityPolicy, config, proxy } from "./proxy"

describe("protected route proxy", () => {
  it("runs on app pages so every rendered document receives a nonce", () => {
    expect(config.matcher).toEqual([
      expect.objectContaining({
        source: expect.stringContaining("_next/static"),
      }),
    ])
  })

  it("redirects a request without a session cookie", () => {
    const response = proxy(
      new NextRequest("https://questly.test/app/workspaces/example?q=1"),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "https://questly.test/sign-in?next=%2Fapp%2Fworkspaces%2Fexample%3Fq%3D1",
    )
  })

  it.each(["/unauthorized", "/session-expired"])(
    "redirects the legacy %s path to the real sign-out page",
    (pathname) => {
      const response = proxy(
        new NextRequest(`https://questly.test${pathname}?next=%2Fprofile`),
      )

      expect(response.status).toBe(307)
      expect(response.headers.get("location")).toBe(
        "https://questly.test/sign-out?next=%2Fprofile",
      )
    },
  )

  it("protects the Phase 3 shell routes", () => {
    const response = proxy(
      new NextRequest("https://questly.test/today?view=compact"),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "https://questly.test/sign-in?next=%2Ftoday%3Fview%3Dcompact",
    )
  })

  it("allows unauthenticated visitors to reach the contact support page", () => {
    const response = proxy(
      new NextRequest("https://questly.test/contact?topic=account"),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("allows a cookie-bearing request through to authoritative server auth", () => {
    const response = proxy(
      new NextRequest("https://questly.test/app", {
        headers: {
          cookie: "__Secure-questly.session_token=opaque-token",
        },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("redirects an authenticated root request directly to /today", () => {
    const response = proxy(
      new NextRequest("https://questly.test/", {
        headers: {
          cookie: "__Secure-questly.session_token=opaque-token",
        },
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://questly.test/today")
  })

  it("redirects an unauthenticated root request directly to /sign-in", () => {
    const response = proxy(new NextRequest("https://questly.test/"))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "https://questly.test/sign-in",
    )
  })

  it("adds a strict nonce-based CSP to rendered pages", () => {
    const response = proxy(new NextRequest("https://questly.test/sign-in"))
    const csp = response.headers.get("content-security-policy")

    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'unsafe-eval'/)
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    expect(csp).not.toContain("strict-dynamic")
  })

  it("allows only the configured R2 account for direct browser uploads", () => {
    const csp = buildContentSecurityPolicy("nonce-value", {
      development: false,
      r2AccountId: "1234567890abcdef1234567890abcdef",
    })

    expect(csp).toContain(
      "https://*.1234567890abcdef1234567890abcdef.r2.cloudflarestorage.com",
    )
    expect(csp).toContain("style-src 'self' 'nonce-nonce-value'")
    expect(csp).toContain("style-src-attr 'unsafe-inline'")
    expect(csp).not.toContain("strict-dynamic")
    expect(csp).not.toContain("'unsafe-eval'")
  })
})
