import { withSerwist } from "@serwist/turbopack"
import type { NextConfig } from "next"

const production = process.env.NODE_ENV === "production"
const securityHeaders = [
  ...(!production
    ? [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
      ]
    : []),
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=()",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  ...(production
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
]

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    authInterrupts: true,
  },
  poweredByHeader: false,
  reactCompiler: true,
  typedRoutes: true,
  async headers() {
    return [
      { headers: securityHeaders, source: "/:path*" },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
        source: "/serwist/:path*",
      },
    ]
  },
}

export default withSerwist(nextConfig)
