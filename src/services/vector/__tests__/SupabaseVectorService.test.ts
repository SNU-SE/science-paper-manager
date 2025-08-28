// Mock all external dependencies first
jest.mock('@langchain/openai')
jest.mock('@langchain/community/vectorstores/supabase')
jest.mock('@langchain/core/documents')
jest.mock('@/lib/database', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
    select: jest.fn().mockReturnThis(),
    not: jest.fn().mockResolvedValue({
      data: [{ metadata: { paper_id: 'paper-1' } }],
      error: null,
    }),
  },
  TABLES: {
    DOCUMENTS: 'documents',
  },
}))

import type { Paper, UserEvaluation, MultiModelAnalysis } from '@/types'

// Mock implementations
const mockOpenAIEmbeddings = {
  embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  embedDocuments: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
}

const mockSupabaseVectorStore = {
  addDocuments: jest.fn().mockResolvedValue(undefined),
  similaritySearchWithScore: jest.fn().mockResolvedValue([
    [
      {
        pageContent: 'Test paper content with relevant information',
        metadata: {
          paper_id: 'test-paper-1',
          title: 'Test Paper',
          authors: ['Author 1'],
          reading_status: 'unread',
          date_added: '2024-01-01T00:00:00.000Z',
        },
      },
      0.85,
    ],
  ]),
}

// Set up mocks
require('@langchain/openai').OpenAIEmbeddings = jest.fn(() => mockOpenAIEmbeddings)
require('@langchain/community/vectorstores/supabase').SupabaseVectorStore = jest.fn(() => mockSupabaseVectorStore)
require('@langchain/core/documents').Document = jest.fn()

// Now import the service
import { SupabaseVectorService } from '../SupabaseVectorService'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

