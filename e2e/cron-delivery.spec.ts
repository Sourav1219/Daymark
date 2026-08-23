import { expect, test } from "@playwright/test"

// Exercises the authenticated cron entry points the way the platform
// scheduler does: shared bearer secret, GET invocation, JSON summary. The
// dev server used by Playwright is configured with CRON_SECRET in CI.
const cronSecret = process.env.CRON_SECRET

test.describe("cron delivery", () => {
  test.skip(
    !cronSecret,
    "CRON_SECRET must be configured for cron delivery checks",
  )

  for (const job of ["reminders", "retention", "overdue-tasks"]) {
    test(`delivers ${job} with the shared bearer secret`, async ({
      request,
    }) => {
      const response = await request.get(`/api/cron/${job}`, {
        headers: { authorization: `Bearer ${cronSecret}` },
      })
      expect(response.status()).toBe(200)
      const payload = await response.json()
      expect(payload).toBeInstanceOf(Object)
    })

    test(`rejects ${job} without credentials`, async ({ request }) => {
      const response = await request.get(`/api/cron/${job}`)
      expect(response.status()).toBe(401)
    })
  }
})
