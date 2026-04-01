export interface Queue<T> {
  enqueue(job: T): Promise<void>
  process(handler: (job: T) => Promise<void>): void
}
