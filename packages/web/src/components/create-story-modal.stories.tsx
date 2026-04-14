import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import CreateStoryModal from './create-story-modal'

const meta: Meta<typeof CreateStoryModal> = {
  title: 'Components/CreateStoryModal',
  component: CreateStoryModal,
}

export default meta

type Story = StoryObj<typeof CreateStoryModal>

function CreateStoryModalPreview() {
  const [open, setOpen] = useState(true)

  return (
    <CreateStoryModal
      open={open}
      onClose={() => setOpen(false)}
      onSubmit={async () => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        setOpen(false)
      }}
    />
  )
}

export const Default: Story = {
  render: () => <CreateStoryModalPreview />,
}
