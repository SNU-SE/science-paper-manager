import { JobQueueManager } from '../JobQueueManager'
import { AIProvider } from '../types'
import Redis from 'ioredis'

// Mock Redis
jest.mock('ioredis')
const MockedRedis = Redis as jest.MockedClass<typeof Redis>

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    getJob: jest.fn(),
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    getDelayed: jest.fn().mockResolvedValue([]),
    close: jest.fn(),
    on: jest.fn()
  })),
  Worker: jest.fn()
}))

describe('JobQueueManager', () => {
  let jobQueueManager: JobQueueManager
  let mockRedis: jest.Mocked<Redis>
  let mockQueue: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Setup Redis mock
    mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn()
    } as any

    MockedRedis.mockImplementation(() => mockRedis)

    // Setup Queue mock
    const { Queue } = require('bullmq')
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
      getJob: jest.fn(),
      getWaiting: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getCompleted: jest.fn().mockResolvedValue([]),
      getFailed: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
      close: jest.fn(),
      on: jest.fn()
    }
    Queue.mockImplementation(() => mockQueue)

    jobQueueManager = new JobQueueManager('redis://test:6379')
  })

  afterEach(async () => {
    await jobQueueManager.close()
  })

  describe('addAnalysisJob', () => {
    it('should successfully add an analysis job', async () => {
      const paperId = 'paper-123'
      const providers: AIProvider[] = ['openai', 'anthropic']

      const jobId = await jobQueueManager.addAnalysisJob(paperId, providers)

      expect(jobId).toBe('test-job-id')
      expect(mockQueue.add).toHaveBeenCalledWith(
        'analyze-paper',
        {
          paperId,
          providers,
          userId: 'current-user',
          priority: 20 // 2 providers * 10
        },
        expect.objectContaining({
          priority: 20,
          delay: 0,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        })
      )
    })

    it('should handle job creation errors', async () => {
      mockQueue.add.mockRejectedValue(new Error('Redis connection failed'))

      await expect(
        jobQueueManager.addAnalysisJob('paper-123', ['openai'])
      ).rejects.toThrow('Failed to queue analysis job: Redis connection failed')
    })
  })

  describe('getJobStatus', () => {
    it('should return job status for existing job', async () => {
      const mockJob = {
        id: 'test-job-id',
        getState: jest.fn().mockResolvedValue('completed'),
        progress: 100,
        processedOn: Date.now() - 5000,
        finishedOn: Date.now(),
        failedReason: null,
        returnvalue: { success: true },
        attemptsMade: 1,
        opts: { attempts: 3 }
      }

      mockQueue.getJob.mockResolvedValue(mockJob)

      const status = await jobQueueManager.getJobStatus('test-job-id')

      expect(status).toEqual({
        id: 'test-job-id',
        status: 'completed',
        progress: 100,
        startedAt: expect.any(Date),
        completedAt: expect.any(Date),
        error: undefined,
        result: { success: true },
        attempts: 1,
        maxAttempts: 3
      })
    })

    it('should throw error for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValue(null)

      await expect(
        jobQueueManager.getJobStatus('non-existent-job')
      ).rejects.toThrow('Job non-existent-job not found')
    })
  })

  describe('cancelJob', () => {
    it('should successfully cancel existing job', async () => {
      const mockJob = {
        remove: jest.fn().mockResolvedValue(true)
      }
      mockQueue.getJob.mockResolvedValue(mockJob)

      const result = await jobQueueManager.cancelJob('test-job-id')

      expect(result).toBe(true)
      expect(mockJob.remove).toHaveBeenCalled()
    })

    it('should return false for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValue(null)

      const result = await jobQueueManager.cancelJob('non-existent-job')

      expect(result).toBe(false)
    })
  })

  describe('retryFailedJob', () => {
    it('should successfully retry failed job', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('failed'),
        retry: jest.fn().mockResolvedValue(true)
      }
      mockQueue.getJob.mockResolvedValue(mockJob)

      const jobId = await jobQueueManager.retryFailedJob('test-job-id')

      expect(jobId).toBe('test-job-id')
      expect(mockJob.retry).toHaveBeenCalled()
    })

    it('should throw error for non-failed job', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('completed')
      }
      mockQueue.getJob.mockResolvedValue(mockJob)

      await expect(
        jobQueueManager.retryFailedJob('test-job-id')
      ).rejects.toThrow('Job test-job-id is not in failed state')
    })
  })

  describe('getQueueStatus', () => {
    it('should return queue statistics', async () => {
      mockQueue.getWaiting.mockResolvedValue([1, 2])
      mockQueue.getActive.mockResolvedValue([3])
      mockQueue.getCompleted.mockResolvedValue([4, 5, 6])
      mockQueue.getFailed.mockResolvedValue([7])
      mockQueue.getDelayed.mockResolvedValue([])

      const status = await jobQueueManager.getQueueStatus()

      expect(status).toEqual({
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 1,
        delayed: 0
      })
    })
  })

  describe('isHealthy', () => {
    it('should return true when Redis is responsive', async () => {
      mockRedis.ping.mockResolvedValue('PONG')

      const healthy = await jobQueueManager.isHealthy()

      expect(healthy).toBe(true)
      expect(mockRedis.ping).toHaveBeenCalled()
    })

    it('should return false when Redis is unresponsive', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'))

      const healthy = await jobQueueManager.isHealthy()

      expect(healthy).toBe(false)
    })
  })
})