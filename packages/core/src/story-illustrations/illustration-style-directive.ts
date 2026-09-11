export function buildIllustrationStyleDirective(): string {
  return [
    'The final attached image is the sole style anchor for this picture — match its art style (linework, coloring, rendering technique) exactly. Do not copy its subject or scene.',
    "Picture-book illustration style suitable for a children's bedtime story — warm, gentle, appropriate for a young child. Depict the full scene, not an isolated portrait.",
  ].join('\n\n')
}
