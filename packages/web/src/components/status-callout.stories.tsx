import type { Meta, StoryObj } from '@storybook/react'
import StatusCallout from './status-callout'

const meta: Meta<typeof StatusCallout> = {
  title: 'Components/StatusCallout',
  component: StatusCallout,
}

export default meta

type Story = StoryObj<typeof StatusCallout>

export const Info: Story = {
  args: {
    tone: 'info',
    title: 'Loading',
    message: 'Fetching the latest pipeline state for this story.',
  },
}

export const Error: Story = {
  args: {
    tone: 'error',
    title: 'Request failed',
    message: 'The story could not be loaded from the API.',
  },
}
