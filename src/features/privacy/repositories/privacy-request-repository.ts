import "server-only"

import { desc, eq } from "drizzle-orm"

import type { DatabaseExecutor } from "@/db/client"
import { privacyRequests } from "@/db/schema"
import {
  privacyRequestTypeLabels,
  type PrivacyRequestType,
  type PrivacyRequestView,
} from "@/features/privacy/domain/privacy-request"

function toView(
  request: typeof privacyRequests.$inferSelect,
): PrivacyRequestView {
  return {
    createdAt: request.createdAt.toISOString(),
    details: request.details,
    id: request.id,
    status: request.status,
    ticketNumber: request.ticketNumber,
    type: privacyRequestTypeLabels[request.type],
  }
}

export async function createPrivacyRequest(
  database: DatabaseExecutor,
  input: Readonly<{
    details: string
    requesterEmail: string
    ticketNumber: string
    type: PrivacyRequestType
    userId: string | null
  }>,
): Promise<PrivacyRequestView> {
  const [created] = await database
    .insert(privacyRequests)
    .values(input)
    .returning()

  if (!created) throw new Error("Unable to create privacy request")
  return toView(created)
}

export async function listPrivacyRequestsForUser(
  database: DatabaseExecutor,
  userId: string,
): Promise<readonly PrivacyRequestView[]> {
  const rows = await database
    .select()
    .from(privacyRequests)
    .where(eq(privacyRequests.userId, userId))
    .orderBy(desc(privacyRequests.createdAt))

  return rows.map(toView)
}
