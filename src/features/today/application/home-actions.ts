"use server"

import { z } from "zod"
import { headers } from "next/headers"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { taskTypes } from "@/features/quests/domain/classification"
import { questPriorities } from "@/features/quests/domain/types"
import { getHomePage, getHomeFacets } from "@/features/today/queries/home-query"
import { getUserSettings } from "@/features/reminders/queries/user-settings-query-service"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

const requestSchema = z
  .object({
    bucket: z.enum(["active", "completed", "missed", "deleted"]),
    date: z.iso.date(),
    offset: z.number().int().min(0).max(100_000),
    filters: z
      .object({
        customType: z.string().trim().max(64).nullable(),
        taskType: z.enum(["any", ...taskTypes]),
        priority: z.enum(["any", ...questPriorities]),
        labelId: z.union([z.literal("any"), z.uuid()]),
        search: z.string().trim().max(160).optional(),
      })
      .strict(),
  })
  .strict()

async function checkHomeRateLimit(userId: string) {
  const limit = await enforceRateLimit({
    headers: await headers(),
    policy: "default",
    userId,
  })
  if (limit && !limit.success) {
    throw new Error(
      "Too many dashboard requests. Please slow down and try again shortly.",
    )
  }
}

export async function loadHomePage(input: z.infer<typeof requestSchema>) {
  const access = await requireWorkspaceAccess()
  await checkHomeRateLimit(access.userId)
  const request = requestSchema.parse(input)
  const settings = await getUserSettings(access)
  return getHomePage(
    access,
    request.bucket,
    request.date,
    settings.timezone,
    request.filters,
    request.offset,
  )
}

export async function loadHomePages(
  input: Omit<z.infer<typeof requestSchema>, "bucket" | "offset">,
) {
  const access = await requireWorkspaceAccess()
  await checkHomeRateLimit(access.userId)
  const request = requestSchema
    .omit({ bucket: true, offset: true })
    .parse(input)
  const settings = await getUserSettings(access)
  const [pages, facets] = await Promise.all([
    Promise.all(
      (["active", "completed", "missed"] as const).map((bucket) =>
        getHomePage(
          access,
          bucket,
          request.date,
          settings.timezone,
          request.filters,
        ),
      ),
    ),
    getHomeFacets(access),
  ])
  return { facets, pages }
}

export async function loadHomeFacets() {
  const access = await requireWorkspaceAccess()
  await checkHomeRateLimit(access.userId)
  return getHomeFacets(access)
}
