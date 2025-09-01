// Background job queue types and interfaces

export interface JobQueueManager {
  addAnalysisJob(paperId: string, providers: AIProvider[]): Promise<string>
  getJobStatus(jobId: string): Promise<JobStatus>
  cancelJob(jobId: string): Promise<boolean>
  retryFailedJob(jobId: string): Promise<string>
  getQueueStatus(): Promise<QueueStatus>
}

export interface AIAnalysisWorker {
  processAnalysisJob(job: AnalysisJob): Promise<void>
  handleJobFailure(job: AnalysisJob, error: Error): Promise<void>
  updateJobProgress(jobId: string, progress: number): Promise<void>
}

export interface JobStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  startedAt?: Date
  completedAt?: Date
  error?: string
  result?: AIAnalysisResult
  attempts: number
  maxAttempts: number
}

export interface QueueStatus {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export interface AnalysisJob {
  id: string
  paperId: string
  providers: AIProvider[]
  userId: string
  priority: number
  createdAt: Date
}

export interface AnalysisJobData {
  paperId: string
  providers: AIProvider[]
  userId: string
  priority?: number
}

export interface AIAnalysisResult {
  paperId: string
  provider: string
  analysis: {
    summary: string
    keyFindings: string[]
    methodology: string
    limitations: string[]
    significance: string
  }
  confidence: number
  processingTime: number
  completedAt: Date
}

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'xai'

export interface JobRetryOptions {
  attempts: number
  backoff: {
    type: 'exponential' | 'fixed'
    delay: number
  }
}

export interface JobProgressUpdate {
  jobId: string
  progress: number
  message?: string
  data?: any
}

export interface JobError {
  message: string
  stack?: string
  code?: string
  retryable: boolean
}