import type { Meta, StoryObj } from '@storybook/react'
import DashboardPanel from './dashboard-panel'

const meta: Meta<typeof DashboardPanel> = {
  title: 'Components/DashboardPanel',
  component: DashboardPanel,
}

export default meta

type Story = StoryObj<typeof DashboardPanel>

export const Placeholder: Story = {
  args: {
    title: 'Quality Trend',
    description:
      'Rating over time, with markers for prompt and model changes. Shows whether quality improves after agent updates.',
    children: (
      <div className="flex h-40 items-center justify-center rounded-box border border-dashed border-base-300 bg-base-200 text-sm text-base-content/50">
        Coming soon
      </div>
    ),
  },
}
