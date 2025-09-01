// Background job queue system exports

export { JobQueueManager } from './JobQueueManager'
export { AIAnalysisWorker } from './AIAnalysisWorker'
export { JobErrorHandler } from './JobErrorHandler'

export type {
  JobQueueManager as IJobQueueManager,
  AIAnalysisWorker as IAIAnalysisWorker,
  JobStatus,
  QueueStatus,
  AnalysisJob,
  AnalysisJobData,
  AIAnalysisResult,
  AIProvider,
  JobRetryOptions,
  JobProgressUpdate,
  JobError
} from './types'

// Singleton instances for application use
let jobQueueManager: JobQueueManager | null = null
let aiAnalysisWorker: AIAnalysisWorker | null = null

/**
 * Get or create the job queue manager singleton
 */
export function getJobQueueManager(): JobQueueManager {
  if (!jobQueueManager) {
    jobQueueManager = new JobQueueManager()
  }
  return jobQueueManager
}

/**
 * Get or create the AI analysis worker singleton
 */
export function getAIAnalysisWorker(): AIAnalysisWorker {
  if (!aiAnalysisWorker) {
    aiAnalysisWorker = new AIAnalysisWorker()
  }
  return aiAnalysisWorker
}

/**
 * Initialize the background job system
 */
export async function initializeBackgroundJobs(): Promise<{
  queueManager: JobQueueManager
  worker: AIAnalysisWorker
}> {
  const queueManager = getJobQueueManager()
  const worker = getAIAnalysisWorker()
  
  // Verify Redis connection
  const isQueueHealthy = await queueManager.isHealthy()
  const isWorkerHealthy = await worker.isHealthy()
  
  if (!isQueueHealthy) {
    throw new Error('Job queue manager is not healthy - check Redis connection')
  }
  
  if (!isWorkerHealthy) {
    throw new Error('AI analysis worker is not healthy - check Redis connection')
  }
  
  console.log('Background job system initialized successfully')
  
  return { queueManager, worker }
}

/**
 * Gracefully shutdown the background job system
 */
export async function shutdownBackgroundJobs(): Promise<void> {
  const promises: Promise<void>[] = []
  
  if (jobQueueManager) {
    promises.push(jobQueueManager.close())
    jobQueueManager = null
  }
  
  if (aiAnalysisWorker) {
    promises.push(aiAnalysisWorker.close())
    aiAnalysisWorker = null
  }
  
  await Promise.all(promises)
  console.log('Background job system shutdown complete')
}

/**
 * Health check for the entire background job system
 */
export async function checkBackgroundJobsHealth(): Promise<{
  healthy: boolean
  queueManager: boolean
  worker: boolean
  details: {
    queueStatus?: QueueStatus
    workerStats?: { processed: number; failed: number; active: number }
    error?: string
  }
}> {
  try {
    const queueManager = getJobQueueManager()
    const worker = getAIAnalysisWorker()
    
    const [queueHealthy, workerHealthy] = await Promise.all([
      queueManager.isHealthy(),
      worker.isHealthy()
    ])
    
    const details: any = {}
    
    if (queueHealthy) {
      details.queueStatus = await queueManager.getQueueStatus()
    }
    
    if (workerHealthy) {
      details.workerStats = await worker.getWorkerStats()
    }
    
    return {
      healthy: queueHealthy && workerHealthy,
      queueManager: queueHealthy,
      worker: workerHealthy,
      details
    }
  } catch (error) {
    return {
      healthy: false,
      queueManager: false,
      worker: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}