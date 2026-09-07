import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { safeRedirectPath } from "@/features/authentication/application/validation"
import { getCurrentUser } from "@/features/authentication/server/authorization"
import { TwoFactorChallenge } from "@/features/authentication/ui/two-factor-challenge"

export const metadata: Metadata = { title: "Two-factor verification" }

type TwoFactorPageProps = Readonly<{
  searchParams: Promise<{ next?: string | string[] }>
}>

export default async function TwoFactorPage({
  searchParams,
}: TwoFactorPageProps) {
  const { next } = await searchParams
  const nextPath = safeRedirectPath(
    Array.isArray(next) ? (next[0] ?? null) : (next ?? null),
  )

  if (await getCurrentUser()) {
    redirect(nextPath)
  }

  return (
    <main className="auth" data-mode="two-factor">
      <div className="auth__inner auth__inner--verification">
        <TwoFactorChallenge nextPath={nextPath} />
      </div>
    </main>
  )
}
