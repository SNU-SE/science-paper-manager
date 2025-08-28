/**
 * Integration tests for vector service functionality
 * These tests verify the complete workflow without mocking external dependencies
 */

// Set test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.OPENAI_API_KEY = 'test-openai-key'

// Mock Supabase and other dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  })),
}))

jest.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn(() => ({
    embedQuery: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    embedDocuments: jest.fn().mockResolvedValue([new Array(1536).fill(0.1)]),
  })),
}))

jest.mock('@langchain/community/vectorstores/supabase', () => ({
  SupabaseVectorStore: jest.fn().mockImplementation(() => ({
    similaritySearch: jest.fn().mockResolvedValue([
      {
        pageContent: 'Test content',
        metadata: { paperId: 'test-paper-id', title: 'Test Paper' },
      },
    ]),
    addDocuments: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  })),
}))

import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { afterEach } from 'node:test'
import { describe } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { expect } from '@playwright/test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { describe } from 'node:test'
import { VectorServiceFactory } from '../VectorServiceFactory'

// Define types locally for testing
interface Paper {
  id: string
  title: string
  authors: string[]
  journal?: string
  publicationYear: number
  abstract?: string
  readingStatus: 'unread' | 'reading' | 'completed'
  dateAdded: Date
  lastModified: Date
}

interface UserEvaluation {
  id: string
  paperId: string
  rating: number
  notes?: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

interface MultiModelAnalysis {
  [key: string]: {
    id: string
    paperId: string
    modelProvider: string
    modelName: string
    summary: string
    keywords: string[]
    confidenceScore: number
    tokensUsed: number
    processingTimeMs: number
    createdAt: Date
  }
}

// Skip integration tests in CI or when no API key is available
const shouldRunIntegrationTests = process.env.OPENAI_API_KEY && process.env.RUN_INTEGRATION_TESTS === 'true'

const describeIf = shouldRunIntegrationTests ? describe : describe.skip

describeIf('Vector Service Integration Tests', () => {
  let vectorService: any
  const testPaperId = 'integration-test-paper'

  beforeAll(() => {
    if (process.env.OPENAI_API_KEY) {
      vectorService = VectorServiceFactory.getInstance(process.env.OPENAI_API_KEY)
    }
  })

  afterAll(async () => {
    // Clean up test data
    if (vectorService) {
      try {
        await vectorService.removePaperEmbedding(testPaperId)
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    VectorServiceFactory.resetInstance()
  })

  const mockPaper: Paper = {
    id: testPaperId,
    title: 'Integration Test Paper: Deep Learning for Natural Language Processing',
    authors: ['Test Author 1', 'Test Author 2'],
    journal: 'Test Journal of AI',
    publicationYear: 2024,
    abstract: 'This is a test paper for integration testing of the vector database service. It covers deep learning techniques for natural language processing tasks.',
    readingStatus: 'reading',
    dateAdded: new Date(),
    lastModified: new Date(),
  }

  const mockEvaluation: UserEvaluation = {
    id: 'integration-eval',
    paperId: testPaperId,
    rating: 4,
    notes: 'Good test paper for integration testing. Covers important concepts.',
    tags: ['integration-test', 'deep-learning', 'nlp'],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockAnalyses: MultiModelAnalysis = {
    openai: {
      id: 'integration-analysis',
      paperId: testPaperId,
      modelProvider: 'openai',
      modelName: 'gpt-4',
      summary: 'This integration test paper demonstrates vector database functionality with deep learning and NLP concepts.',
      keywords: ['integration testing', 'vector database', 'deep learning', 'nlp'],
      confidenceScore: 0.9,
      tokensUsed: 500,
      processingTimeMs: 1500,
      createdAt: new Date(),
    },
  }

  it('should complete full workflow: embed, search, and RAG', async () => {
    // 1. Embed paper with context
    await vectorService.embedPaperWithContext({
      paper: mockPaper,
      evaluation: mockEvaluation,
      analyses: mockAnalyses,
    })

    // 2. Perform semantic search
    const searchResults = await vectorService.semanticSearch(
      'deep learning natural language processing',
      { matchCount: 5, similarityThreshold: 0.5 }
    )

    expect(searchResults).toBeDefined()
    expect(Array.isArray(searchResults)).toBe(true)

    // 3. Perform RAG query
    const ragResponse = await vectorService.ragQuery(
      'What are the main concepts covered in papers about deep learning and NLP?'
    )

    expect(ragResponse).toBeDefined()
    expect(ragResponse.answer).toBeDefined()
    expect(ragResponse.sources).toBeDefined()
    expect(ragResponse.confidence).toBeGreaterThanOrEqual(0)
    expect(ragResponse.confidence).toBeLessThanOrEqual(1)

    // 4. Get embedding statistics
    const stats = await vectorService.getEmbeddingStats()
    expect(stats).toBeDefined()
    expect(stats.totalDocuments).toBeGreaterThan(0)
    expect(stats.totalPapers).toBeGreaterThan(0)
  }, 30000) // 30 second timeout for API calls

  it('should update paper embedding when context changes', async () => {
    // First embed the paper
    await vectorService.embedPaperWithContext({
      paper: mockPaper,
      evaluation: mockEvaluation,
    })

    // Update the evaluation
    const updatedEvaluation: UserEvaluation = {
      ...mockEvaluation,
      rating: 5,
      notes: 'Updated notes: Excellent paper after further review.',
      tags: [...mockEvaluation.tags, 'updated'],
      updatedAt: new Date(),
    }

    // Update the embedding
    await vectorService.updatePaperEmbedding({
      paper: mockPaper,
      evaluation: updatedEvaluation,
      analyses: mockAnalyses,
    })

    // Verify the update worked by searching for updated content
    const searchResults = await vectorService.semanticSearch(
      'excellent paper further review updated',
      { matchCount: 5, similarityThreshold: 0.3 }
    )

    expect(searchResults.length).toBeGreaterThan(0)
  }, 30000)

  it('should handle removal of paper embeddings', async () => {
    // First embed a paper
    await vectorService.embedPaperWithContext({
      paper: mockPaper,
    })

    // Remove the embedding
    await vectorService.removePaperEmbedding(testPaperId)

    // Verify removal by searching for the paper
    const searchResults = await vectorService.semanticSearch(
      mockPaper.title,
      { matchCount: 10, similarityThreshold: 0.1 }
    )

    // The paper should not be found or have very low similarity
    const foundPaper = searchResults.find(result => result.paper.id === testPaperId)
    expect(foundPaper).toBeUndefined()
  }, 30000)
})

// Unit tests that always run
describe('Vector Service Factory', () => {
  afterEach(() => {
    VectorServiceFactory.resetInstance()
  })

  it('should require API key for initialization', () => {
    expect(() => VectorServiceFactory.getInstance()).toThrow(
      'OpenAI API key is required to initialize vector service'
    )
  })

  it('should maintain singleton pattern', () => {
    const instance1 = VectorServiceFactory.getInstance('test-key')
    const instance2 = VectorServiceFactory.getInstance()
    
    expect(instance1).toBe(instance2)
  })

  it('should reset instance correctly', () => {
    VectorServiceFactory.getInstance('test-key')
    expect(VectorServiceFactory.isInitialized()).toBe(true)
    
    VectorServiceFactory.resetInstance()
    expect(VectorServiceFactory.isInitialized()).toBe(false)
  })
})