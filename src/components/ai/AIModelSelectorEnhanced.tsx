'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AIModel } from '@/types'
import { useAIStore } from '@/stores'
import { Eye, EyeOff, Key, CheckCircle, XCircle, Loader2 } from 'lucide-react'

const AI_MODELS: { id: AIModel; name: string; description: string }[] = [
  {
    id: 'openai',
    name: 'OpenAI GPT-4',
    description: 'Advanced language model with strong reasoning capabilities'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Constitutional AI with focus on helpfulness and safety'
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    description: 'Real-time AI with access to current information'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Multimodal AI with strong analytical capabilities'
  }
]

const AIModelSelectorEnhanced = memo(() => {
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  const [tempApiKeys, setTempApiKeys] = useState<Record<string, string>>({})

  const {
    apiKeys,
    activeModels,
    usage,
    isValidating,
    validationErrors,
    updateApiKey,
    removeApiKey,
    validateApiKey,
    toggleModel,
    hasValidKey,
    isModelActive,
    getActiveModelsWithKeys
  } = useAIStore()

  const handleApiKeyChange = useCallback((model: AIModel, key: string) => {
    setTempApiKeys(prev => ({ ...prev, [model]: key }))
  }, [])

  const handleApiKeySave = useCallback(async (model: AIModel) => {
    const key = tempApiKeys[model]
    if (!key) return

    updateApiKey(model, key)
    const isValid = await validateApiKey(model, key)
    
    if (isValid) {
      setTempApiKeys(prev => {
        const newKeys = { ...prev }
        delete newKeys[model]
        return newKeys
      })
      setShowApiKeys(prev => ({ ...prev, [model]: false }))
    }
  }, [tempApiKeys, updateApiKey, validateApiKey])

  const handleApiKeyRemove = useCallback((model: AIModel) => {
    removeApiKey(model)
    setTempApiKeys(prev => {
      const newKeys = { ...prev }
      delete newKeys[model]
      return newKeys
    })
  }, [removeApiKey])

  const toggleApiKeyVisibility = useCallback((model: AIModel) => {
    setShowApiKeys(prev => ({ ...prev, [model]: !prev[model] }))
    if (!showApiKeys[model]) {
      setTempApiKeys(prev => ({ ...prev, [model]: apiKeys[model] || '' }))
    }
  }, [showApiKeys, apiKeys])

  const activeModelsWithKeys = useMemo(() => getActiveModelsWithKeys(), [getActiveModelsWithKeys])
  
  const totalUsageCost = useMemo(() => 
    Object.values(usage).reduce((sum, u) => sum + u.estimatedCost, 0),
    [usage]
  )

  return (
    <div className="space-y-6" role="region" aria-labelledby="ai-config-title">
      <div className="flex items-center justify-between">
        <div>
          <h3 id="ai-config-title" className="text-lg font-semibold">AI Model Configuration</h3>
          <p className="text-sm text-gray-600" id="ai-config-description">
            Configure API keys and select which models to use for analysis
          </p>
        </div>
        <Badge variant="outline" aria-label={`${activeModelsWithKeys.length} active models`}>
          {activeModelsWithKeys.length} active
        </Badge>
      </div>

      <div className="grid gap-4">
        {AI_MODELS.map((model) => {
          const hasKey = !!apiKeys[model.id]
          const isValid = hasValidKey(model.id)
          const isActive = isModelActive(model.id)
          const modelUsage = usage[model.id]
          const hasError = !!validationErrors[model.id]
          const isShowingKey = showApiKeys[model.id]
          const tempKey = tempApiKeys[model.id]

          return (
            <Card key={model.id} className="relative" role="article" aria-labelledby={`model-title-${model.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2" id={`model-title-${model.id}`}>
                      {model.name}
                      {isValid && (
                        <CheckCircle className="w-4 h-4 text-green-500" aria-label="Valid configuration" />
                      )}
                      {hasError && (
                        <XCircle className="w-4 h-4 text-red-500" aria-label="Configuration error" />
                      )}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1" id={`model-desc-${model.id}`}>
                      {model.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => toggleModel(model.id)}
                      disabled={!isValid}
                      aria-label={`Enable ${model.name} model`}
                      aria-describedby={`model-desc-${model.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleApiKeyVisibility(model.id)}
                      aria-label={isShowingKey ? `Hide ${model.name} API key` : `Show ${model.name} API key`}
                      aria-expanded={isShowingKey}
                      aria-controls={`api-key-section-${model.id}`}
                    >
                      {isShowingKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* API Key Management */}
                {isShowingKey && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg" id={`api-key-section-${model.id}`} role="group" aria-labelledby={`${model.id}-key-label`}>
                    <Label htmlFor={`${model.id}-key`} className="text-sm font-medium" id={`${model.id}-key-label`}>
                      API Key
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={`${model.id}-key`}
                        type="password"
                        placeholder="Enter API key..."
                        value={tempKey || ''}
                        onChange={(e) => handleApiKeyChange(model.id, e.target.value)}
                        className={hasError ? 'border-red-300' : ''}
                        aria-describedby={hasError ? `${model.id}-error` : undefined}
                        aria-invalid={hasError}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleApiKeySave(model.id)}
                        disabled={!tempKey || isValidating}
                        aria-label={`Save ${model.name} API key`}
                      >
                        {isValidating ? (
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Key className="w-4 h-4" aria-hidden="true" />
                        )}
                        <span className="sr-only">
                          {isValidating ? 'Validating...' : 'Save API key'}
                        </span>
                      </Button>
                      {hasKey && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleApiKeyRemove(model.id)}
                          aria-label={`Remove ${model.name} API key`}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    {hasError && (
                      <p className="text-sm text-red-600" id={`${model.id}-error`} role="alert">
                        {validationErrors[model.id]}
                      </p>
                    )}
                  </div>
                )}

                {/* Usage Statistics */}
                {modelUsage && (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Tokens Used</div>
                      <div className="font-medium">{modelUsage.tokensUsed.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Requests</div>
                      <div className="font-medium">{modelUsage.requestCount}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Est. Cost</div>
                      <div className="font-medium">${modelUsage.estimatedCost.toFixed(4)}</div>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    isActive && isValid ? 'bg-green-500' : 
                    hasKey ? 'bg-yellow-500' : 'bg-gray-300'
                  }`} />
                  <span className="text-gray-600">
                    {isActive && isValid ? 'Active' : 
                     hasKey ? 'Configured' : 'Not configured'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Active Models</div>
              <div className="font-medium">{activeModelsWithKeys.length} of {AI_MODELS.length}</div>
            </div>
            <div>
              <div className="text-gray-600">Total Usage</div>
              <div className="font-medium">
                ${totalUsageCost.toFixed(4)}
              </div>
            </div>
          </div>
          
          {activeModelsWithKeys.length === 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                No active models configured. Add API keys and enable models to start analyzing papers.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})

AIModelSelectorEnhanced.displayName = 'AIModelSelectorEnhanced'

export { AIModelSelectorEnhanced }