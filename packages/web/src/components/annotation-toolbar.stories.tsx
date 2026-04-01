import type { Meta, StoryObj } from '@storybook/react'
import AnnotationToolbar from './annotation-toolbar'

const meta: Meta<typeof AnnotationToolbar> = {
  title: 'Components/AnnotationToolbar',
  component: AnnotationToolbar,
  parameters: {
    layout: 'centered',
  },
}

export default meta

type Story = StoryObj<typeof AnnotationToolbar>

export const Visible: Story = {
  args: {
    selectedText: 'He felt the warmth of friendship',
    onAnnotate: (type, text) => {
      console.log('Annotated:', type, text)
    },
  },
}

export const Empty: Story = {
  args: {
    selectedText: '',
    onAnnotate: () => {},
  },
}

export const WithLongText: Story = {
  args: {
    selectedText: 'Once upon a time, in a land far away, there lived a little bear named Gosha.',
    onAnnotate: (type, text) => {
      console.log(`Annotated as "${type}": "${text}"`)
    },
  },
}
