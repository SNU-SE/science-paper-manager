import { MultiModelAnalyzer } from '../MultiModelAnalyzer';
import { BaseAIService } from '../BaseAIService';
import { AIProvider } from '../AIServiceFactory';

// Mock AI service for testing
class MockAIService extends BaseAIService {
  constructor(provider: string) {
    super('mock-key', 'mock-model');
    this.provider = provider;
  }

  private provider: string;

  async summarize(text: string): Promise<string> {
    return `Mock summary from ${this.provider}`;
  }

  async extractKeywords(text: string): Promise<string[]> {
    return [`keyword1-${this.provider}`, `keyword2-${this.provider}`];
  }

  async analyzeRelevance(text: string): Promise<any> {
    return {
      novelty: 8,
      methodology: 7,
      impact: 9,
      clarity: 8
    };
  }

  async validateApiKey(key: string): Promise<boolean> {
    return true;
  }

  getProvider(): string {
    return this.provider;
  }

  getLastUsageStats() {
    return {
      tokensUsed: 100,
      processingTimeMs: 1000,
      cost: 0.01
    };
  }
}

describe('MultiModelAnalyzer', () => {
  let analyzer: MultiModelAnalyzer;
  let mockServices: Map<AIProvider, BaseAIService>;

  beforeEach(() => {
    mockServices = new Map([
      ['openai', new MockAIService('openai')],
      ['anthropic', new MockAIService('anthropic')]
    ]);
    analyzer = new MultiModelAnalyzer(mockServices);
  });

  const mockPaper = {
    id: 'test-paper-1',
    title: 'Test Paper Title',
    authors: ['Author 1', 'Author 2'],
    abstract: 'This is a test abstract for the paper.',
    content: 'This is the full content of the test paper.'
  };

  describe('analyzePaper', () => {
    it('should analyze paper with all available models', async () => {
      const result = await analyzer.analyzePaper(mockPaper);

      expect(result.paperId).toBe(mockPaper.id);
      expect(result.openai).toBeDefined();
      expect(result.anthropic).toBeDefined();
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should analyze paper with selected providers only', async () => {
      const result = await analyzer.analyzePaper(mockPaper, ['openai']);

      expect(result.paperId).toBe(mockPaper.id);
      expect(result.openai).toBeDefined();
      expect(result.anthropic).toBeUndefined();
    });

    it('should handle analysis failures gracefully', async () => {
      // Create a service that throws an error
      const failingService = new MockAIService('failing');
      failingService.summarize = jest.fn().mockRejectedValue(new Error('API Error'));
      
      mockServices.set('openai', failingService);
      analyzer = new MultiModelAnalyzer(mockServices);

      const result = await analyzer.analyzePaper(mockPaper);

      expect(result.paperId).toBe(mockPaper.id);
      expect(result.openai).toBeUndefined(); // Should be undefined due to failure
      expect(result.anthropic).toBeDefined(); // Should still work
    });
  });

  describe('service management', () => {
    it('should get available providers', () => {
      const providers = analyzer.getAvailableProviders();
      expect(providers).toEqual(['openai', 'anthropic']);
    });

    it('should add new service', () => {
      const newService = new MockAIService('xai');
      analyzer.addService('xai', newService);

      expect(analyzer.hasProvider('xai')).toBe(true);
      expect(analyzer.getAvailableProviders()).toContain('xai');
    });

    it('should remove service', () => {
      analyzer.removeService('openai');

      expect(analyzer.hasProvider('openai')).toBe(false);
      expect(analyzer.getAvailableProviders()).not.toContain('openai');
    });

    it('should check if provider exists', () => {
      expect(analyzer.hasProvider('openai')).toBe(true);
      expect(analyzer.hasProvider('nonexistent' as AIProvider)).toBe(false);
    });

    it('should get service by provider', () => {
      const service = analyzer.getService('openai');
      expect(service).toBeDefined();
      expect(service?.getProvider()).toBe('openai');
    });
  });

  describe('error handling', () => {
    it('should handle unavailable provider gracefully', async () => {
      analyzer.removeService('openai');
      
      const result = await analyzer.analyzePaper(mockPaper, ['openai']);
      
      expect(result.paperId).toBe(mockPaper.id);
      expect(result.openai).toBeUndefined(); // Should be undefined due to service not available
    });
  });
});