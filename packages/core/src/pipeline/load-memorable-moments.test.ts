import { describe, expect, it, vi, beforeEach } from 'vitest'
import { loadMemorableMoments } from './load-memorable-moments'

let mockRows: Array<{ type: string; selectedText: string | null; noteText: string | null; storyTitle: string | null }> = []

vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => mockRows),
            })),
          })),
        })),
      })),
    })),
  },
}))

describe('loadMemorableMoments', () => {
  beforeEach(() => {
    mockRows = []
  })

  it('returns an empty list when universeIds is empty, without querying the db', async () => {
    mockRows = [{ type: 'sasha_loved', selectedText: 'момент', noteText: null, storyTitle: null }]

    const result = await loadMemorableMoments([])

    expect(result).toEqual([])
  })

  it('returns an empty list when the universe has no qualifying rows', async () => {
    mockRows = []

    const result = await loadMemorableMoments([1])

    expect(result).toEqual([])
  })

  it('maps and caps qualifying rows into memorable moments', async () => {
    mockRows = [
      { type: 'sasha_loved', selectedText: 'Гоша нашёл рыбку', noteText: 'Саша смеялся', storyTitle: 'Рыбка' },
      { type: 'sasha_laughed', selectedText: 'Мира упала в лужу', noteText: null, storyTitle: 'Прогулка' },
    ]

    const result = await loadMemorableMoments([1])

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      type: 'sasha_loved',
      selectedText: 'Гоша нашёл рыбку',
      noteText: 'Саша смеялся',
      storyTitle: 'Рыбка',
    })
  })

  it('combines rows across multiple mixed universes', async () => {
    mockRows = [{ type: 'sasha_loved', selectedText: 'Гоша нашёл рыбку', noteText: null, storyTitle: 'Рыбка' }]

    const result = await loadMemorableMoments([1, 2])

    expect(result).toHaveLength(1)
  })

  it('drops rows with a null selectedText', async () => {
    mockRows = [{ type: 'sasha_loved', selectedText: null, noteText: null, storyTitle: null }]

    const result = await loadMemorableMoments([1])

    expect(result).toEqual([])
  })
})
