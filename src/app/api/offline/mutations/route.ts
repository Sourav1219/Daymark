import { NextResponse } from "next/server"

import { getDatabase } from "@/db/client"
import { requireWorkspaceAccess } from "@/features/authentication/server/authorization"
import { QuestServiceError } from "@/features/quests/domain/errors"
import { isTrustedOriginRequest } from "@/lib/http/same-origin"
import {
  completeQuest,
  createQuest,
  editQuest,
  reopenQuest,
  softDeleteQuest,
} from "@/features/quests/mutations/quest-mutation-service"
import { findQuestRecord } from "@/features/quests/repositories/quest-repository"
import {
  parseCreateQuestForm,
  parseEditQuestForm,
} from "@/features/quests/validation/quest-validation"
import type { OfflineMutationResult } from "@/features/offline/domain/types"
import { offlineMutationRequestSchema } from "@/features/offline/validation/offline-mutation-validation"
import { getUserSettings } from "@/features/reminders/queries/user-settings-query-service"
import { readServerEnv } from "@/lib/env/server"
import { enforceRateLimit } from "@/lib/rate-limit/rate-limiter"

export const dynamic = "force-dynamic"

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
}
const maximumBodyBytes = 32_768

type BodyReadResult =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ message: string; ok: false; status: 400 | 413 | 415 }>

function json(body: OfflineMutationResult, status = 200) {
  return NextResponse.json(body, { headers: responseHeaders, status })
}

function allowedOrigins(): readonly string[] {
  return [new URL(readServerEnv().BETTER_AUTH_URL).origin]
}

async function readBoundedJson(request: Request): Promise<BodyReadResult> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? ""
  if (!contentType.startsWith("application/json")) {
    return {
      message: "Mutation payloads must use application/json.",
      ok: false,
      status: 415,
    }
  }

  const declaredLength = request.headers.get("content-length")
  if (declaredLength !== null) {
    const bytes = Number(declaredLength)
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      return {
        message: "Enter a valid mutation payload.",
        ok: false,
        status: 400,
      }
    }
    if (bytes > maximumBodyBytes) {
      return {
        message: "Mutation payload is too large.",
        ok: false,
        status: 413,
      }
    }
  }

  if (!request.body) {
    return {
      message: "Enter a valid mutation payload.",
      ok: false,
      status: 400,
    }
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalBytes += value.byteLength
      if (totalBytes > maximumBodyBytes) {
        await reader.cancel()
        return {
          message: "Mutation payload is too large.",
          ok: false,
          status: 413,
        }
      }
      chunks.push(value)
    }

    const body = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }

    return {
      ok: true,
      value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)),
    }
  } catch {
    return {
      message: "Enter a valid mutation payload.",
      ok: false,
      status: 400,
    }
  } finally {
    reader.releaseLock()
  }
}

export async function POST(request: Request) {
  if (!isTrustedOriginRequest(request, allowedOrigins())) {
    return NextResponse.json(
      { message: "Cross-site mutation requests are not allowed." },
      { headers: responseHeaders, status: 403 },
    )
  }

  const body = await readBoundedJson(request)
  if (!body.ok) {
    return NextResponse.json(
      { message: body.message },
      { headers: responseHeaders, status: body.status },
    )
  }

  const parsed = offlineMutationRequestSchema.safeParse(body.value)
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Enter a valid, bounded mutation payload." },
      { headers: responseHeaders, status: 422 },
    )
  }

  const access = await requireWorkspaceAccess(parsed.data.workspaceId)
  const limit = await enforceRateLimit({
    headers: request.headers,
    policy: "offlineMutation",
    userId: access.userId,
  })
  if (limit && !limit.success) {
    return NextResponse.json(
      { message: "Too many offline mutations. Retry shortly." },
      { headers: responseHeaders, status: 429 },
    )
  }
  const database = getDatabase()

  try {
    if (parsed.data.type === "create") {
      const settings = await getUserSettings(access)
      // A task queued while offline may sync after its window closed. Accept it
      // here and let the overdue sweep settle it, rather than losing the work.
      const command = parseCreateQuestForm(
        parsed.data.payload,
        settings.timezone,
        { allowElapsedSchedule: true },
      )
      if (!command.success) {
        return json(
          {
            message: "The queued task is no longer valid. Review its fields.",
            mutationId: parsed.data.id,
            status: "rejected",
          },
          422,
        )
      }
      const quest = await createQuest(
        database,
        access,
        command.data,
        parsed.data.id,
        parsed.data.id,
      )
      return json({ mutationId: parsed.data.id, quest, status: "applied" })
    }

    if (parsed.data.type === "edit") {
      const settings = await getUserSettings(access)
      const command = parseEditQuestForm(parsed.data.payload, settings.timezone)
      if (!command.success) {
        return json(
          {
            message: "The queued edit is no longer valid. Review its fields.",
            mutationId: parsed.data.id,
            status: "rejected",
          },
          422,
        )
      }
      const quest = await editQuest(
        database,
        access,
        command.data,
        parsed.data.id,
      )
      return json({ mutationId: parsed.data.id, quest, status: "applied" })
    }

    const quest =
      parsed.data.type === "complete"
        ? await completeQuest(
            database,
            access,
            parsed.data.payload,
            new Date(),
            parsed.data.id,
          )
        : parsed.data.type === "delete"
          ? await softDeleteQuest(database, access, parsed.data.payload)
          : await reopenQuest(database, access, parsed.data.payload)
    return json({ mutationId: parsed.data.id, quest, status: "applied" })
  } catch (error) {
    if (!(error instanceof QuestServiceError)) throw error

    if (parsed.data.type !== "create" && error.code === "CONFLICT") {
      const current = await findQuestRecord(
        database,
        access,
        parsed.data.payload.questId,
        parsed.data.type === "delete" || parsed.data.type === "edit",
      )

      const desiredStateAlreadyApplied =
        (parsed.data.type === "complete" && current?.status === "completed") ||
        (parsed.data.type === "delete" && Boolean(current?.deletedAt)) ||
        (parsed.data.type === "reopen" && current?.status === "open")

      if (current && desiredStateAlreadyApplied) {
        return json({
          mutationId: parsed.data.id,
          quest: { id: current.id, version: current.version },
          status: "applied",
        })
      }

      return json(
        {
          conflict: {
            message:
              "This task changed on the server while the device was offline.",
            serverQuest: current
              ? {
                  id: current.id,
                  status: current.status,
                  title: current.title,
                  version: current.version,
                }
              : null,
          },
          mutationId: parsed.data.id,
          status: "conflict",
        },
        409,
      )
    }

    return json(
      {
        message:
          error.code === "CONFLICT"
            ? "The queued change conflicts with newer server data."
            : error.message,
        mutationId: parsed.data.id,
        status: "rejected",
      },
      error.code === "CONFLICT" ? 409 : 422,
    )
  }
}
