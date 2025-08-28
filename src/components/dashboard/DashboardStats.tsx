'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BookOpen, FileText, Brain, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import { Paper, AIAnalysisResult, UserEvaluation } from '@/types'

interface DashboardStatsProps {
  papers: Paper[]
  evaluations: UserEvaluation[]
  aiAnalyses: AIAnalysisResult[]
  isLoading?: boolean
}

export function DashboardStats({ 
  papers, 
  evaluations, 
  aiAnalyses, 
  isLoading = false 
}: DashboardStatsProps) {
  // Calculate statistics
  const totalPapers = papers.length
  const readPapers = papers.filter(p => p.readingStatus === 'completed').length
  const readingPapers = papers.filter(p => p.readingStatus === 'reading').length
  const unreadPapers = papers.filter(p => p.readingStatus === 'unread').length
  
  const readingProgress = totalPapers > 0 ? (readPapers / totalPapers) * 100 : 0
  
  const totalAnalyses = aiAnalyses.length
  const analysesThisMonth = aiAnalyses.filter(
    a => new Date(a.createdAt).getMonth() === new Date().getMonth()
  ).length
  
  const averageRating = evaluations.length > 0 
    ? evaluations
        .filter(e => e.rating)
        .reduce((sum, e) => sum + (e.rating || 0), 0) / evaluations.filter(e => e.rating).length
    : 0
  
  const recentPapers = papers
    .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
    .slice(0, 3)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-slate-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Papers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Papers</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalPapers}</div>
          <p className="text-xs text-muted-foreground">
            {totalPapers > 0 ? `${analysesThisMonth} analyzed this month` : 'No papers yet'}
          </p>
        </CardContent>
      </Card>

      {/* Reading Progress */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Reading Progress</CardTitle>
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(readingProgress)}%</div>
          <Progress value={readingProgress} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {readPapers} completed, {readingPapers} in progress
          </p>
        </CardContent>
      </Card>

      {/* AI Analyses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">AI Analyses</CardTitle>
          <Brain className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalAnalyses}</div>
          <p className="text-xs text-muted-foreground">
            {analysesThisMonth} this month
          </p>
        </CardContent>
      </Card>

      {/* Average Rating */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {averageRating > 0 ? averageRating.toFixed(1) : '—'}
          </div>
          <div className="flex items-center mt-1">
            {averageRating > 0 && (
              <>
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`text-xs ${
                      i < Math.round(averageRating) 
                        ? 'text-yellow-400' 
                        : 'text-slate-300'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {evaluations.filter(e => e.rating).length} rated papers
          </p>
        </CardContent>
      </Card>
    </div>
  )
}