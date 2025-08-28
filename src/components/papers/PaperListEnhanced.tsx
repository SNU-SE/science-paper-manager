'use client'

import { useState, useMemo, useEffect } from 'react'
import { SearchFilters } from '@/types'
import { PaperCardEnhanced } from './PaperCardEnhanced'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react'
import { usePaperStore } from '../../stores'

interface PaperListEnhancedProps {
  itemsPerPage?: number
}

export function PaperListEnhanced({
  itemsPerPage = 12
}: PaperListEnhancedProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [sortBy, setSortBy] = useState<'dateAdded' | 'title' | 'publicationYear' | 'rating'>('dateAdded')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const {
    papers,
    evaluations,
    isLoading,
    error,
    fetchPapers,
    clearError
  } = usePaperStore()

  // Convert Map to Array for easier processing
  const papersArray = useMemo(() => Array.from(papers.values()), [papers])

  // Fetch papers on component mount
  useEffect(() => {
    if (papersArray.length === 0 && !isLoading) {
      fetchPapers()
    }
  }, [papersArray.length, isLoading, fetchPapers])

  // Filter and search papers
  const filteredPapers = useMemo(() => {
    const filtered = papersArray.filter((paper) => {
      // Text search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const searchableText = [
          paper.title,
          paper.authors.join(' '),
          paper.journal || '',
          paper.abstract || ''
        ].join(' ').toLowerCase()
        
        if (!searchableText.includes(query)) {
          return false
        }
      }

      // Reading status filter
      if (filters.readingStatus && filters.readingStatus.length > 0) {
        if (!filters.readingStatus.includes(paper.readingStatus)) {
          return false
        }
      }

      // Publication year filter
      if (filters.publicationYear) {
        const year = paper.publicationYear
        if (year) {
          if (filters.publicationYear.min && year < filters.publicationYear.min) {
            return false
          }
          if (filters.publicationYear.max && year > filters.publicationYear.max) {
            return false
          }
        }
      }

      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const evaluation = evaluations.get(paper.id)
        if (!evaluation?.tags || !filters.tags.some(tag => evaluation.tags.includes(tag))) {
          return false
        }
      }

      // Rating filter
      if (filters.rating) {
        const evaluation = evaluations.get(paper.id)
        const rating = evaluation?.rating || 0
        if (filters.rating.min && rating < filters.rating.min) {
          return false
        }
        if (filters.rating.max && rating > filters.rating.max) {
          return false
        }
      }

      return true
    })

    // Sort papers
    return filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'publicationYear':
          aValue = a.publicationYear || 0
          bValue = b.publicationYear || 0
          break
        case 'rating':
          aValue = evaluations.get(a.id)?.rating || 0
          bValue = evaluations.get(b.id)?.rating || 0
          break
        case 'dateAdded':
        default:
          aValue = new Date(a.dateAdded).getTime()
          bValue = new Date(b.dateAdded).getTime()
          break
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
  }, [papersArray, searchQuery, filters, sortBy, sortOrder, evaluations])

  // Pagination
  const totalPages = Math.ceil(filteredPapers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedPapers = filteredPapers.slice(startIndex, startIndex + itemsPerPage)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filters, sortBy, sortOrder])

  const clearFilters = () => {
    setFilters({})
    setSearchQuery('')
    setCurrentPage(1)
  }

  const activeFilterCount = Object.values(filters).filter(value => 
    Array.isArray(value) ? value.length > 0 : value !== undefined
  ).length + (searchQuery ? 1 : 0)

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-red-600 mb-4">Error: {error}</div>
        <Button onClick={clearError} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search papers by title, authors, journal, or abstract..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
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
          {activeFilterCount > 0 && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-gray-50">
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
              <label className="text-sm font-medium mb-2 block">Sort By</label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dateAdded">Date Added</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="publicationYear">Publication Year</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Sort Order</label>
              <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading papers...
            </div>
          ) : (
            `Showing ${startIndex + 1}-${Math.min(startIndex + itemsPerPage, filteredPapers.length)} of ${filteredPapers.length} papers`
          )}
        </div>
      </div>

      {/* Papers Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-lg h-64"></div>
            </div>
          ))}
        </div>
      ) : paginatedPapers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedPapers.map((paper) => (
            <PaperCardEnhanced
              key={paper.id}
              paper={paper}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            {searchQuery || activeFilterCount > 0
              ? 'No papers match your search criteria'
              : 'No papers found. Upload some papers to get started!'
            }
          </div>
          {(searchQuery || activeFilterCount > 0) && (
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = i + 1
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="w-8 h-8 p-0"
                >
                  {pageNum}
                </Button>
              )
            })}
            {totalPages > 5 && (
              <>
                <span className="px-2">...</span>
                <Button
                  variant={currentPage === totalPages ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  className="w-8 h-8 p-0"
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}