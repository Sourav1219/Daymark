import "server-only"

/**
 * Central CSRF gate for state-changing Route Handlers.
 *
 * Allowed origins come from server configuration (the canonical
 * BETTER_AUTH_URL origin), never from client-controllable request headers.
 * Fetch metadata (`sec-fetch-site`) short-circuits modern browsers before any
 * header comparison. Requests that carry neither an Origin nor fetch-metadata
 * stay allowed: non-browser clients hold no ambient credentials beyond the
 * SameSite=Lax session cookie. Only in local development does an origin whose
 * host matches this deployment's Host / x-forwarded-host also count as
 * trusted, keeping multi-port workflows convenient where headers cannot be
 * forged into real access.
 */
export function isTrustedOriginRequest(
  request: Request,
  allowedOrigins: readonly string[],
): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")
  if (fetchSite && fetchSite !== "same-origin") {
    return false
  }

  const originHeader = request.headers.get("origin")
  if (!originHeader) {
    return !fetchSite || fetchSite === "same-origin"
  }

  let origin: URL
  try {
    origin = new URL(originHeader)
  } catch {
    return false
  }

  if (allowedOrigins.includes(origin.origin)) {
    return true
  }

  return (
    process.env.NODE_ENV === "development" &&
    matchesDeploymentHost(request, origin)
  )
}

function matchesDeploymentHost(request: Request, origin: URL): boolean {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim()
  const expectedHost = forwardedHost || request.headers.get("host")

  return Boolean(expectedHost) && origin.host === expectedHost
}
