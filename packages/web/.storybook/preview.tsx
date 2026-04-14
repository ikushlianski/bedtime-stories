import type { Preview } from '@storybook/react'
import React from 'react'
import '../src/index.css'

const preview: Preview = {
  decorators: [
    (Story) => (
      <div data-theme="bedtime" className="min-h-screen bg-base-200 p-6 text-base-content">
        <Story />
      </div>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
