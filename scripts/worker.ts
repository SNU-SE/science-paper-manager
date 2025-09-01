#!/usr/bin/env tsx

/**
 * Background worker process for handling AI analysis jobs
 * 
 * This script can be run as a separate process to handle background jobs:
 * npm run worker
 * 
 * Or with custom configuration:
 * WORKER_CONCURRENCY=10 REDIS_URL=redis://localhost:6379 npm run worker
 */

import { AIAnalysisWorker } from '../src/services/background/AIAnalysisWorker'
import { getBackgroundJobConfig, validateBackgroundJobConfig } from '../src/services/background/config'

class WorkerProcess {
  private worker: AIAnalysisWorker | null = null
  private isShuttingDown = false

  async start(): Promise<void> {
    try {
      console.log('🚀 Starting background worker process...')
      
      // Load and validate configuration
      const config = getBackgroundJobConfig()
      validateBackgroundJobConfig(config)
      
      console.log('📋 Worker Configuration:')
      console.log(`  - Redis URL: ${config.redis.url}`)
      console.log(`  - Concurrency: ${config.worker.concurrency}`)
      console.log(`  - Max Attempts: ${config.queue.defaultJobOptions.attempts}`)
      console.log(`  - Retry Delay: ${config.queue.defaultJobOptions.backoff.delay}ms`)
      
      // Initialize worker
      this.worker = new AIAnalysisWorker(config.redis.url)
      
      // Check health
      const isHealthy = await this.worker.isHealthy()
      if (!isHealthy) {
        throw new Error('Worker health check failed - check Redis connection')
      }
      
      console.log('✅ Worker initialized successfully')
      console.log('🔄 Waiting for jobs...')
      
      // Setup graceful shutdown
      this.setupGracefulShutdown()
      
      // Keep process alive
      await this.keepAlive()
      
    } catch (error) {
      console.error('❌ Failed to start worker:', error)
      process.exit(1)
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        console.log('⚠️  Force shutdown requested')
        process.exit(1)
      }
      
      this.isShuttingDown = true
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`)
      
      try {
        if (this.worker) {
          console.log('⏳ Waiting for active jobs to complete...')
          await this.worker.close()
          console.log('✅ Worker shutdown complete')
        }
        process.exit(0)
      } catch (error) {
        console.error('❌ Error during shutdown:', error)
        process.exit(1)
      }
    }

    // Handle various shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGUSR2', () => shutdown('SIGUSR2')) // nodemon restart
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error)
      shutdown('uncaughtException')
    })
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
      shutdown('unhandledRejection')
    })
  }

  private async keepAlive(): Promise<void> {
    // Log worker stats periodically
    const statsInterval = setInterval(async () => {
      if (this.worker && !this.isShuttingDown) {
        try {
          const stats = await this.worker.getWorkerStats()
          console.log(`📊 Worker Stats - Processed: ${stats.processed}, Failed: ${stats.failed}, Active: ${stats.active}`)
        } catch (error) {
          console.error('Failed to get worker stats:', error)
        }
      }
    }, 60000) // Every minute

    // Health check interval
    const healthInterval = setInterval(async () => {
      if (this.worker && !this.isShuttingDown) {
        try {
          const isHealthy = await this.worker.isHealthy()
          if (!isHealthy) {
            console.error('❌ Worker health check failed')
            clearInterval(statsInterval)
            clearInterval(healthInterval)
            process.exit(1)
          }
        } catch (error) {
          console.error('Health check error:', error)
        }
      }
    }, 30000) // Every 30 seconds

    // Keep process alive until shutdown
    return new Promise((resolve) => {
      const checkShutdown = () => {
        if (this.isShuttingDown) {
          clearInterval(statsInterval)
          clearInterval(healthInterval)
          resolve()
        } else {
          setTimeout(checkShutdown, 1000)
        }
      }
      checkShutdown()
    })
  }
}

// Start the worker if this script is run directly
if (require.main === module) {
  const worker = new WorkerProcess()
  worker.start().catch((error) => {
    console.error('❌ Worker process failed:', error)
    process.exit(1)
  })
}

export { WorkerProcess }