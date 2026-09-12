import type { Metadata } from "next"

import "@/app/styles/quest-studio.css"

import { OfflineQuestShell } from "@/features/offline/components/offline-quest-shell"

export const metadata: Metadata = {
  title: "Offline",
  robots: {
    index: false,
    follow: false,
  },
}

export default function OfflinePage() {
  return <OfflineQuestShell />
}
