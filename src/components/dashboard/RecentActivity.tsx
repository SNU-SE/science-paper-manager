'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { FileText, Brain, Star, Upload, MessageCircle } from 'lucide-react'
import { Paper, AIAnalysisResult, UserEvaluation } from '@/types'

interface ActivityItem {
  id: string
  type: 'paper_added' | 'paper_read' | 'analysis_completed' | 'evaluation_added' | 'search_performed'
  title: string
  description: string
  timestamp: Date
  icon: React.ReactNode
  badge?: string
}

interface RecentActivityProps {
  papers: Paper[]
  evaluations: UserEvaluation[]
  aiAnalyses: AIAnalysisResult[]
  isLoading?: boolean
}

export function RecentActivity({ 
  papers, 
  evaluations, 
  aiAnalyses, 
  isLoading = false 
}: RecentActivityProps) {
  // Generate activity items from data
  const generateActivityItems = (): ActivityItem[] => {
    const activities: ActivityItem[] = []

    // Recent papers added
    papers
      .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
      .slice(0, 5)
      .forEach(paper => {
        activities.push({
          id: `paper-${paper.id}`,
          type: 'paper_added',
          title: 'Paper Added',
          description: paper.title.length > 60 
            ? `${paper.title.substring(0, 60)}...` 
            : paper.title,
          timestamp: paper.dateAdded,
          icon: <FileText className="h-4 w-4" />,
          badge: paper.readingStatus
        })
      })

    // Recent papers completed
    papers
      .filter(p => p.readingStatus === 'completed' && p.dateRead)
      .sort((a, b) => new Date(b.dateRead!).getTime() - new Date(a.dateRead!).getTime())
      .slice(0, 3)
      .forEach(paper => {
        activities.push({
          id: `read-${paper.id}`,
          type: 'paper_read',
          title: 'Paper Completed',
          description: paper.title.length > 60 
            ? `${paper.title.substring(0, 60)}...` 
            : paper.title,
          timestamp: paper.dateRead!,
          icon: <Badge className="h-4 w-4 bg-green-500" />,
          badge: 'completed'
        })
      })

    // Recent AI analyses
    aiAnalyses
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .forEach(analysis => {
        const paper = papers.find(p => p.id === analysis.paperId)
        if (paper) {
          activities.push({
            id: `analysis-${analysis.id}`,
            type: 'analysis_completed',
            title: 'AI Analysis Completed',
            description: `${analysis.modelProvider.toUpperCase()} analysis for "${
              paper.title.length > 40 
                ? `${paper.title.substring(0, 40)}...` 
                : paper.title
            }"`,
            timestamp: analysis.createdAt,
            icon: <Brain className="h-4 w-4" />,
            badge: analysis.modelProvider
          })
        }
      })

    // Recent evaluations
    evaluations
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3)
      .forEach(evaluation => {
        const paper = papers.find(p => p.id === evaluation.paperId)
        if (paper && evaluation.rating) {
          activities.push({
            id: `eval-${evaluation.id}`,
            type: 'evaluation_added',
            title: 'Paper Rated',
            description: `Rated "${
              paper.title.length > 40 
                ? `${paper.title.substring(0, 40)}...` 
                : paper.title
            }" ${evaluation.rating} stars`,
            timestamp: evaluation.updatedAt,
            icon: <Star className="h-4 w-4" />,
            badge: `${evaluation.rating}★`
          })
        }
      })

    // Sort all activities by timestamp and take the most recent 10
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
  }

  const activities = generateActivityItems()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest research activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 animate-pulse">
                <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest research activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <MessageCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              No recent activity yet. Start by uploading your first paper!
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest research activities</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-4">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-slate-100 dark:bg-slate-800">
                  {activity.icon}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium leading-none">
                    {activity.title}
                  </p>
                  {activity.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {activity.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {activity.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}