import {
  BarChart3,
  Clock3,
  DoorOpen,
  History,
  Play,
  Sparkles,
  TimerReset,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react"

import { LoadingPlaceholder } from "@/components/system/loading-placeholder"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function TimerLoadingState() {
  return (
    <div
      aria-label="Loading Timer"
      className="timer-page exact-route-loading"
      role="status"
    >
      <span className="sr-only">Loading Timer</span>
      <header className="timer-page-header">
        <div>
          <p className="timer-page-eyebrow">Focus timer</p>
          <h1>Timer</h1>
          <p>Give one thing your full attention.</p>
        </div>
      </header>

      <section
        aria-hidden="true"
        className="timer-focus-card"
        data-state="ready"
      >
        <span className="timer-focus-orb timer-focus-orb--one" />
        <span className="timer-focus-orb timer-focus-orb--two" />
        <div className="timer-focus-topline">
          <div>
            <span className="timer-focus-icon">
              <TimerReset />
            </span>
            <div>
              <p>Your focus room</p>
              <h2>Ready when you are</h2>
            </div>
          </div>
          <span className="timer-status-pill" data-state="ready">
            <span /> Ready
          </span>
        </div>

        <div className="timer-clock-wrap">
          <div className="timer-clock">
            <span className="timer-clock-unit">
              <strong>00</strong>
              <small>Hours</small>
            </span>
            <span className="timer-clock-separator">:</span>
            <span className="timer-clock-unit">
              <strong>00</strong>
              <small>Minutes</small>
            </span>
            <span className="timer-clock-separator">:</span>
            <span className="timer-clock-unit">
              <strong>00</strong>
              <small>Seconds</small>
            </span>
          </div>
        </div>

        <div className="timer-start-form">
          <label>What will you focus on?</label>
          <div>
            <Input
              className="timer-subject-input"
              disabled
              placeholder="e.g. Read chapter four"
            />
            <Button className="timer-start-button" disabled>
              <Play /> Start timer
            </Button>
          </div>
        </div>
        <p className="timer-background-note">
          <Sparkles /> Keeps counting while you work in another tab.
        </p>
      </section>

      <section aria-hidden="true" className="group-study">
        <div className="timer-section-heading group-study__heading">
          <div>
            <p>Study together</p>
            <h2>Group Study</h2>
          </div>
          <span className="group-study__heading-icon">
            <Users />
          </span>
        </div>
        <div className="group-study__lobby">
          <div className="group-study__intro">
            <span>
              <Sparkles />
            </span>
            <div>
              <h3>Open a shared focus room</h3>
              <p>
                Study together while every person keeps complete control of
                their own timer.
              </p>
            </div>
          </div>
          <div className="group-study__lobby-grid">
            <div className="group-study__form">
              <span className="group-study__form-icon">
                <Users />
              </span>
              <div>
                <h3>Create a room</h3>
                <p>Choose the shared study topic and invite your people.</p>
              </div>
              <LoadingInput label="Room name" />
              <LoadingInput label="Study objective" />
              <LoadingInput label="Participant limit" />
              <Button className="group-study__join-button" disabled>
                <Play /> Create &amp; start
              </Button>
            </div>
            <span className="group-study__divider">or</span>
            <div className="group-study__form">
              <span className="group-study__form-icon group-study__form-icon--join">
                <UserPlus />
              </span>
              <div>
                <h3>Join with a code</h3>
                <p>Enter the active room code shared by another student.</p>
              </div>
              <LoadingInput label="Room code" />
              <Button disabled variant="outline">
                <DoorOpen /> Join room
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section aria-hidden="true" className="timer-overview">
        <div className="timer-section-heading">
          <div>
            <p>At a glance</p>
            <h2>Your focus</h2>
          </div>
          <TrendingUp />
        </div>
        <div className="timer-metrics-grid">
          <TimerMetric icon="clock" label="Today's focus" tone="blue" />
          <TimerMetric icon="chart" label="Sessions" tone="violet" />
          <TimerMetric icon="trend" label="Best session" tone="cyan" />
        </div>
      </section>

      <section aria-hidden="true" className="timer-history-section">
        <div className="timer-section-heading">
          <div>
            <p>Today&apos;s focus record</p>
            <h2>Today&apos;s timer history</h2>
          </div>
          <span className="timer-history-count">
            <History /> <LoadingPlaceholder className="exact-loading__count" />
          </span>
        </div>
        <article className="timer-history-card">
          <div className="timer-history-index">
            <span>01</span>
          </div>
          <div className="timer-history-content">
            <LoadingPlaceholder className="exact-loading__line exact-loading__line--title" />
            <LoadingPlaceholder className="exact-loading__line exact-loading__line--body" />
            <div className="timer-history-progress">
              <LoadingPlaceholder />
            </div>
          </div>
          <LoadingPlaceholder className="exact-loading__duration" />
        </article>
      </section>
    </div>
  )
}

function LoadingInput({ label }: Readonly<{ label: string }>) {
  return (
    <>
      <label>{label}</label>
      <LoadingPlaceholder className="exact-loading__input" />
    </>
  )
}

function TimerMetric({
  icon,
  label,
  tone,
}: Readonly<{
  icon: "chart" | "clock" | "trend"
  label: string
  tone: "blue" | "cyan" | "violet"
}>) {
  const Icon =
    icon === "clock" ? Clock3 : icon === "chart" ? BarChart3 : TrendingUp

  return (
    <article className="timer-metric-card" data-tone={tone}>
      <span>
        <Icon />
      </span>
      <strong>
        <LoadingPlaceholder className="exact-loading__metric" />
      </strong>
      <p>{label}</p>
    </article>
  )
}
