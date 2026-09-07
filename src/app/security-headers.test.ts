import { NextRequest } from "next/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@sentry/nextjs", () => ({
  withSentryConfig: <T>(config: T) => config,
}))

import nextConfig from "../../next.config"
import { proxy } from "../proxy"

describe("response security headers", () => {
  it("applies browser hardening to every route", async () => {
    const entries = (await nextConfig.headers?.()) ?? []
    const globalEntry = entries.find(({ source }) => source === "/:path*")
    const workerEntry = entries.find(
      ({ source }) => source === "/serwist/:path*",
    )
    const headers = new Map(
      globalEntry?.headers.map((header) => [header.key, header.value] as const),
    )
    const csp = proxy(
      new NextRequest("https://traketo.example.test/sign-in"),
    ).headers.get("Content-Security-Policy")

    expect(globalEntry).toBeDefined()
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/)
    expect(csp).not.toContain("strict-dynamic")
    expect(csp).toContain("frame-src 'self' https://challenges.cloudflare.com")
    expect(csp).toContain("https://challenges.cloudflare.com")
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin")
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin")
    expect(headers.get("Permissions-Policy")).toContain("camera=()")
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    )
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(headers.get("X-Frame-Options")).toBe("DENY")
    expect(workerEntry?.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "Cache-Control",
          value: expect.stringContaining("no-cache"),
        }),
      ]),
    )
  })
})
