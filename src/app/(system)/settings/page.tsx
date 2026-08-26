import type { Metadata } from "next"
import Link from "next/link"
import { BellRing, Download, FileText, ShieldCheck } from "lucide-react"

import { PageHeading } from "@/components/system/page-heading"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { getQuestList } from "@/features/quests/queries/quest-query-service"
import { emailDeliveryEnabled } from "@/features/reminders/delivery/resend-reminder-provider"
import { ReminderManager } from "@/features/reminders/components/reminder-manager"
import { ReminderInboxPanel } from "@/features/reminders/components/notification-menu"
import {
  getReminderInbox,
  getReminderList,
} from "@/features/reminders/queries/reminder-query-service"
import { getUserSettings } from "@/features/reminders/queries/user-settings-query-service"
import { PwaInstallCard } from "@/features/offline/components/pwa-install-card"
import { OfflineStorageControl } from "@/features/offline/components/offline-storage-control"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const access = await requireWorkspaceAccess()
  const now = new Date()
  const [settings, reminders, quests, reminderInbox] = await Promise.all([
    getUserSettings(access),
    getReminderList(access),
    getQuestList(access, "active"),
    getReminderInbox(access, { now }),
  ])

  return (
    <div className="grid gap-section">
      <PageHeading
        description="Tune dates, reminders, and offline access around your routine."
        eyebrow="Settings"
        title="Settings"
      />
      <section aria-labelledby="preferences-heading" className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold" id="preferences-heading">
            Preferences
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Keep dates, reminders, and offline access aligned with your routine.
          </p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="border-border-soft bg-card/75 shadow-panel xl:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <BellRing
                  aria-hidden="true"
                  className="size-5 text-system-blue"
                />
                <div>
                  <CardTitle>Reminder inbox</CardTitle>
                  <CardDescription>
                    See open tasks with less than 30 minutes remaining.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ReminderInboxPanel
                inbox={reminderInbox}
                referenceNow={now.toISOString()}
                timezone={settings.timezone}
              />
            </CardContent>
          </Card>

          <Card className="border-border-soft bg-card/75 shadow-panel">
            <CardHeader>
              <div className="flex items-center gap-3">
                <BellRing
                  aria-hidden="true"
                  className="size-5 text-mana-violet"
                />
                <div>
                  <CardTitle>Task reminders</CardTitle>
                  <CardDescription>
                    Create, edit, or cancel one-shot delivery schedules.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ReminderManager
                emailDeliveryEnabled={emailDeliveryEnabled()}
                quests={quests.map(({ id, title }) => ({ id, title }))}
                reminders={reminders}
                timezone={settings.timezone}
              />
            </CardContent>
          </Card>

          <Card className="border-border-soft bg-card/75 shadow-panel">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Download aria-hidden="true" className="size-5 text-warning" />
                <div>
                  <CardTitle>Install and offline access</CardTitle>
                  <CardDescription>
                    Keep recent tasks and queued changes available offline.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <PwaInstallCard />
                <OfflineStorageControl />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border-soft bg-card/75 shadow-panel xl:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-5 text-system-blue"
                />
                <div>
                  <CardTitle>Legal and privacy</CardTitle>
                  <CardDescription>
                    Review how Traketo handles your data and the rules for using
                    the service.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Link
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-soft bg-background px-4 py-2 font-semibold text-system-blue transition-colors hover:bg-system-blue/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-system-blue"
                  href="/terms"
                >
                  <FileText aria-hidden="true" className="size-4" />
                  Terms of Service
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-soft bg-background px-4 py-2 font-semibold text-system-blue transition-colors hover:bg-system-blue/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-system-blue"
                  href="/privacy"
                >
                  <ShieldCheck aria-hidden="true" className="size-4" />
                  Privacy Policy
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
