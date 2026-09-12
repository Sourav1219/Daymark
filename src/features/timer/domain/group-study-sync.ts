export type GroupStudyPollSnapshot = Readonly<{
  activityCount: number
  joinRequestCount: number
  participantCount: number
  version: number
}>

/** Participant activity and join requests change independently from the room version. */
export function groupStudySnapshotChanged(
  previous: GroupStudyPollSnapshot,
  next: GroupStudyPollSnapshot,
) {
  return (
    previous.activityCount !== next.activityCount ||
    previous.joinRequestCount !== next.joinRequestCount ||
    previous.version !== next.version ||
    previous.participantCount !== next.participantCount
  )
}
