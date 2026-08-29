import type { Metadata } from "next"

import "@/app/styles/quest-studio.css"

import { OfflineQuestShell } from "@/features/offline/components/offline-quest-shell"

export const metadata: Metadata = { title: "Offline" }

export default function OfflinePage() {
  return <OfflineQuestShell />
}
