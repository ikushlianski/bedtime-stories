import type { Config } from 'tailwindcss'
import daisyui from 'daisyui'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './.storybook/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Avenir Next"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Iowan Old Style"', '"Palatino Linotype"', 'serif'],
      },
    },
  },
  darkMode: 'class',
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        bedtime: {
          primary: '#0f766e',
          'primary-content': '#f0fdfa',
          secondary: '#f97316',
          'secondary-content': '#fff7ed',
          accent: '#f59e0b',
          'accent-content': '#1c1917',
          neutral: '#1f2937',
          'neutral-content': '#f8fafc',
          'base-100': '#fffdfa',
          'base-200': '#f7f2ea',
          'base-300': '#e7dccb',
          'base-content': '#312e2b',
          info: '#0ea5e9',
          'info-content': '#f0f9ff',
          success: '#16a34a',
          'success-content': '#f0fdf4',
          warning: '#d97706',
          'warning-content': '#fffbeb',
          error: '#dc2626',
          'error-content': '#fef2f2',
          '--rounded-box': '1.25rem',
          '--rounded-btn': '9999px',
          '--rounded-badge': '9999px',
          '--tab-radius': '9999px',
        },
      },
      'light',
    ],
  },
}

export default config
