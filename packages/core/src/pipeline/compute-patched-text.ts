export interface ComputePatchedTextInput {
  currentText: string
  find: string
  replace: string
  lineIndex?: number
}

export type ComputePatchedTextResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'not_found' }

export function computePatchedText({ currentText, find, replace, lineIndex }: ComputePatchedTextInput): ComputePatchedTextResult {
  if (lineIndex !== undefined) {
    const lines = currentText.split('\n')

    if (lineIndex < 0 || lineIndex >= lines.length || lines[lineIndex] !== find) {
      return { ok: false, reason: 'not_found' }
    }

    lines[lineIndex] = replace

    return { ok: true, text: lines.join('\n') }
  }

  if (!currentText.includes(find)) {
    return { ok: false, reason: 'not_found' }
  }

  return { ok: true, text: currentText.replace(find, () => replace) }
}
