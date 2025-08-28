'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchFilters } from '@/types'
import { useSearchStore } from '../../stores'
import { Search, Filter, X, Loader2 } from 'lucide-react'

export function SemanticSearchEnhanced() {
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({})

  const {
    searchResults,
    isSearching,
    error,
    performSearch,
    clearSearchResults,
    clearError
  } = useSearchStore()

  const handleSearch = async () => {
    if (!query.trim()) return
    await performSearch(query, filters)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const clearFilters = () => {
    setFilters({})
  }

  const clearAll = () => {
    setQuery('')
    setFilters({})
    clearSearchResults()
    clearError()
  }

  const activeFilterCount = Object.values(filters).filter(value => 
    Array.isArray(value) ? value.length > 0 : value !== undefined
  ).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Semantic Search
          </CardTitle>
          <p className="text-sm text-gray-600">
            Search your papers using natural language. Find papers by meaning, not just keywords.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="What are you looking for? (e.g., 'papers about machine learning in healthcare')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pr-10"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuery('')}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            {(query || activeFilterCount > 0 || searchResults.length > 0) && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear All
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-gray-50">
              <div>
                <label className="text-sm font-medium mb-2 block">Reading Status</label>
                <Select
                  value={filters.readingStatus?.[0] || ''}
                  onValueChange={(value) => 
                    setFilters(prev => ({
                      ...prev,
                      readingStatus: value ? [value] : undefined
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any status</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="reading">Reading</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Min Publication Year</label>
                <Input
                  type="number"
                  placeholder="e.g., 2020"
                  value={filters.publicationYear?.min || ''}
                  onChange={(e) => 
                    setFilters(prev => ({
                      ...prev,
                      publicationYear: {
                        ...prev.publicationYear,
                        min: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    }))
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Max Publication Year</label>
                <Input
                  type="number"
                  placeholder="e.g., 2024"
                  value={filters.publicationYear?.max || ''}
                  onChange={(e) => 
                    setFilters(prev => ({
                      ...prev,
                      publicationYear: {
                        ...prev.publicationYear,
                        max: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    }))
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Min Rating</label>
                <Select
                  value={filters.rating?.min?.toString() || ''}
                  onValueChange={(value) => 
                    setFilters(prev => ({
                      ...prev,
                      rating: {
                        ...prev.rating,
                        min: value ? parseInt(value) : undefined
                      }
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any rating</SelectItem>
                    <SelectItem value="1">1+ stars</SelectItem>
                    <SelectItem value="2">2+ stars</SelectItem>
                    <SelectItem value="3">3+ stars</SelectItem>
                    <SelectItem value="4">4+ stars</SelectItem>
                    <SelectItem value="5">5 stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">Tags (comma-separated)</label>
                <Input
                  placeholder="e.g., important, research, review"
                  value={filters.tags?.join(', ') || ''}
                  onChange={(e) => 
                    setFilters(prev => ({
                      ...prev,
                      tags: e.target.value ? e.target.value.split(',').map(tag => tag.trim()) : undefined
                    }))
                  }
                />
              </div>

              {activeFilterCount > 0 && (
                <div className="flex items-end">
                  <Button variant="outline" onClick={clearFilters} className="w-full">
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-red-800">
                <strong>Search Error:</strong> {error}
              </div>
              <Button variant="ghost" size="sm" onClick={clearError}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Search Results</span>
              <Badge variant="outline">
                {searchResults.length} found
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">
                        {result.paper.title}
                      </h3>
                      <div className="text-sm text-gray-600 mb-2">
                        {result.paper.authors.join(', ')}
                        {result.paper.journal && ` • ${result.paper.journal}`}
                        {result.paper.publicationYear && ` • ${result.paper.publicationYear}`}
                      </div>
                      {result.relevantExcerpts.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-gray-700">
                            Relevant excerpts:
                          </div>
                          {result.relevantExcerpts.map((excerpt, index) => (
                            <div
                              key={index}
                              className="text-sm bg-yellow-50 border-l-4 border-yellow-200 pl-3 py-2"
                            >
                              "{excerpt}"
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="secondary">
                        {(result.similarity * 100).toFixed(1)}% match
                      </Badge>
                      <Badge variant="outline">
                        {result.paper.readingStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isSearching && !error && searchResults.length === 0 && query && (
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-gray-500 mb-4">
              No papers found matching your search query.
            </div>
            <p className="text-sm text-gray-400">
              Try using different keywords or adjusting your filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}