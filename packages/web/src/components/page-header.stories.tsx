import type { Meta, StoryObj } from '@storybook/react'
import PageHeader from './page-header'

const meta: Meta<typeof PageHeader> = {
  title: 'Components/PageHeader',
  component: PageHeader,
}

export default meta

type Story = StoryObj<typeof PageHeader>

export const Default: Story = {
  args: {
    eyebrow: 'Library',
    title: 'Stories',
    description: 'Review generated stories, filter their status, and start a new bedtime story.',
    action: <button className="btn btn-primary">New Story</button>,
  },
}

export const WithBackAction: Story = {
  args: {
    eyebrow: 'Review',
    title: 'Plan Review',
    description: 'Compare the first draft against the final plan before approving it.',
    backAction: <button className="btn btn-ghost btn-sm">← Back to stories</button>,
  },
}
