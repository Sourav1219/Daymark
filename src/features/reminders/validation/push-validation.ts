import { z } from "zod"

import { parseTrustedPushEndpoint } from "@/features/reminders/delivery/push-endpoint-security"

export const pushSubscriptionSchema = z
  .object({
    endpoint: z
      .url()
      .max(2_048)
      .refine((endpoint) => {
        try {
          parseTrustedPushEndpoint(endpoint)
          return true
        } catch {
          return false
        }
      }, "Choose a push subscription from a supported browser."),
    expirationTime: z.number().nonnegative().nullable(),
    keys: z
      .object({
        auth: z.string().min(1).max(128),
        p256dh: z.string().min(1).max(256),
      })
      .strict(),
  })
  .strict()

export const removePushSubscriptionSchema = z.object({
  endpoint: z.url().max(2_048),
})
