"use client"

import { useEffect } from "react"

import type { LabelView } from "@/features/labels/domain/types"
import { useOffline } from "@/features/offline/components/offline-provider"

export function LabelOfflineSync({
  labels,
}: Readonly<{
  labels: readonly LabelView[]
}>) {
  const { snapshotLabels } = useOffline()

  useEffect(() => {
    void snapshotLabels(labels)
  }, [labels, snapshotLabels])

  return null
}
