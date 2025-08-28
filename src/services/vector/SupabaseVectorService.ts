import { OpenAIEmbeddings } from '@langchain/openai'
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase'
import { Document } from '@langchain/core/documents'
import { getSupabaseAdminClient, TABLES, type MatchDocumentsResult } from '@/lib/database'
import type { Paper, UserEvaluation, AIAnalysisResult, MultiModelAnalysis, SearchResult, RAGResponse } from '@/types'

export interface VectorSearchOptions {
  matchCount?: number
  filter?: Record<string, unknown>
  similarityThreshold?: number
}

export interface PaperContext {
  paper: Paper
  evaluation?: UserEvaluation
  analyses?: MultiModelAnalysis
}

/**
 * SupabaseVectorService provides vector database operations using LangChain and OpenAI embeddings
 * Implements semantic search and RAG functionality for the Science Paper Manager
 */
export class SupabaseVectorService {
  private vectorStore: SupabaseVectorStore
  private embeddings: OpenAIEmbeddings

  constructor(openaiApiKey: string) {
    // Initialize OpenAI embeddings with text-embedding-3-small model
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: openaiApiKey,
      modelName: 'text-embedding-3-small',
      dimensions: 1536, // Default dimensions for text-embedding-3-small
    })

    // Initialize Supabase vector store with LangChain integration
    // Use try-catch to handle build-time issues gracefully
    try {
      this.vectorStore = new SupabaseVectorStore(this.embeddings, {
        client: getSupabaseAdminClient(),
        tableName: TABLES.DOCUMENTS,
        queryName: 'match_documents',
      })
    } catch (error) {
      // During build time, environment variables might not be available
      // Create a mock vector store that will throw meaningful errors at runtime
      console.warn('Failed to initialize SupabaseVectorStore during build:', error)
      this.vectorStore = null as any
    }
  }

  /**
   * Embed a paper with its full context including metadata, evaluations, and AI analyses
   */
  async embedPaperWithContext(context: PaperContext): Promise<void> {
    const { paper, evaluation, analyses } = context

    try {
      // Build comprehensive content for embedding
      const content = this.buildPaperContent(paper, evaluation, analyses)
      
      // Build metadata for filtering and retrieval
      const metadata = this.buildPaperMetadata(paper, evaluation, analyses)

      // Create document for vector storage
      const document = new Document({
        pageContent: content,
        metadata,
      })

      // Store in vector database
      await this.vectorStore.addDocuments([document])

      console.log(`Successfully embedded paper: ${paper.title}`)
    } catch (error) {
      console.error(`Failed to embed paper ${paper.id}:`, error)
      throw new Error(`Vector embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Perform semantic search across embedded papers
   */
  async semanticSearch(
    query: string, 
    options: VectorSearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      matchCount = 10,
      filter = {},
      similarityThreshold = 0.7
    } = options

    try {
      // Perform similarity search
      const results = await this.vectorStore.similaritySearchWithScore(
        query,
        matchCount,
        filter
      )

      // Transform results to SearchResult format
      const searchResults: SearchResult[] = results
        .filter(([, score]) => score >= similarityThreshold)
        .map(([document, similarity]) => {
          const paper = this.extractPaperFromMetadata(document.metadata)
          const relevantExcerpts = this.extractRelevantExcerpts(document.pageContent, query)

          return {
            id: paper.id,
            paper,
            similarity,
            relevantExcerpts,
          }
        })

      return searchResults
    } catch (error) {
      console.error('Semantic search failed:', error)
      throw new Error(`Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Perform RAG-based question answering
   */
  async ragQuery(question: string, context?: Record<string, unknown>): Promise<RAGResponse> {
    try {
      // First, find relevant documents
      const searchResults = await this.semanticSearch(question, {
        matchCount: 5,
        filter: context,
        similarityThreshold: 0.6
      })

      if (searchResults.length === 0) {
        return {
          answer: "I couldn't find relevant papers in your collection to answer this question.",
          sources: [],
          confidence: 0
        }
      }

      // Extract source papers
      const sources = searchResults.map(result => result.paper)
      
      // Build context from search results
      const contextText = this.buildRAGContext(searchResults)

      // Generate answer using AI service
      const answer = await this.generateRAGAnswerWithAI(question, contextText, searchResults)
      const confidence = this.calculateConfidence(searchResults)

      return {
        answer,
        sources,
        confidence
      }
    } catch (error) {
      console.error('RAG query failed:', error)
      throw new Error(`RAG query failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update an existing paper's vector embedding
   */
  async updatePaperEmbedding(context: PaperContext): Promise<void> {
    try {
      // Remove existing embedding
      await this.removePaperEmbedding(context.paper.id)
      
      // Add updated embedding
      await this.embedPaperWithContext(context)
    } catch (error) {
      console.error(`Failed to update embedding for paper ${context.paper.id}:`, error)
      throw error
    }
  }

  /**
   * Remove a paper's vector embedding
   */
  async removePaperEmbedding(paperId: string): Promise<void> {
    try {
      const supabaseAdmin = getSupabaseAdminClient()
      // Delete documents with matching paper_id in metadata
      const { error } = await supabaseAdmin
        .from(TABLES.DOCUMENTS)
        .delete()
        .eq('metadata->>paper_id', paperId)

      if (error) {
        throw error
      }

      console.log(`Successfully removed embedding for paper: ${paperId}`)
    } catch (error) {
      console.error(`Failed to remove embedding for paper ${paperId}:`, error)
      throw new Error(`Failed to remove embedding: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(): Promise<{
    totalDocuments: number
    totalPapers: number
    lastUpdated?: Date
  }> {
    try {
      const supabaseAdmin = getSupabaseAdminClient()
      const { count, error } = await supabaseAdmin
        .from(TABLES.DOCUMENTS)
        .select('*', { count: 'exact', head: true })

      if (error) {
        throw error
      }

      // Get unique paper count
      const { data: uniquePapers, error: paperError } = await supabaseAdmin
        .from(TABLES.DOCUMENTS)
        .select('metadata')
        .not('metadata->>paper_id', 'is', null)

      if (paperError) {
        throw paperError
      }

      const uniquePaperIds = new Set(
        uniquePapers?.map(doc => doc.metadata?.paper_id).filter(Boolean) || []
      )

      return {
        totalDocuments: count || 0,
        totalPapers: uniquePaperIds.size,
        lastUpdated: new Date()
      }
    } catch (error) {
      console.error('Failed to get embedding stats:', error)
      throw error
    }
  }

  /**
   * Build comprehensive content for paper embedding
   */
  private buildPaperContent(
    paper: Paper, 
    evaluation?: UserEvaluation, 
    analyses?: MultiModelAnalysis
  ): string {
    const parts: string[] = []

    // Core paper information
    parts.push(`Title: ${paper.title}`)
    
    if (paper.authors?.length) {
      parts.push(`Authors: ${paper.authors.join(', ')}`)
    }
    
    if (paper.abstract) {
      parts.push(`Abstract: ${paper.abstract}`)
    }
    
    if (paper.journal) {
      parts.push(`Journal: ${paper.journal}`)
    }

    // User evaluation content
    if (evaluation) {
      if (evaluation.notes) {
        parts.push(`Personal Notes: ${evaluation.notes}`)
      }
      
      if (evaluation.tags?.length) {
        parts.push(`Tags: ${evaluation.tags.join(', ')}`)
      }
    }

    // AI analysis summaries
    if (analyses) {
      Object.entries(analyses).forEach(([provider, analysis]) => {
        if (analysis) {
          parts.push(`${provider.toUpperCase()} Summary: ${analysis.summary}`)
          
          if (analysis.keywords?.length) {
            parts.push(`${provider.toUpperCase()} Keywords: ${analysis.keywords.join(', ')}`)
          }
        }
      })
    }

    return parts.join('\n\n')
  }

  /**
   * Build metadata for paper filtering and retrieval
   */
  private buildPaperMetadata(
    paper: Paper, 
    evaluation?: UserEvaluation, 
    analyses?: MultiModelAnalysis
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      paper_id: paper.id,
      title: paper.title,
      authors: paper.authors || [],
      journal: paper.journal,
      publication_year: paper.publicationYear,
      reading_status: paper.readingStatus,
      date_added: paper.dateAdded.toISOString(),
      doi: paper.doi,
    }

    // Add evaluation metadata
    if (evaluation) {
      metadata.rating = evaluation.rating
      metadata.tags = evaluation.tags || []
      metadata.has_notes = !!evaluation.notes
    }

    // Add AI analysis metadata
    if (analyses) {
      metadata.ai_providers = Object.keys(analyses).filter(key => analyses[key as keyof MultiModelAnalysis])
      metadata.has_ai_analysis = metadata.ai_providers.length > 0
    }

    return metadata
  }

  /**
   * Extract paper information from document metadata
   */
  private extractPaperFromMetadata(metadata: Record<string, unknown>): Paper {
    return {
      id: metadata.paper_id,
      title: metadata.title,
      authors: metadata.authors || [],
      journal: metadata.journal,
      publicationYear: metadata.publication_year,
      doi: metadata.doi,
      abstract: '', // Not stored in metadata to save space
      readingStatus: metadata.reading_status || 'unread',
      dateAdded: new Date(metadata.date_added),
      lastModified: new Date(metadata.date_added), // Fallback
    } as Paper
  }

  /**
   * Extract relevant excerpts from content based on query
   */
  private extractRelevantExcerpts(content: string, query: string, maxExcerpts: number = 3): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20)
    const queryWords = query.toLowerCase().split(/\s+/)
    
    // Score sentences based on query word matches
    const scoredSentences = sentences.map(sentence => {
      const lowerSentence = sentence.toLowerCase()
      const score = queryWords.reduce((acc, word) => {
        return acc + (lowerSentence.includes(word) ? 1 : 0)
      }, 0)
      return { sentence: sentence.trim(), score }
    })

    // Return top scoring sentences
    return scoredSentences
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxExcerpts)
      .map(item => item.sentence)
  }

  /**
   * Build comprehensive context for RAG from search results
   */
  private buildRAGContext(searchResults: SearchResult[]): string {
    return searchResults
      .map((result, index) => {
        const paper = result.paper
        const excerpts = result.relevantExcerpts.slice(0, 2) // Limit excerpts to avoid token overflow
        
        return `[Source ${index + 1}] "${paper.title}" (${paper.publicationYear || 'Unknown year'})
Authors: ${paper.authors?.join(', ') || 'Unknown'}
Journal: ${paper.journal || 'Unknown'}
Relevant content: ${excerpts.join(' ')}
Similarity score: ${(result.similarity * 100).toFixed(1)}%`
      })
      .join('\n\n')
  }

  /**
   * Generate RAG answer using AI service
   */
  private async generateRAGAnswerWithAI(
    question: string,
    context: string,
    searchResults: SearchResult[]
  ): Promise<string> {
    try {
      // Use OpenAI to generate contextual answer
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.embeddings.openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a research assistant helping analyze a personal collection of scientific papers. 
              
Your task is to answer questions based ONLY on the provided context from the user's paper collection. 

Guidelines:
- Provide accurate, helpful answers based on the context
- Cite specific papers when referencing information
- If the context doesn't contain enough information, say so clearly
- Be concise but comprehensive
- Use academic tone appropriate for research
- Always mention which papers your answer is based on`
            },
            {
              role: 'user',
              content: `Question: ${question}

Context from paper collection:
${context}

Please provide a comprehensive answer based on this context.`
            }
          ],
          max_tokens: 800,
          temperature: 0.3
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0]?.message?.content || this.generateFallbackAnswer(question, searchResults)
    } catch (error) {
      console.error('AI answer generation failed:', error)
      return this.generateFallbackAnswer(question, searchResults)
    }
  }

  /**
   * Generate fallback answer when AI service fails
   */
  private generateFallbackAnswer(question: string, searchResults: SearchResult[]): string {
    const topResult = searchResults[0]
    const paperCount = searchResults.length
    
    return `Based on your paper collection, I found ${paperCount} relevant paper${paperCount > 1 ? 's' : ''} related to your question. 

The most relevant paper is "${topResult.paper.title}" by ${topResult.paper.authors?.join(', ') || 'Unknown authors'} (${topResult.paper.publicationYear || 'Unknown year'}).

Key relevant content: ${topResult.relevantExcerpts[0] || 'Please refer to the full paper for details.'}

${paperCount > 1 ? `Other relevant papers include: ${searchResults.slice(1, 3).map(r => `"${r.paper.title}"`).join(', ')}.` : ''}

For more detailed information, please review the source papers directly.`
  }

  /**
   * Calculate confidence score based on search results
   */
  private calculateConfidence(searchResults: SearchResult[]): number {
    if (searchResults.length === 0) return 0
    
    // Average similarity score as confidence
    const avgSimilarity = searchResults.reduce((sum, result) => sum + result.similarity, 0) / searchResults.length
    
    // Normalize to 0-1 range and apply some adjustments
    return Math.min(avgSimilarity * 1.2, 1.0)
  }
}