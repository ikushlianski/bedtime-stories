import { sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { storyEmbeddings, stories } from '../db/schema.js'
import { env } from '../env.js'
import { OpenRouterClient } from '../openrouter/openrouter.client.js'
import { EMBEDDING_MODEL } from '../pipeline/embed-story.js'
import { deriveRecallAtK } from '../pipeline/eval-recall.js'

const UNIVERSE_ID = 1
const K = 5
const OVERALL_RECALL_THRESHOLD = 0.8

interface EvalQuery {
  query: string
  expectedIds: number[]
  note: string
}

const EVAL_QUERIES: EvalQuery[] = [
  {
    query: 'ребёнок один в тёмной комнате, свет неожиданно погас, страшно',
    expectedIds: [108, 72],
    note: 'darkness/scared-of-the-dark theme',
  },
  {
    query: 'история, где Максим — главный герой и рассказывает от своего имени',
    expectedIds: [42],
    note: 'character Maxim as protagonist, not a supporting role',
  },
  {
    query: 'мальчик нашёл деньги на улице или в песке',
    expectedIds: [8, 58],
    note: 'found money on the ground',
  },
  {
    query: 'рыбки в аквариуме, что-то странное пропало или случилось',
    expectedIds: [65, 66, 77],
    note: 'aquarium mystery',
  },
  {
    query: 'ребёнок учится играть в шахматы, ходит конём',
    expectedIds: [88],
    note: 'learning chess',
  },
  {
    query: 'первая ночь в гостях у бабушки, всё непривычное',
    expectedIds: [14, 15],
    note: 'first night at grandma\'s house',
  },
  {
    query: 'бассейн, плавательная шапочка, немного страшно в воде',
    expectedIds: [17],
    note: 'swimming pool fear',
  },
  {
    query: 'друг делится секретом, связанным с камушками',
    expectedIds: [55, 31, 91],
    note: 'friend shares a secret about pebbles',
  },
  {
    query: 'гроза и молния ночью на даче у бабушки, страшно',
    expectedIds: [92],
    note: 'thunderstorm at night at the dacha',
  },
  {
    query: 'ребёнок нашёл старый компас в коробке у бабушки',
    expectedIds: [51],
    note: 'found an old compass',
  },
]

interface RankedRow {
  storyId: number
  storyTitle: string | null
  distance: number
}

async function rankCorpus(client: OpenRouterClient, query: string): Promise<RankedRow[]> {
  const { embeddings } = await client.embed([query], EMBEDDING_MODEL)
  const queryVector = embeddings[0]

  if (queryVector === undefined) {
    throw new Error(`embed() returned no vector for query: ${query}`)
  }

  const queryVectorLiteral = JSON.stringify(queryVector)
  const distanceExpr = sql<number>`${storyEmbeddings.embedding} <=> ${queryVectorLiteral}::vector`

  const rows = await db
    .select({
      storyId: storyEmbeddings.storyId,
      storyTitle: stories.title,
      distance: distanceExpr,
    })
    .from(storyEmbeddings)
    .innerJoin(stories, sql`${stories.id} = ${storyEmbeddings.storyId}`)
    .where(sql`${storyEmbeddings.universeId} = ${UNIVERSE_ID}`)
    .orderBy(distanceExpr)
    .limit(K)

  return rows
}

async function main(): Promise<void> {
  const client = new OpenRouterClient(env.OPENROUTER_API_KEY)
  const perQueryRecall: number[] = []

  console.log(`Running retrieval eval against universe ${UNIVERSE_ID} (model: ${EMBEDDING_MODEL}, k=${K})\n`)

  for (const evalQuery of EVAL_QUERIES) {
    const ranked = await rankCorpus(client, evalQuery.query)
    const rankedIds = ranked.map((r) => r.storyId)
    const recall = deriveRecallAtK(rankedIds, evalQuery.expectedIds, K)

    perQueryRecall.push(recall)

    const status = recall > 0 ? 'PASS' : 'FAIL'
    console.log(`[${status}] "${evalQuery.query}" (${evalQuery.note})`)
    console.log(`  expected: [${evalQuery.expectedIds.join(', ')}]  recall@${K}: ${recall.toFixed(2)}`)
    console.log(
      `  got: ${ranked.map((r) => `${r.storyId} «${r.storyTitle ?? 'Без названия'}» (${r.distance.toFixed(4)})`).join(' | ')}`,
    )
    console.log('')
  }

  const overallRecall = perQueryRecall.reduce((sum, r) => sum + r, 0) / perQueryRecall.length
  const overallStatus = overallRecall >= OVERALL_RECALL_THRESHOLD ? 'PASS' : 'FAIL'

  console.log(`Overall recall@${K}: ${overallRecall.toFixed(3)} (threshold: ${OVERALL_RECALL_THRESHOLD}) — ${overallStatus}`)

  if (overallStatus === 'FAIL') {
    process.exitCode = 1
  }
}

await main()
