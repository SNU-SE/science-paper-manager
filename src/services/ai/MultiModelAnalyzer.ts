import { BaseAIService, AIAnalysisResult, MultiModelAnalysis } from './BaseAIService';
import { AIProvider } from './AIServiceFactory';

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract?: string;
  content?: string;
}

/**
 * Service for analyzing papers with multiple AI models in parallel
 */
export class MultiModelAnalyzer {
  private services: Map<AIProvider, BaseAIService>;

  constructor(services: Map<AIProvider, BaseAIService>) {
    this.services = services;
  }

  /**
   * Analyze a paper with all available AI models
   */
  async analyzePaper(paper: Paper, selectedProviders?: AIProvider[]): Promise<MultiModelAnalysis> {
    const providers = selectedProviders || Array.from(this.services.keys());
    const analysisPromises = providers.map(provider => 
      this.analyzeWithModel(paper, provider)
    );

    const results = await Promise.allSettled(analysisPromises);
    
    const analysis: MultiModelAnalysis = {
      paperId: paper.id,
      completedAt: new Date()
    };

    results.forEach((result, index) => {
      const provider = providers[index];
      if (result.status === 'fulfilled') {
        analysis[provider] = result.value;
      } else {
        console.error(`Analysis failed for ${provider}:`, result.reason);
      }
    });

    return analysis;
  }

  /**
   * Analyze a paper with a specific AI model
   */
  private async analyzeWithModel(paper: Paper, provider: AIProvider): Promise<AIAnalysisResult> {
    const service = this.services.get(provider);
    if (!service) {
      throw new Error(`Service not available for provider: ${provider}`);
    }

    const paperText = this.preparePaperText(paper);
    const startTime = Date.now();

    try {
      // Run all analysis tasks in parallel
      const [summary, keywords, relevance] = await Promise.all([
        service.summarize(paperText),
        service.extractKeywords(paperText),
        service.analyzeRelevance(paperText)
      ]);

      const usageStats = service.getLastUsageStats();
      
      return {
        id: `${paper.id}-${provider}-${Date.now()}`,
        paperId: paper.id,
        modelProvider: provider,
        modelName: service.getModelName(),
        summary,
        keywords,
        scientificRelevance: relevance,
        confidenceScore: this.calculateConfidenceScore(summary, keywords, relevance),
        tokensUsed: usageStats.tokensUsed,
        processingTimeMs: Date.now() - startTime,
        createdAt: new Date()
      };
    } catch (error) {
      console.error(`Analysis failed for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Prepare paper text for analysis
   */
  private preparePaperText(paper: Paper): string {
    const parts = [];
    
    if (paper.title) {
      parts.push(`Title: ${paper.title}`);
    }
    
    if (paper.authors && paper.authors.length > 0) {
      parts.push(`Authors: ${paper.authors.join(', ')}`);
    }
    
    if (paper.abstract) {
      parts.push(`Abstract: ${paper.abstract}`);
    }
    
    if (paper.content) {
      parts.push(`Content: ${paper.content}`);
    }
    
    return parts.join('\n\n');
  }

  /**
   * Calculate confidence score based on analysis results
   */
  private calculateConfidenceScore(summary: string, keywords: string[], relevance: any): number {
    let score = 0.5; // Base score
    
    // Adjust based on summary length and quality
    if (summary && summary.length > 100) {
      score += 0.2;
    }
    
    // Adjust based on keywords count
    if (keywords && keywords.length >= 5) {
      score += 0.2;
    }
    
    // Adjust based on relevance analysis
    if (relevance && typeof relevance === 'object' && !relevance.error) {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): AIProvider[] {
    return Array.from(this.services.keys());
  }

  /**
   * Add a new service
   */
  addService(provider: AIProvider, service: BaseAIService): void {
    this.services.set(provider, service);
  }

  /**
   * Remove a service
   */
  removeService(provider: AIProvider): void {
    this.services.delete(provider);
  }

  /**
   * Check if a provider is available
   */
  hasProvider(provider: AIProvider): boolean {
    return this.services.has(provider);
  }

  /**
   * Get service for a provider
   */
  getService(provider: AIProvider): BaseAIService | undefined {
    return this.services.get(provider);
  }
}