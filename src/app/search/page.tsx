'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Settings, Database, AlertCircle, CheckCircle } from 'lucide-react'
import { SemanticSearch, SearchResults } from '@/components/search'
import { useVectorService } from '@/hooks/useVectorService'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import type { SearchFilters } from '@/types'

export default function SearchPage() {
  const router = useRouter()
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('')
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false)
  const [lastQuery, setLastQuery] = useState<string>('')

  const {
    isInitialized,
    isSearching,
    error,
    searchResults,
    initializeService,
    performSearch,
    clearResults,
    getStats
  } = useVectorService({ openaiApiKey })

  const [stats, setStats] = useState<{
    totalDocuments: number
    totalPapers: number
    lastUpdated?: Date
  } | null>(null)

  // Load API key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('openai_api_key')
    if (storedKey) {
      setOpenaiApiKey(storedKey)
      initializeService(storedKey)
    } else {
      setShowApiKeyPrompt(true)
    }
  }, [initializeService])

  // Load stats when service is initialized
  useEffect(() => {
    if (isInitialized) {
      loadStats()
    }
  }, [isInitialized])

  const loadStats = useCallback(async () => {
    try {
      const statsData = await getStats()
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }, [getStats])

  const handleApiKeySubmit = useCallback((key: string) => {
    localStorage.setItem('openai_api_key', key)
    setOpenaiApiKey(key)
    initializeService(key)
    setShowApiKeyPrompt(false)
  }, [initializeService])

  const handleSearch = useCallback(async (query: string, filters?: SearchFilters) => {
    if (!isInitialized) {
      setShowApiKeyPrompt(true)
      return
    }

    setLastQuery(query)
    
    // Convert filters to vector search options
    const searchOptions = {
      matchCount: 20,
      similarityThreshold: 0.5,
      filter: {} as Record<string, any>
    }

    // Apply filters to search options
    if (filters?.readingStatus?.length) {
      searchOptions.filter.reading_status = filters.readingStatus[0]
    }

    if (filters?.publicationYear) {
      if (filters.publicationYear.min) {
        searchOptions.filter.publication_year_min = filters.publicationYear.min
      }
      if (filters.publicationYear.max) {
        searchOptions.filter.publication_year_max = filters.publicationYear.max
      }
    }

    if (filters?.rating) {
      if (filters.rating.min) {
        searchOptions.filter.rating_min = filters.rating.min
      }
      if (filters.rating.max) {
        searchOptions.filter.rating_max = filters.rating.max
      }
    }

    if (filters?.tags?.length) {
      searchOptions.filter.tags = filters.tags
    }

    await performSearch(query, searchOptions)
  }, [isInitialized, performSearch])

  const handlePaperSelect = useCallback((paperId: string) => {
    router.push(`/papers/${paperId}`)
  }, [router])

  const handleClearResults = useCallback(() => {
    clearResults()
    setLastQuery('')
  }, [clearResults])

  if (showApiKeyPrompt) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                OpenAI API Key Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Semantic search requires an OpenAI API key for generating embeddings. 
                Your key will be stored locally in your browser.
              </p>
              
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Enter your OpenAI API key"
                  className="w-full px-3 py-2 border rounded-md"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement
                      if (target.value.trim()) {
                        handleApiKeySubmit(target.value.trim())
                      }
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    const input = document.querySelector('input[type="password"]') as HTMLInputElement
                    if (input?.value.trim()) {
                      handleApiKeySubmit(input.value.trim())
                    }
                  }}
                  className="w-full"
                >
                  Save API Key
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Don't have an API key? Get one from{' '}
                <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  OpenAI Platform
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Semantic Search</h1>
          <p className="text-muted-foreground mt-1">
            Search your papers by meaning, concepts, and questions
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {stats && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="h-4 w-4" />
              <span>{stats.totalPapers} papers indexed</span>
            </div>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowApiKeyPrompt(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Service Status */}
      {isInitialized ? (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Vector search service is ready. {stats?.totalDocuments || 0} documents indexed.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Vector search service is not initialized. Please configure your OpenAI API key.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search Interface */}
      <Card>
        <CardContent className="pt-6">
          <SemanticSearch
            onSearch={handleSearch}
            isSearching={isSearching}
            placeholder="Search papers by meaning, concepts, or ask questions..."
          />
        </CardContent>
      </Card>

      {/* Results Section */}
      {(searchResults.length > 0 || isSearching) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Search Results</h2>
            {searchResults.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearResults}
              >
                Clear Results
              </Button>
            )}
          </div>
          
          <SearchResults
            results={searchResults}
            onPaperSelect={handlePaperSelect}
            isLoading={isSearching}
            query={lastQuery}
          />
        </div>
      )}

      {/* Getting Started */}
      {!isSearching && searchResults.length === 0 && !lastQuery && (
        <Card>
          <CardHeader>
            <CardTitle>Getting Started with Semantic Search</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">What you can search for:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Concepts and topics: "machine learning applications"</li>
                  <li>• Research questions: "How does climate change affect biodiversity?"</li>
                  <li>• Methodologies: "statistical analysis methods"</li>
                  <li>• Authors and institutions</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Search features:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Semantic similarity matching</li>
                  <li>• Filter by reading status, year, rating</li>
                  <li>• Highlighted relevant excerpts</li>
                  <li>• Similarity scores for each result</li>
                </ul>
              </div>
            </div>
            
            {stats && stats.totalPapers === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No papers are currently indexed for search. Upload and analyze some papers first to enable semantic search.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </DashboardLayout>
  )
}