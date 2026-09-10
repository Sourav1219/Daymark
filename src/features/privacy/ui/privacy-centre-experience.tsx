"use client"

import {
  PrivacyExperience,
  type CentreTab,
  type PrivacyCentreUser,
} from "./privacy-experience"
import type {
  PrivacyRequestType,
  PrivacyRequestView,
} from "@/features/privacy/domain/privacy-request"

export type { CentreTab, PrivacyCentreUser }

export function PrivacyCentreExperience({
  initialRequests = [],
  initialRequestType = "access",
  initialTab = "inventory",
  user,
}: Readonly<{
  initialRequests?: readonly PrivacyRequestView[] | undefined
  initialRequestType?: PrivacyRequestType | undefined
  initialTab?: CentreTab | undefined
  user?: PrivacyCentreUser | null | undefined
}>) {
  return (
    <PrivacyExperience
      initialRequests={initialRequests}
      initialRequestType={initialRequestType}
      initialTab={initialTab}
      user={user}
    />
  )
}
