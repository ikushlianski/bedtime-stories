import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import type { StoryGroup } from '../lib/api'
import PageHeader from './page-header'
import StoryCard from './story-card'
import StoryFilters, { DEFAULT_FILTERS, type StoryFilterState } from './story-filters'
import type { StoryStatus } from './types'

const meta: Meta = {
  title: 'Design System/Advanced/Story Library',
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj

interface LibraryStory {
  id: number
  title: string
  status: StoryStatus
  createdAt: string
  rating?: number
}

const stories: LibraryStory[] = [
  {
    id: 1,
    title: 'Как Мира нашла сонную звезду',
    status: 'ready',
    createdAt: '2026-04-18T19:30:00Z',
  },
  {
    id: 2,
    title: 'Пушистый поезд в страну подушек',
    status: 'read',
    createdAt: '2026-04-12T18:10:00Z',
    rating: 5,
  },
  {
    id: 3,
    title: 'Черновик про маленький маяк',
    status: 'draft',
    createdAt: '2026-04-09T17:00:00Z',
  },
]

const universes: StoryGroup[] = [
  {
    id: 1,
    name: 'Сонный город',
    description: 'Город мягких огней и спокойных приключений.',
    systemPrompt: '',
    universeContext: null,
    styleGuide: null,
    styleGuideWorks: null,
    styleGuideDoesntWork: null,
    styleGuideTechniques: null,
    styleGuideMinimize: null,
    agentOverrides: null,
    characters: [],
    pendingSuggestionsCount: 0,
    createdAt: '2026-04-01T10:00:00Z',
  },
]

function StoryLibraryPreview() {
  const [filters, setFilters] = useState<StoryFilterState>(DEFAULT_FILTERS)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Библиотека"
        title="Истории"
        description="Следи за историями от черновика до прочтения и запускай новые идеи для сказок на ночь."
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 3a2 2 0 00-2 2v9.5A2.5 2.5 0 004.5 17H16a2 2 0 002-2V6a2 2 0 00-2-2h-5.5L9.3 2.4A1 1 0 008.5 2H4z" />
              </svg>
              Добавить пример
            </button>
            <button className="btn btn-primary gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
              </svg>
              Новая история
            </button>
          </div>
        }
      />

      <StoryFilters
        value={filters}
        onChange={setFilters}
        universes={universes}
        availableTags={['сон', 'семейная', 'короткая']}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stories.map((story) => (
          <StoryCard
            key={story.id}
            title={story.title}
            status={story.status}
            createdAt={story.createdAt}
            rating={story.rating}
            actions={[
              { label: 'Открыть', tone: 'primary', onClick: () => undefined },
              { label: 'Править', tone: 'tertiary', onClick: () => undefined },
              { label: 'Удалить', tone: 'destructive', onClick: () => undefined },
            ]}
          />
        ))}
      </div>
    </div>
  )
}

export const LibraryWithActions: Story = {
  render: () => <StoryLibraryPreview />,
}
