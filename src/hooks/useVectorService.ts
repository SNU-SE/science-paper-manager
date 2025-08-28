import { useState, useCallback, useEffect } from 'react'
import { VectorServiceFactory } from '@/services/vector'
import type { SearchResult, RAGResponse, PaperContext } from '@/types'
import type { VectorSearchOptions } from '@/services/vector'

interface UseVectorServiceOptions {
  openaiApiKey?: string
}

interface UseVectorServiceReturn {
  // State
  isInitialized: boolean
  isSearching: boolean
  isEmbedding: boolean
  error: string | null
  
  // Search functionality
  searchResults: SearchResult[]
  ragResponse: RAGResponse | null
  
  // Actions
  initializeService: (apiKey: string) => void
  embedPaper: (context: PaperContext) => Promise<void>
  updatePaperEmbedding: (context: PaperContext) => Promise<void>
  removePaperEmbedding: (paperId: string) => Promise<void>
  performSearch: (query: string, options?: VectorSearchOptions) => Promise<void>
  askRAG: (question: string, context?: Record<string, any>) => Promise<void>
  clearResults: () => void
  getStats: () => Promise<{ totalDocuments: number; totalPapers: number; lastUpdated?: Date } | null>
}

/**
 * Hook for managing vector database operations
 */
export function useVectorService(options: UseVectorServiceOptions = {}): UseVectorServiceReturn {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isEmbedding, setIsEmbedding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [ragResponse, setRagResponse] = useState<RAGResponse | null>(null)

  // Initialize service on mount if API key is provided
  useEffect(() => {
    if (options.openaiApiKey && !isInitialized) {
      initializeService(options.openaiApiKey)
    }
  }, [options.openaiApiKey, isInitialized])

  const initializeService = useCallback((apiKey: string) => {
    try {
      VectorServiceFactory.getInstance(apiKey)
      setIsInitialized(true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize vector service')
      setIsInitialized(false)
    }
  }, [])

  const embedPaper = useCallback(async (context: PaperContext) => {
    if (!isInitialized) {
      throw new Error('Vector service not initialized')
    }

    setIsEmbedding(true)
    setError(null)

    try {
      const service = VectorServiceFactory.getInstance()
      await service.embedPaperWithContext(context)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to embed paper'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsEmbedding(false)
    }
  }, [isInitialized])

  const updatePaperEmbedding = useCallback(async (context: PaperContext) => {
    if (!isInitialized) {
      throw new Error('Vector service not initialized')
    }

    setIsEmbedding(true)
    setError(null)

    try {
      const service = VectorServiceFactory.getInstance()
      await service.updatePaperEmbedding(context)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update paper embedding'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsEmbedding(false)
    }
  }, [isInitialized])

  const removePaperEmbedding = useCallback(async (paperId: string) => {
    if (!isInitialized) {
      throw new Error('Vector service not initialized')
    }

    setIsEmbedding(true)
    setError(null)

    try {
      const service = VectorServiceFactory.getInstance()
      await service.removePaperEmbedding(paperId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove paper embedding'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsEmbedding(false)
    }
  }, [isInitialized])

  const performSearch = useCallback(async (query: string, options?: VectorSearchOptions) => {
    if (!isInitialized) {
      throw new Error('Vector service not initialized')
    }

    setIsSearching(true)
    setError(null)

    try {
      const service = VectorServiceFactory.getInstance()
      const results = await service.semanticSearch(query, options)
      setSearchResults(results)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed'
      setError(errorMessage)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [isInitialized])

  const askRAG = useCallback(async (question: string, context?: Record<string, any>) => {
    if (!isInitialized) {
      throw new Error('Vector service not initialized')
    }

    setIsSearching(true)
    setError(null)

    try {
      const service = VectorServiceFactory.getInstance()
      const response = await service.ragQuery(question, context)
      setRagResponse(response)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'RAG query failed'
      setError(errorMessage)
      setRagResponse(null)
    } finally {
      setIsSearching(false)
    }
  }, [isInitialized])

  const clearResults = useCallback(() => {
    setSearchResults([])
    setRagResponse(null)
    setError(null)
  }, [])

  const getStats = useCallback(async () => {
    if (!isInitialized) {
      return null
    }

    try {
      const service = VectorServiceFactory.getInstance()
      return await service.getEmbeddingStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get stats')
      return null
    }
  }, [isInitialized])

  return {
    // State
    isInitialized,
    isSearching,
    isEmbedding,
    error,
    searchResults,
    ragResponse,
    
    // Actions
    initializeService,
    embedPaper,
    updatePaperEmbedding,
    removePaperEmbedding,
    performSearch,
    askRAG,
    clearResults,
    getStats,
  }
}