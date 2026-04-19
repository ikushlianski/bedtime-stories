import type { Preview } from '@storybook/react'
import React from 'react'
import '../src/index.css'

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'App theme',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'bedtime', title: 'Light' },
          { value: 'bedtime-dark', title: 'Dark' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => (
      <div
        data-theme={context.globals['theme'] === 'bedtime-dark' ? 'bedtime-dark' : 'bedtime'}
        className="min-h-screen bg-base-200 p-6 text-base-content"
      >
        <div className="mx-auto max-w-5xl">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    backgrounds: {
      disable: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
