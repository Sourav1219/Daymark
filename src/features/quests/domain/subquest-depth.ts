/**
 * Subquests nest under a parent Quest with a deliberately limited depth.
 * Depth 0 = top-level Quest, depth 1 = Subquest, depth 2 = nested Subquest.
 */
export const maxSubquestDepth = 2

/**
 * A new Quest may nest under a parent whose ancestor chain has this many
 * levels: the child's own depth becomes `ancestorCount + 1`.
 */
export function canNestUnder(ancestorCount: number): boolean {
  return ancestorCount + 1 <= maxSubquestDepth
}
