export function deriveRecallAtK(rankedIds: number[], expectedIds: number[], k: number): number {
  if (expectedIds.length === 0) {
    return 0
  }

  const topK = new Set(rankedIds.slice(0, k))
  const found = expectedIds.filter((id) => topK.has(id))

  return found.length / expectedIds.length
}
