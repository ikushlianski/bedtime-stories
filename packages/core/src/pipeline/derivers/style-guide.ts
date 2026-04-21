export interface StyleGuideSubsections {
  works: string
  doesntWork: string
  techniques: string
  minimize: string
}

export function compileStyleGuide(sections: StyleGuideSubsections): string {
  const parts: string[] = []

  if (sections.works.trim()) {
    parts.push(`## Что работает\n${sections.works.trim()}`)
  }

  if (sections.doesntWork.trim()) {
    parts.push(`## Что не работает\n${sections.doesntWork.trim()}`)
  }

  if (sections.techniques.trim()) {
    parts.push(`## Предпочтительные техники\n${sections.techniques.trim()}`)
  }

  if (sections.minimize.trim()) {
    parts.push(`## Минимизировать\n${sections.minimize.trim()}`)
  }

  return parts.join('\n\n')
}
