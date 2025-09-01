/**
 * Integration tests for the background job system
 * These tests verify the entire workflow from job creation to completion
 */

import { JobQueueManager } from '../JobQueueManager'
import { AIAnalysisWorker } from '../AIAnalysisWorker'
import { initializeBackgroundJobs, shutdownBackgroundJobs } from '../index'
import { AIProvider } from '../types'

// Skip integration tests in CI unless Redis is available
const SKIP_INTEGRATION = process.env.CI && !process.env.REDIS_URL

describe('Background Job System Integration', () => {
  let queueManager: JobQueueManager
  let worker: AIAnalysisWorker

  beforeAll(async () => {
    if (SKIP_INTEGRATION) {
      console.log('Skipping integration tests - Redis not available')
      return
    }

    try {
      const system = await initializeBackgroundJobs()
      queueManager = system.queueManager
      worker = system.worker
    } catch (error) {
      console.log('Redis not available, skipping integration tests')
      // Mark as skipped
      return
    }
  }, 30000)

  afterAll(async () => {
    if (!SKIP_INTEGRATION && queueManager && worker) {
      await shutdownBackgroundJobs()
    }
  })

  beforeEach(() => {
    if (SKIP_INTEGRATION) {
      pending('Redis not available')
    }
  })

  describe('System Initialization', () => {
    it('should initialize successfully with healthy components', async () => {
      expect(queueManager).toBeDefined()
      expect(worker).toBeDefined()

      const queueHealthy = await queueManager.isHealthy()
      const workerHealthy = await worker.isHealthy()

      expect(queueHealthy).toBe(true)
      expect(workerHealthy).toBe(true)
    })

    it('should provide queue status', async () => {
      const status = await queueManager.getQueueStatus()

      expect(status).toEqual({
        waiting: expect.any(Number),
        active: expect.any(Number),
        completed: expect.any(Number),
        failed: expect.any(Number),
        delayed: expect.any(Number)
      })
    })

    it('should provide worker statistics', async () => {
      const stats = await worker.getWorkerStats()

      expect(stats).toEqual({
        processed: expect.any(Number),
        failed: expect.any(Number),
        active: expect.any(Number)
      })
    })
  })

  describe('Job Lifecycle', () => {
    it('should create and track a job through completion', async () => {
      const paperId = 'test-paper-' + Date.now()
      const providers: AIProvider[] = ['openai']

      // Create job
      const jobId = await queueManager.addAnalysisJob(paperId, providers)
      expect(jobId).toBeDefined()

      // Check initial status
      let status = await queueManager.getJobStatus(jobId)
      expect(status.id).toBe(jobId)
      expect(status.status).toBe('pending')
      expect(status.progress).toBe(0)

      // Wait for job to be processed (with timeout)
      const timeout = 30000 // 30 seconds
      const startTime = Date.now()
      
      while (Date.now() - startTime < timeout) {
        status = await queueManager.getJobStatus(jobId)
        
        if (status.status === 'completed' || status.status === 'failed') {
          break
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Verify final status
      expect(status.status).toBe('completed')
      expect(status.progress).toBe(100)
      expect(status.result).toBeDefined()
      expect(status.completedAt).toBeDefined()
    }, 45000)

    it('should handle job cancellation', async () => {
      const paperId = 'test-paper-cancel-' + Date.now()
      const providers: AIProvider[] = ['openai']

      // Create job
      const jobId = await queueManager.addAnalysisJob(paperId, providers)
      
      // Cancel immediately
      const cancelled = await queueManager.cancelJob(jobId)
      expect(cancelled).toBe(true)

      // Verify job is cancelled (may throw if job was removed)
      try {
        const status = await queueManager.getJobStatus(jobId)
        expect(status.status).toBe('cancelled')
      } catch (error) {
        // Job was removed, which is also acceptable
        expect(error).toBeInstanceOf(Error)
      }
    })

    it('should handle multiple concurrent jobs', async () => {
      const jobPromises = []
      const jobIds: string[] = []

      // Create multiple jobs
      for (let i = 0; i < 3; i++) {
        const paperId = `test-paper-concurrent-${i}-${Date.now()}`
        const providers: AIProvider[] = ['openai']
        
        const promise = queueManager.addAnalysisJob(paperId, providers)
        jobPromises.push(promise)
      }

      // Wait for all jobs to be created
      const createdJobIds = await Promise.all(jobPromises)
      jobIds.push(...createdJobIds)

      expect(jobIds).toHaveLength(3)
      expect(new Set(jobIds).size).toBe(3) // All unique

      // Check that all jobs are tracked
      for (const jobId of jobIds) {
        const status = await queueManager.getJobStatus(jobId)
        expect(status.id).toBe(jobId)
        expect(['pending', 'processing', 'completed']).toContain(status.status)
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid job parameters', async () => {
      // Test with empty providers array
      await expect(
        queueManager.addAnalysisJob('test-paper', [])
      ).rejects.toThrow()

      // Test with invalid provider
      await expect(
        queueManager.addAnalysisJob('test-paper', ['invalid-provider' as AIProvider])
      ).rejects.toThrow()
    })

    it('should handle non-existent job queries', async () => {
      await expect(
        queueManager.getJobStatus('non-existent-job')
      ).rejects.toThrow('not found')
    })

    it('should handle retry of non-failed job', async () => {
      const paperId = 'test-paper-retry-' + Date.now()
      const jobId = await queueManager.addAnalysisJob(paperId, ['openai'])

      // Try to retry a non-failed job
      await expect(
        queueManager.retryFailedJob(jobId)
      ).rejects.toThrow('not in failed state')
    })
  })

  describe('Queue Management', () => {
    it('should track queue statistics accurately', async () => {
      const initialStatus = await queueManager.getQueueStatus()
      
      // Create a job
      const paperId = 'test-paper-stats-' + Date.now()
      await queueManager.addAnalysisJob(paperId, ['openai'])
      
      // Check that queue stats changed
      const newStatus = await queueManager.getQueueStatus()
      
      // Either waiting or active count should have increased
      const totalInitial = initialStatus.waiting + initialStatus.active
      const totalNew = newStatus.waiting + newStatus.active
      
      expect(totalNew).toBeGreaterThanOrEqual(totalInitial)
    })
  })

  describe('System Health', () => {
    it('should report healthy status when components are working', async () => {
      const { checkBackgroundJobsHealth } = require('../index')
      
      const health = await checkBackgroundJobsHealth()
      
      expect(health.healthy).toBe(true)
      expect(health.queueManager).toBe(true)
      expect(health.worker).toBe(true)
      expect(health.details.queueStatus).toBeDefined()
      expect(health.details.workerStats).toBeDefined()
    })
  })
})

/**
 * Helper function to wait for a condition with timeout
 */
async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 500
): Promise<void> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  throw new Error(`Condition not met within ${timeout}ms`)
}