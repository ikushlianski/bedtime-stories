export function appendFactToDescription(currentDescription: string, factText: string): string {
  if (!currentDescription.trim()) return `- ${factText}`
  return `${currentDescription}\n- ${factText}`
}
