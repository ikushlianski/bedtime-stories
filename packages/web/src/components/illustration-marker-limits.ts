export const ILLUSTRATION_MARKER_LIMIT = 6

export function isIllustrationMarkerLimitReached(currentMarkerCount: number): boolean {
  return currentMarkerCount >= ILLUSTRATION_MARKER_LIMIT
}

export const ILLUSTRATION_MARKER_LIMIT_MESSAGE = `Достигнут лимит отметок для иллюстрации (максимум ${ILLUSTRATION_MARKER_LIMIT})`
