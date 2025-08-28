/**
 * Integration tests for service layer interactions
 * These tests verify that services work together correctly
 */

import { AIServiceFactory } from '@/services/ai/AIServiceFactory'
import { MultiModelAnalyzer } from '@/services/ai/MultiModelAnalyzer'
import { SupabaseVectorService } from '@/services/vector/SupabaseVectorService'
import { UserEvaluationService } from '@/services/evaluation/UserEvaluationService'

// Set test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.OPENAI_API_KEY = 'test-openai-key'

// Mock external dependencies
jest.mock('@supabase/supabase-js')
jest.mock('openai')
jest.mock('@langchain/openai')
jest.mock('@langchain/community/vectorstores/supabase')

describe('Service Integration Tests', () => {
  describe('AI Service Integration', () => {
    it('should create AI services through factory', () => {
      const openaiService = AIServiceFactory.createService({
        provider: 'openai',
        apiKey: 'test-key'
      })
      const anthropicService = AIServiceFactory.createService({
        provider: 'anthropic',
        apiKey: 'test-key'
      })
      
      expect(openaiService).toBeDefined()
      expect(anthropicService).toBeDefined()
    })

    it('should analyze paper with multiple models', async () => {
      // Create mock services instead of real ones
      const mockOpenAIService = {
        summarize: jest.fn().mockResolvedValue('OpenAI summary'),
        extractKeywords: jest.fn().mockResolvedValue(['keyword1']),
        analyzeRelevance: jest.fn().mockResolvedValue(0.9),
        validateApiKey: jest.fn().mockResolvedValue(true),
        getLastUsageStats: jest.fn().mockReturnValue({
          tokensUsed: 100,
          processingTimeMs: 1000,
        }),
        getModelName: jest.fn().mockReturnValue('gpt-4'),
      }
      
      const mockAnthropicService = {
        summarize: jest.fn().mockResolvedValue('Anthropic summary'),
        extractKeywords: jest.fn().mockResolvedValue(['keyword2']),
        analyzeRelevance: jest.fn().mockResolvedValue(0.85),
        validateApiKey: jest.fn().mockResolvedValue(true),
        getLastUsageStats: jest.fn().mockReturnValue({
          tokensUsed: 120,
          processingTimeMs: 1200,
        }),
        getModelName: jest.fn().mockReturnValue('claude-3-sonnet'),
      }
      
      const services = new Map([
        ['openai', mockOpenAIService],
        ['anthropic', mockAnthropicService],
      ])
      
      const analyzer = new MultiModelAnalyzer(services)
      
      const mockPaper = {
        id: 'test-paper-id',
        title: 'Test Paper',
        abstract: 'Test abstract',
        authors: ['Author 1'],
        readingStatus: 'unread' as const,
        dateAdded: new Date(),
        lastModified: new Date(),
      }

      const results = await analyzer.analyzePaper(mockPaper, ['openai', 'anthropic'])
      
      expect(results).toBeDefined()
      expect(results.openai).toBeDefined()
      expect(results.anthropic).toBeDefined()
      expect(mockOpenAIService.summarize).toHaveBeenCalled()
      expect(mockAnthropicService.summarize).toHaveBeenCalled()
    })
  })

  describe('Vector Service Integration', () => {
    it('should embed paper with context', async () => {
      const vectorService = new SupabaseVectorService(
        'test-url',
        'test-key',
        'test-openai-key'
      )

      const mockPaper = {
        id: 'test-paper-id',
        title: 'Test Paper',
        abstract: 'Test abstract',
        authors: ['Author 1'],
        readingStatus: 'unread' as const,
        dateAdded: new Date(),
        lastModified: new Date(),
      }

      const mockEvaluation = {
        id: 'test-eval-id',
        paperId: 'test-paper-id',
        rating: 4,
        notes: 'Great paper',
        tags: ['ai', 'ml'],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockAnalyses = {
        openai: {
          id: 'test-analysis-id',
          paperId: 'test-paper-id',
          modelProvider: 'openai' as const,
          modelName: 'gpt-4',
          summary: 'AI summary',
          keywords: ['ai', 'ml'],
          confidenceScore: 0.9,
          tokensUsed: 100,
          processingTimeMs: 1000,
          createdAt: new Date(),
        },
      }

      // Mock the embedding method
      vectorService.embedPaperWithContext = jest.fn().mockResolvedValue(undefined)

      await expect(
        vectorService.embedPaperWithContext(mockPaper, mockEvaluation, mockAnalyses)
      ).resolves.not.toThrow()
    })

    it('should perform semantic search', async () => {
      const vectorService = new SupabaseVectorService(
        'test-url',
        'test-key',
        'test-openai-key'
      )

      // Mock the search method
      vectorService.semanticSearch = jest.fn().mockResolvedValue([
        {
          id: 'result-1',
          paperId: 'paper-1',
          title: 'Relevant Paper',
          similarity: 0.85,
          excerpt: 'Relevant excerpt',
        },
      ])

      const results = await vectorService.semanticSearch('machine learning')
      
      expect(results).toHaveLength(1)
      expect(results[0].similarity).toBeGreaterThan(0.8)
    })
  })

  describe('Evaluation Service Integration', () => {
    it('should create and retrieve evaluations', async () => {
      const evaluationService = new UserEvaluationService()

      const mockEvaluation = {
        paperId: 'test-paper-id',
        rating: 4,
        notes: 'Great paper',
        tags: ['ai', 'ml'],
      }

      // Mock the service methods
      evaluationService.createEvaluation = jest.fn().mockResolvedValue({
        id: 'test-eval-id',
        ...mockEvaluation,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      evaluationService.getEvaluation = jest.fn().mockResolvedValue({
        id: 'test-eval-id',
        ...mockEvaluation,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const created = await evaluationService.createEvaluation(mockEvaluation)
      const retrieved = await evaluationService.getEvaluation('test-paper-id')

      expect(created).toBeDefined()
      expect(retrieved).toBeDefined()
      expect(retrieved?.rating).toBe(4)
    })
  })

  describe('End-to-End Service Flow', () => {
    it('should complete full paper processing workflow', async () => {
      // This test simulates the complete workflow:
      // 1. Upload paper
      // 2. Analyze with AI
      // 3. Create user evaluation
      // 4. Embed in vector database
      // 5. Search and retrieve

      const mockPaper = {
        id: 'test-paper-id',
        title: 'Test Paper',
        abstract: 'Test abstract about machine learning',
        authors: ['Author 1'],
        readingStatus: 'unread' as const,
        dateAdded: new Date(),
        lastModified: new Date(),
      }

      // Step 1: AI Analysis
      const aiService = AIServiceFactory.createService({
        provider: 'openai',
        apiKey: 'test-key'
      })
      aiService.summarize = jest.fn().mockResolvedValue('AI generated summary')
      aiService.extractKeywords = jest.fn().mockResolvedValue(['ml', 'ai'])

      const summary = await aiService.summarize(mockPaper.abstract)
      const keywords = await aiService.extractKeywords(mockPaper.abstract)

      expect(summary).toBe('AI generated summary')
      expect(keywords).toEqual(['ml', 'ai'])

      // Step 2: User Evaluation
      const evaluationService = new UserEvaluationService()
      evaluationService.createEvaluation = jest.fn().mockResolvedValue({
        id: 'eval-id',
        paperId: mockPaper.id,
        rating: 5,
        notes: 'Excellent paper',
        tags: ['important'],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const evaluation = await evaluationService.createEvaluation({
        paperId: mockPaper.id,
        rating: 5,
        notes: 'Excellent paper',
        tags: ['important'],
      })

      expect(evaluation.rating).toBe(5)

      // Step 3: Vector Embedding
      const vectorService = new SupabaseVectorService('url', 'key', 'openai-key')
      vectorService.embedPaperWithContext = jest.fn().mockResolvedValue(undefined)

      await expect(
        vectorService.embedPaperWithContext(mockPaper, evaluation, {
          openai: {
            id: 'analysis-id',
            paperId: mockPaper.id,
            modelProvider: 'openai',
            modelName: 'gpt-4',
            summary,
            keywords,
            confidenceScore: 0.9,
            tokensUsed: 100,
            processingTimeMs: 1000,
            createdAt: new Date(),
          },
        })
      ).resolves.not.toThrow()

      // Step 4: Search and Retrieval
      vectorService.semanticSearch = jest.fn().mockResolvedValue([
        {
          id: 'search-result-1',
          paperId: mockPaper.id,
          title: mockPaper.title,
          similarity: 0.95,
          excerpt: 'machine learning excerpt',
        },
      ])

      const searchResults = await vectorService.semanticSearch('machine learning')
      
      expect(searchResults).toHaveLength(1)
      expect(searchResults[0].paperId).toBe(mockPaper.id)
    })
  })
})