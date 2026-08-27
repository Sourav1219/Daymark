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

  it("protects the profile contact page", () => {
    const response = proxy(
      new NextRequest("https://questly.test/contact?topic=account"),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "https://questly.test/sign-in?next=%2Fcontact%3Ftopic%3Daccount",
    )
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

  it("adds a strict nonce-based CSP to rendered pages", () => {
    const response = proxy(new NextRequest("https://questly.test/sign-in"))
    const csp = response.headers.get("content-security-policy")

    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
    expect(csp).toMatch(/style-src 'self' 'nonce-[^']+'/)
  })

  it("allows only the configured R2 account for direct browser uploads", () => {
    const csp = buildContentSecurityPolicy("nonce-value", {
      development: false,
      r2AccountId: "1234567890abcdef1234567890abcdef",
    })

    expect(csp).toContain(
      "https://*.1234567890abcdef1234567890abcdef.r2.cloudflarestorage.com",
    )
    expect(csp).toContain("'unsafe-hashes'")
    expect(csp).toContain(
      "'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='",
    )
    expect(csp).not.toContain("'unsafe-inline'")
    expect(csp).not.toContain("'unsafe-eval'")
  })
})
