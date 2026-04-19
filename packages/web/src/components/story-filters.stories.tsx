import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import type { StoryGroup } from '../lib/api'
import StoryFilters, { DEFAULT_FILTERS, type StoryFilterState } from './story-filters'

const meta: Meta<typeof StoryFilters> = {
  title: 'Design System/Advanced/Story Filters',
  component: StoryFilters,
  parameters: {
    layout: 'centered',
  },
}

export default meta

type Story = StoryObj<typeof StoryFilters>

const universes: StoryGroup[] = [
  {
    id: 1,
    name: 'Лесные друзья',
    description: 'Добрые истории про зверей и лес.',
    systemPrompt: '',
    universeContext: null,
    styleGuide: null,
    agentOverrides: null,
    createdAt: '2026-04-01T10:00:00Z',
  },
  {
    id: 2,
    name: 'Космос',
    description: 'Спокойные приключения среди звёзд.',
    systemPrompt: '',
    universeContext: null,
    styleGuide: null,
    agentOverrides: null,
    createdAt: '2026-04-02T10:00:00Z',
  },
]

const availableTags = ['спокойная', 'смешная', 'короткая', 'про сон', 'семейная']

function StoryFiltersPreview({ initialValue }: { initialValue: StoryFilterState }) {
  const [value, setValue] = useState(initialValue)

  return (
    <div className="min-h-80 w-[26rem]">
      <StoryFilters
        value={value}
        onChange={setValue}
        universes={universes}
        availableTags={availableTags}
      />
    </div>
  )
}

export const Default: Story = {
  render: () => <StoryFiltersPreview initialValue={DEFAULT_FILTERS} />,
}

export const WithSelectedFilters: Story = {
  render: () => (
    <StoryFiltersPreview
      initialValue={{
        status: 'read',
        groupId: 1,
        tag: 'спокойная',
      }}
    />
  ),
}

export const NoOptionalFilters: Story = {
  render: () => (
    <div className="min-h-80 w-[26rem]">
      <StoryFilters
        value={DEFAULT_FILTERS}
        onChange={() => undefined}
        universes={[]}
        availableTags={[]}
      />
    </div>
  ),
}
