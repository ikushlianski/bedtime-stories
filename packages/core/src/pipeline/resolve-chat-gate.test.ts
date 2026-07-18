import { describe, it, expect } from 'vitest'
import { resolveChatGate } from './resolve-chat-gate'

describe('resolveChatGate', () => {
  describe('mutate intent', () => {
    it('allows draft, proofreading, and any not-yet-finished status', () => {
      expect(resolveChatGate({ storyStatus: 'draft', intent: 'mutate' })).toEqual({ allowed: true })
      expect(resolveChatGate({ storyStatus: 'proofreading', intent: 'mutate' })).toEqual({ allowed: true })
    })

    it('rejects ready, read, and archived with a reason and the comments endpoint suggestion', () => {
      for (const status of ['ready', 'read', 'archived'] as const) {
        const result = resolveChatGate({ storyStatus: status, intent: 'mutate' })

        expect(result.allowed).toBe(false)

        if (!result.allowed) {
          expect(result.reason.length).toBeGreaterThan(0)
          expect(result.suggestedEndpoint).toContain('comments')
        }
      }
    })
  })

  describe('record intent', () => {
    it('allows ready, read, and archived', () => {
      expect(resolveChatGate({ storyStatus: 'ready', intent: 'record' })).toEqual({ allowed: true })
      expect(resolveChatGate({ storyStatus: 'read', intent: 'record' })).toEqual({ allowed: true })
      expect(resolveChatGate({ storyStatus: 'archived', intent: 'record' })).toEqual({ allowed: true })
    })

    it('rejects draft and proofreading', () => {
      const draft = resolveChatGate({ storyStatus: 'draft', intent: 'record' })
      const proofreading = resolveChatGate({ storyStatus: 'proofreading', intent: 'record' })

      expect(draft.allowed).toBe(false)
      expect(proofreading.allowed).toBe(false)
    })
  })
})
