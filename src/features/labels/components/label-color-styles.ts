import type { LabelColorToken } from "@/features/labels/domain/types"

export const labelColorLabels: Record<LabelColorToken, string> = {
  "mana-violet": "Violet",
  "spectral-cyan": "Sky",
  "status-danger": "Red",
  "status-success": "Green",
  "status-warning": "Amber",
  "system-blue": "Blue",
}

export const labelColorBadgeStyles: Record<LabelColorToken, string> = {
  "mana-violet": "border-mana-violet/40 bg-mana-violet/10 text-mana-violet",
  "spectral-cyan":
    "border-spectral-cyan/40 bg-spectral-cyan/10 text-spectral-cyan",
  "status-danger": "border-danger/40 bg-danger/10 text-danger",
  "status-success": "border-success/40 bg-success/10 text-success",
  "status-warning": "border-warning/40 bg-warning/10 text-warning",
  "system-blue": "border-system-blue/40 bg-system-blue/10 text-spectral-cyan",
}

export const labelColorDotStyles: Record<LabelColorToken, string> = {
  "mana-violet": "bg-mana-violet",
  "spectral-cyan": "bg-spectral-cyan",
  "status-danger": "bg-danger",
  "status-success": "bg-success",
  "status-warning": "bg-warning",
  "system-blue": "bg-system-blue",
}
