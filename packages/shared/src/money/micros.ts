export type UsdMicros = number

export const MICROS_PER_USD = 1_000_000

export function toMicros(usd: string | number): UsdMicros | null {
  const n = typeof usd === 'string' ? parseFloat(usd) : usd

  if (!Number.isFinite(n)) return null

  return Math.round(n * MICROS_PER_USD)
}

export function formatMicros(micros: UsdMicros, decimals = 4): string {
  return (micros / MICROS_PER_USD).toFixed(decimals)
}
