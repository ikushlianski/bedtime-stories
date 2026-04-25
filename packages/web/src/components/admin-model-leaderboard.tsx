import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { MICROS_PER_USD } from '@bedtime/shared/money/micros'

interface LeaderboardData {
  joyPerDollar: Array<{ model: string; avgJoyPerMicro: number | null; sampleSize: number }>
  planIterationsPerModel: Array<{ model: string; avgPlanIterations: number; sampleSize: number }>
  swapRatePerModel: Array<{ model: string; swapsAway: number; totalUses: number; swapRate: number }>
  tokensPerChar: Array<{ model: string; tokensPerChar: number | null }>
  freeTierCompletionRate: { rate: number; freeOnlyStoryCount: number; totalStoryCount: number }
}

export default function AdminModelLeaderboard() {
  const [data, setData] = useState<LeaderboardData | null>(null)

  useEffect(() => {
    api.admin.modelLeaderboard().then(setData).catch(() => setData(null))
  }, [])

  if (!data) return <p className="text-sm text-base-content/60">Загрузка…</p>

  const ftc = data.freeTierCompletionRate

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section>
        <h3 className="font-semibold mb-2">Joy / $</h3>
        <table className="table table-xs">
          <thead><tr><th>Модель</th><th>Среднее</th><th>n</th></tr></thead>
          <tbody>
            {data.joyPerDollar.map((r) => (
              <tr key={r.model}>
                <td className="font-mono text-xs">{r.model}</td>
                <td>{r.avgJoyPerMicro === null ? '—' : (r.avgJoyPerMicro * MICROS_PER_USD).toFixed(1)}</td>
                <td>{r.sampleSize}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="font-semibold mb-2">Plan iterations / модель</h3>
        <table className="table table-xs">
          <thead><tr><th>Модель</th><th>avg</th><th>n</th></tr></thead>
          <tbody>
            {data.planIterationsPerModel.map((r) => (
              <tr key={r.model}>
                <td className="font-mono text-xs">{r.model}</td>
                <td>{r.avgPlanIterations.toFixed(2)}</td>
                <td>{r.sampleSize}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="font-semibold mb-2">Swap rate / модель</h3>
        <table className="table table-xs">
          <thead><tr><th>Модель</th><th>swaps</th><th>uses</th><th>rate</th></tr></thead>
          <tbody>
            {data.swapRatePerModel.map((r) => (
              <tr key={r.model}>
                <td className="font-mono text-xs">{r.model}</td>
                <td>{r.swapsAway}</td>
                <td>{r.totalUses}</td>
                <td>{(r.swapRate * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="font-semibold mb-2">Tokens / char (writer)</h3>
        <table className="table table-xs">
          <thead><tr><th>Модель</th><th>t/c</th></tr></thead>
          <tbody>
            {data.tokensPerChar.map((r) => (
              <tr key={r.model}>
                <td className="font-mono text-xs">{r.model}</td>
                <td>{r.tokensPerChar === null ? '—' : r.tokensPerChar.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="md:col-span-2">
        <h3 className="font-semibold mb-2">Free-tier completion rate</h3>
        <p className="text-2xl">
          {(ftc.rate * 100).toFixed(0)}%
          <span className="text-sm text-base-content/60 ml-2">
            ({ftc.freeOnlyStoryCount} / {ftc.totalStoryCount} историй)
          </span>
        </p>
      </section>
    </div>
  )
}
