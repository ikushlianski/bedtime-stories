import type { Meta, StoryObj } from '@storybook/react'
import FeedbackForm from './feedback-form'

const meta: Meta<typeof FeedbackForm> = {
  title: 'Components/FeedbackForm',
  component: FeedbackForm,
  parameters: {
    layout: 'centered',
  },
}

export default meta

type Story = StoryObj<typeof FeedbackForm>

export const Empty: Story = {
  args: {
    storyId: 'story-1',
    onSubmit: async (values) => {
      await new Promise((r) => setTimeout(r, 500))
      console.log('Submitted:', values)
    },
  },
}

export const Filled: Story = {
  args: {
    storyId: 'story-2',
    onSubmit: async (values) => {
      await new Promise((r) => setTimeout(r, 500))
      console.log('Submitted:', values)
    },
  },
  render: (args) => (
    <div className="w-96">
      <FeedbackForm {...args} />
    </div>
  ),
}

export const Submitting: Story = {
  args: {
    storyId: 'story-3',
    onSubmit: async () => {
      await new Promise((r) => setTimeout(r, 10000))
    },
  },
}
