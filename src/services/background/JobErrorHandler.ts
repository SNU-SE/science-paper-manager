import { Job } from 'bullmq'
import { AnalysisJobData, JobError } from './types'
import { getNotificationService } from '../notifications'

export class JobErrorHandler {
  /**
   * Handle job failure with retry logic and error classification
   */
  static async handleJobFailure(job: Job, error: Error): Promise<void> {
    const jobData = job.data as AnalysisJobData
    const jobError = this.classifyError(error)
    
    console.error(`Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}):`, {
      error: error.message,
      stack: error.stack,
      jobData,
      retryable: jobError.retryable
    })

    // If job has more attempts and error is retryable
    if (job.attemptsMade < (job.opts.attempts || 3) && jobError.retryable) {
      const delay = this.calculateBackoffDelay(job.attemptsMade)
      console.log(`Scheduling retry for job ${job.id} with delay ${delay}ms`)
      
      // Update job with retry information
      await job.updateProgress({
        status: 'retrying',
        attempt: job.attemptsMade,
        nextRetryAt: new Date(Date.now() + delay),
        error: error.message
      })
      
      return
    }

    // Final failure - no more retries
    await this.recordJobFailure(job.id!, error, jobData)
    await this.notifyUserOfFailure(jobData.userId, job.id!, error)
    
    // Alert administrators for critical errors
    if (this.isCriticalError(error)) {
      await this.notifyAdministrators(job, error)
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private static calculateBackoffDelay(attempt: number): number {
    const baseDelay = 2000 // 2 seconds
    const maxDelay = 30000 // 30 seconds
    const exponentialDelay = baseDelay * Math.pow(2, attempt)
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * exponentialDelay
    
    return Math.min(exponentialDelay + jitter, maxDelay)
  }

  /**
   * Classify error to determine if it's retryable
   */
  private static classifyError(error: Error): JobError {
    const message = error.message.toLowerCase()
    
    // Network/API errors that are typically retryable
    const retryablePatterns = [
      'timeout',
      'network',
      'connection',
      'rate limit',
      'service unavailable',
      'internal server error',
      'bad gateway',
      'gateway timeout'
    ]

    // Permanent errors that shouldn't be retried
    const permanentPatterns = [
      'unauthorized',
      'forbidden',
      'not found',
      'invalid api key',
      'quota exceeded',
      'bad request'
    ]

    const isRetryable = retryablePatterns.some(pattern => message.includes(pattern)) &&
                       !permanentPatterns.some(pattern => message.includes(pattern))

    return {
      message: error.message,
      stack: error.stack,
      code: this.extractErrorCode(error),
      retryable: isRetryable
    }
  }

  /**
   * Extract error code from various error types
   */
  private static extractErrorCode(error: Error): string | undefined {
    // Handle different error types
    if ('code' in error) {
      return String(error.code)
    }
    
    if ('status' in error) {
      return String(error.status)
    }
    
    // Extract HTTP status codes from error messages
    const statusMatch = error.message.match(/status:?\s*(\d{3})/i)
    if (statusMatch) {
      return statusMatch[1]
    }
    
    return undefined
  }

  /**
   * Record job failure in database for analytics
   */
  private static async recordJobFailure(jobId: string, error: Error, jobData: AnalysisJobData): Promise<void> {
    try {
      // TODO: Implement database logging
      console.log('Recording job failure:', {
        jobId,
        error: error.message,
        paperId: jobData.paperId,
        providers: jobData.providers,
        userId: jobData.userId,
        timestamp: new Date().toISOString()
      })
      
      // This would typically insert into a job_failures table
      // await database.jobFailures.create({
      //   jobId,
      //   errorMessage: error.message,
      //   errorStack: error.stack,
      //   paperId: jobData.paperId,
      //   providers: jobData.providers,
      //   userId: jobData.userId,
      //   createdAt: new Date()
      // })
    } catch (dbError) {
      console.error('Failed to record job failure:', dbError)
    }
  }

  /**
   * Notify user of job failure
   */
  private static async notifyUserOfFailure(userId: string, jobId: string, error: Error): Promise<void> {
    try {
      console.log('Notifying user of job failure:', {
        userId,
        jobId,
        error: error.message
      })
      
      const notificationService = getNotificationService()
      
      await notificationService.sendNotification(userId, {
        type: 'ai_analysis_failed',
        title: 'AI Analysis Failed',
        message: `Your analysis job failed: ${error.message}`,
        data: { jobId, error: error.message },
        priority: 'high'
      })
    } catch (notificationError) {
      console.error('Failed to notify user of job failure:', notificationError)
    }
  }

  /**
   * Notify administrators of critical errors
   */
  private static async notifyAdministrators(job: Job, error: Error): Promise<void> {
    try {
      console.error('CRITICAL ERROR - Notifying administrators:', {
        jobId: job.id,
        error: error.message,
        stack: error.stack,
        jobData: job.data
      })
      
      // TODO: Implement admin notification system
      // This could send emails, Slack messages, or other alerts
      // await adminNotificationService.sendAlert({
      //   level: 'critical',
      //   title: 'Critical Job Failure',
      //   message: `Job ${job.id} failed with critical error: ${error.message}`,
      //   data: { job: job.data, error: error.stack }
      // })
    } catch (adminNotificationError) {
      console.error('Failed to notify administrators:', adminNotificationError)
    }
  }

  /**
   * Determine if error is critical and requires immediate attention
   */
  private static isCriticalError(error: Error): boolean {
    const criticalPatterns = [
      'database',
      'redis',
      'memory',
      'disk space',
      'system',
      'security'
    ]
    
    const message = error.message.toLowerCase()
    return criticalPatterns.some(pattern => message.includes(pattern))
  }

  /**
   * Get error statistics for monitoring
   */
  static async getErrorStatistics(timeRange: { start: Date; end: Date }): Promise<{
    totalErrors: number
    retryableErrors: number
    permanentErrors: number
    criticalErrors: number
    errorsByType: Record<string, number>
  }> {
    // TODO: Implement error statistics from database
    return {
      totalErrors: 0,
      retryableErrors: 0,
      permanentErrors: 0,
      criticalErrors: 0,
      errorsByType: {}
    }
  }
}