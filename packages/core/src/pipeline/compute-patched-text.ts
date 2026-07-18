export interface ComputePatchedTextInput {
  currentText: string
  find: string
  replace: string
}

export type ComputePatchedTextResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'not_found' }

export function computePatchedText({ currentText, find, replace }: ComputePatchedTextInput): ComputePatchedTextResult {
  if (!currentText.includes(find)) {
    return { ok: false, reason: 'not_found' }
  }

  return { ok: true, text: currentText.replace(find, replace) }
}
