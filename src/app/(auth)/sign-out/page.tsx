import type { Metadata } from "next"

import { safeRedirectPath } from "@/features/authentication/application/validation"
import { SignOutPageClient } from "@/app/(auth)/sign-out/sign-out-page-client"

export const metadata: Metadata = {
  description: "This device was signed out and requires authentication.",
  title: "Signed Out",
}

type SignOutPageProps = Readonly<{
  searchParams: Promise<{ next?: string | string[] }>
}>

export default async function SignOutPage({ searchParams }: SignOutPageProps) {
  const { next } = await searchParams
  const nextPath = safeRedirectPath(
    Array.isArray(next) ? (next[0] ?? null) : (next ?? null),
  )

  return <SignOutPageClient nextPath={nextPath} />
}
