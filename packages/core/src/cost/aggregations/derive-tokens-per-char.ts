export interface TokensPerCharRow {
  model: string
  sumTokensOut: number
  sumOutputChars: number
}

export interface TokensPerCharResult {
  model: string
  tokensPerChar: number | null
}

export function deriveTokensPerChar(rows: TokensPerCharRow[]): TokensPerCharResult[] {
  return rows
    .map((r) => ({
      model: r.model,
      tokensPerChar: r.sumOutputChars === 0 ? null : r.sumTokensOut / r.sumOutputChars,
    }))
    .sort((a, b) => a.model.localeCompare(b.model))
}
