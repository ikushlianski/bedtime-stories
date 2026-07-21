import { triggerAutoPipeline, type AutoPipelineParams } from './pipeline-auto-trigger'
import { triggerAnalysis } from './story-analysis'
import { generateStoryImages } from './story-images'

async function enqueueTask(path: string, body: unknown): Promise<void> {
  const queue = process.env['PIPELINE_QUEUE']
  const workerUrl = process.env['PIPELINE_WORKER_URL']
  const secret = process.env['PIPELINE_WORKER_SECRET']

  if (!queue || !workerUrl || !secret) {
    throw new Error('Pipeline queue is not fully configured')
  }

  const tasks = await import('@google-cloud/tasks')
  const CloudTasksClient = tasks.CloudTasksClient ?? (tasks as unknown as { default: typeof tasks }).default.CloudTasksClient
  const client = new CloudTasksClient()

  await client.createTask({
    parent: queue,
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url: `${workerUrl}${path}`,
        headers: {
          'Content-Type': 'application/json',
          'x-pipeline-secret': secret,
        },
        body: Buffer.from(JSON.stringify(body)).toString('base64'),
      },
      dispatchDeadline: { seconds: 900 },
    },
  })
}

export async function dispatchAutoPipeline(params: AutoPipelineParams): Promise<void> {
  if (process.env['PIPELINE_QUEUE']) {
    try {
      await enqueueTask('/api/internal/worker/pipeline', params)
      return
    } catch (err) {
      console.error(`[dispatch] enqueue failed for storyId=${params.storyId}, running in-process:`, err)
    }
  }

  triggerAutoPipeline(params)
}

export async function dispatchAnalysis(storyId: number): Promise<void> {
  if (process.env['PIPELINE_QUEUE']) {
    try {
      await enqueueTask('/api/internal/worker/analyze', { storyId })
      return
    } catch (err) {
      console.error(`[dispatch] analysis enqueue failed for storyId=${storyId}, running in-process:`, err)
    }
  }

  triggerAnalysis(storyId)
}

export async function dispatchImageGeneration(storyId: number): Promise<void> {
  if (process.env['PIPELINE_QUEUE']) {
    try {
      await enqueueTask('/api/internal/worker/generate-images', { storyId })
      return
    } catch (err) {
      console.error(`[dispatch] image generation enqueue failed for storyId=${storyId}, running in-process:`, err)
    }
  }

  void generateStoryImages(storyId).catch((err) => {
    console.error(`[story-images] background generation failed for storyId=${storyId}:`, err)
  })
}
