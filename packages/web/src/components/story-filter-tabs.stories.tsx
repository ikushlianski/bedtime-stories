import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import StoryFilterTabs from './story-filter-tabs'

const meta: Meta<typeof StoryFilterTabs> = {
  title: 'Components/StoryFilterTabs',
  component: StoryFilterTabs,
}

export default meta

type Story = StoryObj<typeof StoryFilterTabs>

function StoryFilterTabsPreview() {
  const [value, setValue] = useState<'all' | 'draft' | 'proofreading' | 'ready' | 'read' | 'archived'>('ready')

  return <StoryFilterTabs value={value} onChange={setValue} />
}

export const Interactive: Story = {
  render: () => <StoryFilterTabsPreview />,
}
