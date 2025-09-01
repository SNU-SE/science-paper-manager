import { Queue, Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import { 
  JobQueueManager as IJobQueueManager, 
  JobStatus, 
  AnalysisJobData, 
  AIProvider, 
  QueueStatus,
  JobRetryOptions,
  JobError
} from './types'

export class JobQueueManager implements IJobQueueManager {
  private redis: Redis
  private analysisQueue: Queue
  private readonly QUEUE_NAME = 'ai-analysis'
  
  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    })
    
    this.analysisQueue = new Queue(this.QUEUE_NAME, {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50,      // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds
        },
      },
    })
    
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.analysisQueue.on('error', (error) => {
      console.error('Queue error:', error)
    })

    this.analysisQueue.on('waiting', (job) => {
      console.log(`Job ${job.id} is waiting`)
    })

    this.analysisQueue.on('active', (job) => {
      console.log(`Job ${job.id} is now active`)
    })

    this.analysisQueue.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`)
    })

    this.analysisQueue.on('failed', (job, error) => {
      console.error(`Job ${job?.id} failed:`, error.message)
    })
  }

  async addAnalysisJob(paperId: string, providers: AIProvider[]): Promise<string> {
    try {
      const jobData: AnalysisJobData = {
        paperId,
        providers,
        userId: 'current-user', // TODO: Get from auth context
        priority: this.calculateJobPriority(providers.length)
      }

      const job = await this.analysisQueue.add(
        'analyze-paper',
        jobData,
        {
          priority: jobData.priority,
          delay: 0,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      )

      return job.id!
    } catch (error) {
      console.error('Failed to add analysis job:', error)
      throw new Error(`Failed to queue analysis job: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const job = await this.analysisQueue.getJob(jobId)
      
      if (!job) {
        throw new Error(`Job ${jobId} not found`)
      }

      const state = await job.getState()
      const progress = job.progress as number || 0

      return {
        id: jobId,
        status: this.mapBullStateToJobStatus(state),
        progress,
        startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
        completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        error: job.failedReason || undefined,
        result: job.returnvalue || undefined,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts || 3
      }
    } catch (error) {
      console.error('Failed to get job status:', error)
      throw new Error(`Failed to get job status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.analysisQueue.getJob(jobId)
      
      if (!job) {
        return false
      }

      await job.remove()
      return true
    } catch (error) {
      console.error('Failed to cancel job:', error)
      return false
    }
  }

  async retryFailedJob(jobId: string): Promise<string> {
    try {
      const job = await this.analysisQueue.getJob(jobId)
      
      if (!job) {
        throw new Error(`Job ${jobId} not found`)
      }

      const state = await job.getState()
      if (state !== 'failed') {
        throw new Error(`Job ${jobId} is not in failed state`)
      }

      await job.retry()
      return jobId
    } catch (error) {
      console.error('Failed to retry job:', error)
      throw new Error(`Failed to retry job: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getQueueStatus(): Promise<QueueStatus> {
    try {
      const waiting = await this.analysisQueue.getWaiting()
      const active = await this.analysisQueue.getActive()
      const completed = await this.analysisQueue.getCompleted()
      const failed = await this.analysisQueue.getFailed()
      const delayed = await this.analysisQueue.getDelayed()

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length
      }
    } catch (error) {
      console.error('Failed to get queue status:', error)
      throw new Error(`Failed to get queue status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private calculateJobPriority(providerCount: number): number {
    // Higher priority for jobs with more providers (more comprehensive analysis)
    return Math.max(1, providerCount * 10)
  }

  private mapBullStateToJobStatus(state: string): JobStatus['status'] {
    switch (state) {
      case 'waiting':
      case 'delayed':
        return 'pending'
      case 'active':
        return 'processing'
      case 'completed':
        return 'completed'
      case 'failed':
        return 'failed'
      default:
        return 'pending'
    }
  }

  // Cleanup method for graceful shutdown
  async close(): Promise<void> {
    await this.analysisQueue.close()
    await this.redis.quit()
  }

  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      await this.redis.ping()
      return true
    } catch (error) {
      console.error('Queue health check failed:', error)
      return false
    }
  }

  // Get queue statistics for admin dashboard
  async getQueueStats(): Promise<Array<{
    name: string
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
    paused: boolean
  }>> {
    try {
      const status = await this.getQueueStatus()
      const isPaused = await this.analysisQueue.isPaused()

      return [{
        name: this.QUEUE_NAME,
        waiting: status.waiting,
        active: status.active,
        completed: status.completed,
        failed: status.failed,
        delayed: status.delayed,
        paused: isPaused
      }]
    } catch (error) {
      console.error('Failed to get queue stats:', error)
      return []
    }
  }

  // Retry a job (alias for retryFailedJob for consistency)
  async retryJob(jobId: string): Promise<string> {
    return this.retryFailedJob(jobId)
  }

  // Pause the queue
  async pauseQueue(): Promise<void> {
    await this.analysisQueue.pause()
  }

  // Resume the queue
  async resumeQueue(): Promise<void> {
    await this.analysisQueue.resume()
  }
}