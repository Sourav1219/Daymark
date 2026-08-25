// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest"

import { isTrustedOriginRequest } from "./same-origin"

const canonicalOrigin = "https://traketo.example.test"

function request(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers, method: "POST" })
}

describe("isTrustedOriginRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("accepts an origin matching the server-configured allowlist", () => {
    const result = isTrustedOriginRequest(
      request("https://traketo.example.test/api/timer/stop", {
        origin: canonicalOrigin,
      }),
      [canonicalOrigin],
    )

    expect(result).toBe(true)
  })

  it("rejects cross-site origins even with spoofed forwarded headers", () => {
    const result = isTrustedOriginRequest(
      request("https://traketo.example.test/api/timer/stop", {
        host: "traketo.example.test",
        origin: "https://attacker.test",
        "x-forwarded-host": "attacker.test",
        "x-forwarded-proto": "https",
      }),
      [canonicalOrigin],
    )

    expect(result).toBe(false)
  })

  it("rejects any fetch-metadata mode other than same-origin", () => {
    for (const mode of ["cross-site", "same-site", "none"]) {
      const result = isTrustedOriginRequest(
        request("https://traketo.example.test/api/x", {
          "sec-fetch-site": mode,
          origin: canonicalOrigin,
        }),
        [canonicalOrigin],
      )

      expect(result, `sec-fetch-site=${mode}`).toBe(false)
    }
  })

  it("rejects malformed origin headers without throwing", () => {
    const result = isTrustedOriginRequest(
      request("https://traketo.example.test/api/x", {
        origin: "not a URL",
      }),
      [canonicalOrigin],
    )

    expect(result).toBe(false)
  })

  it("allows header-less non-browser clients and same-origin metadata", () => {
    expect(
      isTrustedOriginRequest(request("https://traketo.example.test/api/x"), [
        canonicalOrigin,
      ]),
    ).toBe(true)

    expect(
      isTrustedOriginRequest(
        request("https://traketo.example.test/api/x", {
          "sec-fetch-site": "same-origin",
        }),
        [canonicalOrigin],
      ),
    ).toBe(true)
  })

  it("denies missing fetch metadata that is not same-origin", () => {
    const result = isTrustedOriginRequest(
      request("https://traketo.example.test/api/x", {
        "sec-fetch-site": "none",
      }),
      [canonicalOrigin],
    )

    expect(result).toBe(false)
  })

  it("falls back to deployment-host matching in development only", () => {
    vi.stubEnv("NODE_ENV", "development")
    const local = isTrustedOriginRequest(
      request("http://127.0.0.1:3000/api/x", {
        host: "localhost:3000",
        origin: "http://127.0.0.1:3000",
        "x-forwarded-host": "127.0.0.1:3000",
      }),
      [canonicalOrigin],
    )
    expect(local).toBe(true)

    vi.stubEnv("NODE_ENV", "test")
    const test = isTrustedOriginRequest(
      request("http://127.0.0.1:3000/api/x", {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        "x-forwarded-host": "127.0.0.1:3000",
      }),
      [canonicalOrigin],
    )
    expect(test).toBe(false)

    vi.stubEnv("NODE_ENV", "production")
    const production = isTrustedOriginRequest(
      request("http://127.0.0.1:3000/api/x", {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
      }),
      [canonicalOrigin],
    )
    expect(production).toBe(false)
  })
})
