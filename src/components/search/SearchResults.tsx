'use client'

import { useState, useMemo } from 'react'
import { FileText, ExternalLink, Star, Calendar, Users, BookOpen, Search } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { SearchResult } from '@/types'

interface SearchResultsProps {
  results: SearchResult[]
  onPaperSelect: (paperId: string) => void
  isLoading?: boolean
  query?: string
  className?: string
}

interface HighlightedTextProps {
  text: string
  query: string
  className?: string
}

function HighlightedText({ text, query, className = "" }: HighlightedTextProps) {
  if (!query.trim()) {
    return <span className={className}>{text}</span>
  }

  const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2)
  
  if (queryWords.length === 0) {
    return <span className={className}>{text}</span>
  }

  // Create regex pattern for highlighting
  const pattern = new RegExp(`(${queryWords.join('|')})`, 'gi')
  const parts = text.split(pattern)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMatch = queryWords.some(word => 
          part.toLowerCase() === word.toLowerCase()
        )
        return isMatch ? (
          <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      })}
    </span>
  )
}

function SimilarityScore({ score }: { score: number }) {
  const percentage = Math.round(score * 100)
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 dark:text-green-400'
    if (score >= 0.6) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getProgressColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500'
    if (score >= 0.6) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1">
        <Progress 
          value={percentage} 
          className="h-2"
          style={{
            '--progress-background': getProgressColor(score)
          } as React.CSSProperties}
        />
      </div>
      <span className={`text-sm font-medium ${getScoreColor(score)}`}>
        {percentage}%
      </span>
    </div>
  )
}

function ReadingStatusBadge({ status }: { status: string }) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { variant: 'default' as const, icon: '✓', label: 'Completed' }
      case 'reading':
        return { variant: 'secondary' as const, icon: '📖', label: 'Reading' }
      default:
        return { variant: 'outline' as const, icon: '○', label: 'Unread' }
    }
  }

  const config = getStatusConfig(status)

  return (
    <Badge variant={config.variant} className="gap-1">
      <span>{config.icon}</span>
      {config.label}
    </Badge>
  )
}

function SearchResultCard({ 
  result, 
  onSelect, 
  query = "" 
}: { 
  result: SearchResult
  onSelect: (paperId: string) => void
  query?: string 
}) {
  const [showAllExcerpts, setShowAllExcerpts] = useState(false)
  
  const { paper, similarity, relevantExcerpts } = result
  const displayExcerpts = showAllExcerpts ? relevantExcerpts : relevantExcerpts.slice(0, 2)

  const handleCardClick = () => {
    onSelect(paper.id)
  }

  const handleExternalLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (paper.googleDriveUrl) {
      window.open(paper.googleDriveUrl, '_blank')
    }
  }

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow duration-200 border-l-4 border-l-primary/20"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <HighlightedText
                text={paper.title}
                query={query}
                className="font-semibold text-lg leading-tight"
              />
            </div>
            
            {paper.authors.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Users className="h-3 w-3" />
                <HighlightedText
                  text={paper.authors.join(', ')}
                  query={query}
                />
              </div>
            )}
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {paper.journal && (
                <div className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  <HighlightedText text={paper.journal} query={query} />
                </div>
              )}
              
              {paper.publicationYear && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{paper.publicationYear}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <SimilarityScore score={similarity} />
            <div className="flex items-center gap-2">
              <ReadingStatusBadge status={paper.readingStatus} />
              {paper.googleDriveUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExternalLinkClick}
                  className="h-8 w-8 p-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      {relevantExcerpts.length > 0 && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Relevant excerpts:
            </h4>
            <div className="space-y-2">
              {displayExcerpts.map((excerpt, index) => (
                <div 
                  key={index}
                  className="p-3 bg-muted/50 rounded-md border-l-2 border-l-primary/30"
                >
                  <HighlightedText
                    text={excerpt}
                    query={query}
                    className="text-sm leading-relaxed"
                  />
                </div>
              ))}
            </div>
            
            {relevantExcerpts.length > 2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAllExcerpts(!showAllExcerpts)
                }}
                className="text-xs"
              >
                {showAllExcerpts 
                  ? 'Show less' 
                  : `Show ${relevantExcerpts.length - 2} more excerpts`
                }
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export function SearchResults({ 
  results, 
  onPaperSelect, 
  isLoading = false, 
  query = "",
  className = ""
}: SearchResultsProps) {
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => b.similarity - a.similarity)
  }, [results])

  const stats = useMemo(() => {
    if (results.length === 0) return null
    
    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length
    const highQualityResults = results.filter(r => r.similarity >= 0.8).length
    
    return {
      total: results.length,
      avgSimilarity,
      highQuality: highQualityResults
    }
  }, [results])

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Searching your papers...</p>
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No papers found</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Try adjusting your search query or filters. Make sure your papers are embedded in the vector database.
        </p>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search Statistics */}
      {stats && (
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-6 text-sm">
            <span>
              <strong>{stats.total}</strong> papers found
            </span>
            <span>
              <strong>{stats.highQuality}</strong> high-quality matches
            </span>
            <span>
              Average similarity: <strong>{Math.round(stats.avgSimilarity * 100)}%</strong>
            </span>
          </div>
          
          {query && (
            <Badge variant="outline" className="gap-1">
              <Search className="h-3 w-3" />
              "{query}"
            </Badge>
          )}
        </div>
      )}

      {/* Results List */}
      <div className="space-y-4">
        {sortedResults.map((result) => (
          <SearchResultCard
            key={result.id}
            result={result}
            onSelect={onPaperSelect}
            query={query}
          />
        ))}
      </div>

      {/* Load More / Pagination could go here */}
      {results.length >= 10 && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Showing top {results.length} results. Refine your search for more specific results.
          </p>
        </div>
      )}
    </div>
  )
}