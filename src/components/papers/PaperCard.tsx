'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StarRating } from '@/components/ui/star-rating'
import { ReadingStatus } from '@/components/ui/reading-status'
import { Paper, UserEvaluation, MultiModelAnalysis } from '@/types'
import { Calendar, Users, BookOpen, ExternalLink } from 'lucide-react'

interface PaperCardProps {
  paper: Paper
  aiAnalyses?: MultiModelAnalysis
  userEvaluation?: UserEvaluation
  onStatusChange?: (status: 'unread' | 'reading' | 'completed') => void
  onRatingChange?: (rating: number) => void
  onCardClick?: () => void
  compact?: boolean
}

export function PaperCard({
  paper,
  aiAnalyses,
  userEvaluation,
  onStatusChange,
  onRatingChange,
  onCardClick,
  compact = false
}: PaperCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const analysisCount = aiAnalyses
    ? Object.values(aiAnalyses).filter(Boolean).length
    : 0

  return (
    <Card
      className={`transition-all duration-200 cursor-pointer ${
        isHovered ? 'shadow-lg scale-[1.02]' : 'shadow-sm'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg font-semibold line-clamp-2 flex-1">
            {paper.title}
          </CardTitle>
          <div className="flex flex-col gap-2 items-end">
            <ReadingStatus
              status={paper.readingStatus}
              onChange={onStatusChange}
              readonly={!onStatusChange}
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

      <CardContent className="space-y-4">
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
        {paper.abstract && (
          <p className="text-sm text-gray-700 line-clamp-3">
            {paper.abstract}
          </p>
        )}

        {/* Tags */}
        {userEvaluation?.tags && userEvaluation.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {userEvaluation.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {userEvaluation.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{userEvaluation.tags.length - 3}
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
              onChange={onRatingChange}
              readonly={!onRatingChange}
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