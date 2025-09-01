import { useState, useCallback, useEffect } from 'react'
import { AIProvider } from '@/services/background/types'

interface JobStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  startedAt?: Date
  completedAt?: Date
  error?: string
  result?: any
  attempts: number
  maxAttempts: number
}

interface BackgroundAnalysisState {
  isLoading: boolean
  error: string | null
  jobId: string | null
  jobStatus: JobStatus | null
  progress: number
}

interface BackgroundJobsHealth {
  healthy: boolean
  queueManager: boolean
  worker: boolean
  details: {
    queueStatus?: {
      waiting: number
      active: number
      completed: number
      failed: number
      delayed: number
    }
    workerStats?: {
      processed: number
      failed: number
      active: number
    }
    error?: string
  }
}

export function useBackgroundAnalysis() {
  const [state, setState] = useState<BackgroundAnalysisState>({
    isLoading: false,
    error: null,
    jobId: null,
    jobStatus: null,
    progress: 0
  })

  const [healthStatus, setHealthStatus] = useState<BackgroundJobsHealth | null>(null)

  /**
   * Start background AI analysis
   */
  const startAnalysis = useCallback(async (paperId: string, providers: AIProvider[]) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch('/api/ai-analysis/background', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paperId, providers })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start analysis')
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        jobId: data.jobId,
        progress: 0
      }))

      return data.jobId
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to start analysis'
      }))
      throw error
    }
  }, [])

  /**
   * Get job status
   */
  const getJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/ai-analysis/background?jobId=${jobId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get job status')
      }

      const jobStatus = data.jobStatus
      setState(prev => ({
        ...prev,
        jobStatus,
        progress: jobStatus.progress || 0,
        error: jobStatus.error || null
      }))

      return jobStatus
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to get job status'
      }))
      throw error
    }
  }, [])

  /**
   * Poll job status until completion
   */
  const pollJobStatus = useCallback(async (jobId: string, intervalMs: number = 2000) => {
    const poll = async (): Promise<JobStatus> => {
      const status = await getJobStatus(jobId)
      
      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        return status
      }

      // Continue polling
      await new Promise(resolve => setTimeout(resolve, intervalMs))
      return poll()
    }

    return poll()
  }, [getJobStatus])

  /**
   * Get background jobs health status
   */
  const getHealthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/background/status')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get health status')
      }

      setHealthStatus(data)
      return data
    } catch (error) {
      const errorStatus: BackgroundJobsHealth = {
        healthy: false,
        queueManager: false,
        worker: false,
        details: {
          error: error instanceof Error ? error.message : 'Failed to get health status'
        }
      }
      setHealthStatus(errorStatus)
      throw error
    }
  }, [])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      jobId: null,
      jobStatus: null,
      progress: 0
    })
  }, [])

  // Auto-poll job status when jobId is set
  useEffect(() => {
    if (!state.jobId || !state.jobStatus || 
        state.jobStatus.status === 'completed' || 
        state.jobStatus.status === 'failed' || 
        state.jobStatus.status === 'cancelled') {
      return
    }

    const interval = setInterval(() => {
      getJobStatus(state.jobId!)
    }, 2000)

    return () => clearInterval(interval)
  }, [state.jobId, state.jobStatus?.status, getJobStatus])

  return {
    // State
    isLoading: state.isLoading,
    error: state.error,
    jobId: state.jobId,
    jobStatus: state.jobStatus,
    progress: state.progress,
    healthStatus,

    // Actions
    startAnalysis,
    getJobStatus,
    pollJobStatus,
    getHealthStatus,
    clearError,
    reset,

    // Computed values
    isAnalyzing: state.jobStatus?.status === 'processing',
    isCompleted: state.jobStatus?.status === 'completed',
    isFailed: state.jobStatus?.status === 'failed',
    hasResult: state.jobStatus?.result != null
  }
}

export default useBackgroundAnalysis