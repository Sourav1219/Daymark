export type GroupStudyPollSnapshot = Readonly<{
  participantCount: number
  version: number
}>

/** Room membership changes independently from the room settings version. */
export function groupStudySnapshotChanged(
  previous: GroupStudyPollSnapshot,
  next: GroupStudyPollSnapshot,
) {
  return (
    previous.version !== next.version ||
    previous.participantCount !== next.participantCount
  )
}
