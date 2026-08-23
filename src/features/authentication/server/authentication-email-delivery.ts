import "server-only"

import { createHash } from "node:crypto"

import { after } from "next/server"
import { Resend } from "resend"

import type { ServerEnv } from "@/lib/env/schema"
import { emailFromServerEnv } from "@/lib/env/schema"
import { logger } from "@/lib/observability/logger"
import { withDeadline } from "@/lib/timeouts"

const emailDeadlineMilliseconds = 10_000

type AuthenticationEmail = Readonly<{
  recipientEmail: string
  recipientName: string
  url: string
}>

export interface AuthenticationEmailDelivery {
  sendPasswordReset(input: AuthenticationEmail): Promise<void>
  sendVerification(input: AuthenticationEmail): Promise<void>
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "'": "&#39;",
      '"': "&quot;",
      "<": "&lt;",
      ">": "&gt;",
    }
    return entities[character] ?? character
  })
}

function emailHtml(input: {
  action: string
  explanation: string
  name: string
  url: string
}): string {
  const name = escapeHtml(input.name)
  const url = escapeHtml(input.url)

  return [
    '<div style="background:#f4f7fd;padding:32px 16px;font-family:Arial,sans-serif;color:#10213b">',
    '<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dce5f5;border-radius:18px;padding:32px">',
    '<p style="margin:0 0 20px;font-weight:700;color:#316df4">Daymark</p>',
    `<h1 style="font-size:24px;margin:0 0 16px">Hello ${name},</h1>`,
    `<p style="line-height:1.6;margin:0 0 24px">${escapeHtml(input.explanation)}</p>`,
    `<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#316df4;color:#fff;text-decoration:none;border-radius:12px;padding:13px 20px;font-weight:700">${escapeHtml(input.action)}</a></p>`,
    '<p style="font-size:13px;line-height:1.5;color:#66758f;margin:0">This link expires in one hour. If you did not request it, you can safely ignore this email.</p>',
    "</div></div>",
  ].join("")
}

class ResendAuthenticationEmailDelivery implements AuthenticationEmailDelivery {
  private readonly client: Resend

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey)
  }

  private async send(input: {
    action: string
    explanation: string
    recipientEmail: string
    recipientName: string
    subject: string
    url: string
  }) {
    const idempotencyKey = createHash("sha256")
      .update(`${input.subject}:${input.url}`)
      .digest("hex")
    const { data, error } = await withDeadline(
      this.client.emails.send(
        {
          from: `Daymark <${this.from}>`,
          html: emailHtml({
            action: input.action,
            explanation: input.explanation,
            name: input.recipientName,
            url: input.url,
          }),
          subject: input.subject,
          text: `${input.explanation}\n\n${input.url}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
          to: input.recipientEmail,
        },
        { idempotencyKey },
      ),
      emailDeadlineMilliseconds,
      "Resend authentication email delivery",
    )

    if (error || !data?.id) {
      throw new Error("Authentication email provider rejected the message.")
    }
  }

  sendVerification(input: AuthenticationEmail) {
    return this.send({
      action: "Verify email address",
      explanation:
        "Confirm that this email address belongs to you before signing in to Daymark.",
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      subject: "Verify your Daymark email",
      url: input.url,
    })
  }

  sendPasswordReset(input: AuthenticationEmail) {
    return this.send({
      action: "Reset password",
      explanation:
        "Use the secure link below to choose a new password for your Daymark account.",
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      subject: "Reset your Daymark password",
      url: input.url,
    })
  }
}

class DevelopmentAuthenticationEmailDelivery implements AuthenticationEmailDelivery {
  private log(
    kind: "password-reset" | "verification",
    input: AuthenticationEmail,
  ) {
    logger.info("authentication.development_email", {
      kind,
      recipient: input.recipientEmail,
      url: input.url,
    })
    return Promise.resolve()
  }

  sendVerification(input: AuthenticationEmail) {
    return this.log("verification", input)
  }

  sendPasswordReset(input: AuthenticationEmail) {
    return this.log("password-reset", input)
  }
}

export function createAuthenticationEmailDelivery(
  env: ServerEnv,
): AuthenticationEmailDelivery {
  const from = emailFromServerEnv(env)
  if (env.RESEND_API_KEY && from) {
    return new ResendAuthenticationEmailDelivery(env.RESEND_API_KEY, from)
  }
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    return new DevelopmentAuthenticationEmailDelivery()
  }
  throw new Error(
    "Authentication email delivery requires RESEND_API_KEY and EMAIL_FROM.",
  )
}

/**
 * Keep external email latency out of authentication responses. Next.js keeps
 * the scheduled work alive after sending the response. Direct auth API calls
 * outside a request (for example integration tests) fall back to awaiting it.
 */
export async function scheduleAuthenticationEmail(
  send: () => Promise<void>,
): Promise<void> {
  const deliver = async () => {
    try {
      await send()
    } catch (error) {
      logger.error(
        "authentication.email_delivery_failed",
        error instanceof Error ? error : undefined,
      )
    }
  }

  try {
    after(deliver)
  } catch {
    await deliver()
  }
}
