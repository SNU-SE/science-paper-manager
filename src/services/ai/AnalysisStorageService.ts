import { AIAnalysisResult, MultiModelAnalysis } from '@/types'
import { AIProvider } from './AIServiceFactory'

/**
 * Service for storing and retrieving AI analysis results
 * Uses localStorage for client-side storage and provides database integration hooks
 */
export class AnalysisStorageService {
  private static readonly STORAGE_KEY = 'ai_analysis_results'
  private static readonly CACHE_EXPIRY_HOURS = 24

  /**
   * Store analysis result for a paper
   */
  static async storeAnalysisResult(result: AIAnalysisResult): Promise<void> {
    try {
      // Store in localStorage for immediate access
      const stored = this.getStoredResults()
      const key = `${result.paperId}-${result.modelProvider}`
      stored[key] = {
        ...result,
        createdAt: new Date(result.createdAt) // Ensure Date object
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored, this.dateReplacer))
      
      // TODO: Also store in database via API call
      await this.storeInDatabase(result)
    } catch (error) {
      console.error('Failed to store analysis result:', error)
      throw error
    }
  }

  /**
   * Store multiple analysis results
   */
  static async storeMultipleResults(results: AIAnalysisResult[]): Promise<void> {
    const promises = results.map(result => this.storeAnalysisResult(result))
    await Promise.allSettled(promises)
  }

  /**
   * Retrieve analysis results for a specific paper
   */
  static async getAnalysisResults(paperId: string): Promise<MultiModelAnalysis> {
    try {
      // First try localStorage
      const localResults = this.getLocalResults(paperId)
      
      // TODO: Also fetch from database and merge with local results
      const dbResults = await this.fetchFromDatabase(paperId)
      
      return this.mergeResults(localResults, dbResults)
    } catch (error) {
      console.error('Failed to retrieve analysis results:', error)
      return {}
    }
  }

  /**
   * Retrieve analysis result for a specific paper and provider
   */
  static async getAnalysisResult(paperId: string, provider: AIProvider): Promise<AIAnalysisResult | undefined> {
    const results = await this.getAnalysisResults(paperId)
    return results[provider]
  }

  /**
   * Delete analysis results for a paper
   */
  static async deleteAnalysisResults(paperId: string): Promise<void> {
    try {
      // Remove from localStorage
      const stored = this.getStoredResults()
      const keysToDelete = Object.keys(stored).filter(key => key.startsWith(`${paperId}-`))
      
      keysToDelete.forEach(key => delete stored[key])
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored, this.dateReplacer))
      
      // TODO: Also delete from database
      await this.deleteFromDatabase(paperId)
    } catch (error) {
      console.error('Failed to delete analysis results:', error)
      throw error
    }
  }

  /**
   * Delete analysis result for a specific provider
   */
  static async deleteAnalysisResult(paperId: string, provider: AIProvider): Promise<void> {
    try {
      const stored = this.getStoredResults()
      const key = `${paperId}-${provider}`
      delete stored[key]
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored, this.dateReplacer))
      
      // TODO: Also delete from database
      await this.deleteFromDatabase(paperId, provider)
    } catch (error) {
      console.error('Failed to delete analysis result:', error)
      throw error
    }
  }

  /**
   * Get all analysis results for multiple papers
   */
  static async getBulkAnalysisResults(paperIds: string[]): Promise<Record<string, MultiModelAnalysis>> {
    const results: Record<string, MultiModelAnalysis> = {}
    
    const promises = paperIds.map(async (paperId) => {
      results[paperId] = await this.getAnalysisResults(paperId)
    })
    
    await Promise.allSettled(promises)
    return results
  }

  /**
   * Check if analysis exists for a paper and provider
   */
  static async hasAnalysis(paperId: string, provider: AIProvider): Promise<boolean> {
    const result = await this.getAnalysisResult(paperId, provider)
    return result !== undefined && !this.isExpired(result)
  }

  /**
   * Get analysis statistics
   */
  static getAnalysisStats(): {
    totalAnalyses: number
    analysesByProvider: Record<AIProvider, number>
    totalTokensUsed: number
    averageProcessingTime: number
  } {
    const stored = this.getStoredResults()
    const results = Object.values(stored)
    
    const stats = {
      totalAnalyses: results.length,
      analysesByProvider: {
        openai: 0,
        anthropic: 0,
        xai: 0,
        gemini: 0
      } as Record<AIProvider, number>,
      totalTokensUsed: 0,
      averageProcessingTime: 0
    }
    
    results.forEach(result => {
      stats.analysesByProvider[result.modelProvider]++
      stats.totalTokensUsed += result.tokensUsed
      stats.averageProcessingTime += result.processingTimeMs
    })
    
    if (results.length > 0) {
      stats.averageProcessingTime = stats.averageProcessingTime / results.length
    }
    
    return stats
  }

  /**
   * Clear expired analysis results
   */
  static clearExpiredResults(): void {
    try {
      const stored = this.getStoredResults()
      const filtered: Record<string, AIAnalysisResult> = {}
      
      Object.entries(stored).forEach(([key, result]) => {
        if (!this.isExpired(result)) {
          filtered[key] = result
        }
      })
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered, this.dateReplacer))
    } catch (error) {
      console.error('Failed to clear expired results:', error)
    }
  }

  /**
   * Clear all analysis results
   */
  static clearAllResults(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear all results:', error)
    }
  }

  // Private helper methods

  private static getStoredResults(): Record<string, AIAnalysisResult> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return {}
      
      return JSON.parse(stored, this.dateReviver)
    } catch (error) {
      console.error('Failed to parse stored results:', error)
      return {}
    }
  }

  private static getLocalResults(paperId: string): MultiModelAnalysis {
    const stored = this.getStoredResults()
    const results: MultiModelAnalysis = {}
    
    Object.entries(stored).forEach(([key, result]) => {
      if (key.startsWith(`${paperId}-`) && !this.isExpired(result)) {
        const provider = result.modelProvider
        results[provider] = result
      }
    })
    
    return results
  }

  private static mergeResults(local: MultiModelAnalysis, db: MultiModelAnalysis): MultiModelAnalysis {
    // Prefer database results over local ones, but keep local if newer
    const merged: MultiModelAnalysis = { ...db }
    
    Object.entries(local).forEach(([provider, localResult]) => {
      if (localResult) {
        const dbResult = db[provider as AIProvider]
        if (!dbResult || localResult.createdAt > dbResult.createdAt) {
          merged[provider as AIProvider] = localResult
        }
      }
    })
    
    return merged
  }

  private static isExpired(result: AIAnalysisResult): boolean {
    const now = new Date()
    const resultDate = new Date(result.createdAt)
    const hoursDiff = (now.getTime() - resultDate.getTime()) / (1000 * 60 * 60)
    
    return hoursDiff > this.CACHE_EXPIRY_HOURS
  }

  private static dateReplacer(key: string, value: unknown): unknown {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() }
    }
    return value
  }

  private static dateReviver(key: string, value: unknown): unknown {
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value)
    }
    return value
  }

  // Database integration methods (to be implemented)

  private static async storeInDatabase(result: AIAnalysisResult): Promise<void> {
    try {
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      })
      
      if (!response.ok) {
        throw new Error(`Database storage failed: ${response.statusText}`)
      }
    } catch (error) {
      // Don't throw here - localStorage storage should still work
      console.warn('Database storage failed, using localStorage only:', error)
    }
  }

  private static async fetchFromDatabase(paperId: string): Promise<MultiModelAnalysis> {
    try {
      const response = await fetch(`/api/ai-analysis/${paperId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          return {} // No results found
        }
        throw new Error(`Database fetch failed: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Convert date strings back to Date objects
      Object.values(data).forEach((result: unknown) => {
        if (result && typeof result === 'object' && 'createdAt' in result) {
          const typedResult = result as { createdAt: string }
          ;(result as { createdAt: Date }).createdAt = new Date(typedResult.createdAt)
        }
      })
      
      return data
    } catch (error) {
      console.warn('Database fetch failed, using localStorage only:', error)
      return {}
    }
  }

  private static async deleteFromDatabase(paperId: string, provider?: AIProvider): Promise<void> {
    try {
      const url = provider 
        ? `/api/ai-analysis/${paperId}/${provider}`
        : `/api/ai-analysis/${paperId}`
      
      const response = await fetch(url, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error(`Database deletion failed: ${response.statusText}`)
      }
    } catch (error) {
      console.warn('Database deletion failed:', error)
    }
  }
}