const minuteMs = 60_000

export function deadlineMessage(dueAt: string, now: number): string {
  const remainingMs = new Date(dueAt).getTime() - now

  if (remainingMs <= 0) return "The deadline has passed."
  if (remainingMs < minuteMs) return "Ends in less than a minute."

  const minutes = Math.ceil(remainingMs / minuteMs)
  if (minutes < 60) {
    return `Ends in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  const hourLabel = `${hours} ${hours === 1 ? "hour" : "hours"}`

  if (remainingMinutes === 0) return `Ends in ${hourLabel}.`

  return `Ends in ${hourLabel} ${remainingMinutes} ${
    remainingMinutes === 1 ? "minute" : "minutes"
  }.`
}
