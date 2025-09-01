'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, Clock, Play, RefreshCw } from 'lucide-react'
import { useBackgroundAnalysis } from '@/hooks/useBackgroundAnalysis'
import { AIProvider } from '@/services/background/types'

interface BackgroundAnalysisDemoProps {
  paperId?: string
  onAnalysisComplete?: (result: any) => void
}

export function BackgroundAnalysisDemo({ 
  paperId = 'demo-paper-id', 
  onAnalysisComplete 
}: BackgroundAnalysisDemoProps) {
  const {
    isLoading,
    error,
    jobId,
    jobStatus,
    progress,
    healthStatus,
    startAnalysis,
    getHealthStatus,
    clearError,
    reset,
    isAnalyzing,
    isCompleted,
    isFailed,
    hasResult
  } = useBackgroundAnalysis()

  const [selectedProviders, setSelectedProviders] = useState<AIProvider[]>(['openai'])

  // Load health status on mount
  useEffect(() => {
    getHealthStatus()
  }, [getHealthStatus])

  const handleStartAnalysis = async () => {
    try {
      clearError()
      await startAnalysis(paperId, selectedProviders)
    } catch (error) {
      console.error('Failed to start analysis:', error)
    }
  }

  const handleProviderToggle = (provider: AIProvider) => {
    setSelectedProviders(prev => 
      prev.includes(provider)
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    )
  }

  const getStatusIcon = () => {
    if (isCompleted) return <CheckCircle className="h-5 w-5 text-green-500" />
    if (isFailed) return <XCircle className="h-5 w-5 text-red-500" />
    if (isAnalyzing) return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
    return <Clock className="h-5 w-5 text-gray-500" />
  }

  const getStatusColor = () => {
    if (isCompleted) return 'bg-green-100 text-green-800'
    if (isFailed) return 'bg-red-100 text-red-800'
    if (isAnalyzing) return 'bg-blue-100 text-blue-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Background Jobs Health
            {healthStatus?.healthy ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </CardTitle>
          <CardDescription>
            Status of the background job processing system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {healthStatus && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Queue Manager</h4>
                <Badge variant={healthStatus.queueManager ? 'default' : 'destructive'}>
                  {healthStatus.queueManager ? 'Healthy' : 'Unhealthy'}
                </Badge>
                {healthStatus.details.queueStatus && (
                  <div className="mt-2 text-sm text-gray-600">
                    <div>Waiting: {healthStatus.details.queueStatus.waiting}</div>
                    <div>Active: {healthStatus.details.queueStatus.active}</div>
                    <div>Completed: {healthStatus.details.queueStatus.completed}</div>
                    <div>Failed: {healthStatus.details.queueStatus.failed}</div>
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-medium mb-2">Worker</h4>
                <Badge variant={healthStatus.worker ? 'default' : 'destructive'}>
                  {healthStatus.worker ? 'Healthy' : 'Unhealthy'}
                </Badge>
                {healthStatus.details.workerStats && (
                  <div className="mt-2 text-sm text-gray-600">
                    <div>Processed: {healthStatus.details.workerStats.processed}</div>
                    <div>Failed: {healthStatus.details.workerStats.failed}</div>
                    <div>Active: {healthStatus.details.workerStats.active}</div>
                  </div>
                )}
              </div>
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={getHealthStatus}
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Background AI Analysis</CardTitle>
          <CardDescription>
            Start AI analysis that runs in the background
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider Selection */}
          <div>
            <h4 className="font-medium mb-2">Select AI Providers</h4>
            <div className="flex flex-wrap gap-2">
              {(['openai', 'anthropic', 'gemini', 'xai'] as AIProvider[]).map(provider => (
                <Button
                  key={provider}
                  variant={selectedProviders.includes(provider) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleProviderToggle(provider)}
                  disabled={isAnalyzing}
                >
                  {provider}
                </Button>
              ))}
            </div>
          </div>

          {/* Start Analysis Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleStartAnalysis}
              disabled={isLoading || isAnalyzing || selectedProviders.length === 0}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Start Background Analysis
            </Button>
            <Button
              variant="outline"
              onClick={reset}
              disabled={isAnalyzing}
            >
              Reset
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Job Status */}
      {jobId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Job Status
              {getStatusIcon()}
            </CardTitle>
            <CardDescription>
              Job ID: {jobId}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor()}>
                {jobStatus?.status || 'Unknown'}
              </Badge>
              {jobStatus && (
                <span className="text-sm text-gray-600">
                  Attempt {jobStatus.attempts} of {jobStatus.maxAttempts}
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>

            {/* Timestamps */}
            {jobStatus && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                {jobStatus.startedAt && (
                  <div>
                    <span className="font-medium">Started:</span>
                    <div className="text-gray-600">
                      {new Date(jobStatus.startedAt).toLocaleString()}
                    </div>
                  </div>
                )}
                {jobStatus.completedAt && (
                  <div>
                    <span className="font-medium">Completed:</span>
                    <div className="text-gray-600">
                      {new Date(jobStatus.completedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error Details */}
            {jobStatus?.error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{jobStatus.error}</AlertDescription>
              </Alert>
            )}

            {/* Results */}
            {hasResult && (
              <div>
                <h4 className="font-medium mb-2">Analysis Results</h4>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-40">
                  {JSON.stringify(jobStatus?.result, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default BackgroundAnalysisDemo