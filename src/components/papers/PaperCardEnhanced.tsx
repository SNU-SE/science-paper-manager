'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StarRating } from '@/components/ui/star-rating'
import { ReadingStatus } from '@/components/ui/reading-status'
import { Paper } from '@/types'
import { Calendar, Users, BookOpen, ExternalLink } from 'lucide-react'
import { usePaperStore } from '../../stores'

interface PaperCardEnhancedProps {
  paper: Paper
  compact?: boolean
}

export function PaperCardEnhanced({
  paper,
  compact = false
}: PaperCardEnhancedProps) {
  const [isHovered, setIsHovered] = useState(false)
  
  const {
    selectPaper,
    updatePaper,
    updateEvaluation,
    getEvaluation,
    getAnalysis
  } = usePaperStore()

  const userEvaluation = getEvaluation(paper.id)
  const aiAnalyses = getAnalysis(paper.id)

  const analysisCount = aiAnalyses
    ? Object.values(aiAnalyses).filter(Boolean).length
    : 0

  const handleStatusChange = async (status: 'unread' | 'reading' | 'completed') => {
    await updatePaper(paper.id, { 
      readingStatus: status,
      dateRead: status === 'completed' ? new Date() : undefined
    })
  }

  const handleRatingChange = async (rating: number) => {
    await updateEvaluation(paper.id, { rating })
  }

  const handleCardClick = () => {
    selectPaper(paper)
  }

  return (
    <Card
      className={`transition-all duration-200 cursor-pointer ${
        isHovered ? 'shadow-lg scale-[1.02]' : 'shadow-sm'
      } ${compact ? 'p-2' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <CardHeader className={compact ? 'pb-2' : 'pb-3'}>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className={`font-semibold line-clamp-2 flex-1 ${
            compact ? 'text-base' : 'text-lg'
          }`}>
            {paper.title}
          </CardTitle>
          <div className="flex flex-col gap-2 items-end">
            <ReadingStatus
              status={paper.readingStatus}
              onChange={handleStatusChange}
              variant="compact"
            />
            {paper.googleDriveUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(paper.googleDriveUrl, '_blank')
                }}
                className="p-1 h-auto"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className={`space-y-${compact ? '2' : '4'}`}>
        {/* Authors */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="w-4 h-4" />
          <span className="line-clamp-1">
            {paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown authors'}
          </span>
        </div>

        {/* Journal and Year */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          {paper.journal && (
            <div className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              <span className="line-clamp-1">{paper.journal}</span>
            </div>
          )}
          {paper.publicationYear && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{paper.publicationYear}</span>
            </div>
          )}
        </div>

        {/* Abstract preview */}
        {!compact && paper.abstract && (
          <p className="text-sm text-gray-700 line-clamp-3">
            {paper.abstract}
          </p>
        )}

        {/* Tags */}
        {userEvaluation?.tags && userEvaluation.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {userEvaluation.tags.slice(0, compact ? 2 : 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {userEvaluation.tags.length > (compact ? 2 : 3) && (
              <Badge variant="secondary" className="text-xs">
                +{userEvaluation.tags.length - (compact ? 2 : 3)}
              </Badge>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between pt-2 border-t">
          {/* Rating */}
          <div onClick={(e) => e.stopPropagation()}>
            <StarRating
              value={userEvaluation?.rating || 0}
              onChange={handleRatingChange}
              size="sm"
            />
          </div>

          {/* AI Analysis indicator */}
          {analysisCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {analysisCount} AI
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}