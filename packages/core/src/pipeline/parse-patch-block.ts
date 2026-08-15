export interface ParsedPatchBlock {
  patch: string
  summary: string
  target?: string
}

export function parsePatchBlock(raw: string): ParsedPatchBlock | null {
  const patchMatch = raw.match(/<<<PATCH>>>([\s\S]*?)<<<END PATCH>>>/)
  const summaryMatch = raw.match(/<<<SUMMARY>>>([\s\S]*?)<<<END SUMMARY>>>/)
  const targetMatch = raw.match(/<<<TARGET>>>([\s\S]*?)<<<END TARGET>>>/)
  const patch = patchMatch?.[1]?.trim()
  const summary = summaryMatch?.[1]?.trim()
  const target = targetMatch?.[1]?.trim()

  if (!patch || !summary) return null

  return target ? { patch, summary, target } : { patch, summary }
}
