import { SupabaseVectorService } from './SupabaseVectorService'

/**
 * Factory class for creating and managing vector service instances
 */
export class VectorServiceFactory {
  private static instance: SupabaseVectorService | null = null

  /**
   * Get or create a SupabaseVectorService instance
   */
  static getInstance(openaiApiKey?: string): SupabaseVectorService {
    if (!this.instance) {
      if (!openaiApiKey) {
        throw new Error('OpenAI API key is required to initialize vector service')
      }
      this.instance = new SupabaseVectorService(openaiApiKey)
    }
    return this.instance
  }

  /**
   * Reset the instance (useful for testing or key changes)
   */
  static resetInstance(): void {
    this.instance = null
  }

  /**
   * Check if instance is initialized
   */
  static isInitialized(): boolean {
    return this.instance !== null
  }
}