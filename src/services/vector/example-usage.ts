/**
 * Example usage of the SupabaseVectorService
 * This file demonstrates how to use the vector database service for semantic search and RAG
 */

import { VectorServiceFactory } from './VectorServiceFactory'
import type { Paper, UserEvaluation, MultiModelAnalysis } from '@/types'

// Example: Initialize the vector service
export async function initializeVectorService() {
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const vectorService = VectorServiceFactory.getInstance(openaiApiKey)
  console.log('Vector service initialized successfully')
  return vectorService
}

// Example: Embed a paper with full context
export async function embedPaperExample() {
  const vectorService = VectorServiceFactory.getInstance()

  const paper: Paper = {
    id: 'paper-123',
    title: 'Deep Learning for Natural Language Processing',
    authors: ['John Doe', 'Jane Smith'],
    journal: 'Journal of AI Research',
    publicationYear: 2024,
    abstract: 'This paper presents a comprehensive study of deep learning techniques applied to natural language processing tasks.',
    readingStatus: 'reading',
    dateAdded: new Date(),
    lastModified: new Date(),
  }

  const evaluation: UserEvaluation = {
    id: 'eval-123',
    paperId: 'paper-123',
    rating: 5,
    notes: 'Excellent paper with practical applications. The methodology is sound and results are impressive.',
    tags: ['deep-learning', 'nlp', 'transformers'],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const analyses: MultiModelAnalysis = {
    openai: {
      id: 'analysis-123',
      paperId: 'paper-123',
      modelProvider: 'openai',
      modelName: 'gpt-4',
      summary: 'This paper introduces novel deep learning architectures for NLP tasks, achieving state-of-the-art results on multiple benchmarks.',
      keywords: ['deep learning', 'natural language processing', 'transformers', 'attention mechanism'],
      confidenceScore: 0.95,
      tokensUsed: 2500,
      processingTimeMs: 3000,
      createdAt: new Date(),
    },
  }

  try {
    await vectorService.embedPaperWithContext({
      paper,
      evaluation,
      analyses,
    })
    console.log('Paper embedded successfully')
  } catch (error) {
    console.error('Failed to embed paper:', error)
  }
}

// Example: Perform semantic search
export async function semanticSearchExample() {
  const vectorService = VectorServiceFactory.getInstance()

  try {
    const searchResults = await vectorService.semanticSearch(
      'deep learning natural language processing transformers',
      {
        matchCount: 5,
        similarityThreshold: 0.7,
        filter: {
          reading_status: 'completed',
        },
      }
    )

    console.log(`Found ${searchResults.length} relevant papers:`)
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.paper.title} (similarity: ${result.similarity.toFixed(3)})`)
      console.log(`   Excerpts: ${result.relevantExcerpts.slice(0, 2).join(' | ')}`)
    })
  } catch (error) {
    console.error('Search failed:', error)
  }
}

// Example: RAG-based question answering
export async function ragQueryExample() {
  const vectorService = VectorServiceFactory.getInstance()

  try {
    const response = await vectorService.ragQuery(
      'What are the latest advances in transformer architectures for NLP?',
      {
        publication_year: { $gte: 2023 }, // Filter for recent papers
      }
    )

    console.log('RAG Response:')
    console.log(`Answer: ${response.answer}`)
    console.log(`Confidence: ${response.confidence.toFixed(3)}`)
    console.log(`Sources: ${response.sources.map(p => p.title).join(', ')}`)
  } catch (error) {
    console.error('RAG query failed:', error)
  }
}

// Example: Update paper embedding when evaluation changes
export async function updatePaperEmbeddingExample() {
  const vectorService = VectorServiceFactory.getInstance()

  const updatedPaper: Paper = {
    id: 'paper-123',
    title: 'Deep Learning for Natural Language Processing',
    authors: ['John Doe', 'Jane Smith'],
    journal: 'Journal of AI Research',
    publicationYear: 2024,
    abstract: 'This paper presents a comprehensive study of deep learning techniques applied to natural language processing tasks.',
    readingStatus: 'completed', // Status changed
    dateAdded: new Date('2024-01-01'),
    lastModified: new Date(),
  }

  const updatedEvaluation: UserEvaluation = {
    id: 'eval-123',
    paperId: 'paper-123',
    rating: 4, // Rating changed
    notes: 'Good paper but some limitations in the experimental setup. Still valuable for understanding current trends.',
    tags: ['deep-learning', 'nlp', 'transformers', 'limitations'], // Tags updated
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  }

  try {
    await vectorService.updatePaperEmbedding({
      paper: updatedPaper,
      evaluation: updatedEvaluation,
    })
    console.log('Paper embedding updated successfully')
  } catch (error) {
    console.error('Failed to update paper embedding:', error)
  }
}

// Example: Get embedding statistics
export async function getEmbeddingStatsExample() {
  const vectorService = VectorServiceFactory.getInstance()

  try {
    const stats = await vectorService.getEmbeddingStats()
    console.log('Embedding Statistics:')
    console.log(`Total documents: ${stats.totalDocuments}`)
    console.log(`Total papers: ${stats.totalPapers}`)
    console.log(`Last updated: ${stats.lastUpdated?.toISOString()}`)
  } catch (error) {
    console.error('Failed to get stats:', error)
  }
}

// Example: Complete workflow
export async function completeWorkflowExample() {
  console.log('Starting complete vector service workflow...')

  try {
    // 1. Initialize service
    await initializeVectorService()

    // 2. Embed a paper
    await embedPaperExample()

    // 3. Perform semantic search
    await semanticSearchExample()

    // 4. Ask RAG question
    await ragQueryExample()

    // 5. Update paper embedding
    await updatePaperEmbeddingExample()

    // 6. Get statistics
    await getEmbeddingStatsExample()

    console.log('Workflow completed successfully!')
  } catch (error) {
    console.error('Workflow failed:', error)
  }
}

// Example: Batch embedding multiple papers
export async function batchEmbeddingExample(papers: Paper[]) {
  const vectorService = VectorServiceFactory.getInstance()

  console.log(`Starting batch embedding of ${papers.length} papers...`)

  const results = await Promise.allSettled(
    papers.map(async (paper) => {
      try {
        await vectorService.embedPaperWithContext({ paper })
        return { success: true, paperId: paper.id }
      } catch (error) {
        return { 
          success: false, 
          paperId: paper.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }
    })
  )

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failed = results.length - successful

  console.log(`Batch embedding completed: ${successful} successful, ${failed} failed`)

  // Log failed embeddings
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && !result.value.success) {
      console.error(`Failed to embed paper ${result.value.paperId}: ${result.value.error}`)
    }
  })
}

// Export all examples for easy testing
export const examples = {
  initializeVectorService,
  embedPaperExample,
  semanticSearchExample,
  ragQueryExample,
  updatePaperEmbeddingExample,
  getEmbeddingStatsExample,
  completeWorkflowExample,
  batchEmbeddingExample,
}