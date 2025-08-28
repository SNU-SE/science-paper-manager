'use client'

import { useState, useMemo } from 'react'
import { Paper, UserEvaluation, MultiModelAnalysis, SearchFilters } from '@/types'
import { PaperCard } from './PaperCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface PaperListProps {
  papers: Paper[]
  evaluations: Map<string, UserEvaluation>
  analyses: Map<string, MultiModelAnalysis>
  onPaperClick: (paper: Paper) => void
  onStatusChange: (paperId: string, status: 'unread' | 'reading' | 'completed') => void
  onRatingChange: (paperId: string, rating: number) => void
  itemsPerPage?: number
}

export function PaperList({
  papers,
  evaluations,
  analyses,
  onPaperClick,
  onStatusChange,
  onRatingChange,
  itemsPerPage = 12
}: PaperListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [sortBy, setSortBy] = useState<'dateAdded' | 'title' | 'publicationYear' | 'rating'>('dateAdded')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Filter and search papers
  const filteredPapers = useMemo(() => {
    const filtered = papers.filter((paper) => {
      // Text search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const searchableText = [
          paper.title,
          paper.authors.join(' '),
          paper.journal || '',
          paper.abstract || ''
        ].join(' ').toLowerCase()
        
        if (!searchableText.includes(query)) return false
      }

      // Reading status filter
      if (filters.readingStatus && filters.readingStatus.length > 0) {
        if (!filters.readingStatus.includes(paper.readingStatus)) return false
      }

      // Publication year filter
      if (filters.publicationYear) {
        if (filters.publicationYear.min && paper.publicationYear && paper.publicationYear < filters.publicationYear.min) return false
        if (filters.publicationYear.max && paper.publicationYear && paper.publicationYear > filters.publicationYear.max) return false
      }

      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const evaluation = evaluations.get(paper.id)
        if (!evaluation || !evaluation.tags.some(tag => filters.tags!.includes(tag))) return false
      }

      // Rating filter
      if (filters.rating) {
        const evaluation = evaluations.get(paper.id)
        const rating = evaluation?.rating || 0
        if (filters.rating.min && rating < filters.rating.min) return false
        if (filters.rating.max && rating > filters.rating.max) return false
      }

      return true
    })

    // Sort papers
    return filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

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
        default:
          aValue = new Date(a.dateAdded).getTime()
          bValue = new Date(b.dateAdded).getTime()
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })
  }, [papers, searchQuery, filters, sortBy, sortOrder, evaluations])

  // Pagination
  const totalPages = Math.ceil(filteredPapers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedPapers = filteredPapers.slice(startIndex, startIndex + itemsPerPage)

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1)
  }, [])

  const clearFilters = () => {
    setFilters({})
    setSearchQuery('')
  }

  const hasActiveFilters = searchQuery || Object.keys(filters).some(key => {
    const value = filters[key as keyof SearchFilters]
    return Array.isArray(value) ? value.length > 0 : value !== undefined
  })

  // Get unique tags for filter options
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    evaluations.forEach(evaluation => {
      evaluation.tags.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [evaluations])

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="space-y-4">
        <div className="flex gap-4 items-center">
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
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1">
                Active
              </Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} size="sm">
              <X className="w-4 h-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Reading Status Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Reading Status</label>
                <Select
                  value={filters.readingStatus?.[0] || ''}
                  onValueChange={(value) => {
                    if (value) {
                      setFilters(prev => ({ ...prev, readingStatus: [value] }))
                    } else {
                      setFilters(prev => ({ ...prev, readingStatus: undefined }))
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="reading">Reading</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Publication Year Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Publication Year</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="From"
                    value={filters.publicationYear?.min || ''}
                    onChange={(e) => {
                      const min = e.target.value ? parseInt(e.target.value) : undefined
                      setFilters(prev => ({
                        ...prev,
                        publicationYear: { ...prev.publicationYear, min }
                      }))
                    }}
                    className="text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="To"
                    value={filters.publicationYear?.max || ''}
                    onChange={(e) => {
                      const max = e.target.value ? parseInt(e.target.value) : undefined
                      setFilters(prev => ({
                        ...prev,
                        publicationYear: { ...prev.publicationYear, max }
                      }))
                    }}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Rating</label>
                <Select
                  value={filters.rating?.min?.toString() || ''}
                  onValueChange={(value) => {
                    if (value) {
                      const min = parseInt(value)
                      setFilters(prev => ({ ...prev, rating: { min } }))
                    } else {
                      setFilters(prev => ({ ...prev, rating: undefined }))
                    }
                  }}
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

              {/* Sort Options */}
              <div>
                <label className="text-sm font-medium mb-2 block">Sort by</label>
                <div className="flex gap-2">
                  <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dateAdded">Date Added</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="publicationYear">Year</SelectItem>
                      <SelectItem value="rating">Rating</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortOrder} onValueChange={(value: typeof sortOrder) => setSortOrder(value)}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">↓</SelectItem>
                      <SelectItem value="asc">↑</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Tags Filter */}
            {allTags.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {allTags.slice(0, 20).map(tag => (
                    <Badge
                      key={tag}
                      variant={filters.tags?.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setFilters(prev => {
                          const currentTags = prev.tags || []
                          if (currentTags.includes(tag)) {
                            return { ...prev, tags: currentTags.filter(t => t !== tag) }
                          } else {
                            return { ...prev, tags: [...currentTags, tag] }
                          }
                        })
                      }}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredPapers.length)} of {filteredPapers.length} papers
        </span>
        {totalPages > 1 && (
          <span>
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* Paper Grid */}
      {paginatedPapers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedPapers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              userEvaluation={evaluations.get(paper.id)}
              aiAnalyses={analyses.get(paper.id)}
              onCardClick={() => onPaperClick(paper)}
              onStatusChange={(status) => onStatusChange(paper.id, status)}
              onRatingChange={(rating) => onRatingChange(paper.id, rating)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No papers found</p>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters} className="mt-4">
              Clear filters to see all papers
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
            Previous
          </Button>
          
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="w-10"
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}