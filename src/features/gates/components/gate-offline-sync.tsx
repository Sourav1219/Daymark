"use client"

import { useEffect } from "react"

import type { GateView } from "@/features/gates/domain/types"
import { useOffline } from "@/features/offline/components/offline-provider"

export function GateOfflineSync({
  gates,
}: Readonly<{
  gates: readonly GateView[]
}>) {
  const { snapshotGates } = useOffline()

  useEffect(() => {
    void snapshotGates(gates)
  }, [gates, snapshotGates])

  return null
}
