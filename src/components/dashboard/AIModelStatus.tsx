'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Settings, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { AIModel, UsageStats } from '@/types'

interface AIModelStatusProps {
  apiKeys: Record<string, string>
  activeModels: Set<string>
  usageStats: Record<string, UsageStats>
  onConfigureClick: () => void
  isLoading?: boolean
}

const MODEL_INFO = {
  openai: { name: 'OpenAI', color: 'bg-green-500' },
  anthropic: { name: 'Anthropic', color: 'bg-orange-500' },
  xai: { name: 'xAI', color: 'bg-blue-500' },
  gemini: { name: 'Gemini', color: 'bg-purple-500' }
}

export function AIModelStatus({ 
  apiKeys, 
  activeModels, 
  usageStats, 
  onConfigureClick,
  isLoading = false 
}: AIModelStatusProps) {
  const getModelStatus = (model: AIModel) => {
    const hasApiKey = Boolean(apiKeys[model])
    const isActive = activeModels.has(model)
    
    if (!hasApiKey) return { status: 'not_configured', icon: XCircle, color: 'text-red-500' }
    if (!isActive) return { status: 'inactive', icon: AlertCircle, color: 'text-yellow-500' }
    return { status: 'active', icon: CheckCircle, color: 'text-green-500' }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="h-5 bg-slate-200 rounded w-32 mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-48"></div>
            </div>
            <div className="h-8 w-20 bg-slate-200 rounded"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-slate-200 rounded"></div>
                  <div className="h-4 bg-slate-200 rounded w-20"></div>
                </div>
                <div className="h-6 w-16 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AI Models</CardTitle>
            <CardDescription>Status and usage of AI analysis services</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onConfigureClick}>
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(Object.keys(MODEL_INFO) as AIModel[]).map((model) => {
            const modelInfo = MODEL_INFO[model]
            const { status, icon: StatusIcon, color } = getModelStatus(model)
            const usage = usageStats[model]
            
            return (
              <div key={model} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 ${modelInfo.color} rounded flex items-center justify-center`}>
                    <span className="text-white text-xs font-bold">
                      {modelInfo.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{modelInfo.name}</p>
                    {usage && (
                      <p className="text-xs text-muted-foreground">
                        {usage.requestCount} requests, ${usage.estimatedCost.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <StatusIcon className={`h-4 w-4 ${color}`} />
                  <Badge 
                    variant={status === 'active' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {status === 'active' ? 'Active' : 
                     status === 'inactive' ? 'Inactive' : 'Not Configured'}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}