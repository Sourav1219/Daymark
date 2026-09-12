import { withSentryConfig } from "@sentry/nextjs/config"
import { withSerwist } from "@serwist/turbopack"
import type { NextConfig } from "next"

import { buildContentSecurityPolicy } from "./src/lib/security/content-security-policy"

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
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(undefined),
  },
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
          value: "max-age=31536000; includeSubDomains; preload",
        },
      ]
    : []),
]

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    authInterrupts: true,
    // Integrity attributes protect cached JavaScript assets while public pages
    // use a static CSP and can therefore be served without a function.
    sri: { algorithm: "sha256" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
  },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactCompiler: true,
  typedRoutes: true,
  async headers() {
    return [
      // Fingerprinted static assets are content-addressed and safe to cache
      // for a full year. This entry must come BEFORE the catch-all rule below
      // so it wins the specificity race and Next.js's built-in immutable
      // headers are not overridden by the no-cache fallback.
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
        source: "/_next/static/:path*",
      },
      // Next.js optimized images carry content hashes and dimensions in query params.
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, stale-while-revalidate=86400",
          },
        ],
        source: "/_next/image",
      },
      // Public static files (icons, manifest, splash screens) can be
      // cached for 30 days; they carry hash-busted filenames when
      // referenced from Next.js and are infrequently updated.
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=604800",
          },
        ],
        source: "/(icons|mascots|splash|public)/:path*",
      },
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

export default withSentryConfig(withSerwist(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "traketo",

  project: "traketo",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Tree-shake unused Sentry features to reduce client bundle size
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
})
