#!/usr/bin/env node
// Post-deployment smoke check for a running Traketo deployment.
//
//   BASE_URL=https://traketo.com node scripts/smoke.mjs
//   READINESS_SECRET=... BASE_URL=... node scripts/smoke.mjs   # also probes /api/ready
//
// Exits non-zero on the first failure so release pipelines can gate on it.
const baseUrl = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/u,
  "",
)

async function check(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(
      `FAIL ${name}:`,
      error instanceof Error ? error.message : error,
    )
    process.exit(1)
  }
}

async function expectOk(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...init,
  })
  if (!(response.status >= 200 && response.status < 400)) {
    throw new Error(`${path} responded ${response.status}`)
  }
  return response
}

await check("health endpoint", async () => {
  const response = await expectOk("/api/health")
  const body = await response.json()
  if (body.status !== "ok" || body.service !== "traketo") {
    throw new Error(`unexpected health payload: ${JSON.stringify(body)}`)
  }
})

await check("web app manifest", async () => {
  const response = await expectOk("/manifest.webmanifest")
  const manifest = await response.json()
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error("manifest is missing icons")
  }
})

await check("sign-in page renders", async () => {
  const response = await expectOk("/sign-in")
  const html = await response.text()
  // The auth experience renders its segmented form on first paint; both the
  // wordmark and the primary CTA must be present.
  for (const marker of ["Traketo", "Sign in", "Get started"]) {
    if (!html.includes(marker)) {
      throw new Error(`sign-in page is missing "${marker}"`)
    }
  }
})

await check("protected route redirects anonymous visitors", async () => {
  const response = await fetch(`${baseUrl}/today`, { redirect: "manual" })
  if (response.status !== 307 && response.status !== 302) {
    throw new Error(`expected a redirect, got ${response.status}`)
  }
})

if (process.env.READINESS_SECRET) {
  await check("database readiness probe", async () => {
    const response = await fetch(`${baseUrl}/api/ready`, {
      headers: { authorization: `Bearer ${process.env.READINESS_SECRET}` },
    })
    if (!response.ok) {
      throw new Error(`/api/ready responded ${response.status}`)
    }
  })
}

console.log("Smoke checks completed successfully.")
