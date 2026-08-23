"use client"

import { CommandMenu } from "@/components/shell/command-menu"
import { NotificationMenu } from "@/features/reminders/components/notification-menu"
import type { ReminderInboxData } from "@/features/reminders/domain/types"

export function TopCommandArea({
  inbox,
  referenceNow,
  timezone,
}: Readonly<{
  inbox: ReminderInboxData
  referenceNow: string
  timezone: string
}>) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
      <CommandMenu />
      <NotificationMenu
        inbox={inbox}
        referenceNow={referenceNow}
        timezone={timezone}
      />
    </div>
  )
}
