import { Client } from '@notionhq/client'
import type { PageObjectResponse, RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints.js'
import { db } from '../db/client.js'
import { stories } from '../db/schema.js'
import type { NewStory } from '../db/types.js'
import { env } from '../env.js'

function getNotionCredentials(): { token: string; databaseId: string } {
  const token = env.NOTION_TOKEN
  const databaseId = env.NOTION_DATABASE_ID

  if (!token || !databaseId) {
    throw new Error('NOTION_TOKEN and NOTION_DATABASE_ID must be set in environment variables')
  }

  return { token, databaseId }
}

function extractPlainText(richText: RichTextItemResponse[]): string {
  return richText.map((block) => block.plain_text).join('')
}

function mapPageToStory(page: PageObjectResponse): NewStory | null {
  const props = page.properties

  const titleProp = Object.values(props).find((p) => p.type === 'title')

  if (!titleProp || titleProp.type !== 'title') {
    console.warn(`Page ${page.id}: missing title property, skipping`)

    return null
  }

  const title = extractPlainText(titleProp.title)

  const textProp = props['Text']

  if (!textProp || textProp.type !== 'rich_text' || textProp.rich_text.length === 0) {
    console.warn(`Page ${page.id} ("${title}"): missing or empty "Text" property, skipping`)

    return null
  }

  const textFinal = extractPlainText(textProp.rich_text)

  const statusProp = props['Status']
  let status: 'ready' | 'read' = 'ready'

  if (statusProp) {
    if (statusProp.type === 'checkbox' && statusProp.checkbox) {
      status = 'read'
    } else if (statusProp.type === 'select' && statusProp.select?.name?.toLowerCase() === 'read') {
      status = 'read'
    } else if (statusProp.type === 'status' && statusProp.status?.name?.toLowerCase() === 'read') {
      status = 'read'
    }
  }

  const tagsProp = props['Tags']
  const tags: string[] =
    tagsProp?.type === 'multi_select' ? tagsProp.multi_select.map((tag) => tag.name) : []

  return {
    title,
    seed: '',
    textFinal,
    isLegacy: true,
    source: 'legacy',
    status,
    tags,
    planV1: null,
    planFinal: null,
    textV1: null,
    textV2: null,
    plotterModel: null,
    plotterPromptVersion: null,
    plotCriticModel: null,
    plotCriticPromptVersion: null,
    writerModel: null,
    writerPromptVersion: null,
    writerCriticModel: null,
    writerCriticPromptVersion: null,
    createdAt: new Date(page.created_time),
    discussionQuestions: [],
  }
}

async function fetchAllPages(notion: Client, databaseId: string): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = []
  let cursor: string | null = null

  do {
    const response = await notion.databases.query(
      cursor
        ? { database_id: databaseId, start_cursor: cursor }
        : { database_id: databaseId },
    )

    for (const result of response.results) {
      if (result.object === 'page' && 'properties' in result && 'created_time' in result) {
        pages.push(result as PageObjectResponse)
      }
    }

    cursor = response.has_more ? response.next_cursor : null
  } while (cursor !== null)

  return pages
}

async function run(): Promise<void> {
  const { token, databaseId } = getNotionCredentials()

  const notion = new Client({ auth: token })

  console.log('Fetching pages from Notion...')

  const pages = await fetchAllPages(notion, databaseId)

  console.log(`Fetched ${pages.length} pages from Notion`)

  let inserted = 0
  let skipped = 0

  for (const page of pages) {
    try {
      const row = mapPageToStory(page)

      if (!row) {
        skipped++
        continue
      }

      const result = await db.insert(stories).values(row).onConflictDoNothing().returning({ id: stories.id })

      if (result.length > 0) {
        inserted++
      } else {
        skipped++
      }
    } catch (err) {
      console.error(`Page ${page.id}: failed to import —`, err)
      skipped++
    }
  }

  console.log(`Import complete: ${inserted} inserted, ${skipped} skipped`)
}

run().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
