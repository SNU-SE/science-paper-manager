'use client'

import { useState, useCallback } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import type { SearchFilters } from '@/types'

interface SemanticSearchProps {
  onSearch: (query: string, filters?: SearchFilters) => Promise<void>
  isSearching?: boolean
  placeholder?: string
  className?: string
}

interface SearchState {
  query: string
  filters: SearchFilters
  showFilters: boolean
}

const READING_STATUS_OPTIONS = [
  { value: 'unread', label: 'Unread' },
  { value: 'reading', label: 'Reading' },
  { value: 'completed', label: 'Completed' }
]

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1900

export function SemanticSearch({ 
  onSearch, 
  isSearching = false, 
  placeholder = "Search papers by meaning, concepts, or questions...",
  className = ""
}: SemanticSearchProps) {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    filters: {},
    showFilters: false
  })

  const handleQueryChange = useCallback((value: string) => {
    setSearchState(prev => ({ ...prev, query: value }))
  }, [])

  const handleSearch = useCallback(async () => {
    if (!searchState.query.trim()) return
    
    const activeFilters = Object.keys(searchState.filters).length > 0 ? searchState.filters : undefined
    await onSearch(searchState.query.trim(), activeFilters)
  }, [searchState.query, searchState.filters, onSearch])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearching) {
      handleSearch()
    }
  }, [handleSearch, isSearching])

  const toggleFilters = useCallback(() => {
    setSearchState(prev => ({ ...prev, showFilters: !prev.showFilters }))
  }, [])

  const updateFilter = useCallback(<K extends keyof SearchFilters>(
    key: K, 
    value: SearchFilters[K]
  ) => {
    setSearchState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [key]: value
      }
    }))
  }, [])

  const removeFilter = useCallback((key: keyof SearchFilters) => {
    setSearchState(prev => {
      const newFilters = { ...prev.filters }
      delete newFilters[key]
      return { ...prev, filters: newFilters }
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setSearchState(prev => ({ ...prev, filters: {} }))
  }, [])

  const getActiveFilterCount = () => {
    return Object.keys(searchState.filters).length
  }

  const renderActiveFilters = () => {
    const activeFilters = []

    if (searchState.filters.readingStatus?.length) {
      activeFilters.push(
        <Badge key="status" variant="secondary" className="gap-1">
          Status: {searchState.filters.readingStatus.join(', ')}
          <X 
            className="h-3 w-3 cursor-pointer" 
            onClick={() => removeFilter('readingStatus')}
          />
        </Badge>
      )
    }

    if (searchState.filters.publicationYear) {
      const { min, max } = searchState.filters.publicationYear
      const yearText = min && max ? `${min}-${max}` : min ? `${min}+` : max ? `<${max}` : ''
      activeFilters.push(
        <Badge key="year" variant="secondary" className="gap-1">
          Year: {yearText}
          <X 
            className="h-3 w-3 cursor-pointer" 
            onClick={() => removeFilter('publicationYear')}
          />
        </Badge>
      )
    }

    if (searchState.filters.rating) {
      const { min, max } = searchState.filters.rating
      const ratingText = min && max ? `${min}-${max}★` : min ? `${min}★+` : max ? `<${max}★` : ''
      activeFilters.push(
        <Badge key="rating" variant="secondary" className="gap-1">
          Rating: {ratingText}
          <X 
            className="h-3 w-3 cursor-pointer" 
            onClick={() => removeFilter('rating')}
          />
        </Badge>
      )
    }

    if (searchState.filters.tags?.length) {
      activeFilters.push(
        <Badge key="tags" variant="secondary" className="gap-1">
          Tags: {searchState.filters.tags.join(', ')}
          <X 
            className="h-3 w-3 cursor-pointer" 
            onClick={() => removeFilter('tags')}
          />
        </Badge>
      )
    }

    return activeFilters
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            value={searchState.query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="pl-10"
            disabled={isSearching}
          />
        </div>
        <Button
          onClick={toggleFilters}
          variant="outline"
          size="icon"
          className="relative"
        >
          <Filter className="h-4 w-4" />
          {getActiveFilterCount() > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs"
            >
              {getActiveFilterCount()}
            </Badge>
          )}
        </Button>
        <Button
          onClick={handleSearch}
          disabled={isSearching || !searchState.query.trim()}
          className="min-w-[100px]"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {/* Active Filters */}
      {getActiveFilterCount() > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Filters:</span>
          {renderActiveFilters()}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Filter Panel */}
      {searchState.showFilters && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Search Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Reading Status Filter */}
            <div className="space-y-2">
              <Label>Reading Status</Label>
              <Select
                value={searchState.filters.readingStatus?.[0] || ''}
                onValueChange={(value) => {
                  if (value) {
                    updateFilter('readingStatus', [value])
                  } else {
                    removeFilter('readingStatus')
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any status</SelectItem>
                  {READING_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Publication Year Filter */}
            <div className="space-y-3">
              <Label>Publication Year</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm w-12">From:</Label>
                  <Slider
                    value={[searchState.filters.publicationYear?.min || MIN_YEAR]}
                    onValueChange={([value]) => {
                      updateFilter('publicationYear', {
                        ...searchState.filters.publicationYear,
                        min: value
                      })
                    }}
                    min={MIN_YEAR}
                    max={CURRENT_YEAR}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-12 text-right">
                    {searchState.filters.publicationYear?.min || MIN_YEAR}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm w-12">To:</Label>
                  <Slider
                    value={[searchState.filters.publicationYear?.max || CURRENT_YEAR]}
                    onValueChange={([value]) => {
                      updateFilter('publicationYear', {
                        ...searchState.filters.publicationYear,
                        max: value
                      })
                    }}
                    min={MIN_YEAR}
                    max={CURRENT_YEAR}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-12 text-right">
                    {searchState.filters.publicationYear?.max || CURRENT_YEAR}
                  </span>
                </div>
              </div>
            </div>

            {/* Rating Filter */}
            <div className="space-y-3">
              <Label>Rating</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm w-12">Min:</Label>
                  <Slider
                    value={[searchState.filters.rating?.min || 1]}
                    onValueChange={([value]) => {
                      updateFilter('rating', {
                        ...searchState.filters.rating,
                        min: value
                      })
                    }}
                    min={1}
                    max={5}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-12 text-right">
                    {searchState.filters.rating?.min || 1}★
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm w-12">Max:</Label>
                  <Slider
                    value={[searchState.filters.rating?.max || 5]}
                    onValueChange={([value]) => {
                      updateFilter('rating', {
                        ...searchState.filters.rating,
                        max: value
                      })
                    }}
                    min={1}
                    max={5}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-12 text-right">
                    {searchState.filters.rating?.max || 5}★
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}