describe('SupabaseVectorService', () => {
  let vectorService: SupabaseVectorService
  const mockOpenAIKey = 'test-openai-key'

  const mockPaper: Paper = {
    id: 'test-paper-1',
    title: 'Test Paper Title',
    authors: ['Author 1', 'Author 2'],
    journal: 'Test Journal',
    publicationYear: 2024,
    doi: '10.1000/test',
    abstract: 'This is a test abstract for the paper.',
    readingStatus: 'unread',
    dateAdded: new Date('2024-01-01'),
    lastModified: new Date('2024-01-01'),
  }

  const mockEvaluation: UserEvaluation = {
    id: 'eval-1',
    paperId: 'test-paper-1',
    rating: 4,
    notes: 'Interesting paper with good methodology',
    tags: ['machine-learning', 'nlp'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }

  const mockAnalyses: MultiModelAnalysis = {
    openai: {
      id: 'analysis-1',
      paperId: 'test-paper-1',
      modelProvider: 'openai',
      modelName: 'gpt-4',
      summary: 'This paper presents a novel approach to machine learning.',
      keywords: ['machine learning', 'neural networks'],
      confidenceScore: 0.9,
      tokensUsed: 1000,
      processingTimeMs: 2000,
      createdAt: new Date('2024-01-01'),
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    vectorService = new SupabaseVectorService(mockOpenAIKey)
  })

  describe('constructor', () => {
    it('should initialize with OpenAI API key', () => {
      expect(vectorService).toBeInstanceOf(SupabaseVectorService)
    })
  })

  describe('embedPaperWithContext', () => {
    it('should embed paper with full context', async () => {
      const context = {
        paper: mockPaper,
        evaluation: mockEvaluation,
        analyses: mockAnalyses,
      }

      await expect(vectorService.embedPaperWithContext(context)).resolves.not.toThrow()
    })

    it('should embed paper without evaluation and analyses', async () => {
      const context = {
        paper: mockPaper,
      }

      await expect(vectorService.embedPaperWithContext(context)).resolves.not.toThrow()
    })

    it('should handle embedding errors gracefully', async () => {
      const mockVectorStore = require('@langchain/community/vectorstores/supabase').SupabaseVectorStore
      mockVectorStore.mockImplementationOnce(() => ({
        addDocuments: jest.fn().mockRejectedValue(new Error('Embedding failed')),
      }))

      const service = new SupabaseVectorService(mockOpenAIKey)
      const context = { paper: mockPaper }

      await expect(service.embedPaperWithContext(context)).rejects.toThrow('Vector embedding failed')
    })
  })

  describe('semanticSearch', () => {
    it('should perform semantic search with default options', async () => {
      const query = 'machine learning neural networks'
      const results = await vectorService.semanticSearch(query)

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        id: 'test-paper-1',
        similarity: 0.85,
        paper: expect.objectContaining({
          id: 'test-paper-1',
          title: 'Test Paper',
        }),
        relevantExcerpts: expect.any(Array),
      })
    })

    it('should apply similarity threshold filter', async () => {
      const query = 'machine learning'
      const results = await vectorService.semanticSearch(query, {
        similarityThreshold: 0.9, // Higher than mock result (0.85)
      })

      expect(results).toHaveLength(0)
    })

    it('should handle search errors gracefully', async () => {
      const mockVectorStore = require('@langchain/community/vectorstores/supabase').SupabaseVectorStore
      mockVectorStore.mockImplementationOnce(() => ({
        similaritySearchWithScore: jest.fn().mockRejectedValue(new Error('Search failed')),
      }))

      const service = new SupabaseVectorService(mockOpenAIKey)
      const query = 'test query'

      await expect(service.semanticSearch(query)).rejects.toThrow('Semantic search failed')
    })
  })

  describe('ragQuery', () => {
    it('should perform RAG query and return structured response', async () => {
      const question = 'What are the main findings about machine learning?'
      const result = await vectorService.ragQuery(question)

      expect(result).toMatchObject({
        answer: expect.stringContaining('Test Paper'),
        sources: expect.arrayContaining([
          expect.objectContaining({
            id: 'test-paper-1',
            title: 'Test Paper',
          }),
        ]),
        confidence: expect.any(Number),
      })
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('should handle no relevant results', async () => {
      const mockVectorStore = require('@langchain/community/vectorstores/supabase').SupabaseVectorStore
      mockVectorStore.mockImplementationOnce(() => ({
        similaritySearchWithScore: jest.fn().mockResolvedValue([]),
      }))

      const service = new SupabaseVectorService(mockOpenAIKey)
      const question = 'What about quantum computing?'
      const result = await service.ragQuery(question)

      expect(result).toMatchObject({
        answer: expect.stringContaining("couldn't find relevant papers"),
        sources: [],
        confidence: 0,
      })
    })
  })

  describe('updatePaperEmbedding', () => {
    it('should update existing paper embedding', async () => {
      const context = { paper: mockPaper }
      
      await expect(vectorService.updatePaperEmbedding(context)).resolves.not.toThrow()
    })
  })

  describe('removePaperEmbedding', () => {
    it('should remove paper embedding', async () => {
      await expect(vectorService.removePaperEmbedding('test-paper-1')).resolves.not.toThrow()
    })
  })

  describe('getEmbeddingStats', () => {
    it('should return embedding statistics', async () => {
      const mockDatabase = require('@/lib/database')
      // Mock count query
      mockDatabase.supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ count: 5, error: null }),
      })

      const stats = await vectorService.getEmbeddingStats()

      expect(stats).toMatchObject({
        totalDocuments: 5,
        totalPapers: expect.any(Number),
        lastUpdated: expect.any(Date),
      })
    })
  })

  describe('private methods', () => {
    it('should build comprehensive paper content', () => {
      const context = {
        paper: mockPaper,
        evaluation: mockEvaluation,
        analyses: mockAnalyses,
      }

      // Access private method through any cast for testing
      const content = (vectorService as any).buildPaperContent(
        context.paper,
        context.evaluation,
        context.analyses
      )

      expect(content).toContain('Title: Test Paper Title')
      expect(content).toContain('Authors: Author 1, Author 2')
      expect(content).toContain('Abstract: This is a test abstract')
      expect(content).toContain('Personal Notes: Interesting paper')
      expect(content).toContain('OPENAI Summary: This paper presents')
    })

    it('should build paper metadata correctly', () => {
      const metadata = (vectorService as any).buildPaperMetadata(
        mockPaper,
        mockEvaluation,
        mockAnalyses
      )

      expect(metadata).toMatchObject({
        paper_id: 'test-paper-1',
        title: 'Test Paper Title',
        authors: ['Author 1', 'Author 2'],
        rating: 4,
        tags: ['machine-learning', 'nlp'],
        ai_providers: ['openai'],
        has_ai_analysis: true,
      })
    })

    it('should extract relevant excerpts from content', () => {
      const content = 'This is about machine learning. Neural networks are important. Deep learning is a subset.'
      const query = 'machine learning neural'
      
      const excerpts = (vectorService as any).extractRelevantExcerpts(content, query)
      
      expect(excerpts).toContain('This is about machine learning')
      expect(excerpts).toContain('Neural networks are important')
    })
  })
})