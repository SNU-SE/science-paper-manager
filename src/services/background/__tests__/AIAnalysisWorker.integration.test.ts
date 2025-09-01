import { AIAnalysisWorker } from '../AIAnalysisWorker'
import { JobQueueManager } from '../JobQueueManager'

// Mock dependencies
jest.mock('../../../lib/database', () => ({
  getSupabaseAdminClient: jest.fn(() => ({
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
  }))
}))

jest.mock('../../settings/UserApiKeyService', () => ({
  UserApiKeyService: jest.fn(() => ({
    getApiKey: jest.fn(() => Promise.resolve('test-api-key')),
    validateApiKey: jest.fn(() => Promise.resolve(true)),
    incrementUsage: jest.fn(() => Promise.resolve())
  }))
}))

jest.mock('../../ai', () => ({
  AIServiceFactory: {
    createService: jest.fn(() => ({
      summarize: jest.fn(() => Promise.resolve('Test summary')),
      extractKeywords: jest.fn(() => Promise.resolve(['keyword1', 'keyword2'])),
      analyzeRelevance: jest.fn(() => Promise.resolve({ relevance: 'high' })),
      getModelName: jest.fn(() => 'test-model'),
      getLastUsageStats: jest.fn(() => ({ tokensUsed: 100, processingTimeMs: 1000 }))
    }))
  },
  MultiModelAnalyzer: jest.fn(() => ({
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
}))

jest.mock('../../notifications', () => ({
  getNotificationService: jest.fn(() => ({
    sendNotification: jest.fn(() => Promise.resolve('notification-id'))
  }))
}))

// Mock Redis
const mockRedis = {
  setex: jest.fn(() => Promise.resolve()),
  lpush: jest.fn(() => Promise.resolve()),
  expire: jest.fn(() => Promise.resolve()),
  publish: jest.fn(() => Promise.resolve()),
  ping: jest.fn(() => Promise.resolve()),
  quit: jest.fn(() => Promise.resolve())
}

jest.mock('ioredis', () => {
  return jest.fn(() => mockRedis)
})

// Mock BullMQ
const mockJob = {
  id: 'test-job-id',
  data: {
    paperId: 'test-paper-id',
    providers: ['openai'],
    userId: 'test-user-id'
  }
}

jest.mock('bullmq', () => ({
  Worker: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn(() => Promise.resolve()),
    processed: 0,
    failed: 0,
    active: 0,
    closing: false
  })),
  Queue: jest.fn(() => ({
    add: jest.fn(() => Promise.resolve({ id: 'test-job-id' })),
    getJob: jest.fn(() => Promise.resolve(mockJob)),
    on: jest.fn(),
    close: jest.fn(() => Promise.resolve())
  }))
}))

describe('AIAnalysisWorker Integration', () => {
  let worker: AIAnalysisWorker
  let queueManager: JobQueueManager

  beforeEach(() => {
    jest.clearAllMocks()
    worker = new AIAnalysisWorker()
    queueManager = new JobQueueManager()
  })

  afterEach(async () => {
    await worker.close()
    await queueManager.close()
  })

  describe('Background Job Processing', () => {
    it('should create worker instance successfully', () => {
      expect(worker).toBeInstanceOf(AIAnalysisWorker)
    })

    it('should create queue manager instance successfully', () => {
      expect(queueManager).toBeInstanceOf(JobQueueManager)
    })

    it('should handle job progress updates', async () => {
      await worker.updateJobProgress('test-job-id', 50, 'Processing...')
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'job:test-job-id:progress',
        3600,
        expect.stringContaining('"progress":50')
      )
    })

    it('should check worker health', async () => {
      const isHealthy = await worker.isHealthy()
      expect(isHealthy).toBe(true)
      expect(mockRedis.ping).toHaveBeenCalled()
    })

    it('should get worker stats', async () => {
      const stats = await worker.getWorkerStats()
      expect(stats).toEqual({
        processed: 0,
        failed: 0,
        active: 0
      })
    })
  })

  describe('Queue Management', () => {
    it('should add analysis job to queue', async () => {
      const jobId = await queueManager.addAnalysisJob('test-paper-id', ['openai'])
      expect(jobId).toBe('test-job-id')
    })

    it('should check queue health', async () => {
      const isHealthy = await queueManager.isHealthy()
      expect(isHealthy).toBe(true)
      expect(mockRedis.ping).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      mockRedis.ping.mockRejectedValueOnce(new Error('Connection failed'))
      
      const isHealthy = await worker.isHealthy()
      expect(isHealthy).toBe(false)
    })

    it('should handle notification failures gracefully', async () => {
      const notificationService = require('../../notifications').getNotificationService()
      notificationService.sendNotification.mockRejectedValueOnce(new Error('Notification failed'))
      
      // This should not throw an error
      await expect(worker.updateJobProgress('test-job-id', 100, 'Complete')).resolves.not.toThrow()
    })
  })
})