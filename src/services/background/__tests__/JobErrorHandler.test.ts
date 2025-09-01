import { JobErrorHandler } from '../JobErrorHandler'
import { Job } from 'bullmq'
import { AnalysisJobData } from '../types'

// Mock console methods
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation()
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation()

describe('JobErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    mockConsoleError.mockRestore()
    mockConsoleLog.mockRestore()
  })

  describe('handleJobFailure', () => {
    const createMockJob = (attemptsMade: number = 1, maxAttempts: number = 3): Job => ({
      id: 'test-job-id',
      data: {
        paperId: 'paper-123',
        providers: ['openai'],
        userId: 'user-123'
      } as AnalysisJobData,
      attemptsMade,
      opts: { attempts: maxAttempts },
      updateProgress: jest.fn().mockResolvedValue(true)
    } as any)

    it('should handle retryable errors within attempt limit', async () => {
      const job = createMockJob(1, 3)
      const error = new Error('Network timeout')

      await JobErrorHandler.handleJobFailure(job, error)

      expect(job.updateProgress).toHaveBeenCalledWith({
        status: 'retrying',
        attempt: 1,
        nextRetryAt: expect.any(Date),
        error: 'Network timeout'
      })
    })

    it('should handle final failure when attempts exhausted', async () => {
      const job = createMockJob(3, 3)
      const error = new Error('Permanent failure')

      await JobErrorHandler.handleJobFailure(job, error)

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Job test-job-id failed'),
        expect.objectContaining({
          error: 'Permanent failure',
          retryable: expect.any(Boolean)
        })
      )
    })

    it('should not retry non-retryable errors', async () => {
      const job = createMockJob(1, 3)
      const error = new Error('Unauthorized - invalid API key')

      await JobErrorHandler.handleJobFailure(job, error)

      // Should go straight to final failure handling
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Recording job failure:',
        expect.objectContaining({
          jobId: 'test-job-id',
          error: 'Unauthorized - invalid API key'
        })
      )
    })
  })

  describe('error classification', () => {
    it('should classify network errors as retryable', () => {
      const networkErrors = [
        new Error('Network timeout'),
        new Error('Connection refused'),
        new Error('Service unavailable'),
        new Error('Rate limit exceeded'),
        new Error('Internal server error')
      ]

      networkErrors.forEach(error => {
        // Access private method through any cast for testing
        const classified = (JobErrorHandler as any).classifyError(error)
        expect(classified.retryable).toBe(true)
      })
    })

    it('should classify permanent errors as non-retryable', () => {
      const permanentErrors = [
        new Error('Unauthorized access'),
        new Error('Forbidden request'),
        new Error('Resource not found'),
        new Error('Invalid API key'),
        new Error('Quota exceeded'),
        new Error('Bad request format')
      ]

      permanentErrors.forEach(error => {
        const classified = (JobErrorHandler as any).classifyError(error)
        expect(classified.retryable).toBe(false)
      })
    })

    it('should extract error codes from different error types', () => {
      const errorWithCode = { message: 'Test error', code: 'E001' } as Error
      const errorWithStatus = { message: 'HTTP error', status: 404 } as Error
      const errorWithStatusInMessage = new Error('Request failed with status: 500')

      const classified1 = (JobErrorHandler as any).extractErrorCode(errorWithCode)
      const classified2 = (JobErrorHandler as any).extractErrorCode(errorWithStatus)
      const classified3 = (JobErrorHandler as any).extractErrorCode(errorWithStatusInMessage)

      expect(classified1).toBe('E001')
      expect(classified2).toBe('404')
      expect(classified3).toBe('500')
    })
  })

  describe('backoff calculation', () => {
    it('should calculate exponential backoff with jitter', () => {
      const calculateBackoffDelay = (JobErrorHandler as any).calculateBackoffDelay

      const delay1 = calculateBackoffDelay(0)
      const delay2 = calculateBackoffDelay(1)
      const delay3 = calculateBackoffDelay(2)

      // Should increase exponentially
      expect(delay2).toBeGreaterThan(delay1)
      expect(delay3).toBeGreaterThan(delay2)

      // Should not exceed max delay
      const delay10 = calculateBackoffDelay(10)
      expect(delay10).toBeLessThanOrEqual(30000)
    })

    it('should add jitter to prevent thundering herd', () => {
      const calculateBackoffDelay = (JobErrorHandler as any).calculateBackoffDelay

      // Calculate multiple delays for same attempt
      const delays = Array.from({ length: 10 }, () => calculateBackoffDelay(2))
      
      // Should have some variation due to jitter
      const uniqueDelays = new Set(delays)
      expect(uniqueDelays.size).toBeGreaterThan(1)
    })
  })

  describe('critical error detection', () => {
    it('should identify critical errors', () => {
      const isCriticalError = (JobErrorHandler as any).isCriticalError

      const criticalErrors = [
        new Error('Database connection failed'),
        new Error('Redis server unavailable'),
        new Error('Out of memory error'),
        new Error('Disk space full'),
        new Error('System overload'),
        new Error('Security breach detected')
      ]

      criticalErrors.forEach(error => {
        expect(isCriticalError(error)).toBe(true)
      })
    })

    it('should not flag normal errors as critical', () => {
      const isCriticalError = (JobErrorHandler as any).isCriticalError

      const normalErrors = [
        new Error('API rate limit exceeded'),
        new Error('Invalid input data'),
        new Error('Timeout waiting for response'),
        new Error('Network connection lost')
      ]

      normalErrors.forEach(error => {
        expect(isCriticalError(error)).toBe(false)
      })
    })
  })

  describe('getErrorStatistics', () => {
    it('should return error statistics structure', async () => {
      const timeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-02')
      }

      const stats = await JobErrorHandler.getErrorStatistics(timeRange)

      expect(stats).toEqual({
        totalErrors: 0,
        retryableErrors: 0,
        permanentErrors: 0,
        criticalErrors: 0,
        errorsByType: {}
      })
    })
  })
})