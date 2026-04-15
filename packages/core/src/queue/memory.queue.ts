import type { Queue } from './queue.interface'

export class MemoryQueue<T> implements Queue<T> {
  private readonly pending: T[] = []
  private handler: ((job: T) => Promise<void>) | undefined
  private running = false

  async enqueue(job: T): Promise<void> {
    this.pending.push(job)
    void this.drain()
  }

  process(handler: (job: T) => Promise<void>): void {
    this.handler = handler
    void this.drain()
  }

  private async drain(): Promise<void> {
    if (this.running || this.handler === undefined) {
      return
    }

    this.running = true

    try {
      while (this.pending.length > 0) {
        const job = this.pending.shift()

        if (job === undefined) continue

        try {
          await this.handler(job)
        } catch (err) {
          console.error('[memory-queue] handler rejected:', err)
        }
      }
    } finally {
      this.running = false
    }
  }
}
