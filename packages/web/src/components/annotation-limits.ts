export const SELECTED_TEXT_MAX_LENGTH = 2000

export const NOTE_TEXT_MAX_LENGTH = 2000

export function isSelectionWithinLimit(text: string): boolean {
  return text.length <= SELECTED_TEXT_MAX_LENGTH
}

export function isNoteTextWithinLimit(text: string): boolean {
  return text.length <= NOTE_TEXT_MAX_LENGTH
}

export const SELECTION_TOO_LONG_MESSAGE =
  `Слишком большой фрагмент текста. Выделите отрывок покороче (максимум ${SELECTED_TEXT_MAX_LENGTH} символов).`
