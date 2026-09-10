const r2AccountIdPattern = /^[a-f\d]{32}$/iu
const sentryConnectSources = [
  "https://*.ingest.sentry.io",
  "https://*.ingest.us.sentry.io",
]

function r2ConnectSources(accountId: string | undefined) {
  if (!accountId || !r2AccountIdPattern.test(accountId)) return []

  const r2Host = `${accountId}.r2.cloudflarestorage.com`
  return [`https://${r2Host}`, `https://*.${r2Host}`]
}

/**
 * Builds the CSP used by both cached public pages and nonce-protected dynamic
 * pages. Static pages cannot receive a per-request nonce, so their policy uses
 * Next.js's documented `unsafe-inline` fallback while still restricting all
 * script origins to Traketo and the Turnstile widget.
 */
export function buildContentSecurityPolicy(
  nonce: string | undefined,
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
    "https://challenges.cloudflare.com",
    ...sentryConnectSources,
    ...r2Sources,
    ...(development ? ["ws:", "wss:"] : []),
  ]
  const scriptAuthorization = nonce ? `'nonce-${nonce}'` : "'unsafe-inline'"

  return [
    "base-uri 'self'",
    "default-src 'self'",
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "object-src 'none'",
    `script-src 'self' ${scriptAuthorization} https://challenges.cloudflare.com${development ? " 'unsafe-eval'" : ""}`,
    development || !nonce
      ? "style-src 'self' 'unsafe-inline'"
      : `style-src 'self' 'nonce-${nonce}'`,
    ...(!development && nonce ? ["style-src-attr 'unsafe-inline'"] : []),
    `connect-src ${connectSources.join(" ")}`,
    "frame-src 'self' https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    ...(!development ? ["upgrade-insecure-requests"] : []),
  ].join("; ")
}
