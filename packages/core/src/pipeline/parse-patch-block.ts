export interface ParsedPatchBlock {
  patch: string
  summary: string
}

export function parsePatchBlock(raw: string): ParsedPatchBlock | null {
  const patchMatch = raw.match(/<<<PATCH>>>([\s\S]*?)<<<END PATCH>>>/)
  const summaryMatch = raw.match(/<<<SUMMARY>>>([\s\S]*?)<<<END SUMMARY>>>/)
  const patch = patchMatch?.[1]?.trim()
  const summary = summaryMatch?.[1]?.trim()

  if (!patch || !summary) return null

  return { patch, summary }
}
