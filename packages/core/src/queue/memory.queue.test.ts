import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryQueue } from './memory.queue'

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

describe('MemoryQueue', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  describe('when a handler is already attached', () => {
    it('processes enqueued jobs in FIFO order', async () => {
      const queue = new MemoryQueue<number>()
      const seen: number[] = []

      queue.process(async (job) => {
        seen.push(job)
      })

      await queue.enqueue(1)
      await queue.enqueue(2)
      await queue.enqueue(3)
      await flushPromises()

      expect(seen).toEqual([1, 2, 3])
    })
  })

  describe('when the handler throws for one job', () => {
    it('logs the error and keeps processing subsequent jobs', async () => {
      const queue = new MemoryQueue<string>()
      const seen: string[] = []

      queue.process(async (job) => {
        if (job === 'bad') throw new Error('boom')
        seen.push(job)
      })

      await queue.enqueue('ok1')
      await queue.enqueue('bad')
      await queue.enqueue('ok2')
      await flushPromises()

      expect(seen).toEqual(['ok1', 'ok2'])
      expect(errorSpy).toHaveBeenCalled()
    })

    it('does not wedge the queue permanently — the running flag is reset even after a throw', async () => {
      const queue = new MemoryQueue<string>()
      const seen: string[] = []

      queue.process(async (job) => {
        if (job === 'bad') throw new Error('boom')
        seen.push(job)
      })

      await queue.enqueue('bad')
      await flushPromises()

      await queue.enqueue('after')
      await flushPromises()

      expect(seen).toEqual(['after'])
    })
  })

  describe('when jobs are enqueued before a handler is attached', () => {
    it('drains pending jobs as soon as process() supplies a handler', async () => {
      const queue = new MemoryQueue<string>()
      const seen: string[] = []

      await queue.enqueue('early-1')
      await queue.enqueue('early-2')
      await flushPromises()

      expect(seen).toEqual([])

      queue.process(async (job) => {
        seen.push(job)
      })

      await flushPromises()

      expect(seen).toEqual(['early-1', 'early-2'])
    })
  })

  describe('concurrent drains', () => {
    it('does not run the handler twice for the same job when enqueue is called mid-drain', async () => {
      const queue = new MemoryQueue<number>()
      const seen: number[] = []
      let resolveFirst: (() => void) | undefined

      queue.process(async (job) => {
        if (job === 1) {
          await new Promise<void>((resolve) => {
            resolveFirst = resolve
          })
        }
        seen.push(job)
      })

      await queue.enqueue(1)
      await Promise.resolve()
      await queue.enqueue(2)
      await queue.enqueue(3)

      resolveFirst?.()
      await flushPromises()

      expect(seen).toEqual([1, 2, 3])
    })
  })
})
