import { describe, it, expect } from 'vitest'
import { claudeCliModel } from './mastra-models'

describe('claudeCliModel', () => {
  describe('when invoked with no arguments', () => {
    it('returns a language model object with the default sonnet id', () => {
      const model = claudeCliModel()

      expect(model).toBeTruthy()
      expect(typeof model).toBe('object')
      expect(model).toMatchObject({
        modelId: 'sonnet',
        specificationVersion: 'v3',
        provider: expect.stringContaining('claude-code'),
      })
    })
  })

  describe('when invoked with an explicit model id', () => {
    it.each(['sonnet', 'opus', 'haiku'] as const)(
      'returns a model whose modelId is %s',
      (id) => {
        const model = claudeCliModel(id)

        expect(model).toMatchObject({ modelId: id })
      },
    )
  })

  describe('contract with the AI SDK language model shape', () => {
    it('exposes doGenerate and doStream callables for Mastra to invoke', () => {
      const model = claudeCliModel('sonnet')

      expect(model).toHaveProperty('doGenerate')
      expect(model).toHaveProperty('doStream')
    })
  })
})
