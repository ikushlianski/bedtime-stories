import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import type { ModelCatalogEntry } from '../lib/api'
import ModelSelectDropdown from './model-select-dropdown'

const meta: Meta<typeof ModelSelectDropdown> = {
  title: 'Design System/Advanced/Model Select Dropdown',
  component: ModelSelectDropdown,
  parameters: {
    layout: 'centered',
  },
}

export default meta

type Story = StoryObj<typeof ModelSelectDropdown>

const MOCK_MODELS: ModelCatalogEntry[] = [
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    inputUsdPerMillion: '5.00',
    outputUsdPerMillion: '15.00',
    contextLength: 128000,
    supportsJsonSchema: true,
    isFree: false,
    isRecommendedForProse: true,
    expirationDate: null,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    inputUsdPerMillion: '0.15',
    outputUsdPerMillion: '0.60',
    contextLength: 128000,
    supportsJsonSchema: true,
    isFree: false,
    isRecommendedForProse: false,
    expirationDate: null,
  },
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    inputUsdPerMillion: '3.00',
    outputUsdPerMillion: '15.00',
    contextLength: 200000,
    supportsJsonSchema: true,
    isFree: false,
    isRecommendedForProse: true,
    expirationDate: null,
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B Instruct (free)',
    inputUsdPerMillion: '0',
    outputUsdPerMillion: '0',
    contextLength: 131072,
    supportsJsonSchema: false,
    isFree: true,
    isRecommendedForProse: false,
    expirationDate: '2026-06-01',
  },
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini Flash 1.5',
    inputUsdPerMillion: '0.075',
    outputUsdPerMillion: '0.30',
    contextLength: 1000000,
    supportsJsonSchema: true,
    isFree: false,
    isRecommendedForProse: false,
    expirationDate: '2026-08-15',
  },
]

const MANY_MODELS: ModelCatalogEntry[] = [
  ...MOCK_MODELS,
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', inputUsdPerMillion: '0.25', outputUsdPerMillion: '1.25', contextLength: 200000, supportsJsonSchema: true, isFree: false, isRecommendedForProse: false, expirationDate: null },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', inputUsdPerMillion: '15.00', outputUsdPerMillion: '75.00', contextLength: 200000, supportsJsonSchema: true, isFree: false, isRecommendedForProse: true, expirationDate: null },
  { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', inputUsdPerMillion: '0.50', outputUsdPerMillion: '1.50', contextLength: 16385, supportsJsonSchema: false, isFree: false, isRecommendedForProse: false, expirationDate: null },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (free)', inputUsdPerMillion: '0', outputUsdPerMillion: '0', contextLength: 32768, supportsJsonSchema: false, isFree: true, isRecommendedForProse: false, expirationDate: '2026-07-01' },
  { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B Instruct', inputUsdPerMillion: '0.24', outputUsdPerMillion: '0.24', contextLength: 32768, supportsJsonSchema: false, isFree: false, isRecommendedForProse: false, expirationDate: null },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', inputUsdPerMillion: '3.50', outputUsdPerMillion: '10.50', contextLength: 1000000, supportsJsonSchema: true, isFree: false, isRecommendedForProse: true, expirationDate: null },
  { id: 'cohere/command-r-plus', name: 'Command R+', inputUsdPerMillion: '3.00', outputUsdPerMillion: '15.00', contextLength: 128000, supportsJsonSchema: false, isFree: false, isRecommendedForProse: false, expirationDate: null },
  { id: 'cohere/command-r', name: 'Command R', inputUsdPerMillion: '0.50', outputUsdPerMillion: '1.50', contextLength: 128000, supportsJsonSchema: false, isFree: false, isRecommendedForProse: false, expirationDate: null },
  { id: 'nousresearch/hermes-3-llama-3.1-70b:free', name: 'Hermes 3 Llama 3.1 70B (free)', inputUsdPerMillion: '0', outputUsdPerMillion: '0', contextLength: 131072, supportsJsonSchema: false, isFree: true, isRecommendedForProse: false, expirationDate: '2026-09-01' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', inputUsdPerMillion: '0.14', outputUsdPerMillion: '0.28', contextLength: 65536, supportsJsonSchema: true, isFree: false, isRecommendedForProse: false, expirationDate: null },
  { id: 'qwen/qwen-72b-chat', name: 'Qwen 72B Chat', inputUsdPerMillion: '0.56', outputUsdPerMillion: '0.56', contextLength: 32768, supportsJsonSchema: false, isFree: false, isRecommendedForProse: false, expirationDate: null },
  { id: 'microsoft/wizardlm-2-8x22b', name: 'WizardLM-2 8x22B', inputUsdPerMillion: '0.65', outputUsdPerMillion: '0.65', contextLength: 65536, supportsJsonSchema: false, isFree: false, isRecommendedForProse: false, expirationDate: null },
  { id: 'perplexity/sonar-medium-online', name: 'Sonar Medium Online', inputUsdPerMillion: '6.00', outputUsdPerMillion: '18.00', contextLength: 28000, supportsJsonSchema: false, isFree: false, isRecommendedForProse: false, expirationDate: null },
  { id: 'fireworks/mixtral-8x7b-fw-chat', name: 'Mixtral 8x7B FW Chat', inputUsdPerMillion: '0.40', outputUsdPerMillion: '0.40', contextLength: 32768, supportsJsonSchema: false, isFree: false, isRecommendedForProse: false, expirationDate: null },
  { id: 'together/llama-3.1-70b', name: 'Llama 3.1 70B (Together)', inputUsdPerMillion: '0.88', outputUsdPerMillion: '0.88', contextLength: 131072, supportsJsonSchema: false, isFree: false, isRecommendedForProse: false, expirationDate: null },
]

function Wrapper({ models, initialValue }: { models: ModelCatalogEntry[]; initialValue: string }) {
  const [value, setValue] = useState(initialValue)

  return (
    <div className="w-72 p-4">
      <ModelSelectDropdown
        models={models}
        value={value}
        onChange={setValue}
      />
      <p className="mt-3 text-xs text-base-content/50">
        Выбрано: <code>{value || '(пусто)'}</code>
      </p>
    </div>
  )
}

export const Default: Story = {
  render: () => <Wrapper models={MOCK_MODELS} initialValue="" />,
}

export const WithSelection: Story = {
  render: () => <Wrapper models={MOCK_MODELS} initialValue="anthropic/claude-3-5-sonnet" />,
}

export const ManyModels: Story = {
  render: () => <Wrapper models={MANY_MODELS} initialValue="" />,
}
