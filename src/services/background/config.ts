// Background job system configuration

export interface BackgroundJobConfig {
  redis: {
    url: string
    maxRetriesPerRequest: number
    retryDelayOnFailover: number
    lazyConnect: boolean
  }
  queue: {
    name: string
    removeOnComplete: number
    removeOnFail: number
    defaultJobOptions: {
      attempts: number
      backoff: {
        type: 'exponential' | 'fixed'
        delay: number
      }
    }
  }
  worker: {
    concurrency: number
    removeOnComplete: number
    removeOnFail: number
  }
  retry: {
    maxAttempts: number
    baseDelay: number
    maxDelay: number
    jitterFactor: number
  }
  cleanup: {
    completedJobRetentionDays: number
    failedJobRetentionDays: number
    progressRetentionHours: number
  }
}

/**
 * Default configuration for background jobs
 */
export const defaultBackgroundJobConfig: BackgroundJobConfig = {
  redis: {
    url: process.env.REDIS_URL || '',
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true
  },
  queue: {
    name: 'ai-analysis',
    removeOnComplete: 100,
    removeOnFail: 50,
    defaultJobOptions: {
      attempts: parseInt(process.env.MAX_JOB_ATTEMPTS || '3'),
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
    removeOnComplete: 100,
    removeOnFail: 50
  },
  retry: {
    maxAttempts: parseInt(process.env.MAX_JOB_ATTEMPTS || '3'),
    baseDelay: 2000,
    maxDelay: 30000,
    jitterFactor: 0.1
  },
  cleanup: {
    completedJobRetentionDays: 7,
    failedJobRetentionDays: 30,
    progressRetentionHours: 24
  }
}

/**
 * Get configuration with environment variable overrides
 */
export function getBackgroundJobConfig(): BackgroundJobConfig {
  return {
    ...defaultBackgroundJobConfig,
    // Allow environment variable overrides
    redis: {
      ...defaultBackgroundJobConfig.redis,
      url: process.env.REDIS_URL || defaultBackgroundJobConfig.redis.url
    },
    worker: {
      ...defaultBackgroundJobConfig.worker,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || String(defaultBackgroundJobConfig.worker.concurrency))
    },
    queue: {
      ...defaultBackgroundJobConfig.queue,
      defaultJobOptions: {
        ...defaultBackgroundJobConfig.queue.defaultJobOptions,
        attempts: parseInt(process.env.MAX_JOB_ATTEMPTS || String(defaultBackgroundJobConfig.queue.defaultJobOptions.attempts))
      }
    }
  }
}

/**
 * Validate configuration
 */
export function validateBackgroundJobConfig(config: BackgroundJobConfig): void {
  if (!config.redis.url) {
    console.warn('Redis URL is not configured - background job processing will be disabled')
    return
  }
  
  if (config.worker.concurrency < 1) {
    throw new Error('Worker concurrency must be at least 1')
  }
  
  if (config.queue.defaultJobOptions.attempts < 1) {
    throw new Error('Job attempts must be at least 1')
  }
  
  if (config.retry.baseDelay < 100) {
    throw new Error('Base retry delay must be at least 100ms')
  }
  
  if (config.retry.maxDelay < config.retry.baseDelay) {
    throw new Error('Max retry delay must be greater than base delay')
  }
}

/**
 * Environment variables documentation
 */
export const ENVIRONMENT_VARIABLES = {
  REDIS_URL: {
    description: 'Redis connection URL for job queue',
    default: 'redis://localhost:6379',
    required: false
  },
  WORKER_CONCURRENCY: {
    description: 'Number of concurrent workers to run',
    default: '5',
    required: false
  },
  MAX_JOB_ATTEMPTS: {
    description: 'Maximum number of retry attempts for failed jobs',
    default: '3',
    required: false
  }
} as const