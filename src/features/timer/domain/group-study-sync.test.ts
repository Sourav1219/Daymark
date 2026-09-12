import { describe, expect, it } from "vitest"

import { groupStudySnapshotChanged } from "./group-study-sync"

describe("groupStudySnapshotChanged", () => {
  it("detects a participant joining even when the room version is unchanged", () => {
    expect(
      groupStudySnapshotChanged(
        {
          activityCount: 1,
          joinRequestCount: 0,
          participantCount: 1,
          version: 4,
        },
        {
          activityCount: 2,
          joinRequestCount: 0,
          participantCount: 2,
          version: 4,
        },
      ),
    ).toBe(true)
  })

  it("ignores a stable room snapshot", () => {
    expect(
      groupStudySnapshotChanged(
        {
          activityCount: 2,
          joinRequestCount: 0,
          participantCount: 2,
          version: 4,
        },
        {
          activityCount: 2,
          joinRequestCount: 0,
          participantCount: 2,
          version: 4,
        },
      ),
    ).toBe(false)
  })

  it("detects timer activity and pending-request changes", () => {
    const previous = {
      activityCount: 2,
      joinRequestCount: 0,
      participantCount: 2,
      version: 4,
    }

    expect(
      groupStudySnapshotChanged(previous, {
        ...previous,
        activityCount: 3,
      }),
    ).toBe(true)
    expect(
      groupStudySnapshotChanged(previous, {
        ...previous,
        joinRequestCount: 1,
      }),
    ).toBe(true)
  })
})
