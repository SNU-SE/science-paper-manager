'use client'

import { useState, useCallback, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdvancedSearchFilters } from './AdvancedSearchFilters'
import { SearchResults } from './SearchResults'
import type { AdvancedSearchFilters as SearchFilters, SortOption, SearchResponse } from '@/services/search/AdvancedSearchService'

interface SemanticSearchEnhancedProps {
  placeholder?: string
  className?: string
  onResultsChange?: (results: SearchResponse) => void
}

interface SearchState {
  query: string
  filters: SearchFilters
  sortBy: SortOption
  page: number
  limit: number
}

export function SemanticSearchEnhanced({ 
  placeholder = "Search papers by title, content, authors, or journal...",
  className = "",
  onResultsChange
}: SemanticSearchEnhancedProps) {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    filters: {},
    sortBy: 'relevance',
    page: 1,
    limit: 20
  })
  
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Debounced search suggestions
  useEffect(() => {
    if (searchState.query.length >= 2) {
      const timeoutId = setTimeout(() => {
        loadSuggestions(searchState.query)
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [searchState.query])

  const loadSuggestions = async (query: string) => {
    try {
      const response = await fetch(`/api/search?action=suggestions&q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const { data } = await response.json()
        setSuggestions(data)
        setShowSuggestions(true)
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    }
  }

  const handleSearch = useCallback(async (resetPage = true) => {
    if (!searchState.query.trim() && Object.keys(searchState.filters).length === 0) {
      setSearchResults(null)
      return
    }

    setIsSearching(true)
    setShowSuggestions(false)

    try {
      const searchParams = {
        query: searchState.query.trim() || undefined,
        filters: searchState.filters,
        sortBy: searchState.sortBy,
        page: resetPage ? 1 : searchState.page,
        limit: searchState.limit
      }

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchParams)
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      const { data } = await response.json()
      setSearchResults(data)
      
      if (resetPage && searchState.page !== 1) {
        setSearchState(prev => ({ ...prev, page: 1 }))
      }

      onResultsChange?.(data)

    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults(null)
    } finally {
      setIsSearching(false)
    }
  }, [searchState, onResultsChange])

  const handleQueryChange = useCallback((value: string) => {
    setSearchState(prev => ({ ...prev, query: value }))
  }, [])

  const handleFiltersChange = useCallback((filters: SearchFilters) => {
    setSearchState(prev => ({ ...prev, filters }))
  }, [])

  const handleSortChange = useCallback((sortBy: SortOption) => {
    setSearchState(prev => ({ ...prev, sortBy }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setSearchState(prev => ({ ...prev, filters: {} }))
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setSearchState(prev => ({ ...prev, page }))
  }, [])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearching) {
      handleSearch()
    }
  }, [handleSearch, isSearching])

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setSearchState(prev => ({ ...prev, query: suggestion }))
    setShowSuggestions(false)
    // Trigger search with the suggestion
    setTimeout(() => handleSearch(), 100)
  }, [handleSearch])

  // Auto-search when filters or sort change
  useEffect(() => {
    if (searchResults) {
      handleSearch(true)
    }
  }, [searchState.filters, searchState.sortBy])

  // Load more results when page changes
  useEffect(() => {
    if (searchResults && searchState.page > 1) {
      handleSearch(false)
    }
  }, [searchState.page])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              value={searchState.query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setShowSuggestions(suggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={placeholder}
              className="pl-10"
              disabled={isSearching}
            />
          </div>
          <Button
            onClick={() => handleSearch()}
            disabled={isSearching}
            className="min-w-[100px]"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              'Search'
            )}
          </Button>
        </div>

        {/* Search Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <Card className="absolute top-full left-0 right-0 z-50 mt-1">
            <CardContent className="p-2">
              <div className="space-y-1">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Advanced Filters */}
      <AdvancedSearchFilters
        filters={searchState.filters}
        sortBy={searchState.sortBy}
        onFiltersChange={handleFiltersChange}
        onSortChange={handleSortChange}
        onClearFilters={handleClearFilters}
      />

      {/* Search Results */}
      {searchResults && (
        <div className="space-y-4">
          {/* Results Summary */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {searchResults.totalResults > 0 ? (
                <>
                  Showing {((searchState.page - 1) * searchState.limit) + 1}-
                  {Math.min(searchState.page * searchState.limit, searchResults.totalResults)} of{' '}
                  {searchResults.totalResults} results
                  {searchState.query && (
                    <> for "<span className="font-medium">{searchState.query}</span>"</>
                  )}
                </>
              ) : (
                <>
                  No results found
                  {searchState.query && (
                    <> for "<span className="font-medium">{searchState.query}</span>"</>
                  )}
                </>
              )}
            </div>
            
            {searchResults.suggestions && searchResults.suggestions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Suggestions:</span>
                <div className="flex gap-1">
                  {searchResults.suggestions.slice(0, 3).map((suggestion, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Results List */}
          <SearchResults
            results={searchResults.results}
            query={searchState.query}
            isLoading={isSearching}
            onLoadMore={
              searchResults.currentPage < searchResults.totalPages
                ? () => handlePageChange(searchState.page + 1)
                : undefined
            }
          />

          {/* Pagination */}
          {searchResults.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.max(1, searchState.page - 1))}
                disabled={searchState.page <= 1 || isSearching}
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, searchResults.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, searchState.page - 2) + i
                  if (pageNum > searchResults.totalPages) return null
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === searchState.page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      disabled={isSearching}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.min(searchResults.totalPages, searchState.page + 1))}
                disabled={searchState.page >= searchResults.totalPages || isSearching}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!searchResults && !isSearching && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Enter a search query or apply filters to find papers</p>
        </div>
      )}
    </div>
  )
}