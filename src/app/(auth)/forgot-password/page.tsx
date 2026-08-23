import type { Metadata } from "next"

import { AccountEmailForm } from "@/features/authentication/ui/account-email-form"

export const metadata: Metadata = { title: "Forgot password" }

export default function ForgotPasswordPage() {
  return <AccountEmailForm mode="password-reset" />
}
