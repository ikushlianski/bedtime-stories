import type { Meta, StoryObj } from '@storybook/react'
import StoryCard from './story-card'

const meta: Meta<typeof StoryCard> = {
  title: 'Components/StoryCard',
  component: StoryCard,
}

export default meta
type Story = StoryObj<typeof StoryCard>

export const Default: Story = {
  args: {
    title: 'The Dragon Who Lost His Fire',
    status: 'ready',
    createdAt: '2026-03-01T10:00:00Z',
  },
}

export const WithRating: Story = {
  args: {
    title: 'The Magic Forest',
    status: 'read',
    createdAt: '2026-02-15T08:00:00Z',
    rating: 4,
  },
}

export const Archived: Story = {
  args: {
    title: 'An Old Tale',
    status: 'archived',
    createdAt: '2025-12-01T00:00:00Z',
    rating: 3,
  },
}

export const WithActions: Story = {
  args: {
    title: 'Как Мира нашла сонную звезду',
    status: 'ready',
    createdAt: '2026-04-18T19:30:00Z',
    actions: [
      { label: 'Открыть', tone: 'primary', onClick: () => undefined },
      { label: 'Править', tone: 'tertiary', onClick: () => undefined },
      { label: 'Удалить', tone: 'destructive', onClick: () => undefined },
    ],
  },
}
