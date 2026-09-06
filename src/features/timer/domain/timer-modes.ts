export type TimerMode = "pomodoro" | "deep-work" | "short-break" | "stopwatch"

export type TimerPreset = Readonly<{
  defaultSubject: string
  durationMinutes: number
  id: TimerMode
  label: string
  placeholder: string
}>

export const timerPresets: readonly TimerPreset[] = [
  {
    defaultSubject: "Pomodoro focus block",
    durationMinutes: 25,
    id: "pomodoro",
    label: "25m Pomodoro",
    placeholder: "e.g. Solve physics problems",
  },
  {
    defaultSubject: "Deep work session",
    durationMinutes: 50,
    id: "deep-work",
    label: "50m Deep Work",
    placeholder: "e.g. Write architecture draft",
  },
  {
    defaultSubject: "Short break & stretch",
    durationMinutes: 5,
    id: "short-break",
    label: "5m Break",
    placeholder: "e.g. Water, stretch & tea",
  },
  {
    defaultSubject: "Open focus session",
    durationMinutes: 0,
    id: "stopwatch",
    label: "Stopwatch",
    placeholder: "e.g. Read chapter four",
  },
] as const

const preferredModeKey = "traketo:preferred-timer-mode"
const sessionModePrefix = "traketo:timer-mode:"

const defaultPreset: TimerPreset = timerPresets[0]!

export function getPresetById(mode: TimerMode): TimerPreset {
  return timerPresets.find((preset) => preset.id === mode) ?? defaultPreset
}

export function getPreferredMode(): TimerMode {
  if (typeof window === "undefined") return "pomodoro"
  try {
    const saved = window.localStorage.getItem(preferredModeKey)
    if (
      saved === "pomodoro" ||
      saved === "deep-work" ||
      saved === "short-break" ||
      saved === "stopwatch"
    ) {
      return saved
    }
  } catch {
    // Ignore localStorage access restrictions
  }
  return "pomodoro"
}

export function setPreferredMode(mode: TimerMode): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(preferredModeKey, mode)
  } catch {
    // Ignore localStorage access restrictions
  }
}

export function getSessionMode(sessionId?: string): TimerMode {
  if (typeof window === "undefined" || !sessionId) return getPreferredMode()
  try {
    const saved = window.localStorage.getItem(
      `${sessionModePrefix}${sessionId}`,
    )
    if (
      saved === "pomodoro" ||
      saved === "deep-work" ||
      saved === "short-break" ||
      saved === "stopwatch"
    ) {
      return saved
    }
  } catch {
    // Ignore localStorage access restrictions
  }
  return getPreferredMode()
}

export function setSessionMode(sessionId: string, mode: TimerMode): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(`${sessionModePrefix}${sessionId}`, mode)
    setPreferredMode(mode)
  } catch {
    // Ignore localStorage access restrictions
  }
}

export function clearSessionMode(sessionId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(`${sessionModePrefix}${sessionId}`)
  } catch {
    // Ignore localStorage access restrictions
  }
}

export function playTimerChime(): void {
  if (typeof window === "undefined") return
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const now = context.currentTime

    // Gentle 3-note ascending melodic chime (C5 -> E5 -> G5)
    const frequencies = [523.25, 659.25, 783.99]
    frequencies.forEach((freq, index) => {
      const osc = context.createOscillator()
      const gain = context.createGain()
      const startTime = now + index * 0.14
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, startTime)
      gain.gain.setValueAtTime(0.12, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.42)
      osc.connect(gain)
      gain.connect(context.destination)
      osc.start(startTime)
      osc.stop(startTime + 0.45)
    })
  } catch {
    // Audio autoplay restrictions or headless environment
  }
}
