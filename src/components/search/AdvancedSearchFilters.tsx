'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Filter, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import type { AdvancedSearchFilters, SortOption } from '@/services/search/AdvancedSearchService'

interface AdvancedSearchFiltersProps {
  filters: AdvancedSearchFilters
  sortBy: SortOption
  onFiltersChange: (filters: AdvancedSearchFilters) => void
  onSortChange: (sortBy: SortOption) => void
  onClearFilters: () => void
  className?: string
}

interface FilterOptions {
  journals: string[]
  authors: string[]
  tags: string[]
  yearRange: { min: number; max: number }
}

const READING_STATUS_OPTIONS = [
  { value: 'unread', label: 'Unread' },
  { value: 'reading', label: 'Reading' },
  { value: 'completed', label: 'Completed' }
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date_added_desc', label: 'Recently Added' },
  { value: 'date_added_asc', label: 'Oldest First' },
  { value: 'publication_year_desc', label: 'Newest Publications' },
  { value: 'publication_year_asc', label: 'Oldest Publications' },
  { value: 'rating_desc', label: 'Highest Rated' },
  { value: 'rating_asc', label: 'Lowest Rated' },
  { value: 'title_asc', label: 'Title A-Z' },
  { value: 'title_desc', label: 'Title Z-A' }
]

