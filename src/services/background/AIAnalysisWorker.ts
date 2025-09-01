import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import { 
  AIAnalysisWorker as IAIAnalysisWorker, 
  AnalysisJob, 
  AnalysisJobData,
  AIAnalysisResult,
  AIProvider 
} from './types'
import { JobErrorHandler } from './JobErrorHandler'
import { AIServiceFactory, MultiModelAnalyzer, MultiModelAnalysis } from '../ai'
import { getSupabaseAdminClient, AIAnalysisInsert, Paper } from '../../lib/database'
import { UserApiKeyService } from '../settings/UserApiKeyService'
import { getNotificationService } from '../notifications'

export class AIAnalysisWorker implements IAIAnalysisWorker {
  private worker: Worker
  private redis: Redis
  private readonly QUEUE_NAME = 'ai-analysis'

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    })

    this.worker = new Worker(
      this.QUEUE_NAME,
      this.processJob.bind(this),
      {
        connection: this.redis,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    )

    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.worker.on('completed', (job) => {
      console.log(`Worker completed job ${job.id}`)
    })

    this.worker.on('failed', async (job, error) => {
      console.error(`Worker failed job ${job?.id}:`, error.message)
      if (job) {
        await JobErrorHandler.handleJobFailure(job, error)
      }
    })

    this.worker.on('error', (error) => {
      console.error('Worker error:', error)
    })

    this.worker.on('stalled', (jobId) => {
      console.warn(`Job ${jobId} stalled`)
    })
  }

  /**
   * Main job processing function
   */
  private async processJob(job: Job): Promise<AIAnalysisResult[]> {
    const jobData = job.data as AnalysisJobData
    console.log(`Processing analysis job ${job.id} for paper ${jobData.paperId}`)

    try {
      await this.updateJobProgress(job.id!, 10, 'Starting analysis...')
      
      // Validate job data
      this.validateJobData(jobData)
      
      await this.updateJobProgress(job.id!, 20, 'Fetching paper content...')
      
      // Get paper content
      const paper = await this.getPaperContent(jobData.paperId)
      
      await this.updateJobProgress(job.id!, 30, 'Initializing AI providers...')
      
      // Get user's API keys and create AI services
      const aiServices = await this.createAIServices(jobData.userId, jobData.providers)
      
      if (aiServices.size === 0) {
        throw new Error('No valid AI services available. Please check your API keys.')
      }
      
      // Create multi-model analyzer
      const analyzer = new MultiModelAnalyzer(aiServices)
      
      await this.updateJobProgress(job.id!, 40, 'Starting AI analysis...')
      
      // Process analysis with multiple providers concurrently
      const multiModelAnalysis = await analyzer.analyzePaper(paper, Array.from(aiServices.keys()))
      
      // Convert MultiModelAnalysis to AIAnalysisResult[]
      const results = this.convertMultiModelAnalysisToResults(multiModelAnalysis)
      
      await this.updateJobProgress(job.id!, 90, 'Analysis completed, processing results...')

      if (results.length === 0) {
        throw new Error('All AI providers failed to analyze the paper')
      }

      await this.updateJobProgress(job.id!, 95, 'Saving results...')
      
      // Save results to database
      await this.saveAnalysisResults(jobData.paperId, results)
      
      await this.updateJobProgress(job.id!, 100, 'Analysis completed successfully')
      
      // Notify user of completion
      await this.notifyUserOfCompletion(jobData.userId, jobData.paperId, results)
      
      return results
    } catch (error) {
      console.error(`Job ${job.id} processing failed:`, error)
      throw error
    }
  }

  async processAnalysisJob(job: AnalysisJob): Promise<void> {
    // This method is part of the interface but the actual processing
    // is handled by the processJob method above through the Worker
    throw new Error('Use Worker.process() instead of calling this method directly')
  }

  async handleJobFailure(job: AnalysisJob, error: Error): Promise<void> {
    // Delegate to JobErrorHandler
    const bullJob = { 
      id: job.id, 
      data: job, 
      attemptsMade: 1, 
      opts: { attempts: 3 } 
    } as Job
    
    await JobErrorHandler.handleJobFailure(bullJob, error)
  }

  async updateJobProgress(jobId: string, progress: number, message?: string): Promise<void> {
    try {
      // Store progress in Redis for real-time updates
      const progressKey = `job:${jobId}:progress`
      const progressData = {
        progress,
        message,
        updatedAt: new Date().toISOString()
      }
      
      await this.redis.setex(progressKey, 3600, JSON.stringify(progressData)) // Expire in 1 hour
      
      console.log(`Job ${jobId} progress: ${progress}% - ${message || ''}`)
    } catch (error) {
      console.error('Failed to update job progress:', error)
    }
  }

  /**
   * Validate job data before processing
   */
  private validateJobData(jobData: AnalysisJobData): void {
    if (!jobData.paperId) {
      throw new Error('Paper ID is required')
    }
    
    if (!jobData.providers || jobData.providers.length === 0) {
      throw new Error('At least one AI provider is required')
    }
    
    if (!jobData.userId) {
      throw new Error('User ID is required')
    }
    
    const validProviders: AIProvider[] = ['openai', 'anthropic', 'gemini', 'xai']
    const invalidProviders = jobData.providers.filter(p => !validProviders.includes(p))
    
    if (invalidProviders.length > 0) {
      throw new Error(`Invalid AI providers: ${invalidProviders.join(', ')}`)
    }
  }

  /**
   * Get paper content from database
   */
  private async getPaperContent(paperId: string): Promise<Paper> {
    try {
      console.log(`Fetching content for paper ${paperId}`)
      
      const supabase = getSupabaseAdminClient()
      const { data: paper, error } = await supabase
        .from('papers')
        .select('*')
        .eq('id', paperId)
        .single()
      
      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }
      
      if (!paper) {
        throw new Error(`Paper ${paperId} not found`)
      }
      
      return {
        id: paper.id,
        title: paper.title,
        authors: paper.authors || [],
        abstract: paper.abstract || undefined,
        content: undefined // We don't store full content in the database yet
      }
    } catch (error) {
      throw new Error(`Failed to fetch paper content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create AI services for the specified providers using user's API keys
   */
  private async createAIServices(userId: string, providers: AIProvider[]): Promise<Map<AIProvider, any>> {
    const services = new Map()
    const apiKeyService = new UserApiKeyService()
    
    for (const provider of providers) {
      try {
        // Get user's API key for this provider
        const apiKey = await apiKeyService.getApiKey(userId, provider)
        
        if (!apiKey) {
          console.warn(`No API key found for provider ${provider}`)
          continue
        }
        
        // Validate the API key is still valid
        const isValid = await apiKeyService.validateApiKey(userId, provider)
        if (!isValid) {
          console.warn(`Invalid API key for provider ${provider}`)
          continue
        }
        
        // Create AI service
        const service = AIServiceFactory.createService({
          provider,
          apiKey
        })
        
        services.set(provider, service)
        console.log(`Created AI service for provider: ${provider}`)
        
        // Increment usage count
        await apiKeyService.incrementUsage(userId, provider)
      } catch (error) {
        console.error(`Failed to create AI service for ${provider}:`, error)
      }
    }
    
    return services
  }

  /**
   * Convert MultiModelAnalysis to AIAnalysisResult array
   */
  private convertMultiModelAnalysisToResults(multiModelAnalysis: MultiModelAnalysis): AIAnalysisResult[] {
    const results: AIAnalysisResult[] = []
    
    // Extract results from each provider
    const providers: AIProvider[] = ['openai', 'anthropic', 'xai', 'gemini']
    
    for (const provider of providers) {
      const analysisResult = multiModelAnalysis[provider]
      if (analysisResult) {
        results.push({
          paperId: analysisResult.paperId,
          provider,
          analysis: {
            summary: analysisResult.summary,
            keyFindings: analysisResult.keywords,
            methodology: `Analysis performed using ${analysisResult.modelName}`,
            limitations: [], // Could be extracted from scientificRelevance if available
            significance: analysisResult.scientificRelevance ? 
              JSON.stringify(analysisResult.scientificRelevance) : 
              'Scientific relevance analysis completed'
          },
          confidence: analysisResult.confidenceScore,
          processingTime: analysisResult.processingTimeMs,
          completedAt: analysisResult.createdAt
        })
      }
    }
    
    return results
  }

  /**
   * Save analysis results to database
   */
  private async saveAnalysisResults(paperId: string, results: AIAnalysisResult[]): Promise<void> {
    try {
      console.log(`Saving ${results.length} analysis results for paper ${paperId}`)
      
      const supabase = getSupabaseAdminClient()
      
      // Prepare analysis records for insertion
      const analysisRecords: AIAnalysisInsert[] = results.map(result => ({
        paper_id: result.paperId,
        model_provider: result.provider as any,
        model_name: `${result.provider}-model`, // We'll need to get actual model name from the service
        summary: result.analysis.summary,
        keywords: result.analysis.keyFindings,
        scientific_relevance: {
          methodology: result.analysis.methodology,
          limitations: result.analysis.limitations,
          significance: result.analysis.significance
        },
        confidence_score: result.confidence,
        processing_time_ms: result.processingTime,
        tokens_used: null, // We'll need to track this from the AI service
        created_at: result.completedAt.toISOString()
      }))
      
      // Insert all analysis records
      const { error } = await supabase
        .from('ai_analyses')
        .insert(analysisRecords)
      
      if (error) {
        throw new Error(`Database insertion failed: ${error.message}`)
      }
      
      console.log(`Successfully saved ${results.length} analysis results to database`)
    } catch (error) {
      throw new Error(`Failed to save analysis results: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Notify user of analysis completion
   */
  private async notifyUserOfCompletion(
    userId: string, 
    paperId: string, 
    results: AIAnalysisResult[]
  ): Promise<void> {
    try {
      console.log(`Notifying user ${userId} of completed analysis for paper ${paperId}`)
      
      const notificationService = getNotificationService()
      
      await notificationService.sendNotification(userId, {
        type: 'ai_analysis_complete',
        title: 'AI Analysis Complete',
        message: `Analysis completed for your paper with ${results.length} provider(s)`,
        data: { 
          paperId, 
          resultCount: results.length,
          providers: results.map(r => r.provider)
        },
        priority: 'medium'
      })
      
      console.log(`Successfully sent notification to user ${userId}`)
    } catch (error) {
      console.error('Failed to notify user of completion:', error)
      // Don't throw error - notification failure shouldn't fail the job
    }
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(): Promise<{
    processed: number
    failed: number
    active: number
  }> {
    return {
      processed: this.worker.processed,
      failed: this.worker.failed,
      active: this.worker.active
    }
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    await this.worker.close()
    await this.redis.quit()
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.redis.ping()
      return !this.worker.closing
    } catch (error) {
      return false
    }
  }
}