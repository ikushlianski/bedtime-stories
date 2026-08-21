export const MARKER_LIMIT = 6

export interface ValidateMarkerLimitInput {
  currentMarkerCount: number
}

export interface ValidateMarkerLimitResult {
  allowed: boolean
  reason?: string
}

export function validateMarkerLimit(input: ValidateMarkerLimitInput): ValidateMarkerLimitResult {
  if (input.currentMarkerCount >= MARKER_LIMIT) {
    return {
      allowed: false,
      reason: `Достигнут лимит отметок для иллюстрации (максимум ${MARKER_LIMIT} на историю)`,
    }
  }

  return { allowed: true }
}
