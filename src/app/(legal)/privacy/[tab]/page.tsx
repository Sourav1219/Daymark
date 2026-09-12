import type { Metadata } from "next"
import "@/app/styles/legal-pages.css"
import "@/app/styles/privacy-centre.css"

import { getCurrentUser } from "@/features/authentication/server/authorization"
import {
  PrivacyExperience,
  type CentreTab,
  type PrivacyCentreUser,
} from "@/features/privacy/ui/privacy-experience"

import { notFound, redirect } from "next/navigation"

const validTabs: readonly CentreTab[] = [
  "policy",
  "inventory",
  "consent",
  "rights",
  "nominee",
]

const tabTitles: Record<CentreTab, string> = {
  consent: "Consent Controls & Ledger",
  inventory: "Data Inventory & Lawful Bases",
  nominee: "Digital Nominee Delegation",
  policy: "Official Statutory Policy",
  rights: "Statutory Privacy Rights Desk",
}

export function generateStaticParams() {
  return validTabs.map((tab) => ({ tab }))
}

export async function generateMetadata(props: {
  params: Promise<{ tab: string }>
}): Promise<Metadata> {
  const { tab } = await props.params
  if (tab === "actions") {
    return {
      title: "Data Controls · Profile Settings",
    }
  }
  if (!validTabs.includes(tab as CentreTab)) {
    return {
      title: "Page Not Found",
      robots: { index: false, follow: false },
    }
  }
  const resolvedTab = tab as CentreTab
  const title = `${tabTitles[resolvedTab]} · Privacy & Data Centre`

  return {
    alternates: { canonical: `/privacy/${resolvedTab}` },
    description: `Traketo Privacy & Data Centre: ${tabTitles[resolvedTab]}`,
    title,
  }
}

export default async function PrivacySubpage(props: {
  params: Promise<{ tab: string }>
}) {
  const { tab } = await props.params
  if (tab === "actions") {
    redirect("/profile")
  }
  if (!validTabs.includes(tab as CentreTab)) {
    notFound()
  }
  const initialTab = tab as CentreTab

  const currentUser = await getCurrentUser()
  let privacyUser: PrivacyCentreUser | null = null

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
  }

  return (
    <PrivacyExperience initialTab={initialTab} isSubpage user={privacyUser} />
  )
}
