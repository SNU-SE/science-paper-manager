'use client'

import { useState } from 'react'
import { Paper, UserEvaluation as UserEvaluationType, MultiModelAnalysis } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReadingStatus } from '@/components/ui/reading-status'
import { UserEvaluation } from '@/components/papers/UserEvaluation'
import { useUserEvaluation, useTagSuggestions } from '@/hooks/useUserEvaluation'
import { 
  Calendar, 
  Users, 
  BookOpen, 
  ExternalLink, 
  FileText, 
  Brain, 
  Tags, 
  X,
  User
} from 'lucide-react'

interface PaperDetailProps {
  paper: Paper
  analyses?: MultiModelAnalysis
  onPaperUpdate?: (paper: Partial<Paper>) => Promise<void>
  onClose?: () => void
}

export function PaperDetail({
  paper,
  analyses,
  onPaperUpdate,
  onClose
}: PaperDetailProps) {
  const { evaluation, saveEvaluation } = useUserEvaluation({ paperId: paper.id })
  const { tags: tagSuggestions } = useTagSuggestions()
  const [currentPaper, setCurrentPaper] = useState(paper)

  const handleStatusChange = async (status: 'unread' | 'reading' | 'completed') => {
    const updatedPaper = { ...currentPaper, readingStatus: status }
    setCurrentPaper(updatedPaper)
    
    if (onPaperUpdate) {
      try {
        await onPaperUpdate({ id: paper.id, readingStatus: status })
      } catch (error) {
        console.error('Failed to update paper status:', error)
        // Revert on error
        setCurrentPaper(currentPaper)
      }
    }
  }

  const handleEvaluationSave = async (evaluationData: Partial<UserEvaluationType>) => {
    await saveEvaluation(evaluationData)
  }

  const analysisCount = analyses
    ? Object.values(analyses).filter(Boolean).length
    : 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl font-bold mb-2">
                {paper.title}
              </CardTitle>
              
              <div className="space-y-2">
                {/* Authors */}
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown authors'}</span>
                </div>

                {/* Journal and Year */}
                <div className="flex items-center gap-4 text-gray-600">
                  {paper.journal && (
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      <span>{paper.journal}</span>
                    </div>
                  )}
                  {paper.publicationYear && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{paper.publicationYear}</span>
                    </div>
                  )}
                  {paper.doi && (
                    <div className="text-sm">
                      DOI: <span className="font-mono">{paper.doi}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 items-end">
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              )}
              
              <ReadingStatus
                status={currentPaper.readingStatus}
                onChange={handleStatusChange}
                variant="compact"
              />

              {paper.googleDriveUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(paper.googleDriveUrl, '_blank')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View PDF
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <ReadingStatus
            status={currentPaper.readingStatus}
            onChange={handleStatusChange}
            variant="detailed"
          />
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI Analysis
            {analysisCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {analysisCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="evaluation" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            My Evaluation
          </TabsTrigger>
          <TabsTrigger value="metadata" className="flex items-center gap-2">
            <Tags className="w-4 h-4" />
            Metadata
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Abstract</CardTitle>
            </CardHeader>
            <CardContent>
              {paper.abstract ? (
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {paper.abstract}
                </p>
              ) : (
                <p className="text-gray-500 italic">No abstract available</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Tags Preview */}
          {evaluation?.tags && evaluation.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {evaluation.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* AI Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          {analyses && Object.keys(analyses).length > 0 ? (
            <div className="grid gap-4">
              {Object.entries(analyses).map(([provider, analysis]) => {
                if (!analysis) return null
                
                return (
                  <Card key={provider}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="capitalize">{provider} Analysis</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{analysis.modelName}</span>
                          <Badge variant="outline">
                            {analysis.confidenceScore.toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Summary</h4>
                        <p className="text-gray-700 leading-relaxed">
                          {analysis.summary}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.keywords.map((keyword: string) => (
                            <Badge key={keyword} variant="outline">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 pt-2 border-t">
                        <div className="flex justify-between">
                          <span>Tokens used: {analysis.tokensUsed}</span>
                          <span>Processing time: {analysis.processingTimeMs}ms</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No AI analysis available</p>
                <p className="text-sm text-gray-400 mt-2">
                  Upload this paper and run AI analysis to see insights here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* User Evaluation Tab */}
        <TabsContent value="evaluation">
          <UserEvaluation
            paper={currentPaper}
            evaluation={evaluation}
            onSave={handleEvaluationSave}
            tagSuggestions={tagSuggestions}
          />
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata">
          <Card>
            <CardHeader>
              <CardTitle>Paper Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Paper ID</label>
                  <p className="font-mono text-sm">{paper.id}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Date Added</label>
                  <p>{new Date(paper.dateAdded).toLocaleDateString()}</p>
                </div>

                {paper.dateRead && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Date Read</label>
                    <p>{new Date(paper.dateRead).toLocaleDateString()}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-600">Last Modified</label>
                  <p>{new Date(paper.lastModified).toLocaleDateString()}</p>
                </div>

                {paper.zoteroKey && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Zotero Key</label>
                    <p className="font-mono text-sm">{paper.zoteroKey}</p>
                  </div>
                )}

                {paper.googleDriveId && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Google Drive ID</label>
                    <p className="font-mono text-sm">{paper.googleDriveId}</p>
                  </div>
                )}

                {evaluation && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Evaluation Created</label>
                      <p>{new Date(evaluation.createdAt).toLocaleDateString()}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-600">Evaluation Updated</label>
                      <p>{new Date(evaluation.updatedAt).toLocaleDateString()}</p>
                    </div>

                    {evaluation.rating && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Rating</label>
                        <p>{evaluation.rating}/5 stars</p>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-gray-600">Tags Count</label>
                      <p>{evaluation.tags.length} tags</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}