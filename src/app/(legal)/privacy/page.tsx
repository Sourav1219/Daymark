import type { Metadata } from "next"
import "@/app/styles/legal-pages.css"
import "@/app/styles/privacy-centre.css"

import { getDatabase } from "@/db/client"
import { getCurrentUser } from "@/features/authentication/server/authorization"
import type {
  PrivacyRequestType,
  PrivacyRequestView,
} from "@/features/privacy/domain/privacy-request"
import { listPrivacyRequestsForUser } from "@/features/privacy/repositories/privacy-request-repository"
import {
  PrivacyExperience,
  type CentreTab,
  type PrivacyCentreUser,
} from "@/features/privacy/ui/privacy-experience"

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  description:
    "Official Privacy Policy, personal data inventory, consent controls, and statutory rights.",
  title: "Privacy & Data Centre",
}

const validTabs: readonly CentreTab[] = [
  "policy",
  "inventory",
  "consent",
  "rights",
  "nominee",
]

export default async function PrivacyPage(props: {
  searchParams?: Promise<{ request?: string; tab?: string }>
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const initialTab =
    searchParams?.tab && validTabs.includes(searchParams.tab as CentreTab)
      ? (searchParams.tab as CentreTab)
      : "policy"

  const currentUser = await getCurrentUser()
  let privacyUser: PrivacyCentreUser | null = null
  let initialRequests: readonly PrivacyRequestView[] = []

  if (currentUser) {
    privacyUser = {
      createdAt: currentUser.createdAt.toISOString(),
      email: currentUser.email,
      emailVerified: currentUser.emailVerified,
      id: currentUser.id,
      name: currentUser.name,
      timezone: "UTC",
      workspaceName: currentUser.name
        ? `${currentUser.name}'s Workspace`
        : undefined,
    }
    initialRequests = await listPrivacyRequestsForUser(
      getDatabase(),
      currentUser.id,
    )
  }

  const initialRequestType: PrivacyRequestType =
    searchParams?.request === "correction" ? "correction" : "access"

  return (
    <PrivacyExperience
      initialRequests={initialRequests}
      initialRequestType={initialRequestType}
      initialTab={initialTab}
      user={privacyUser}
    />
  )
}
