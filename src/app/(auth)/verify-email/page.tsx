import type { Metadata } from "next"

import { AccountEmailForm } from "@/features/authentication/ui/account-email-form"

export const metadata: Metadata = { title: "Verify email" }

export default function VerifyEmailPage() {
  return <AccountEmailForm mode="verification" />
}
