"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { restoreQuestAction } from "@/features/quests/application/actions"
import { RestoreQuestScheduleDialog } from "@/features/quests/components/restore-quest-schedule-dialog"
import type { TodayCard } from "@/features/today/types"

export function HomeDeletedRows({
  cards,
  referenceNow,
  timezone,
}: Readonly<{
  cards: readonly TodayCard[]
  referenceNow: string
  timezone: string
}>) {
  return (
    <section
      aria-label="Recently deleted"
      className="today-section home-deleted"
    >
      <div className="today-section__heading">
        <h2 className="today-section__title">Recently deleted</h2>
        <span>
          {cards.length} {cards.length === 1 ? "task" : "tasks"}
        </span>
      </div>
      <p className="home-history-note">
        Tasks can only be restored on the day they were deleted.
      </p>
      <div className="today-section__cards">
        {cards.map((card) => (
          <DeletedRow
            card={card}
            key={card.id}
            referenceNow={referenceNow}
            timezone={timezone}
          />
        ))}
      </div>
    </section>
  )
}

function DeletedRow({
  card,
  referenceNow,
  timezone,
}: Readonly<{ card: TodayCard; referenceNow: string; timezone: string }>) {
  const [pending, startTransition] = useTransition()
  const [restored, setRestored] = useState(false)
  const router = useRouter()
  const needsSchedule =
    card.status === "failed" ||
    (card.status === "open" && card.dueAt && card.dueAt < referenceNow)
  if (restored) return null
  return (
    <article aria-label={`Deleted: ${card.title}`} className="home-deleted-row">
      <Trash2 aria-hidden="true" />
      <div>
        <strong>{card.title}</strong>
        <small>
          Deleted{" "}
          {card.deletedAt
            ? new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
                timeZone: timezone,
              }).format(new Date(card.deletedAt))
            : "recently"}
        </small>
      </div>
      {needsSchedule ? (
        <RestoreQuestScheduleDialog
          input={{ questId: card.id, expectedVersion: card.version }}
          onRestored={() => setRestored(true)}
          timezone={timezone}
          title={card.title}
        />
      ) : (
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await restoreQuestAction({
                  questId: card.id,
                  expectedVersion: card.version,
                })
                if (!result.ok) {
                  toast.error(result.error.message)
                  return
                }
                setRestored(true)
                toast.success("Task restored")
                router.refresh()
              } catch {
                toast.error("Could not restore this task. Please retry.")
              }
            })
          }
          type="button"
        >
          <Undo2 aria-hidden="true" />
          {pending ? "Restoring…" : "Restore"}
        </button>
      )}
    </article>
  )
}
