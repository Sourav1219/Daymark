import type { Metadata } from "next"

import { SessionExpiredCard } from "@/features/authentication/ui/session-expired-card"

export const metadata: Metadata = {
  title: "Session Expired",
  description: "Your session has expired. Please sign in again to continue.",
}

export default function Unauthorized() {
  return <SessionExpiredCard />
}
