/**
 * Base abstract class for AI services
 * Provides common interface for all AI service implementations
 */
export abstract class BaseAIService {
  protected apiKey: string;
  protected modelName: string;

  constructor(apiKey: string, modelName: string) {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  /**
   * Generate a summary of the given text
   */
  abstract summarize(text: string): Promise<string>;

  /**
   * Extract keywords from the given text
   */
  abstract extractKeywords(text: string): Promise<string[]>;

  /**
   * Analyze scientific relevance of the text
   */
  abstract analyzeRelevance(text: string): Promise<any>;

  /**
   * Validate the API key for this service
   */
  abstract validateApiKey(key: string): Promise<boolean>;

  /**
   * Get the service provider name
   */
  abstract getProvider(): string;

  /**
   * Get the model name
   */
  getModelName(): string {
    return this.modelName;
  }

  /**
   * Get usage statistics for the last operation
   */
  abstract getLastUsageStats(): {
    tokensUsed: number;
    processingTimeMs: number;
    cost?: number;
  };

  /**
   * Calculate cost based on tokens used
   */
  protected abstract calculateCost(tokensUsed: number): number;
}

/**
 * Interface for AI analysis results
 */
export interface AIAnalysisResult {
  id: string;
  paperId: string;
  modelProvider: 'openai' | 'anthropic' | 'xai' | 'gemini';
  modelName: string;
  summary: string;
  keywords: string[];
  scientificRelevance?: any;
  confidenceScore: number;
  tokensUsed: number;
  processingTimeMs: number;
  createdAt: Date;
}

/**
 * Interface for multi-model analysis results
 */
export interface MultiModelAnalysis {
  paperId: string;
  openai?: AIAnalysisResult;
  anthropic?: AIAnalysisResult;
  xai?: AIAnalysisResult;
  gemini?: AIAnalysisResult;
  completedAt: Date;
}