export function AdvancedSearchFilters({
  filters,
  sortBy,
  onFiltersChange,
  onSortChange,
  onClearFilters,
  className = ""
}: AdvancedSearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    journals: [],
    authors: [],
    tags: [],
    yearRange: { min: 1900, max: new Date().getFullYear() }
  })
  const [isLoading, setIsLoading] = useState(false)

  // Load filter options on mount
  useEffect(() => {
    loadFilterOptions()
  }, [])

  const loadFilterOptions = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/search?action=filter-options')
      if (response.ok) {
        const { data } = await response.json()
        setFilterOptions(data)
      }
    } catch (error) {
      console.error('Failed to load filter options:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateFilter = useCallback(<K extends keyof AdvancedSearchFilters>(
    key: K,
    value: AdvancedSearchFilters[K]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }, [filters, onFiltersChange])

  const removeFilter = useCallback((key: keyof AdvancedSearchFilters) => {
    const newFilters = { ...filters }
    delete newFilters[key]
    onFiltersChange(newFilters)
  }, [filters, onFiltersChange])

  const getActiveFilterCount = () => {
    return Object.keys(filters).filter(key => {
      const value = filters[key as keyof AdvancedSearchFilters]
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => v !== undefined && v !== null)
      }
      return value !== undefined && value !== null
    }).length
  }

  const renderActiveFilters = () => {
    const activeFilters = []

    if (filters.readingStatus?.length) {
      activeFilters.push(
        <Badge key="status" variant="secondary" className="gap-1">
          Status: {filters.readingStatus.join(', ')}
          <X 
            className="h-3 w-3 cursor-pointer" 
            onClick={() => removeFilter('readingStatus')}
          />
        </Badge>
      )
    }

    if (filters.publicationYear) {
      const { min, max } = filters.publicationYear
      const yearText = min && max ? `${min}-${max}` : min ? `${min}+` : max ? `<${max}` : ''
      if (yearText) {
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
    }

    if (filters.rating) {
      const { min, max } = filters.rating
      const ratingText = min && max ? `${min}-${max}★` : min ? `${min}★+` : max ? `<${max}★` : ''
      if (ratingText) {
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
    }

    if (filters.tags?.length) {
      activeFilters.push(
        <Badge key="tags" variant="secondary" className="gap-1">
          Tags: {filters.tags.slice(0, 2).join(', ')}{filters.tags.length > 2 ? '...' : ''}
          <X 
            className="h-3 w-3 cursor-pointer" 
            onClick={() => removeFilter('tags')}
          />
        </Badge>
      )
    }

    if (filters.journals?.length) {
      activeFilters.push(
        <Badge key="journals" variant="secondary" className="gap-1">
          Journals: {filters.journals.slice(0, 2).join(', ')}{filters.journals.length > 2 ? '...' : ''}
          <X 
            className="h-3 w-3 cursor-pointer" 
            onClick={() => removeFilter('journals')}
          />
        </Badge>
      )
    }

    if (filters.authors?.length) {
      activeFilters.push(
        <Badge key="authors" variant="secondary" className="gap-1">
          Authors: {filters.authors.slice(0, 2).join(', ')}{filters.authors.length > 2 ? '...' : ''}
          <X 
            className="h-3 w-3 cursor-pointer" 
            onClick={() => removeFilter('authors')}
          />
        </Badge>
      )
    }

    if (filters.dateRange) {
      const { start, end } = filters.dateRange
      const dateText = start && end ? 
        `${start.toLocaleDateString()} - ${end.toLocaleDateString()}` :
        start ? `From ${start.toLocaleDateString()}` :
        end ? `Until ${end.toLocaleDateString()}` : ''
      
      if (dateText) {
        activeFilters.push(
          <Badge key="dateRange" variant="secondary" className="gap-1">
            Added: {dateText}
            <X 
              className="h-3 w-3 cursor-pointer" 
              onClick={() => removeFilter('dateRange')}
            />
          </Badge>
        )
      }
    }

    return activeFilters
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filter Toggle and Sort */}
      <div className="flex items-center gap-2">
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          variant="outline"
          className="relative"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {getActiveFilterCount() > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs"
            >
              {getActiveFilterCount()}
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 ml-2" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-2" />
          )}
        </Button>

        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {getActiveFilterCount() > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Active Filters */}
      {getActiveFilterCount() > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {renderActiveFilters()}
        </div>
      )}

      {/* Expanded Filter Panel */}
      {isExpanded && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Reading Status */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Reading Status</Label>
              <div className="flex flex-wrap gap-2">
                {READING_STATUS_OPTIONS.map(option => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${option.value}`}
                      checked={filters.readingStatus?.includes(option.value) || false}
                      onCheckedChange={(checked) => {
                        const current = filters.readingStatus || []
                        if (checked) {
                          updateFilter('readingStatus', [...current, option.value])
                        } else {
                          updateFilter('readingStatus', current.filter(s => s !== option.value))
                        }
                      }}
                    />
                    <Label 
                      htmlFor={`status-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Publication Year */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Publication Year</Label>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label className="text-sm w-12">From:</Label>
                  <Slider
                    value={[filters.publicationYear?.min || filterOptions.yearRange.min]}
                    onValueChange={([value]) => {
                      updateFilter('publicationYear', {
                        ...filters.publicationYear,
                        min: value
                      })
                    }}
                    min={filterOptions.yearRange.min}
                    max={filterOptions.yearRange.max}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-16 text-right">
                    {filters.publicationYear?.min || filterOptions.yearRange.min}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Label className="text-sm w-12">To:</Label>
                  <Slider
                    value={[filters.publicationYear?.max || filterOptions.yearRange.max]}
                    onValueChange={([value]) => {
                      updateFilter('publicationYear', {
                        ...filters.publicationYear,
                        max: value
                      })
                    }}
                    min={filterOptions.yearRange.min}
                    max={filterOptions.yearRange.max}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-16 text-right">
                    {filters.publicationYear?.max || filterOptions.yearRange.max}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Rating */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Rating</Label>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label className="text-sm w-12">Min:</Label>
                  <Slider
                    value={[filters.rating?.min || 1]}
                    onValueChange={([value]) => {
                      updateFilter('rating', {
                        ...filters.rating,
                        min: value
                      })
                    }}
                    min={1}
                    max={5}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-16 text-right">
                    {filters.rating?.min || 1}★
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Label className="text-sm w-12">Max:</Label>
                  <Slider
                    value={[filters.rating?.max || 5]}
                    onValueChange={([value]) => {
                      updateFilter('rating', {
                        ...filters.rating,
                        max: value
                      })
                    }}
                    min={1}
                    max={5}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-16 text-right">
                    {filters.rating?.max || 5}★
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Journals */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Journals</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value) {
                    const current = filters.journals || []
                    if (!current.includes(value)) {
                      updateFilter('journals', [...current, value])
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select journals..." />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.journals.map(journal => (
                    <SelectItem key={journal} value={journal}>
                      {journal}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.journals?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {filters.journals.map(journal => (
                    <Badge key={journal} variant="outline" className="gap-1">
                      {journal}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => {
                          const current = filters.journals || []
                          updateFilter('journals', current.filter(j => j !== journal))
                        }}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Authors */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Authors</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value) {
                    const current = filters.authors || []
                    if (!current.includes(value)) {
                      updateFilter('authors', [...current, value])
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select authors..." />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.authors.slice(0, 100).map(author => (
                    <SelectItem key={author} value={author}>
                      {author}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.authors?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {filters.authors.map(author => (
                    <Badge key={author} variant="outline" className="gap-1">
                      {author}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => {
                          const current = filters.authors || []
                          updateFilter('authors', current.filter(a => a !== author))
                        }}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Tags */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Tags</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value) {
                    const current = filters.tags || []
                    if (!current.includes(value)) {
                      updateFilter('tags', [...current, value])
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tags..." />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.tags.map(tag => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {filters.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="gap-1">
                      {tag}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => {
                          const current = filters.tags || []
                          updateFilter('tags', current.filter(t => t !== tag))
                        }}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Date Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Date Added</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="date"
                    value={filters.dateRange?.start?.toISOString().split('T')[0] || ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : undefined
                      updateFilter('dateRange', {
                        ...filters.dateRange,
                        start: date
                      })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    value={filters.dateRange?.end?.toISOString().split('T')[0] || ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : undefined
                      updateFilter('dateRange', {
                        ...filters.dateRange,
                        end: date
                      })
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}