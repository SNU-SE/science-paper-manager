'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { AIAnalysisResult, MultiModelAnalysis } from '@/types'
import { AIProvider } from '@/services/ai/AIServiceFactory'
import { 
  Brain, 
  Clock, 
  Zap, 
  TrendingUp, 
  FileText, 
  Tags, 
  BarChart3,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'

export interface AnalysisComparisonProps {
  analyses: MultiModelAnalysis
  paperId?: string
  isLoading?: boolean
  onModelSelect?: (provider: AIProvider) => void
  onReanalyze?: (provider: AIProvider) => void
}

interface AnalysisMetrics {
  provider: AIProvider
  result?: AIAnalysisResult
  displayName: string
  color: string
}

export function AnalysisComparison({
  analyses,
  paperId,
  isLoading = false,
  onModelSelect,
  onReanalyze
}: AnalysisComparisonProps) {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | 'all'>('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'comparison'>('overview')

  const analysisMetrics: AnalysisMetrics[] = [
    {
      provider: 'openai',
      result: analyses.openai,
      displayName: 'OpenAI',
      color: 'bg-green-500'
    },
    {
      provider: 'anthropic',
      result: analyses.anthropic,
      displayName: 'Anthropic',
      color: 'bg-orange-500'
    },
    {
      provider: 'xai',
      result: analyses.xai,
      displayName: 'xAI',
      color: 'bg-blue-500'
    },
    {
      provider: 'gemini',
      result: analyses.gemini,
      displayName: 'Gemini',
      color: 'bg-purple-500'
    }
  ]

  const completedAnalyses = analysisMetrics.filter(m => m.result)
  const averageConfidence = completedAnalyses.length > 0 
    ? completedAnalyses.reduce((sum, m) => sum + (m.result?.confidenceScore || 0), 0) / completedAnalyses.length
    : 0

  const totalTokensUsed = completedAnalyses.reduce((sum, m) => sum + (m.result?.tokensUsed || 0), 0)
  const averageProcessingTime = completedAnalyses.length > 0
    ? completedAnalyses.reduce((sum, m) => sum + (m.result?.processingTimeMs || 0), 0) / completedAnalyses.length
    : 0

  const handleProviderSelect = (provider: AIProvider) => {
    setSelectedProvider(provider)
    onModelSelect?.(provider)
  }

  const formatProcessingTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const getKeywordOverlap = (): { keyword: string; providers: string[] }[] => {
    const keywordMap = new Map<string, string[]>()
    
    completedAnalyses.forEach(({ result, displayName }) => {
      if (result?.keywords) {
        result.keywords.forEach(keyword => {
          const normalizedKeyword = keyword.toLowerCase().trim()
          if (!keywordMap.has(normalizedKeyword)) {
            keywordMap.set(normalizedKeyword, [])
          }
          keywordMap.get(normalizedKeyword)!.push(displayName)
        })
      }
    })

    return Array.from(keywordMap.entries())
      .map(([keyword, providers]) => ({ keyword, providers }))
      .sort((a, b) => b.providers.length - a.providers.length)
      .slice(0, 10) // Top 10 keywords
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">Analyzing paper with AI models...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (completedAnalyses.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No analysis results available. Configure AI models and run analysis to see results.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{completedAnalyses.length}</p>
                <p className="text-xs text-muted-foreground">Models Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{(averageConfidence * 100).toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Avg Confidence</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{totalTokensUsed.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{formatProcessingTime(averageProcessingTime)}</p>
                <p className="text-xs text-muted-foreground">Avg Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analysis Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Analysis Results
          </CardTitle>
          <CardDescription>
            Compare AI analysis results across different models
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'overview' | 'detailed' | 'comparison')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="detailed">Detailed</TabsTrigger>
              <TabsTrigger value="comparison">Comparison</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4">
                {analysisMetrics.map((metric) => (
                  <Card 
                    key={metric.provider} 
                    className={`cursor-pointer transition-all ${
                      selectedProvider === metric.provider ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleProviderSelect(metric.provider)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${metric.color}`} />
                          <div>
                            <h3 className="font-medium">{metric.displayName}</h3>
                            {metric.result ? (
                              <p className="text-sm text-muted-foreground">
                                {metric.result.keywords.length} keywords • 
                                {formatProcessingTime(metric.result.processingTimeMs)} • 
                                {(metric.result.confidenceScore * 100).toFixed(0)}% confidence
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">No analysis available</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {metric.result ? (
                            <>
                              <Badge variant="secondary">
                                {metric.result.tokensUsed} tokens
                              </Badge>
                              <Progress 
                                value={metric.result.confidenceScore * 100} 
                                className="w-20"
                              />
                            </>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                onReanalyze?.(metric.provider)
                              }}
                            >
                              Analyze
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {metric.result && (
                        <div className="mt-3 p-3 bg-muted rounded-lg">
                          <p className="text-sm line-clamp-3">
                            {metric.result.summary}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="detailed" className="space-y-4">
              {selectedProvider === 'all' ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Select a specific model from the Overview tab to see detailed results.
                  </AlertDescription>
                </Alert>
              ) : (
                (() => {
                  const selectedMetric = analysisMetrics.find(m => m.provider === selectedProvider)
                  const result = selectedMetric?.result
                  
                  if (!result) {
                    return (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No analysis results available for {selectedMetric?.displayName}.
                        </AlertDescription>
                      </Alert>
                    )
                  }
                  
                  return (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${selectedMetric.color}`} />
                          {selectedMetric.displayName} Analysis
                        </h3>
                        <Badge variant="outline">
                          {result.modelName}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" />
                              Confidence
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {(result.confidenceScore * 100).toFixed(1)}%
                            </div>
                            <Progress value={result.confidenceScore * 100} className="mt-2" />
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Zap className="h-4 w-4" />
                              Tokens Used
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {result.tokensUsed.toLocaleString()}
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Processing Time
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">
                              {formatProcessingTime(result.processingTimeMs)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm leading-relaxed">{result.summary}</p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Tags className="h-4 w-4" />
                            Keywords ({result.keywords.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {result.keywords.map((keyword, index) => (
                              <Badge key={index} variant="secondary">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                      
                      {result.scientificRelevance && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" />
                              Scientific Relevance
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <pre className="text-sm bg-muted p-3 rounded-lg overflow-auto">
                              {JSON.stringify(result.scientificRelevance, null, 2)}
                            </pre>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )
                })()
              )}
            </TabsContent>
            
            <TabsContent value="comparison" className="space-y-4">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Keyword Analysis</CardTitle>
                    <CardDescription>
                      Keywords identified by multiple models (showing consensus)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {getKeywordOverlap().map(({ keyword, providers }, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{keyword}</Badge>
                            <span className="text-sm text-muted-foreground">
                              ({providers.length}/{completedAnalyses.length} models)
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {providers.map((provider, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {provider}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Performance Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {completedAnalyses.map((metric) => (
                        <div key={metric.provider} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${metric.color}`} />
                              <span className="font-medium">{metric.displayName}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {(metric.result!.confidenceScore * 100).toFixed(1)}% confidence
                            </div>
                          </div>
                          <Progress value={metric.result!.confidenceScore * 100} />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{metric.result!.tokensUsed} tokens</span>
                            <span>{formatProcessingTime(metric.result!.processingTimeMs)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}