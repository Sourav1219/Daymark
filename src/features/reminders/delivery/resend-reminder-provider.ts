import "server-only"

import { Resend } from "resend"

import { readServerEnv } from "@/lib/env/server"
import { emailFromServerEnv } from "@/lib/env/schema"
import { withDeadline } from "@/lib/timeouts"
import {
  ReminderProviderError,
  type ReminderDeliveryInput,
  type ReminderDeliveryProvider,
} from "@/features/reminders/delivery/reminder-delivery-provider"

/** Application-level deadline for one Resend API call. */
const resendDeadlineMilliseconds = 10_000

export class ResendReminderDeliveryProvider implements ReminderDeliveryProvider {
  private readonly client: Resend

  constructor(
    apiKey: string,
    private readonly from: string,
    private readonly appUrl: string,
  ) {
    this.client = new Resend(apiKey)
  }

  async send(input: ReminderDeliveryInput) {
    const { data, error } = await withDeadline(
      this.client.emails.send(
        {
          from: this.from,
          html: `<p>A task reminder is due.</p><p><a href="${this.appUrl}/quests">Open your task list</a></p>`,
          subject: "A task reminder is due",
          to: input.recipientEmail,
        },
        { idempotencyKey: input.idempotencyKey },
      ),
      resendDeadlineMilliseconds,
      "Resend email delivery",
    )

    if (error || !data?.id) {
      throw new ReminderProviderError("provider_rejected")
    }

    return { providerMessageId: data.id }
  }
}

class UnconfiguredReminderDeliveryProvider implements ReminderDeliveryProvider {
  async send(): Promise<never> {
    throw new ReminderProviderError("provider_not_configured")
  }
}

/**
 * Server-derived capability flag. Email reminders may only be offered when
 * the complete delivery configuration exists; the environment schema already
 * rejects partial pairs.
 */
export function emailDeliveryEnabled(): boolean {
  const env = readServerEnv()
  return Boolean(env.RESEND_API_KEY && emailFromServerEnv(env))
}

export function createReminderDeliveryProvider(
  configuration: Readonly<{
    apiKey?: string | undefined
    appUrl: string
    from?: string | undefined
  }>,
): ReminderDeliveryProvider {
  return configuration.apiKey && configuration.from
    ? new ResendReminderDeliveryProvider(
        configuration.apiKey,
        configuration.from,
        configuration.appUrl,
      )
    : new UnconfiguredReminderDeliveryProvider()
}
