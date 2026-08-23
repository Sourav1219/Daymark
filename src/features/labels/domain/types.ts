export const labelColorTokens = [
  "system-blue",
  "mana-violet",
  "spectral-cyan",
  "status-success",
  "status-warning",
  "status-danger",
] as const

export type LabelColorToken = (typeof labelColorTokens)[number]

export type LabelView = Readonly<{
  id: string
  name: string
  colorToken: LabelColorToken
  version: number
}>
