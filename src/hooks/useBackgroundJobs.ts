import { useState, useEffect, useCallback } from 'react'
import { JobStatus, QueueStatus, AIProvider } from '@/services/background/types'

interface UseBackgroundJobsReturn {
  // Job management
  createAnalysisJob: (paperId: string, providers: AIProvider[]) => Promise<string>
  getJobStatus: (jobId: string) => Promise<JobStatus>
  cancelJob: (jobId: string) => Promise<boolean>
  retryJob: (jobId: string) => Promise<string>
  
  // Queue status
  queueStatus: QueueStatus | null
  refreshQueueStatus: () => Promise<void>
  
  // Health check
  isHealthy: boolean | null
  checkHealth: () => Promise<void>
  
  // Loading states
  isLoading: boolean
  error: string | null
}

export function useBackgroundJobs(): UseBackgroundJobsReturn {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Create a new AI analysis job
   */
  const createAnalysisJob = useCallback(async (paperId: string, providers: AIProvider[]): Promise<string> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'ai-analysis',
          paperId,
          providers
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create job')
      }

      return data.jobId
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create job'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Get job status by ID
   */
  const getJobStatus = useCallback(async (jobId: string): Promise<JobStatus> => {
    setError(null)

    try {
      const response = await fetch(`/api/jobs/${jobId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get job status')
      }

      return data.job
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get job status'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  /**
   * Cancel a job
   */
  const cancelJob = useCallback(async (jobId: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel job')
      }

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel job'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Retry a failed job
   */
  const retryJob = useCallback(async (jobId: string): Promise<string> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retry job')
      }

      return data.jobId
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry job'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Refresh queue status
   */
  const refreshQueueStatus = useCallback(async (): Promise<void> => {
    setError(null)

    try {
      const response = await fetch('/api/jobs')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get queue status')
      }

      setQueueStatus(data.queueStatus)
      setIsHealthy(data.isHealthy)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get queue status'
      setError(errorMessage)
      setIsHealthy(false)
    }
  }, [])

  /**
   * Check system health
   */
  const checkHealth = useCallback(async (): Promise<void> => {
    setError(null)

    try {
      const response = await fetch('/api/jobs/health')
      const data = await response.json()

      setIsHealthy(data.healthy)

      if (!data.healthy && data.details?.error) {
        setError(data.details.error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Health check failed'
      setError(errorMessage)
      setIsHealthy(false)
    }
  }, [])

  // Auto-refresh queue status on mount and periodically
  useEffect(() => {
    refreshQueueStatus()
    checkHealth()

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      refreshQueueStatus()
      checkHealth()
    }, 30000)

    return () => clearInterval(interval)
  }, [refreshQueueStatus, checkHealth])

  return {
    createAnalysisJob,
    getJobStatus,
    cancelJob,
    retryJob,
    queueStatus,
    refreshQueueStatus,
    isHealthy,
    checkHealth,
    isLoading,
    error
  }
}

/**
 * Hook for tracking a specific job's progress
 */
export function useJobProgress(jobId: string | null, pollInterval: number = 2000) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { getJobStatus } = useBackgroundJobs()

  const refreshJobStatus = useCallback(async () => {
    if (!jobId) return

    setIsLoading(true)
    setError(null)

    try {
      const status = await getJobStatus(jobId)
      setJobStatus(status)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get job status'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [jobId, getJobStatus])

  useEffect(() => {
    if (!jobId) {
      setJobStatus(null)
      return
    }

    refreshJobStatus()

    // Poll for updates if job is not in final state
    const interval = setInterval(() => {
      if (jobStatus?.status === 'pending' || jobStatus?.status === 'processing') {
        refreshJobStatus()
      }
    }, pollInterval)

    return () => clearInterval(interval)
  }, [jobId, jobStatus?.status, pollInterval, refreshJobStatus])

  return {
    jobStatus,
    isLoading,
    error,
    refreshJobStatus
  }
}