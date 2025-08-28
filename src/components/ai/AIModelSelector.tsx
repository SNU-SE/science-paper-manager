'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { AIProvider, AIServiceFactory } from '@/services/ai/AIServiceFactory'
import { CheckCircle, XCircle, Loader2, Key, Settings } from 'lucide-react'

export interface AIModelSelectorProps {
  selectedModels: AIProvider[]
  onSelectionChange: (models: AIProvider[]) => void
  apiKeys: Record<string, string>
  onApiKeyUpdate: (provider: AIProvider, key: string) => void
  onApiKeyValidate?: (provider: AIProvider, key: string) => Promise<boolean>
}

interface ModelStatus {
  provider: AIProvider
  isEnabled: boolean
  hasValidKey: boolean
  isValidating: boolean
  validationError?: string
  modelName: string
}

export function AIModelSelector({
  selectedModels,
  onSelectionChange,
  apiKeys,
  onApiKeyUpdate,
  onApiKeyValidate
}: AIModelSelectorProps) {
  const [modelStatuses, setModelStatuses] = useState<ModelStatus[]>([])
  const [tempApiKeys, setTempApiKeys] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'selection' | 'configuration'>('selection')

  // Initialize model statuses
  useEffect(() => {
    const providers = AIServiceFactory.getAvailableProviders()
    const defaultModels = AIServiceFactory.getDefaultModels()
    
    const statuses: ModelStatus[] = providers.map(provider => ({
      provider,
      isEnabled: selectedModels.includes(provider),
      hasValidKey: Boolean(apiKeys[provider]),
      isValidating: false,
      modelName: defaultModels[provider]
    }))
    
    setModelStatuses(statuses)
    setTempApiKeys({ ...apiKeys })
  }, [selectedModels, apiKeys])

  const handleModelToggle = (provider: AIProvider) => {
    const newSelection = selectedModels.includes(provider)
      ? selectedModels.filter(p => p !== provider)
      : [...selectedModels, provider]
    
    onSelectionChange(newSelection)
  }

  const handleApiKeyChange = (provider: AIProvider, key: string) => {
    setTempApiKeys(prev => ({ ...prev, [provider]: key }))
  }

  const handleApiKeySave = async (provider: AIProvider) => {
    const key = tempApiKeys[provider]
    if (!key) return

    // Update validation status
    setModelStatuses(prev => prev.map(status => 
      status.provider === provider 
        ? { ...status, isValidating: true, validationError: undefined }
        : status
    ))

    try {
      let isValid = true
      if (onApiKeyValidate) {
        isValid = await onApiKeyValidate(provider, key)
      } else {
        // Fallback validation using factory
        isValid = await AIServiceFactory.validateApiKey(provider, key)
      }

      if (isValid) {
        onApiKeyUpdate(provider, key)
        setModelStatuses(prev => prev.map(status => 
          status.provider === provider 
            ? { ...status, hasValidKey: true, isValidating: false }
            : status
        ))
      } else {
        setModelStatuses(prev => prev.map(status => 
          status.provider === provider 
            ? { 
                ...status, 
                hasValidKey: false, 
                isValidating: false,
                validationError: 'Invalid API key'
              }
            : status
        ))
      }
    } catch (error) {
      setModelStatuses(prev => prev.map(status => 
        status.provider === provider 
          ? { 
              ...status, 
              hasValidKey: false, 
              isValidating: false,
              validationError: error instanceof Error ? error.message : 'Validation failed'
            }
          : status
      ))
    }
  }

  const getProviderDisplayName = (provider: AIProvider): string => {
    const names: Record<AIProvider, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      xai: 'xAI',
      gemini: 'Google Gemini'
    }
    return names[provider]
  }

  const getProviderDescription = (provider: AIProvider): string => {
    const descriptions: Record<AIProvider, string> = {
      openai: 'GPT models for comprehensive analysis',
      anthropic: 'Claude models for detailed reasoning',
      xai: 'Grok models for innovative insights',
      gemini: 'Gemini models for multimodal analysis'
    }
    return descriptions[provider]
  }

  const enabledModelsCount = modelStatuses.filter(s => s.isEnabled && s.hasValidKey).length
  const totalModelsCount = modelStatuses.length

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          AI Model Configuration
        </CardTitle>
        <CardDescription>
          Configure and select AI models for paper analysis. 
          {enabledModelsCount > 0 && (
            <span className="ml-2">
              <Badge variant="secondary">
                {enabledModelsCount}/{totalModelsCount} models active
              </Badge>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'selection' | 'configuration')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="selection">Model Selection</TabsTrigger>
            <TabsTrigger value="configuration">API Configuration</TabsTrigger>
          </TabsList>
          
          <TabsContent value="selection" className="space-y-4">
            <div className="grid gap-4">
              {modelStatuses.map((status) => (
                <Card key={status.provider} className="relative">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Switch
                          checked={status.isEnabled}
                          onCheckedChange={() => handleModelToggle(status.provider)}
                          disabled={!status.hasValidKey}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">
                              {getProviderDisplayName(status.provider)}
                            </h3>
                            {status.hasValidKey ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {getProviderDescription(status.provider)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Model: {status.modelName}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {status.isEnabled && (
                          <Badge variant="default">Selected</Badge>
                        )}
                        {!status.hasValidKey && (
                          <Badge variant="destructive">No API Key</Badge>
                        )}
                      </div>
                    </div>
                    
                    {!status.hasValidKey && (
                      <Alert className="mt-3">
                        <Key className="h-4 w-4" />
                        <AlertDescription>
                          API key required. Configure in the API Configuration tab.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {enabledModelsCount === 0 && (
              <Alert>
                <AlertDescription>
                  No models are currently active. Configure API keys and enable models to start analysis.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="configuration" className="space-y-4">
            <div className="grid gap-4">
              {modelStatuses.map((status) => (
                <Card key={status.provider}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {getProviderDisplayName(status.provider)}
                      {status.hasValidKey && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`${status.provider}-key`}>API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`${status.provider}-key`}
                          type="password"
                          placeholder="Enter API key..."
                          value={tempApiKeys[status.provider] || ''}
                          onChange={(e) => handleApiKeyChange(status.provider, e.target.value)}
                        />
                        <Button
                          onClick={() => handleApiKeySave(status.provider)}
                          disabled={!tempApiKeys[status.provider] || status.isValidating}
                          size="sm"
                        >
                          {status.isValidating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {status.validationError && (
                      <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>{status.validationError}</AlertDescription>
                      </Alert>
                    )}
                    
                    {status.hasValidKey && !status.validationError && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>API key is valid and ready to use</AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="text-xs text-muted-foreground">
                      Model: {status.modelName}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}