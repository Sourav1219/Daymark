export const gateAccentTokens = [
  "system-blue",
  "mana-violet",
  "spectral-cyan",
  "status-success",
  "status-warning",
  "status-danger",
] as const

export type GateAccentToken = (typeof gateAccentTokens)[number]

export type GateView = Readonly<{
  id: string
  name: string
  description: string
  accentToken: GateAccentToken
  position: number
  archivedAt: string | null
  version: number
  questCount: number
}>

export type GateListKind = "active" | "archived"
