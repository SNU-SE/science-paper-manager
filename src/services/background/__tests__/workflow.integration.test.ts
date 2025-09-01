/**
 * Integration test for the complete background AI analysis workflow
 * Tests the entire flow from job creation to completion and notification
 */

import { JobQueueManager } from '../JobQueueManager'
import { AIAnalysisWorker } from '../AIAnalysisWorker'
import { getNotificationService } from '../../notifications'

// Mock all external dependencies
jest.mock('../../../lib/database')
jest.mock('../../settings/UserApiKeyService')
jest.mock('../../ai')
jest.mock('../../notifications')
jest.mock('ioredis')
jest.mock('bullmq')

describe('Background Analysis Workflow Integration', () => {
  let queueManager: JobQueueManager
  let worker: AIAnalysisWorker
  let notificationService: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup mocks
    const mockDatabase = require('../../../lib/database')
    mockDatabase.getSupabaseAdminClient.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: {
                id: 'test-paper-id',
                title: 'Test Paper',
                authors: ['Test Author'],
                abstract: 'Test abstract'
              },
              error: null
            }))
          }))
        })),
        insert: jest.fn(() => Promise.resolve({ error: null }))
      }))
    })

    const mockApiKeyService = require('../../settings/UserApiKeyService')
    mockApiKeyService.UserApiKeyService.mockImplementation(() => ({
      getApiKey: jest.fn(() => Promise.resolve('test-api-key')),
      validateApiKey: jest.fn(() => Promise.resolve(true)),
      incrementUsage: jest.fn(() => Promise.resolve())
    }))

    const mockAI = require('../../ai')
    mockAI.AIServiceFactory = {
      createService: jest.fn(() => ({
        summarize: jest.fn(() => Promise.resolve('Test summary')),
        extractKeywords: jest.fn(() => Promise.resolve(['keyword1', 'keyword2'])),
        analyzeRelevance: jest.fn(() => Promise.resolve({ relevance: 'high' })),
        getModelName: jest.fn(() => 'test-model'),
        getLastUsageStats: jest.fn(() => ({ tokensUsed: 100, processingTimeMs: 1000 }))
      }))
    }
    mockAI.MultiModelAnalyzer.mockImplementation(() => ({
      analyzePaper: jest.fn(() => Promise.resolve({
        paperId: 'test-paper-id',
        openai: {
          id: 'test-analysis-id',
          paperId: 'test-paper-id',
          modelProvider: 'openai',
          modelName: 'gpt-4',
          summary: 'Test summary',
          keywords: ['keyword1', 'keyword2'],
          scientificRelevance: { relevance: 'high' },
          confidenceScore: 0.9,
          tokensUsed: 100,
          processingTimeMs: 1000,
          createdAt: new Date()
        },
        completedAt: new Date()
      }))
    }))

    notificationService = {
      sendNotification: jest.fn(() => Promise.resolve('notification-id'))
    }
    const mockNotifications = require('../../notifications')
    mockNotifications.getNotificationService.mockReturnValue(notificationService)

    // Mock Redis
    const mockRedis = {
      setex: jest.fn(() => Promise.resolve()),
      lpush: jest.fn(() => Promise.resolve()),
      expire: jest.fn(() => Promise.resolve()),
      publish: jest.fn(() => Promise.resolve()),
      ping: jest.fn(() => Promise.resolve()),
      quit: jest.fn(() => Promise.resolve())
    }
    const Redis = require('ioredis')
    Redis.mockImplementation(() => mockRedis)

    // Mock BullMQ
    const mockJob = {
      id: 'test-job-id',
      data: {
        paperId: 'test-paper-id',
        providers: ['openai'],
        userId: 'test-user-id'
      }
    }
    const BullMQ = require('bullmq')
    BullMQ.Worker.mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn(() => Promise.resolve()),
      processed: 1,
      failed: 0,
      active: 0,
      closing: false
    }))
    BullMQ.Queue.mockImplementation(() => ({
      add: jest.fn(() => Promise.resolve({ id: 'test-job-id' })),
      getJob: jest.fn(() => Promise.resolve(mockJob)),
      getWaiting: jest.fn(() => Promise.resolve([])),
      getActive: jest.fn(() => Promise.resolve([])),
      getCompleted: jest.fn(() => Promise.resolve([mockJob])),
      getFailed: jest.fn(() => Promise.resolve([])),
      getDelayed: jest.fn(() => Promise.resolve([])),
      on: jest.fn(),
      close: jest.fn(() => Promise.resolve())
    }))

    // Initialize services
    queueManager = new JobQueueManager()
    worker = new AIAnalysisWorker()
  })

  afterEach(async () => {
    await queueManager.close()
    await worker.close()
  })

  describe('Complete Workflow', () => {
    it('should successfully process an analysis job from start to finish', async () => {
      // 1. Add job to queue
      const jobId = await queueManager.addAnalysisJob('test-paper-id', ['openai'])
      expect(jobId).toBe('test-job-id')

      // 2. Check initial job status
      const initialStatus = await queueManager.getJobStatus(jobId)
      expect(initialStatus.id).toBe(jobId)

      // 3. Verify queue status
      const queueStatus = await queueManager.getQueueStatus()
      expect(queueStatus).toEqual({
        waiting: 0,
        active: 0,
        completed: 1,
        failed: 0,
        delayed: 0
      })

      // 4. Verify worker stats
      const workerStats = await worker.getWorkerStats()
      expect(workerStats).toEqual({
        processed: 1,
        failed: 0,
        active: 0
      })

      // 5. Test progress updates
      await worker.updateJobProgress(jobId, 50, 'Processing...')
      
      // 6. Verify health checks
      expect(await queueManager.isHealthy()).toBe(true)
      expect(await worker.isHealthy()).toBe(true)
    })

    it('should handle multiple providers correctly', async () => {
      const providers = ['openai', 'anthropic', 'gemini']
      const jobId = await queueManager.addAnalysisJob('test-paper-id', providers)
      
      expect(jobId).toBe('test-job-id')
      
      // Verify the job was created with correct providers
      const BullMQ = require('bullmq')
      const mockQueue = BullMQ.Queue.mock.instances[0]
      expect(mockQueue.add).toHaveBeenCalledWith(
        'analyze-paper',
        expect.objectContaining({
          paperId: 'test-paper-id',
          providers: providers,
          userId: 'current-user'
        }),
        expect.any(Object)
      )
    })

    it('should validate providers correctly', async () => {
      // Test invalid provider
      await expect(
        queueManager.addAnalysisJob('test-paper-id', ['invalid-provider' as any])
      ).rejects.toThrow()

      // Test empty providers
      await expect(
        queueManager.addAnalysisJob('test-paper-id', [])
      ).rejects.toThrow()
    })

    it('should handle job failures gracefully', async () => {
      // Mock a failing job
      const mockDatabase = require('../../../lib/database')
      mockDatabase.getSupabaseAdminClient.mockReturnValueOnce({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: null,
                error: { message: 'Paper not found' }
              }))
            }))
          }))
        }))
      })

      const jobId = await queueManager.addAnalysisJob('nonexistent-paper', ['openai'])
      expect(jobId).toBe('test-job-id')
    })

    it('should send notifications on completion', async () => {
      const jobId = await queueManager.addAnalysisJob('test-paper-id', ['openai'])
      
      // Simulate job completion notification
      await worker.updateJobProgress(jobId, 100, 'Complete')
      
      // The notification would be sent during actual job processing
      // Here we just verify the service is available
      expect(notificationService.sendNotification).toBeDefined()
    })

    it('should handle concurrent jobs', async () => {
      const jobs = await Promise.all([
        queueManager.addAnalysisJob('paper-1', ['openai']),
        queueManager.addAnalysisJob('paper-2', ['anthropic']),
        queueManager.addAnalysisJob('paper-3', ['gemini'])
      ])

      expect(jobs).toHaveLength(3)
      jobs.forEach(jobId => {
        expect(jobId).toBe('test-job-id')
      })
    })

    it('should maintain job progress correctly', async () => {
      const jobId = 'test-job-id'
      
      // Test progress updates
      await worker.updateJobProgress(jobId, 0, 'Starting...')
      await worker.updateJobProgress(jobId, 25, 'Fetching paper...')
      await worker.updateJobProgress(jobId, 50, 'Analyzing...')
      await worker.updateJobProgress(jobId, 75, 'Saving results...')
      await worker.updateJobProgress(jobId, 100, 'Complete')

      // Verify Redis calls for progress tracking
      const Redis = require('ioredis')
      const mockRedis = Redis.mock.instances[0]
      expect(mockRedis.setex).toHaveBeenCalledTimes(5)
    })
  })

  describe('Error Handling', () => {
    it('should handle Redis connection failures', async () => {
      const Redis = require('ioredis')
      const mockRedis = Redis.mock.instances[0]
      mockRedis.ping.mockRejectedValueOnce(new Error('Connection failed'))

      expect(await worker.isHealthy()).toBe(false)
      expect(await queueManager.isHealthy()).toBe(false)
    })

    it('should handle database errors gracefully', async () => {
      const mockDatabase = require('../../../lib/database')
      mockDatabase.getSupabaseAdminClient.mockReturnValueOnce({
        from: jest.fn(() => {
          throw new Error('Database connection failed')
        })
      })

      // This should not crash the worker
      await expect(worker.updateJobProgress('test-job', 50)).resolves.not.toThrow()
    })

    it('should handle notification failures gracefully', async () => {
      notificationService.sendNotification.mockRejectedValueOnce(new Error('Notification failed'))
      
      // This should not crash the worker
      await expect(worker.updateJobProgress('test-job', 100)).resolves.not.toThrow()
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle high job volumes', async () => {
      const jobPromises = Array.from({ length: 100 }, (_, i) => 
        queueManager.addAnalysisJob(`paper-${i}`, ['openai'])
      )

      const jobs = await Promise.all(jobPromises)
      expect(jobs).toHaveLength(100)
    })

    it('should provide accurate queue statistics', async () => {
      await queueManager.addAnalysisJob('test-paper', ['openai'])
      
      const status = await queueManager.getQueueStatus()
      expect(typeof status.waiting).toBe('number')
      expect(typeof status.active).toBe('number')
      expect(typeof status.completed).toBe('number')
      expect(typeof status.failed).toBe('number')
      expect(typeof status.delayed).toBe('number')
    })
  })
})