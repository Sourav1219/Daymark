import { describe, expect, it } from "vitest"

import { groupStudySnapshotChanged } from "./group-study-sync"

describe("groupStudySnapshotChanged", () => {
  it("detects a participant joining even when the room version is unchanged", () => {
    expect(
      groupStudySnapshotChanged(
        { participantCount: 1, version: 4 },
        { participantCount: 2, version: 4 },
      ),
    ).toBe(true)
  })

  it("ignores a stable room snapshot", () => {
    expect(
      groupStudySnapshotChanged(
        { participantCount: 2, version: 4 },
        { participantCount: 2, version: 4 },
      ),
    ).toBe(false)
  })
})
